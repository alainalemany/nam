"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EquipmentFuelPersistenceError,
  persistEquipmentFuelEvent,
  saveFuelServicePersonReference,
} from "./persistence";
import { getTankLabelSuggestionsForEquipment } from "./data";
import {
  emptyEquipmentFuelActionState,
  equipmentFuelEventSubmissionSchema,
  equipmentFuelFieldErrors,
  equipmentFuelSubmittedValues,
  fuelServicePersonSchema,
  type EquipmentFuelActionState,
} from "./validation";

function parsePayload(formData: FormData): unknown {
  const payload = formData.get("payload");
  if (typeof payload !== "string") return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

export async function getEquipmentFuelTankLabelSuggestionsAction(
  equipmentId: string,
) {
  return getTankLabelSuggestionsForEquipment(equipmentId);
}

function inputState(formData: FormData):
  | {
      ok: true;
      data: ReturnType<typeof equipmentFuelEventSubmissionSchema.parse>;
      values: NonNullable<EquipmentFuelActionState["values"]>;
    }
  | { ok: false; state: EquipmentFuelActionState } {
  const payload = parsePayload(formData);
  const values = equipmentFuelSubmittedValues(payload);
  const parsed = equipmentFuelEventSubmissionSchema.safeParse(payload);
  if (parsed.success) {
    if (values) return { ok: true, data: parsed.data, values };
    return {
      ok: false,
      state: {
        status: "error",
        message: "The submitted Fuel Event could not be read. Review the fields and try again.",
        fieldErrors: {},
      },
    };
  }
  return {
    ok: false,
    state: {
      status: "error",
      message: "Check the highlighted Fuel Event fields and try again.",
      fieldErrors: equipmentFuelFieldErrors(parsed.error),
      values,
    },
  };
}

function persistenceState(
  error: unknown,
  values: NonNullable<EquipmentFuelActionState["values"]>,
): EquipmentFuelActionState {
  if (error instanceof EquipmentFuelPersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
      values,
    };
  }
  return {
    ...emptyEquipmentFuelActionState,
    status: "error",
    message: "The Fuel Event could not be saved. Review the fields and try again.",
    values,
  };
}

export async function createEquipmentFuelEventAction(
  _previousState: EquipmentFuelActionState,
  formData: FormData,
) {
  const parsed = inputState(formData);
  if (!parsed.ok) return parsed.state;
  let id: string;
  try {
    id = (await persistEquipmentFuelEvent(parsed.data)).id;
  } catch (error) {
    return persistenceState(error, parsed.values);
  }
  revalidatePath("/");
  revalidatePath("/equipment-fuel-events");
  redirect(`/equipment-fuel-events/${id}`);
}

export async function correctEquipmentFuelEventAction(
  eventId: string,
  _previousState: EquipmentFuelActionState,
  formData: FormData,
) {
  const parsed = inputState(formData);
  if (!parsed.ok) return parsed.state;
  try {
    await persistEquipmentFuelEvent(parsed.data, eventId);
  } catch (error) {
    return persistenceState(error, parsed.values);
  }
  revalidatePath("/equipment-fuel-events");
  revalidatePath(`/equipment-fuel-events/${eventId}`);
  redirect(`/equipment-fuel-events/${eventId}`);
}

const referenceInitialState = { ok: true, message: "" };
export type FuelServicePersonActionState = typeof referenceInitialState;

export async function saveFuelServicePersonAction(
  id: string | null,
  _previousState: FuelServicePersonActionState,
  formData: FormData,
) {
  const parsed = fuelServicePersonSchema.safeParse({
    displayName: formData.get("displayName"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid Fuel Service Person." };
  try {
    await saveFuelServicePersonReference(parsed.data, id ?? undefined);
  } catch (error) {
    const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    return { ok: false, message: duplicate ? "That Fuel Service Person already exists." : "Fuel Service Person could not be saved." };
  }
  revalidatePath("/equipment-fuel-events/service-personnel");
  revalidatePath("/equipment-fuel-events/new");
  return { ok: true, message: "Fuel Service Person saved." };
}
