"use server";

import type { DraglineDelayReportAutosaveResult } from "@/features/dragline-delay-reports/actions";
import { getDraglineDelayCode } from "@/features/dragline-delay-reports/catalog";
import type { DraglineDelayReportFormInitialValues } from "@/features/dragline-delay-reports/types";
import {
  draglineDelayReportSubmissionSchema,
  type DraglineDelayReportActionState,
  type DraglineDelayReportSubmissionInput,
} from "@/features/dragline-delay-reports/validation";

type StoredStressDraft = {
  payload: DraglineDelayReportSubmissionInput;
  recordVersion: number;
};

const stressState = globalThis as typeof globalThis & {
  __namDdrStressDrafts?: Map<string, StoredStressDraft>;
};
const drafts = (stressState.__namDdrStressDrafts ??= new Map());

function enabled() {
  return process.env.NAM_DDR_STRESS_TEST === "1";
}

export async function stressDraglineFormAction(
  _previousState: DraglineDelayReportActionState,
  _formData: FormData,
): Promise<DraglineDelayReportActionState> {
  return { status: "idle", message: "", fieldErrors: {} };
}

export async function stressDraglineAutosaveAction(
  reportId: string | undefined,
  serialized: string,
): Promise<DraglineDelayReportAutosaveResult> {
  if (!enabled()) {
    return { status: "error", message: "Stress fixture is disabled.", fieldErrors: {} };
  }
  const payload = draglineDelayReportSubmissionSchema.parse(
    JSON.parse(serialized),
  );
  const id = reportId ?? "stress-new-draft";
  const recordVersion = Number(payload.recordVersion ?? 0) + 1;
  drafts.set(id, { payload, recordVersion });
  const identities = {
    operators: payload.operators.map((row: {
      id?: string;
      sequence: number;
      employeeId: string;
    }) => ({
      id: row.id ?? `${id}-operator-${row.sequence}`,
      sequence: row.sequence,
    })),
    timelineEntries: payload.timelineEntries.map((row: {
      id?: string;
      sequence: number;
      startTime: string;
      dayOffset: 0 | 1;
      delayCode: string;
      description?: string | null;
      durationMinutes?: number | null;
      causesDowntime: boolean;
    }) => ({
      id: row.id ?? `${id}-timeline-${row.sequence}`,
      sequence: row.sequence,
    })),
    downtimeBlocks: payload.downtimeBlocks.map((block: {
      id?: string;
      sequence: number;
      startTime: string;
      dayOffset: 0 | 1;
      durationMinutes: number;
      description?: string | null;
      activities: Array<{
        id?: string;
        sequence: number;
        delayCode: string;
        description?: string | null;
      }>;
    }) => ({
      id: block.id ?? `${id}-block-${block.sequence}`,
      sequence: block.sequence,
      activities: block.activities.map((row: {
        id?: string;
        sequence: number;
        delayCode: string;
        description?: string | null;
      }) => ({
        id: row.id ?? `${id}-block-${block.sequence}-activity-${row.sequence}`,
        sequence: row.sequence,
      })),
    })),
    groundChecks: payload.groundChecks.map((row: {
      id?: string;
      sequence: number;
      startTime: string;
      dayOffset: 0 | 1;
    }) => ({
      id: row.id ?? `${id}-ground-${row.sequence}`,
      sequence: row.sequence,
    })),
  };
  return {
    status: "saved",
    reportId: id,
    recordVersion,
    savedAt: new Date().toISOString(),
    identities,
  };
}

