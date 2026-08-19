"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  DraglineDelayReportPersistenceError,
  persistDraglineDelayReport,
} from "./persistence";
import {
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

function inputState(formData: FormData) {
  const parsed = draglineDelayReportSubmissionSchema.safeParse(parsePayload(formData));
  if (parsed.success) return { ok: true as const, data: parsed.data };
  return {
    ok: false as const,
    state: {
      status: "error" as const,
      message: "Check the highlighted report fields and try again.",
      fieldErrors: draglineDelayReportFieldErrors(parsed.error),
    },
  };
}

function persistenceState(error: unknown): DraglineDelayReportActionState {
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
    message: "The Draft report could not be saved. Review the fields and try again.",
  };
}

export async function createDraglineDelayReportAction(
  _previousState: DraglineDelayReportActionState,
  formData: FormData,
) {
  const parsed = inputState(formData);
  if (!parsed.ok) return parsed.state;

  let id: string;
  try {
    id = (await persistDraglineDelayReport(parsed.data)).id;
  } catch (error) {
    return persistenceState(error);
  }

  revalidatePath("/dragline-delay-reports");
  redirect(`/dragline-delay-reports/${id}`);
}

export async function updateDraglineDelayReportAction(
  reportId: string,
  _previousState: DraglineDelayReportActionState,
  formData: FormData,
) {
  const parsed = inputState(formData);
  if (!parsed.ok) return parsed.state;

  try {
    await persistDraglineDelayReport(parsed.data, reportId);
  } catch (error) {
    return persistenceState(error);
  }

  revalidatePath("/dragline-delay-reports");
  revalidatePath(`/dragline-delay-reports/${reportId}`);
  redirect(`/dragline-delay-reports/${reportId}`);
}
