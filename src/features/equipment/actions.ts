"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  cityStateSchema,
  emptyEquipmentFormState,
  equipmentEditFormSchema,
  equipmentFormSchema,
  mineTypeSchema,
  type EquipmentEditFormInput,
  type EquipmentFormInput,
  type EquipmentFormState,
} from "./validation";

type EquipmentSubmissionInput = EquipmentFormInput | EquipmentEditFormInput;
type ReferenceInput = Pick<
  EquipmentEditFormInput,
  "cityName" | "cityState" | "mineName" | "mineType"
>;

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function sameName(left: string, right: string) {
  return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

class ReferenceResolutionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: EquipmentFormState["fieldErrors"],
  ) {
    super(message);
    this.name = "ReferenceResolutionError";
  }
}

class EquipmentNotFoundError extends Error {}

function cityConflictError(): ReferenceResolutionError {
  return new ReferenceResolutionError(
    "The City name matches shared reference data with different, missing, or ambiguous State information.",
    {
      cityState: [
        "Shared City State cannot be corrected from an Equipment form. Use the controlled reference-data process, or use a different City name only for a genuine reassignment.",
      ],
    },
  );
}

function ambiguousCityError(): ReferenceResolutionError {
  return new ReferenceResolutionError(
    "Multiple shared City records match this name.",
    {
      cityName: [
        "The City name is ambiguous after case-insensitive matching. Resolve the shared reference data before saving Equipment.",
      ],
    },
  );
}

function mineConflictError(): ReferenceResolutionError {
  return new ReferenceResolutionError(
    "The Mine name matches shared reference data with different, missing, or ambiguous Mine Type information.",
    {
      mineType: [
        "Shared Mine Type cannot be corrected from an Equipment form. Use the controlled reference-data process, or use a different Mine name only for a genuine reassignment.",
      ],
    },
  );
}

function ambiguousMineError(): ReferenceResolutionError {
  return new ReferenceResolutionError(
    "Multiple shared Mine records match this name.",
    {
      mineName: [
        "The Mine name is ambiguous after case-insensitive matching. Resolve the shared reference data before saving Equipment.",
      ],
    },
  );
}

function controlledAssignmentError(
  field: "cityState" | "mineType",
): ReferenceResolutionError {
  const isCityState = field === "cityState";
  return new ReferenceResolutionError(
    "A new Equipment assignment requires controlled reference values.",
    {
      [field]: [
        isCityState
          ? "Choose a controlled State for a genuine City reassignment. The stored shared City value may only be retained unchanged."
          : "Choose a controlled Mine Type for a genuine Mine reassignment. The stored shared Mine value may only be retained unchanged.",
      ],
    },
  );
}

async function resolveCity(
  transaction: Prisma.TransactionClient,
  input: ReferenceInput,
) {
  const candidates = await transaction.city.findMany({
    where: {
      name: {
        equals: input.cityName,
        mode: "insensitive",
      },
    },
    take: 2,
  });

  if (candidates.length > 1) {
    throw ambiguousCityError();
  }

  const existingCity = candidates[0];
  if (existingCity) {
    if (existingCity.state !== input.cityState) {
      throw cityConflictError();
    }

    return existingCity;
  }

  return transaction.city.create({
    data: {
      name: input.cityName,
      state: input.cityState,
    },
  });
}

async function resolveMine(
  transaction: Prisma.TransactionClient,
  input: ReferenceInput,
  cityId: string,
) {
  const candidates = await transaction.mine.findMany({
    where: {
      cityId,
      name: {
        equals: input.mineName,
        mode: "insensitive",
      },
    },
    take: 2,
  });

  if (candidates.length > 1) {
    throw ambiguousMineError();
  }

  const existingMine = candidates[0];
  if (existingMine) {
    if (existingMine.type !== input.mineType) {
      throw mineConflictError();
    }

    return existingMine;
  }

  return transaction.mine.create({
    data: {
      cityId,
      name: input.mineName,
      type: input.mineType,
    },
  });
}

