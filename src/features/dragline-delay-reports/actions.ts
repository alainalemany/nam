"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  completeDraglineDelayReport,
  correctDraglineDelayReport,
  DraglineDelayReportPersistenceError,
  persistDraglineDelayReport,
} from "./persistence";
import {
  draglineDelayReportCompletionSchema,
  draglineDelayReportCorrectionSubmissionSchema,
  draglineDelayReportFieldErrors,
  draglineDelayReportSubmissionSchema,
  emptyDraglineDelayReportActionState,
  type DraglineDelayReportActionState,
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

type MutationIntent = "draft" | "complete" | "correct";

function inputState<T>(
  formData: FormData,
  schema: { safeParse: (value: unknown) =>
    | { success: true; data: T }
    | { success: false; error: Parameters<typeof draglineDelayReportFieldErrors>[0] } },
  message: string,
) {
  const parsed = schema.safeParse(parsePayload(formData));
  if (parsed.success) return { ok: true as const, data: parsed.data };
  return {
    ok: false as const,
    state: {
      status: "error" as const,
      message,
      fieldErrors: draglineDelayReportFieldErrors(parsed.error),
    },
  };
}

function persistenceState(
  error: unknown,
  intent: MutationIntent,
): DraglineDelayReportActionState {
  if (error instanceof DraglineDelayReportPersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      status: "error",
      message:
        "A Dragline Delay Report already exists for that Equipment, operational work date, and shift.",
      fieldErrors: {
        operationalWorkDate: ["Open the existing report or choose another report identity."],
      },
    };
  }
  return {
    ...emptyDraglineDelayReportActionState,
    status: "error",
    message:
      intent === "complete"
        ? "Could not complete report. Review the fields and try again."
        : intent === "correct"
          ? "Could not correct report. Review the fields and try again."
          : "The Draft report could not be saved. Review the fields and try again.",
  };
}

export async function createDraglineDelayReportAction(
  _previousState: DraglineDelayReportActionState,
  formData: FormData,
) {
  const parsed = inputState(
    formData,
    draglineDelayReportSubmissionSchema,
    "Required or invalid fields need attention. Your entered values were preserved.",
  );
  if (!parsed.ok) return parsed.state;

  let id: string;
  try {
    id = (await persistDraglineDelayReport(parsed.data)).id;
  } catch (error) {
    return persistenceState(error, "draft");
  }

  revalidatePath("/dragline-delay-reports");
  redirect(`/dragline-delay-reports/${id}?saved=created`);
}

export async function updateDraglineDelayReportAction(
  reportId: string,
  _previousState: DraglineDelayReportActionState,
  formData: FormData,
) {
  const completing = formData.get("intent") === "complete";
  const parsed = inputState(
    formData,
    completing
      ? draglineDelayReportCompletionSchema
      : draglineDelayReportSubmissionSchema,
    completing
      ? "Cannot complete report yet. Required or invalid fields need attention. Your entered values were preserved."
      : "Required or invalid fields need attention. Your entered values were preserved.",
  );
  if (!parsed.ok) return parsed.state;

  try {
    if (completing) {
      await completeDraglineDelayReport(parsed.data, reportId);
    } else {
      await persistDraglineDelayReport(parsed.data, reportId);
    }
  } catch (error) {
    return persistenceState(error, completing ? "complete" : "draft");
  }

  revalidatePath("/dragline-delay-reports");
  revalidatePath(`/dragline-delay-reports/${reportId}`);
  redirect(
    `/dragline-delay-reports/${reportId}?saved=${completing ? "completed" : "updated"}`,
  );
}

export async function correctDraglineDelayReportAction(
  reportId: string,
  _previousState: DraglineDelayReportActionState,
  formData: FormData,
) {
  const parsed = inputState(
    formData,
    draglineDelayReportCorrectionSubmissionSchema,
    "Cannot correct report yet. Required or invalid fields need attention. Your entered values were preserved.",
  );
  if (!parsed.ok) return parsed.state;

  try {
    await correctDraglineDelayReport(
      parsed.data,
      reportId,
      parsed.data.correctionReason,
    );
  } catch (error) {
    return persistenceState(error, "correct");
  }

  revalidatePath("/dragline-delay-reports");
  revalidatePath(`/dragline-delay-reports/${reportId}`);
  redirect(`/dragline-delay-reports/${reportId}?saved=corrected`);
}