export async function getStressDraft(
  reportId: string,
): Promise<DraglineDelayReportFormInitialValues | null> {
  if (!enabled()) return null;
  const stored = drafts.get(reportId);
  if (!stored) return null;
  const payload = stored.payload;
  return {
    operationalWorkDate: payload.operationalWorkDate,
    shift: payload.shift,
    equipmentId: payload.equipmentId,
    startingHourMeter: String(payload.startingHourMeter),
    endingHourMeter: payload.endingHourMeter == null ? "" : String(payload.endingHourMeter),
    supervisorId: payload.supervisorId ?? "",
    dayShiftFieldLeadId: payload.dayShiftFieldLeadId ?? "",
    nightShiftFieldLeadId: payload.nightShiftFieldLeadId ?? "",
    lakeId: payload.lakeId ?? "",
    normalDiggingBuckets: payload.normalDiggingBuckets == null ? "" : String(payload.normalDiggingBuckets),
    benchfillBuckets: payload.benchfillBuckets == null ? "" : String(payload.benchfillBuckets),
    cutType: payload.cutType ?? "",
    cutNote: payload.cutNote ?? "",
    stationStart: payload.stationStart ?? "",
    stationEnd: payload.stationEnd ?? "",
    depthFeet: payload.depthFeet == null ? "" : String(payload.depthFeet),
    fuelGallons: payload.fuelGallons == null ? "" : String(payload.fuelGallons),
    cableDragFeet: payload.cableDragFeet == null ? "" : String(payload.cableDragFeet),
    hoistFeet: payload.hoistFeet == null ? "" : String(payload.hoistFeet),
    comments: payload.comments ?? "",
    safetyItemsFound: payload.safetyItemsFound ?? "",
    actionTaken: payload.actionTaken ?? "",
    recordVersion: stored.recordVersion,
    operators: payload.operators.map((row: {
      id?: string;
      sequence: number;
      employeeId: string;
    }) => ({
      clientId: row.id ?? `${reportId}-operator-${row.sequence}`,
      id: row.id ?? `${reportId}-operator-${row.sequence}`,
      employeeId: row.employeeId,
    })),
    timelineEntries: payload.timelineEntries.map((row: {
      id?: string;
      sequence: number;
      startTime: string;
      dayOffset: 0 | 1;
      delayCode: string;
      description?: string | null;
      durationMinutes?: number | null;
      causesDowntime: boolean;
    }) => ({
      clientId: row.id ?? `${reportId}-timeline-${row.sequence}`,
      id: row.id ?? `${reportId}-timeline-${row.sequence}`,
      sequence: row.sequence,
      startTime: row.startTime,
      dayOffset: row.dayOffset,
      delayCode: row.delayCode,
      description: row.description ?? "",
      durationMinutes: row.durationMinutes == null ? "" : String(row.durationMinutes),
      causesDowntime: row.causesDowntime,
      category: getDraglineDelayCode(row.delayCode)?.category,
    })),
    downtimeBlocks: payload.downtimeBlocks.map((block: {
      id?: string;
      sequence: number;
      startTime: string;
      dayOffset: 0 | 1;
      durationMinutes: number;
      description?: string | null;
      activities: Array<{
        id?: string;
        sequence: number;
        delayCode: string;
        description?: string | null;
      }>;
    }) => ({
      clientId: block.id ?? `${reportId}-block-${block.sequence}`,
      id: block.id ?? `${reportId}-block-${block.sequence}`,
      sequence: block.sequence,
      startTime: block.startTime,
      dayOffset: block.dayOffset,
      durationMinutes: String(block.durationMinutes),
      description: block.description ?? "",
      activities: block.activities.map((row: {
        id?: string;
        sequence: number;
        delayCode: string;
        description?: string | null;
      }) => ({
        clientId: row.id ?? `${reportId}-block-${block.sequence}-activity-${row.sequence}`,
        id: row.id ?? `${reportId}-block-${block.sequence}-activity-${row.sequence}`,
        delayCode: row.delayCode,
        description: row.description ?? "",
        category: getDraglineDelayCode(row.delayCode)?.category,
      })),
    })),
    groundChecks: payload.groundChecks.map((row: {
      id?: string;
      sequence: number;
      startTime: string;
      dayOffset: 0 | 1;
    }) => ({
      clientId: row.id ?? `${reportId}-ground-${row.sequence}`,
      id: row.id ?? `${reportId}-ground-${row.sequence}`,
      sequence: row.sequence,
      startTime: row.startTime,
      dayOffset: row.dayOffset,
    })),
  };
}