function equipmentWriteData(input: EquipmentSubmissionInput, mineId: string) {
  return {
    mineId,
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
  if (error instanceof ReferenceResolutionError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.fieldErrors,
    };
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

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (
        targetMatches(
          target,
          "Equipment_mineId_displayName_key",
          ["mineId", "displayName"],
        )
      ) {
        return duplicateEquipmentState();
      }

      if (targetMatches(target, "City_name_state_key", ["name", "state"])) {
        return {
          status: "error",
          message: "An equivalent City was created while Equipment was being saved.",
          fieldErrors: {
            cityName: ["Retry so the existing shared City can be resolved safely."],
            cityState: ["The City was not duplicated and no Equipment change was saved."],
          },
        };
      }

      if (targetMatches(target, "Mine_cityId_name_key", ["cityId", "name"])) {
        return {
          status: "error",
          message: "An equivalent Mine was created while Equipment was being saved.",
          fieldErrors: {
            mineName: ["Retry so the existing shared Mine can be resolved safely."],
            mineType: ["The Mine was not duplicated and no Equipment change was saved."],
          },
        };
      }

      return errorState(
        "Equipment could not be saved because related reference data changed. Reload and try again.",
      );
    }
  }

  return errorState(
    `Equipment could not be ${operation}. Review the fields and try again.`,
  );
}

function throwReferenceCorrectionErrors(
  cityStateChanged: boolean,
  mineTypeChanged: boolean,
): never {
  const fieldErrors: EquipmentFormState["fieldErrors"] = {};
  if (cityStateChanged) {
    fieldErrors.cityState = [
      "Shared City State cannot be corrected from an Equipment form. Keep the stored value for this assignment or use the controlled reference-data process.",
    ];
  }
  if (mineTypeChanged) {
    fieldErrors.mineType = [
      "Shared Mine Type cannot be corrected from an Equipment form. Keep the stored value for this assignment or use the controlled reference-data process.",
    ];
  }

  throw new ReferenceResolutionError(
    "Equipment changes cannot correct shared City or Mine reference data.",
    fieldErrors,
  );
}

async function mineForEquipmentUpdate(
  transaction: Prisma.TransactionClient,
  equipmentId: string,
  input: EquipmentEditFormInput,
) {
  const existingEquipment = await transaction.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
    },
  });

  if (!existingEquipment) {
    throw new EquipmentNotFoundError();
  }

  const currentCityNameMatches = sameName(
    input.cityName,
    existingEquipment.mine.city.name,
  );
  const currentCityStateMatches =
    input.cityState === (existingEquipment.mine.city.state ?? "");
  const currentMineNameMatches = sameName(
    input.mineName,
    existingEquipment.mine.name,
  );
  const currentMineTypeMatches =
    input.mineType === (existingEquipment.mine.type ?? "");

  if (
    currentCityNameMatches &&
    currentCityStateMatches &&
    currentMineNameMatches &&
    currentMineTypeMatches
  ) {
    return existingEquipment.mine;
  }

  const cityStateCorrection = currentCityNameMatches && !currentCityStateMatches;
  const mineTypeCorrection =
    currentCityNameMatches && currentMineNameMatches && !currentMineTypeMatches;
  if (cityStateCorrection || mineTypeCorrection) {
    throwReferenceCorrectionErrors(cityStateCorrection, mineTypeCorrection);
  }

  let city = existingEquipment.mine.city;
  if (!currentCityNameMatches || !currentCityStateMatches) {
    if (!cityStateSchema.safeParse(input.cityState).success) {
      throw controlledAssignmentError("cityState");
    }
    city = await resolveCity(transaction, input);
  }

  if (city.id === existingEquipment.mine.city.id && currentMineNameMatches) {
    return existingEquipment.mine;
  }

  if (!mineTypeSchema.safeParse(input.mineType).success) {
    throw controlledAssignmentError("mineType");
  }

  return resolveMine(transaction, input, city.id);
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
      const city = await resolveCity(transaction, input.data);
      const mine = await resolveMine(transaction, input.data, city.id);
      await transaction.equipment.create({
        data: equipmentWriteData(input.data, mine.id),
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
      const mine = await mineForEquipmentUpdate(transaction, equipmentId, input.data);
      await transaction.equipment.update({
        where: { id: equipmentId },
        data: equipmentWriteData(input.data, mine.id),
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
