export const identityStatusLabels: Record<string, string> = {
  NEEDS_REVIEW: "Needs review",
  EXPLICIT_SELECTION: "Explicit selection",
  OWNER_VERIFIED: "Owner verified",
  REVIEWED_UNASSIGNED: "Reviewed — unassigned",
};

export const rateStatusLabels: Record<string, string> = {
  NEEDS_REVIEW: "Needs review",
  VERIFIED: "Verified",
  CONFLICT: "Conflict",
  SUPERSEDED: "Superseded",
  EXCLUDED: "Excluded",
};

export const provenanceLabels: Record<string, string> = {
  UNKNOWN: "Unknown",
  PAYCHECK: "Confirmed Paycheck",
  INDEPENDENT: "Independent evidence",
};

export function formatReviewDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatReviewTimestamp(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatReviewDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder.toString().padStart(2, "0")}m`;
}

export function formatRate(value: { toString(): string } | string) {
  return `$${Number(value.toString()).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: false,
  })}/hr`;
}

export function employeeLabel(employee: { displayName: string; employeeCode: string | null; id: string; isActive?: boolean }) {
  return `${employee.displayName}${employee.employeeCode ? ` · ${employee.employeeCode}` : ""} · ${employee.id}${employee.isActive === false ? " · Inactive" : ""}`;
}
