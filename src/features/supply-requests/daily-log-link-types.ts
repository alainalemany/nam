export const supplyRequestDailyLogRoles = [
  "SUBMISSION",
  "FULFILLMENT",
] as const;

export type SupplyRequestDailyLogRoleValue =
  (typeof supplyRequestDailyLogRoles)[number];

export type SupplyRequestDailyLogLinkSummary = Readonly<{
  role: SupplyRequestDailyLogRoleValue;
  activityId: string;
  activityTitle: string;
  activitySequence: number;
  activityStartTime: string | null;
  activityEndTime: string | null;
  dailyLogId: string;
  dailyLogDate: string;
  dailyLogHref: string;
}>;

export type SupplyRequestDailyLogCandidateActivity = Readonly<{
  id: string;
  dailyLogId: string;
  sequence: number;
  startTime: string | null;
  endTime: string | null;
  title: string;
  equipmentLabel: string | null;
  dailyLogHref: string;
  currentlyLinked: boolean;
}>;

export type SupplyRequestDailyLogCandidate = Readonly<{
  id: string;
  logDate: string;
  shiftLabel: string;
  mineLabel: string | null;
  primaryEquipmentLabel: string | null;
  summary: string | null;
  detailHref: string;
  editHref: string;
  activities: readonly SupplyRequestDailyLogCandidateActivity[];
}>;

export type SupplyRequestDailyLogLinkContext = Readonly<{
  supplyRequestId: string;
  namReference: string;
  currentVersionNumber: number;
  currentStatus: "REQUESTED" | "FULFILLED" | "CANCELLED";
  requestTitle: string;
  equipmentLabel: string;
  expectedRoleDate: string | null;
  requiredActivityTitle: string;
  role: SupplyRequestDailyLogRoleValue;
  eligible: boolean;
  unavailableReason: string | null;
  existingLink: SupplyRequestDailyLogLinkSummary | null;
  dailyLogs: readonly SupplyRequestDailyLogCandidate[];
}>;
