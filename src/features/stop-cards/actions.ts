"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyStopCardFormState,
  stopCardFormSchema,
  type StopCardFormInput,
  type StopCardFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function errorState(message: string): StopCardFormState {
  return {
    ...emptyStopCardFormState,
    status: "error",
    message,
  };
}

function parseFormData(formData: FormData):
  | { ok: true; data: StopCardFormInput }
  | { ok: false; state: StopCardFormState } {
  const parsed = stopCardFormSchema.safeParse({
    observationDate: formData.get("observationDate"),
    category: formData.get("category"),
    severity: formData.get("severity"),
    status: formData.get("status"),
    mineId: formData.get("mineId"),
    equipmentId: formData.get("equipmentId"),
    location: formData.get("location"),
    description: formData.get("description"),
    correctiveAction: formData.get("correctiveAction"),
    createdBy: formData.get("createdBy"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  return { ok: true, data: parsed.data };
}

export async function createStopCardAction(
  _previousState: StopCardFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  let stopCardId: string;

  try {
    const stopCard = await prisma.stopCard.create({
      data: {
        observationDate: toDateOnly(input.data.observationDate),
        category: input.data.category,
        severity: input.data.severity,
        status: input.data.status,
        mineId: asNullable(input.data.mineId),
        equipmentId: asNullable(input.data.equipmentId),
        location: asNullable(input.data.location),
        description: input.data.description,
        correctiveAction: asNullable(input.data.correctiveAction),
        createdBy: asNullable(input.data.createdBy),
      },
    });

    stopCardId = stopCard.id;
  } catch {
    return errorState("STOP Card could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/stop-cards");
  redirect(`/stop-cards/${stopCardId}`);
}

export async function updateStopCardAction(
  stopCardId: string,
  _previousState: StopCardFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.stopCard.update({
      where: { id: stopCardId },
      data: {
        observationDate: toDateOnly(input.data.observationDate),
        category: input.data.category,
        severity: input.data.severity,
        status: input.data.status,
        mineId: asNullable(input.data.mineId),
        equipmentId: asNullable(input.data.equipmentId),
        location: asNullable(input.data.location),
        description: input.data.description,
        correctiveAction: asNullable(input.data.correctiveAction),
        createdBy: asNullable(input.data.createdBy),
      },
    });
  } catch {
    return errorState("STOP Card could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/stop-cards");
  revalidatePath(`/stop-cards/${stopCardId}`);
  redirect(`/stop-cards/${stopCardId}`);
}
