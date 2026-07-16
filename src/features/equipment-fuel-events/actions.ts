"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EquipmentFuelPersistenceError,
  persistEquipmentFuelEvent,
  saveFuelServicePersonReference,
} from "./persistence";
import { getEquipmentFuelFormContext } from "./data";
import {
  emptyEquipmentFuelActionState,
  equipmentFuelEventSubmissionSchema,
  equipmentFuelFieldErrors,
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

export async function getEquipmentFuelFormContextAction(
  operationalWorkDate: string,
  equipmentId: string,
  currentEventId?: string | null,
) {
  return getEquipmentFuelFormContext({ operationalWorkDate, equipmentId, currentEventId });
}

function inputState(formData: FormData):
  | { ok: true; data: ReturnType<typeof equipmentFuelEventSubmissionSchema.parse> }
  | { ok: false; state: EquipmentFuelActionState } {
  const parsed = equipmentFuelEventSubmissionSchema.safeParse(parsePayload(formData));
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    state: {
      status: "error",
      message: "Check the highlighted Fuel Event fields and try again.",
      fieldErrors: equipmentFuelFieldErrors(parsed.error),
    },
  };
}

function persistenceState(error: unknown): EquipmentFuelActionState {
  if (error instanceof EquipmentFuelPersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String(error.meta?.target ?? "");
    if (target.includes("dailyLogActivity")) {
      return {
        status: "error",
        message: "That Daily Work Log activity is already linked to another Fuel Event.",
        fieldErrors: { dailyLogActivityId: ["Choose a different Fueling activity or leave the link empty."] },
      };
    }
    if (target.includes("normalizedKey")) {
      return {
        status: "error",
        message: "That Fuel Service Person already exists.",
        fieldErrors: { newFuelServicePersonDisplayName: ["Select the existing record instead."] },
      };
    }
  }
  return {
    ...emptyEquipmentFuelActionState,
    status: "error",
    message: "The Fuel Event could not be saved. Review the fields and try again.",
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
    return persistenceState(error);
  }
  revalidatePath("/");
  revalidatePath("/equipment-fuel-events");
  revalidatePath("/equipment-fuel-events/service-personnel");
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
    return persistenceState(error);
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
