import { DRAGLINE_DELAY_CODE_CATALOG_VERSION } from "./catalog";
import type { DraglineDelayReportFormInitialValues } from "./types";

export const DRAGLINE_DRAFT_RECOVERY_SCHEMA_VERSION = 1;
export const DRAGLINE_DRAFT_RECOVERY_PREFIX =
  "nam:dragline-delay-report:draft-recovery:v1";
export const DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY =
  `${DRAGLINE_DRAFT_RECOVERY_PREFIX}:latest-new`;

export type DraglineTimelineOrderItem =
  | { kind: "entry"; clientId: string }
  | { kind: "block"; clientId: string };

export type DraglineDelayReportDraftSnapshot =
  DraglineDelayReportFormInitialValues & {
    timelineOrder: DraglineTimelineOrderItem[];
  };

export type DraglineDelayReportDraftRecovery = {
  schemaVersion: typeof DRAGLINE_DRAFT_RECOVERY_SCHEMA_VERSION;
  savedAt: string;
  reportId?: string;
  serverRecordVersion?: number;
  snapshot: DraglineDelayReportDraftSnapshot;
};

type SubmittedTimelineItem =
  | {
      kind: "entry";
      value: DraglineDelayReportDraftSnapshot["timelineEntries"][number];
    }
  | {
      kind: "block";
      value: DraglineDelayReportDraftSnapshot["downtimeBlocks"][number];
    };

function submittedTimelineItems(
  snapshot: DraglineDelayReportDraftSnapshot,
): SubmittedTimelineItem[] {
  const entryByClientId = new Map(
    snapshot.timelineEntries.map((entry) => [entry.clientId, entry]),
  );
  const blockByClientId = new Map(
    snapshot.downtimeBlocks.map((block) => [block.clientId, block]),
  );
  return snapshot.timelineOrder.reduce<SubmittedTimelineItem[]>((items, item) => {
    if (item.kind === "entry") {
      const entry = entryByClientId.get(item.clientId);
      if (entry &&
        Boolean(
          entry.id ||
            entry.startTime ||
            entry.delayCode ||
            entry.description.trim() ||
            entry.durationMinutes ||
            entry.causesDowntime,
        )) {
        items.push({ kind: "entry", value: entry });
      }
      return items;
    }
    const block = blockByClientId.get(item.clientId);
    if (block) items.push({ kind: "block", value: block });
    return items;
  }, []);
}

export function draglineDraftRecoveryKey(input: {
  reportId?: string;
  equipmentId: string;
  operationalWorkDate: string;
  shift: string;
}) {
  if (input.reportId) {
    return `${DRAGLINE_DRAFT_RECOVERY_PREFIX}:report:${input.reportId}`;
  }
  const equipment = input.equipmentId || "unselected";
  const date = input.operationalWorkDate || "undated";
  const shift = input.shift || "unselected";
  return `${DRAGLINE_DRAFT_RECOVERY_PREFIX}:new:${equipment}:${date}:${shift}`;
}

export function draglineDraftSubmission(
  snapshot: DraglineDelayReportDraftSnapshot,
  recordVersion = snapshot.recordVersion,
) {
  const submittedItems = submittedTimelineItems(snapshot);

  return {
    operationalWorkDate: snapshot.operationalWorkDate,
    shift: snapshot.shift,
    equipmentId: snapshot.equipmentId,
    startingHourMeter: snapshot.startingHourMeter,
    endingHourMeter: snapshot.endingHourMeter,
    supervisorId: snapshot.supervisorId,
    dayShiftFieldLeadId: snapshot.dayShiftFieldLeadId,
    nightShiftFieldLeadId: snapshot.nightShiftFieldLeadId,
    lakeId: snapshot.lakeId,
    normalDiggingBuckets: snapshot.normalDiggingBuckets,
    benchfillBuckets: snapshot.benchfillBuckets,
    cutType: snapshot.cutType,
    cutNote: snapshot.cutNote,
    stationStart: snapshot.stationStart,
    stationEnd: snapshot.stationEnd,
    depthFeet: snapshot.depthFeet,
    fuelGallons: snapshot.fuelGallons,
    cableDragFeet: snapshot.cableDragFeet,
    hoistFeet: snapshot.hoistFeet,
    comments: snapshot.comments,
    safetyItemsFound: snapshot.safetyItemsFound,
    actionTaken: snapshot.actionTaken,
    recordVersion,
    operators: snapshot.operators.map((operator, index) => ({
      id: operator.id,
      sequence: index + 1,
      employeeId: operator.employeeId,
    })),
    timelineEntries: submittedItems.flatMap((item, itemIndex) =>
      item.kind === "entry"
        ? [
            {
              id: item.value.id,
              sequence: itemIndex + 1,
              startTime: item.value.startTime,
              dayOffset: item.value.dayOffset,
              catalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
              delayCode: item.value.delayCode,
              description: item.value.description,
              durationMinutes: item.value.durationMinutes,
              causesDowntime: item.value.causesDowntime,
            },
          ]
        : [],
    ),
    downtimeBlocks: submittedItems.flatMap((item, itemIndex) =>
      item.kind === "block"
        ? [
            {
              id: item.value.id,
              sequence: itemIndex + 1,
              startTime: item.value.startTime,
              dayOffset: item.value.dayOffset,
              durationMinutes: item.value.durationMinutes,
              description: item.value.description,
              activities: item.value.activities.map(
                (activity, activityIndex) => ({
                  id: activity.id,
                  sequence: activityIndex + 1,
                  catalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
                  delayCode: activity.delayCode,
                  description: activity.description,
                }),
              ),
            },
          ]
        : [],
    ),
    groundChecks: snapshot.groundChecks
      .filter((groundCheck) => groundCheck.id || groundCheck.startTime)
      .map((groundCheck, index) => ({
        id: groundCheck.id,
        sequence: index + 1,
        startTime: groundCheck.startTime,
        dayOffset: groundCheck.dayOffset,
      })),
  };
}

