"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  canTransitionDefectStatus,
  defectLifecycleUpdate,
  type DefectStatusValue,
} from "./constants";
import {
  defectFormSchema,
  emptyDefectFormState,
  type DefectFormInput,
  type DefectFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function errorState(message: string): DefectFormState {
  return { ...emptyDefectFormState, status: "error", message };
}

function parseFormData(formData: FormData):
  | { ok: true; data: DefectFormInput }
  | { ok: false; state: DefectFormState } {
  const parsed = defectFormSchema.safeParse({
    reportedDate: formData.get("reportedDate"),
    equipmentId: formData.get("equipmentId"),
    sourceDailyInspectionId: formData.get("sourceDailyInspectionId"),
    severity: formData.get("severity"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    title: formData.get("title"),
    description: formData.get("description"),
    correctiveAction: formData.get("correctiveAction"),
    resolutionSummary: formData.get("resolutionSummary"),
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

export async function createDefectAction(
  _previousState: DefectFormState,
  formData: FormData,
) {
  formData.set("status", "OPEN");
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  let defectId: string;

  try {
    const defect = await prisma.defect.create({
      data: {
        reportedDate: toDateOnly(input.data.reportedDate),
        equipmentId: input.data.equipmentId,
        sourceDailyInspectionId: asNullable(input.data.sourceDailyInspectionId),
        severity: input.data.severity,
        priority: input.data.priority,
        status: "OPEN",
        title: input.data.title,
        description: input.data.description,
        correctiveAction: asNullable(input.data.correctiveAction),
        resolutionSummary: null,
      },
    });
    defectId = defect.id;
  } catch {
    return errorState("Defect could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/defect-tracking");
  revalidatePath("/day-view");
  redirect(`/defect-tracking/${defectId}`);
}

export async function updateDefectAction(
  defectId: string,
  _previousState: DefectFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  const current = await prisma.defect.findUnique({ where: { id: defectId } });

  if (!current) {
    return errorState("Defect could not be found.");
  }

  const currentStatus = current.status as DefectStatusValue;
  const nextStatus = input.data.status as DefectStatusValue;

  if (!canTransitionDefectStatus(currentStatus, nextStatus)) {
    return {
      status: "error" as const,
      message: "That lifecycle transition is not allowed.",
      fieldErrors: { status: ["Choose a valid next status."] },
    };
  }

  const lifecycleUpdate = defectLifecycleUpdate({
    currentStatus,
    nextStatus,
    submittedResolutionSummary: input.data.resolutionSummary,
    currentResolutionSummary: current.resolutionSummary,
    currentResolvedAt: current.resolvedAt,
    currentClosedAt: current.closedAt,
    now: new Date(),
  });

  try {
    await prisma.defect.update({
      where: { id: defectId },
      data: {
        reportedDate: toDateOnly(input.data.reportedDate),
        equipmentId: input.data.equipmentId,
        sourceDailyInspectionId: asNullable(input.data.sourceDailyInspectionId),
        severity: input.data.severity,
        priority: input.data.priority,
        status: nextStatus,
        title: input.data.title,
        description: input.data.description,
        correctiveAction: asNullable(input.data.correctiveAction),
        resolutionSummary: lifecycleUpdate.resolutionSummary,
        resolvedAt: lifecycleUpdate.resolvedAt,
        closedAt: lifecycleUpdate.closedAt,
      },
    });
  } catch {
    return errorState("Defect could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/defect-tracking");
  revalidatePath(`/defect-tracking/${defectId}`);
  revalidatePath("/day-view");
  redirect(`/defect-tracking/${defectId}`);
}
