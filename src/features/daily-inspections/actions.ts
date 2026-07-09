"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  dailyInspectionFormSchema,
  emptyDailyInspectionFormState,
  type DailyInspectionFormInput,
  type DailyInspectionFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function errorState(message: string): DailyInspectionFormState {
  return {
    ...emptyDailyInspectionFormState,
    status: "error",
    message,
  };
}

function parseFormData(formData: FormData):
  | { ok: true; data: DailyInspectionFormInput }
  | { ok: false; state: DailyInspectionFormState } {
  const parsed = dailyInspectionFormSchema.safeParse({
    inspectionDate: formData.get("inspectionDate"),
    shift: formData.get("shift"),
    mineId: formData.get("mineId"),
    equipmentId: formData.get("equipmentId"),
    equipmentHours: formData.get("equipmentHours"),
    condition: formData.get("condition"),
    status: formData.get("status"),
    findings: formData.get("findings"),
    defectsIdentified: formData.get("defectsIdentified"),
    notes: formData.get("notes"),
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

export async function createDailyInspectionAction(
  _previousState: DailyInspectionFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  let dailyInspectionId: string;

  try {
    const dailyInspection = await prisma.dailyInspection.create({
      data: {
        inspectionDate: toDateOnly(input.data.inspectionDate),
        shift: input.data.shift,
        mineId: asNullable(input.data.mineId),
        equipmentId: input.data.equipmentId,
        equipmentHours: input.data.equipmentHours ?? null,
        condition: input.data.condition,
        status: input.data.status,
        findings: input.data.findings,
        defectsIdentified: input.data.defectsIdentified,
        notes: asNullable(input.data.notes),
      },
    });

    dailyInspectionId = dailyInspection.id;
  } catch {
    return errorState("Daily Inspection could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/daily-inspections");
  redirect(`/daily-inspections/${dailyInspectionId}`);
}

export async function updateDailyInspectionAction(
  dailyInspectionId: string,
  _previousState: DailyInspectionFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.dailyInspection.update({
      where: { id: dailyInspectionId },
      data: {
        inspectionDate: toDateOnly(input.data.inspectionDate),
        shift: input.data.shift,
        mineId: asNullable(input.data.mineId),
        equipmentId: input.data.equipmentId,
        equipmentHours: input.data.equipmentHours ?? null,
        condition: input.data.condition,
        status: input.data.status,
        findings: input.data.findings,
        defectsIdentified: input.data.defectsIdentified,
        notes: asNullable(input.data.notes),
      },
    });
  } catch {
    return errorState("Daily Inspection could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/daily-inspections");
  revalidatePath(`/daily-inspections/${dailyInspectionId}`);
  redirect(`/daily-inspections/${dailyInspectionId}`);
}
