import { isPayrollDateOnly } from "./date-only";

export const candidateStatusLabels: Record<string, string> = {
  OPEN: "Needs exact-date review",
  RESOLVED: "Verified boundary",
  REJECTED: "Rejected candidate",
  SUPERSEDED: "Superseded candidate",
};

export const observationStateLabels: Record<string, string> = {
  SUPPORTED: "Supported",
  REVIEW_REQUIRED: "Review required",
  UNSUPPORTED: "Unsupported",
};

export const dateConfidenceLabels: Record<string, string> = {
  EXPLICIT_ROW_RANGE: "Document-proven row dates",
  PAY_PERIOD_ONLY: "Document pay-period bounds",
  UNKNOWN: "Date unknown",
};

export const extractionBasisLabels: Record<string, string> = {
  WORKDAY_REGULAR_ROW: "Workday regular-earnings row",
  PAYCHECK_CORRECTION: "Paycheck correction",
  MANUAL_ENTRY: "Manual entry",
};

export const classificationLabels: Record<string, string> = {
  FIRST_RATE_CANDIDATE: "First observed rate",
  REPEATED_SUPPORTING_OBSERVATION: "Repeated supporting observation",
  CANDIDATE_INCREASE: "Proposed increase",
  CANDIDATE_DECREASE: "Proposed decrease",
  MULTIPLE_RATE_SPLIT: "Multiple-rate split",
  SAME_DATE_CONFLICT: "Conflicting evidence",
  UNCERTAIN_EFFECTIVE_DATE_CHANGE: "Uncertain effective date",
  UNSUPPORTED_OBSERVATION: "Unsupported evidence",
  CORRECTED_OR_SUPERSEDED_OBSERVATION: "Corrected or superseded observation",
};

const classificationPriority = [
  "SAME_DATE_CONFLICT",
  "MULTIPLE_RATE_SPLIT",
  "CANDIDATE_INCREASE",
  "CANDIDATE_DECREASE",
  "FIRST_RATE_CANDIDATE",
  "UNCERTAIN_EFFECTIVE_DATE_CHANGE",
  "REPEATED_SUPPORTING_OBSERVATION",
  "UNSUPPORTED_OBSERVATION",
  "CORRECTED_OR_SUPERSEDED_OBSERVATION",
];

export function orderedRateClassifications(kinds: string[]) {
  const remaining = new Set(kinds);
  const ordered = classificationPriority.filter((kind) => remaining.delete(kind));
  return [...ordered, ...[...remaining].sort()];
}

export function primaryRateClassification(kinds: string[]) {
  return orderedRateClassifications(kinds)[0] ?? "UNCERTAIN_EFFECTIVE_DATE_CHANGE";
}
export function validateCandidateDate(value: string, earliest: string, latest: string | null) {
  if (!value) return "Select an exact effective date.";
  if (!isPayrollDateOnly(value)) return "Use a real calendar date in YYYY-MM-DD format.";
  if (value < earliest || (latest !== null && value > latest)) {
    return `Select a date inside the evidence window (${earliest} through ${latest ?? "open ended"}).`;
  }
  return undefined;
}