export function draglineDraftSubmittedClientIds(
  snapshot: DraglineDelayReportDraftSnapshot,
) {
  const submittedItems = submittedTimelineItems(snapshot);
  return {
    operators: snapshot.operators.map((operator, index) => ({
      clientId: operator.clientId,
      sequence: index + 1,
    })),
    timelineEntries: submittedItems.flatMap((item, index) =>
      item.kind === "entry"
        ? [{ clientId: item.value.clientId, sequence: index + 1 }]
        : [],
    ),
    downtimeBlocks: submittedItems.flatMap((item, index) =>
      item.kind === "block"
        ? [
            {
              clientId: item.value.clientId,
              sequence: index + 1,
              activities: item.value.activities.map((activity, activityIndex) => ({
                clientId: activity.clientId,
                sequence: activityIndex + 1,
              })),
            },
          ]
        : [],
    ),
    groundChecks: snapshot.groundChecks
      .filter((groundCheck) => groundCheck.id || groundCheck.startTime)
      .map((groundCheck, index) => ({
        clientId: groundCheck.clientId,
        sequence: index + 1,
      })),
  };
}

export function draglineDraftContentFingerprint(
  snapshot: DraglineDelayReportDraftSnapshot,
) {
  return JSON.stringify(draglineDraftSubmission(snapshot), (key, value) =>
    key === "id" || key === "recordVersion" ? undefined : value,
  );
}

function isDraftSnapshot(value: unknown): value is DraglineDelayReportDraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraglineDelayReportDraftSnapshot>;
  return (
    typeof candidate.operationalWorkDate === "string" &&
    (candidate.shift === "DAY" || candidate.shift === "NIGHT") &&
    typeof candidate.equipmentId === "string" &&
    Array.isArray(candidate.operators) &&
    Array.isArray(candidate.timelineEntries) &&
    Array.isArray(candidate.downtimeBlocks) &&
    Array.isArray(candidate.groundChecks) &&
    Array.isArray(candidate.timelineOrder)
  );
}

export function parseDraglineDraftRecovery(
  serialized: string | null,
): DraglineDelayReportDraftRecovery | null {
  if (!serialized) return null;
  try {
    const candidate = JSON.parse(serialized) as Partial<DraglineDelayReportDraftRecovery>;
    if (
      candidate.schemaVersion !== DRAGLINE_DRAFT_RECOVERY_SCHEMA_VERSION ||
      typeof candidate.savedAt !== "string" ||
      !isDraftSnapshot(candidate.snapshot)
    ) {
      return null;
    }
    return candidate as DraglineDelayReportDraftRecovery;
  } catch {
    return null;
  }
}

export function serializeDraglineDraftRecovery(
  recovery: Omit<DraglineDelayReportDraftRecovery, "schemaVersion" | "savedAt"> & {
    savedAt?: string;
  },
) {
  return JSON.stringify({
    ...recovery,
    schemaVersion: DRAGLINE_DRAFT_RECOVERY_SCHEMA_VERSION,
    savedAt: recovery.savedAt ?? new Date().toISOString(),
  } satisfies DraglineDelayReportDraftRecovery);
}
