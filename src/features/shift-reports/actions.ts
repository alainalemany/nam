"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyShiftReportFormState,
  shiftReportFormSchema,
  type ShiftReportFormInput,
  type ShiftReportFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function errorState(message: string): ShiftReportFormState {
  return {
    ...emptyShiftReportFormState,
    status: "error",
    message,
  };
}

function parseFormData(formData: FormData):
  | { ok: true; data: ShiftReportFormInput }
  | { ok: false; state: ShiftReportFormState } {
  const parsed = shiftReportFormSchema.safeParse({
    reportDate: formData.get("reportDate"),
    shift: formData.get("shift"),
    status: formData.get("status"),
    mineId: formData.get("mineId"),
    equipmentId: formData.get("equipmentId"),
    location: formData.get("location"),
    summary: formData.get("summary"),
    operationalNotes: formData.get("operationalNotes"),
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

export async function createShiftReportAction(
  _previousState: ShiftReportFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  let shiftReportId: string;

  try {
    const shiftReport = await prisma.shiftReport.create({
      data: {
        reportDate: toDateOnly(input.data.reportDate),
        shift: input.data.shift,
        status: input.data.status,
        mineId: asNullable(input.data.mineId),
        equipmentId: asNullable(input.data.equipmentId),
        location: asNullable(input.data.location),
        summary: input.data.summary,
        operationalNotes: asNullable(input.data.operationalNotes),
      },
    });

    shiftReportId = shiftReport.id;
  } catch {
    return errorState("Shift Report could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/shift-reports");
  redirect(`/shift-reports/${shiftReportId}`);
}

export async function updateShiftReportAction(
  shiftReportId: string,
  _previousState: ShiftReportFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.shiftReport.update({
      where: { id: shiftReportId },
      data: {
        reportDate: toDateOnly(input.data.reportDate),
        shift: input.data.shift,
        status: input.data.status,
        mineId: asNullable(input.data.mineId),
        equipmentId: asNullable(input.data.equipmentId),
        location: asNullable(input.data.location),
        summary: input.data.summary,
        operationalNotes: asNullable(input.data.operationalNotes),
      },
    });
  } catch {
    return errorState("Shift Report could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/shift-reports");
  revalidatePath(`/shift-reports/${shiftReportId}`);
  redirect(`/shift-reports/${shiftReportId}`);
}
