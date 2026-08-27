"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyEquipmentFormState,
  equipmentEditFormSchema,
  equipmentFormSchema,
  type EquipmentEditFormInput,
  type EquipmentFormInput,
  type EquipmentFormState,
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

function duplicateEquipmentState(): EquipmentFormState {
  return {
    status: "error",
    message: "An equipment record with this display name already exists for the selected mine.",
    fieldErrors: {
      displayName: ["Use a unique display name for this mine."],
    },
  };
}

function errorState(message: string): EquipmentFormState {
  return {
    ...emptyEquipmentFormState,
    status: "error",
    message,
  };
}

function mineErrorState(message: string): EquipmentFormState {
  return {
    status: "error",
    message: "The selected Mine is not available.",
    fieldErrors: { mineId: [message] },
  };
}

function validationState(
  fieldErrors: EquipmentFormState["fieldErrors"],
): EquipmentFormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

function parseCreateFormData(formData: FormData):
  | { ok: true; data: EquipmentFormInput }
  | { ok: false; state: EquipmentFormState } {
  const parsed = equipmentFormSchema.safeParse(Object.fromEntries(formData));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, state: validationState(parsed.error.flatten().fieldErrors) };
}

function parseEditFormData(formData: FormData):
  | { ok: true; data: EquipmentEditFormInput }
  | { ok: false; state: EquipmentFormState } {
  const parsed = equipmentEditFormSchema.safeParse(Object.fromEntries(formData));
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, state: validationState(parsed.error.flatten().fieldErrors) };
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
): EquipmentFormState {
  if (error instanceof MineSelectionError) {
    return mineErrorState(error.message);
  }

  if (error instanceof EquipmentNotFoundError) {
    return errorState("Equipment could not be found. Reload the Equipment list and try again.");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return errorState("Equipment could not be found. Reload the Equipment list and try again.");
    }

    if (error.code === "P2034") {
      return errorState("Reference data changed while Equipment was being saved. Try again.");
    }

    if (error.code === "P2003") {
      return mineErrorState("Select an existing Mine and try again.");
    }

    if (
      error.code === "P2002" &&
      targetMatches(
        error.meta?.target,
        "Equipment_mineId_displayName_key",
        ["mineId", "displayName"],
      )
    ) {
      return duplicateEquipmentState();
    }
  }

  return errorState(
    `Equipment could not be ${operation}. Review the fields and try again.`,
  );
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
  const input = parseCreateFormData(formData);
  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await validateMineSelection(transaction, input.data.mineId);
      await transaction.equipment.create({
        data: equipmentWriteData(input.data),
      });
    }, serializableTransaction);
  } catch (error) {
    return persistenceErrorState(error, "created");
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
      await transaction.equipment.update({
        where: { id: equipmentId },
        data: equipmentWriteData(input.data),
      });
    }, serializableTransaction);
  } catch (error) {
    return persistenceErrorState(error, "updated");
  }

  revalidatePath("/");
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equipmentId}/edit`);
  redirect("/equipment");
}
