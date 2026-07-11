export const defectStatusValues = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export const defectSeverityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const defectPriorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type DefectStatusValue = (typeof defectStatusValues)[number];

export const defectStatusOptions = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
] as const satisfies ReadonlyArray<{ value: DefectStatusValue; label: string }>;

export const defectSeverityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export const defectPriorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
] as const;

const allowedTransitions: Record<DefectStatusValue, readonly DefectStatusValue[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

export function canTransitionDefectStatus(
  currentStatus: DefectStatusValue,
  nextStatus: DefectStatusValue,
) {
  return currentStatus === nextStatus || allowedTransitions[currentStatus].includes(nextStatus);
}

export function availableDefectStatusOptions(currentStatus: DefectStatusValue) {
  return defectStatusOptions.filter(
    (option) =>
      option.value === currentStatus || allowedTransitions[currentStatus].includes(option.value),
  );
}

type DefectLifecycleUpdateInput = {
  currentStatus: DefectStatusValue;
  nextStatus: DefectStatusValue;
  submittedResolutionSummary?: string;
  currentResolutionSummary: string | null;
  currentResolvedAt: Date | null;
  currentClosedAt: Date | null;
  now: Date;
};

export function defectLifecycleUpdate({
  currentStatus,
  nextStatus,
  submittedResolutionSummary,
  currentResolutionSummary,
  currentResolvedAt,
  currentClosedAt,
  now,
}: DefectLifecycleUpdateInput) {
  const reopening = currentStatus === "RESOLVED" && nextStatus === "IN_PROGRESS";
  const resolving = currentStatus !== "RESOLVED" && nextStatus === "RESOLVED";
  const closing = currentStatus === "RESOLVED" && nextStatus === "CLOSED";

  return {
    resolutionSummary: reopening
      ? currentResolutionSummary
      : (submittedResolutionSummary ?? null),
    resolvedAt: resolving ? now : currentResolvedAt,
    closedAt: closing ? now : currentClosedAt,
  };
}

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? "Not set";
}
