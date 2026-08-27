"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyEquipmentFormState,
  equipmentEditFormSchema,
  equipmentFormValues,
  equipmentFormSchema,
  type EquipmentEditFormInput,
  type EquipmentFormInput,
  type EquipmentFormState,
  type EquipmentFormValues,
} from "./validation";

type EquipmentSubmissionInput = EquipmentFormInput | EquipmentEditFormInput;

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

class MineSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MineSelectionError";
  }
}

class EquipmentNotFoundError extends Error {}

class EquipmentNumberConflictError extends Error {
  constructor(
    readonly equipmentNumber: string,
    readonly displayName: string,
    readonly mineName: string,
  ) {
    super(
      `Equipment #${equipmentNumber} already exists as ${displayName} at ${mineName}.`,
    );
    this.name = "EquipmentNumberConflictError";
  }
}

function equipmentWriteData(input: EquipmentSubmissionInput) {
  return {
    mineId: input.mineId,
    displayName: input.displayName,
    equipmentNumber: asNullable(input.equipmentNumber),
    category: input.category,
    make: asNullable(input.make),
    model: asNullable(input.model),
    powerType: input.powerType || null,
    instrumentationType: input.instrumentationType || null,
    hasDigitalAlarmScreen: input.hasDigitalAlarmScreen,
    status: input.status,
    notes: asNullable(input.notes),
  };
}

function duplicateEquipmentNumberState(
  values: EquipmentFormValues,
  conflict?: EquipmentNumberConflictError,
): EquipmentFormState {
  return {
    status: "error",
    message:
      conflict?.message ??
      `Equipment #${values.equipmentNumber.trim()} is already assigned to another Equipment record.`,
    fieldErrors: {
      equipmentNumber: ["Enter a different Equipment Number."],
    },
    values,
  };
}

function errorState(
  message: string,
  values: EquipmentFormValues,
): EquipmentFormState {
  return {
    ...emptyEquipmentFormState,
    status: "error",
    message,
    values,
  };
}

function mineErrorState(
  message: string,
  values: EquipmentFormValues,
): EquipmentFormState {
  return {
    status: "error",
    message: "The selected Mine is not available.",
    fieldErrors: { mineId: [message] },
    values,
  };
}

function validationState(
  fieldErrors: EquipmentFormState["fieldErrors"],
  values: EquipmentFormValues,
): EquipmentFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
    values,
  };
}

function parseCreateFormData(formData: FormData):
  | { ok: true; data: EquipmentFormInput }
  | { ok: false; state: EquipmentFormState } {
  const parsed = equipmentFormSchema.safeParse(Object.fromEntries(formData));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        state: validationState(
          parsed.error.flatten().fieldErrors,
          equipmentFormValues(formData),
        ),
      };
}

function parseEditFormData(formData: FormData):
  | { ok: true; data: EquipmentEditFormInput }
  | { ok: false; state: EquipmentFormState } {
  const parsed = equipmentEditFormSchema.safeParse(Object.fromEntries(formData));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        state: validationState(
          parsed.error.flatten().fieldErrors,
          equipmentFormValues(formData),
        ),
      };
}

function targetMatches(
  target: unknown,
  constraint: string,
  fields: readonly string[],
) {
  if (target === constraint) {
    return true;
  }

  return (
    Array.isArray(target) &&
    target.length === fields.length &&
    fields.every((field) => target.includes(field))
  );
}

function persistenceErrorState(
  error: unknown,
  operation: "created" | "updated",
  values: EquipmentFormValues,
): EquipmentFormState {
  if (error instanceof MineSelectionError) {
    return mineErrorState(error.message, values);
  }

  if (error instanceof EquipmentNotFoundError) {
    return errorState(
      "Equipment could not be found. Reload the Equipment list and try again.",
      values,
    );
  }

  if (error instanceof EquipmentNumberConflictError) {
    return duplicateEquipmentNumberState(values, error);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return errorState(
        "Equipment could not be found. Reload the Equipment list and try again.",
        values,
      );
    }

    if (error.code === "P2034") {
      return errorState(
        "Reference data changed while Equipment was being saved. Try again.",
        values,
      );
    }

    if (error.code === "P2003") {
      return mineErrorState("Select an existing Mine and try again.", values);
    }

    if (
      error.code === "P2002" &&
      targetMatches(
        error.meta?.target,
        "Equipment_equipmentNumber_key",
        ["equipmentNumber"],
      )
    ) {
      return duplicateEquipmentNumberState(values);
    }
  }

  return errorState(
    `Equipment could not be ${operation}. Review the fields and try again.`,
    values,
  );
}

async function validateEquipmentNumber(
  transaction: Prisma.TransactionClient,
  equipmentNumber: string | undefined,
  retainedEquipmentId?: string,
) {
  if (!equipmentNumber) {
    return;
  }

  const conflict = await transaction.equipment.findFirst({
    where: {
      equipmentNumber,
      ...(retainedEquipmentId ? { id: { not: retainedEquipmentId } } : {}),
    },
    select: {
      displayName: true,
      equipmentNumber: true,
      mine: { select: { name: true } },
    },
  });

  if (conflict?.equipmentNumber) {
    throw new EquipmentNumberConflictError(
      conflict.equipmentNumber,
      conflict.displayName,
      conflict.mine.name,
    );
  }
}

async function validateMineSelection(
  transaction: Prisma.TransactionClient,
  mineId: string,
  retainedMineId?: string,
) {
  const mine = await transaction.mine.findUnique({
    where: { id: mineId },
    select: { id: true, status: true },
  });

  if (!mine) {
    throw new MineSelectionError("Select an existing Mine and try again.");
  }

  if (mine.status !== "ACTIVE" && mine.id !== retainedMineId) {
    throw new MineSelectionError("Select an active Mine.");
  }
}

const serializableTransaction = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export async function createEquipmentAction(
  _previousState: EquipmentFormState,
  formData: FormData,
) {
  const values = equipmentFormValues(formData);
  const input = parseCreateFormData(formData);
  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await validateMineSelection(transaction, input.data.mineId);
      await validateEquipmentNumber(transaction, input.data.equipmentNumber);
      await transaction.equipment.create({
        data: equipmentWriteData(input.data),
      });
    }, serializableTransaction);
  } catch (error) {
    return persistenceErrorState(error, "created", values);
  }

  revalidatePath("/");
  revalidatePath("/equipment");
  redirect("/equipment");
}

export async function updateEquipmentAction(
  equipmentId: string,
  _previousState: EquipmentFormState,
  formData: FormData,
) {
  const values = equipmentFormValues(formData);
  const input = parseEditFormData(formData);
  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const equipment = await transaction.equipment.findUnique({
        where: { id: equipmentId },
        select: { mineId: true },
      });
      if (!equipment) {
        throw new EquipmentNotFoundError();
      }

      await validateMineSelection(transaction, input.data.mineId, equipment.mineId);
      await validateEquipmentNumber(
        transaction,
        input.data.equipmentNumber,
        equipmentId,
      );
      await transaction.equipment.update({
        where: { id: equipmentId },
        data: equipmentWriteData(input.data),
      });
    }, serializableTransaction);
  } catch (error) {
    return persistenceErrorState(error, "updated", values);
  }

  revalidatePath("/");
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equipmentId}/edit`);
  redirect("/equipment");
}
