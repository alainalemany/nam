"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  persistOperationalSafetyChecklist,
  SafetyChecklistPersistenceError,
} from "./persistence";
import {
  emptySafetyChecklistActionState,
  safetyChecklistFieldErrors,
  safetyChecklistSubmissionSchema,
  type SafetyChecklistActionState,
} from "./validation";

function responseValues(formData: FormData) {
  const responses: Array<{ itemKey: string; responseCode: FormDataEntryValue }> = [];
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("response.")) {
      responses.push({ itemKey: name.slice("response.".length), responseCode: value });
    }
  }
  return responses;
}

function parseFormData(formData: FormData):
  | { ok: true; data: ReturnType<typeof safetyChecklistSubmissionSchema.parse> }
  | { ok: false; state: SafetyChecklistActionState } {
  const responses = responseValues(formData);
  const parsed = safetyChecklistSubmissionSchema.safeParse({
    inspectionDate: formData.get("inspectionDate"),
    shift: formData.get("shift"),
    equipmentId: formData.get("equipmentId"),
    templateKey: formData.get("templateKey"),
    templateVersion: formData.get("templateVersion"),
    startingMeter: formData.get("startingMeter"),
    operatorDisplayName: formData.get("operatorDisplayName"),
    supervisorDisplayName: formData.get("supervisorDisplayName"),
    problemDescription: formData.get("problemDescription"),
    responses,
  });

  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the highlighted checklist fields and try again.",
        fieldErrors: safetyChecklistFieldErrors(parsed.error, responses),
      },
    };
  }
  return { ok: true, data: parsed.data };
}

function persistenceErrorState(error: unknown): SafetyChecklistActionState {
  if (error instanceof SafetyChecklistPersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
    };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      status: "error",
      message: "A checklist already exists for this Equipment, date, and shift.",
      fieldErrors: {
        equipmentId: ["Choose the existing checklist and correct it instead."],
      },
    };
  }
  return {
    ...emptySafetyChecklistActionState,
    status: "error",
    message: "The checklist could not be saved. Review the fields and try again.",
  };
}

export async function createOperationalSafetyChecklistAction(
  _previousState: SafetyChecklistActionState,
  formData: FormData,
) {
  const parsed = parseFormData(formData);
  if (!parsed.ok) return parsed.state;

  let checklistId: string;
  try {
    checklistId = (await persistOperationalSafetyChecklist(parsed.data)).id;
  } catch (error) {
    return persistenceErrorState(error);
  }

  revalidatePath("/operational-safety-checklists");
  redirect(`/operational-safety-checklists/${checklistId}`);
}

export async function correctOperationalSafetyChecklistAction(
  checklistId: string,
  _previousState: SafetyChecklistActionState,
  formData: FormData,
) {
  const parsed = parseFormData(formData);
  if (!parsed.ok) return parsed.state;

  try {
    await persistOperationalSafetyChecklist(parsed.data, checklistId);
  } catch (error) {
    return persistenceErrorState(error);
  }

  revalidatePath("/operational-safety-checklists");
  revalidatePath(`/operational-safety-checklists/${checklistId}`);
  redirect(`/operational-safety-checklists/${checklistId}`);
}
