"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyWorkAuthorizationFormState,
  workAuthorizationFormSchema,
  type WorkAuthorizationFormInput,
  type WorkAuthorizationFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function errorState(message: string): WorkAuthorizationFormState {
  return {
    ...emptyWorkAuthorizationFormState,
    status: "error",
    message,
  };
}

function parseFormData(formData: FormData):
  | { ok: true; data: WorkAuthorizationFormInput }
  | { ok: false; state: WorkAuthorizationFormState } {
  const parsed = workAuthorizationFormSchema.safeParse({
    shiftReportId: formData.get("shiftReportId"),
    status: formData.get("status"),
    workType: formData.get("workType"),
    mineId: formData.get("mineId"),
    equipmentId: formData.get("equipmentId"),
    jobLocation: formData.get("jobLocation"),
    workDescription: formData.get("workDescription"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    crewWorkerCount: formData.get("crewWorkerCount"),
    contactName: formData.get("contactName"),
    equipmentRequired: formData.get("equipmentRequired"),
    personInChargeName: formData.get("personInChargeName"),
    lockoutRequired: formData.get("lockoutRequired"),
    lockoutNotRequiredReason: formData.get("lockoutNotRequiredReason"),
    workplaceExamRequired: formData.get("workplaceExamRequired"),
    confinedSpaceRequired: formData.get("confinedSpaceRequired"),
    lockoutTagoutRequired: formData.get("lockoutTagoutRequired"),
    hotWorkRequired: formData.get("hotWorkRequired"),
    workingAtHeightsRequired: formData.get("workingAtHeightsRequired"),
    stopCardJhaRequired: formData.get("stopCardJhaRequired"),
    jobCompleted: formData.get("jobCompleted"),
    permitsClosed: formData.get("permitsClosed"),
    guardsReplaced: formData.get("guardsReplaced"),
    lockoutTagoutRemoved: formData.get("lockoutTagoutRemoved"),
    toolsRemoved: formData.get("toolsRemoved"),
    housekeepingCompleted: formData.get("housekeepingCompleted"),
    supervisorNotified: formData.get("supervisorNotified"),
    completionNotes: formData.get("completionNotes"),
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

function toWriteData(input: WorkAuthorizationFormInput) {
  return {
    shiftReportId: input.shiftReportId,
    status: input.status,
    workType: input.workType,
    mineId: asNullable(input.mineId),
    equipmentId: asNullable(input.equipmentId),
    jobLocation: asNullable(input.jobLocation),
    workDescription: input.workDescription,
    startTime: asNullable(input.startTime),
    endTime: asNullable(input.endTime),
    crewWorkerCount: input.crewWorkerCount ?? null,
    contactName: asNullable(input.contactName),
    equipmentRequired: asNullable(input.equipmentRequired),
    personInChargeName: asNullable(input.personInChargeName),
    lockoutRequired: input.lockoutRequired,
    lockoutNotRequiredReason: asNullable(input.lockoutNotRequiredReason),
    workplaceExamRequired: input.workplaceExamRequired,
    confinedSpaceRequired: input.confinedSpaceRequired,
    lockoutTagoutRequired: input.lockoutTagoutRequired,
    hotWorkRequired: input.hotWorkRequired,
    workingAtHeightsRequired: input.workingAtHeightsRequired,
    stopCardJhaRequired: input.stopCardJhaRequired,
    jobCompleted: input.jobCompleted,
    permitsClosed: input.permitsClosed,
    guardsReplaced: input.guardsReplaced,
    lockoutTagoutRemoved: input.lockoutTagoutRemoved,
    toolsRemoved: input.toolsRemoved,
    housekeepingCompleted: input.housekeepingCompleted,
    supervisorNotified: input.supervisorNotified,
    completionNotes: asNullable(input.completionNotes),
  };
}

export async function createWorkAuthorizationAction(
  _previousState: WorkAuthorizationFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  let workAuthorizationId: string;

  try {
    const workAuthorization = await prisma.workAuthorization.create({
      data: toWriteData(input.data),
    });

    workAuthorizationId = workAuthorization.id;
  } catch {
    return errorState("Work Authorization could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/work-authorizations");
  revalidatePath("/shift-reports");
  revalidatePath(`/shift-reports/${input.data.shiftReportId}`);
  redirect(`/work-authorizations/${workAuthorizationId}`);
}

export async function updateWorkAuthorizationAction(
  workAuthorizationId: string,
  _previousState: WorkAuthorizationFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.workAuthorization.update({
      where: { id: workAuthorizationId },
      data: toWriteData(input.data),
    });
  } catch {
    return errorState("Work Authorization could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/work-authorizations");
  revalidatePath(`/work-authorizations/${workAuthorizationId}`);
  revalidatePath("/shift-reports");
  revalidatePath(`/shift-reports/${input.data.shiftReportId}`);
  redirect(`/work-authorizations/${workAuthorizationId}`);
}
