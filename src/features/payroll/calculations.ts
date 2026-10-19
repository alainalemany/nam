import { addDays, dateInputValue, endOfPayrollWeek, parseDateOnly, startOfPayrollWeek } from "@/features/timesheets/calculations";

import type { PayrollStatus } from "./constants";

export function payrollPeriodForDate(value: Date) {
  const periodStart = startOfPayrollWeek(value);
  const periodEnd = endOfPayrollWeek(value);
  return {
    periodStart,
    periodEnd,
    expectedCheckDate: addDays(periodEnd, 3),
  };
}

export function projectedCheckDateForNamPeriod(periodStart: Date, periodEnd: Date) {
  const expectedStart = startOfPayrollWeek(periodStart);
  const expectedEnd = endOfPayrollWeek(periodStart);
  if (
    dateInputValue(periodStart) !== dateInputValue(expectedStart) ||
    dateInputValue(periodEnd) !== dateInputValue(expectedEnd)
  ) {
    return undefined;
  }
  return addDays(periodEnd, 3);
}

export function dateRangeLabel(start: Date | string, end: Date | string) {
  const startDate = typeof start === "string" ? parseDateOnly(start) : start;
  const endDate = typeof end === "string" ? parseDateOnly(end) : end;
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${format.format(startDate)} – ${format.format(endDate)}`;
}

export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function decimalUnits(value: string, scale = 4) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(10) ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0").slice(0, scale));
}

function divideRoundHalfUp(numerator: bigint, denominator: bigint) {
  return (numerator + denominator / BigInt(2)) / denominator;
}

export function estimatedGrossCents(
  regularMinutes: number,
  overtimeMinutes: number,
  hourlyRate: string,
) {
  const rateUnits = decimalUnits(hourlyRate);
  const weightedMinutes = BigInt(regularMinutes * 2 + overtimeMinutes * 3);
  return Number(divideRoundHalfUp(rateUnits * weightedMinutes, BigInt(12_000)));
}

export function formatCents(cents: number) {
  return formatMoney((cents / 100).toFixed(2));
}

export type ReconciliationReason =
  | "FULL_AGGREGATE_MATCH"
  | "TOTAL_HOURS_MISMATCH"
  | "REGULAR_OVERTIME_CLASSIFICATION_MISMATCH"
  | "MISSING_PAYCHECK_EVIDENCE"
  | "DRAFT_TIMESHEET_EVIDENCE"
  | "MISSING_TIMESHEET_EVIDENCE"
  | "UNCONFIRMED_PAYCHECK_EVIDENCE"
  | "UNRESOLVED_EMPLOYEE_IDENTITY"
  | "AMBIGUOUS_TIMESHEET_EVIDENCE"
  | "UNVERIFIED_FTO_EVIDENCE"
  | "OVERLAPPING_PAYROLL_EVIDENCE";

export type MinuteBreakdown = {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
};

export function reconcilePayrollEvidence(input: {
  hasPaycheck: boolean;
  recorded?: MinuteBreakdown;
  paid?: MinuteBreakdown;
  evidenceIssues?: ReconciliationReason[];
}) {
  const issues = [...new Set(input.evidenceIssues ?? [])];
  const recorded = input.recorded ?? { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 };
  const paid = input.paid ?? { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 };
  const differences = {
    totalMinutes: recorded.totalMinutes - paid.totalMinutes,
    regularMinutes: recorded.regularMinutes - paid.regularMinutes,
    overtimeMinutes: recorded.overtimeMinutes - paid.overtimeMinutes,
  };

  if (!input.hasPaycheck) {
    if (issues.length > 0) {
      return {
        status: "NEEDS_REVIEW" as const,
        reason: issues[0],
        reasons: issues,
        differenceMinutes: differences.totalMinutes,
        differences,
        explanation: "NAM work evidence is incomplete or ambiguous and cannot yet be matched to payment evidence.",
      };
    }
    return {
      status: "AWAITING_PAYROLL" as const,
      reason: "MISSING_PAYCHECK_EVIDENCE" as const,
      reasons: ["MISSING_PAYCHECK_EVIDENCE" as const],
      differenceMinutes: 0,
      differences,
      explanation: "Completed NAM hours are waiting for paycheck confirmation.",
    };
  }

  if (issues.length > 0) {
    return {
      status: "NEEDS_REVIEW" as const,
      reason: issues[0],
      reasons: issues,
      differenceMinutes: differences.totalMinutes,
      differences,
      explanation: reconciliationIssueExplanation(issues),
    };
  }
  if (differences.totalMinutes !== 0) {
    return {
      status: "DISCREPANCY" as const,
      reason: "TOTAL_HOURS_MISMATCH" as const,
      reasons: ["TOTAL_HOURS_MISMATCH" as const],
      differenceMinutes: differences.totalMinutes,
      differences,
      explanation: `${formatHours(Math.abs(differences.totalMinutes))} ${differences.totalMinutes > 0 ? "more recorded than paid" : "more paid than recorded"}; review the aggregate source records.`,
    };
  }
  if (differences.regularMinutes !== 0 || differences.overtimeMinutes !== 0) {
    return {
      status: "DISCREPANCY" as const,
      reason: "REGULAR_OVERTIME_CLASSIFICATION_MISMATCH" as const,
      reasons: ["REGULAR_OVERTIME_CLASSIFICATION_MISMATCH" as const],
      differenceMinutes: 0,
      differences,
      explanation: `Aggregate totals match, but classification differs: regular ${signedMinutes(differences.regularMinutes)} and overtime ${signedMinutes(differences.overtimeMinutes)} NAM minus Workday.`,
    };
  }
  return {
    status: "RECONCILED" as const,
    reason: "FULL_AGGREGATE_MATCH" as const,
    reasons: ["FULL_AGGREGATE_MATCH" as const],
    differenceMinutes: 0,
    differences,
    explanation: "Aggregate NAM regular, overtime, and total hours match the paycheck; individual dates are not independently confirmed.",
  };
}

function signedMinutes(value: number) {
  if (value === 0) return "0h";
  return `${value > 0 ? "+" : "-"}${formatHours(Math.abs(value))}`;
}

function reconciliationIssueExplanation(issues: ReconciliationReason[]) {
  const labels: Record<Exclude<ReconciliationReason, "FULL_AGGREGATE_MATCH" | "TOTAL_HOURS_MISMATCH" | "REGULAR_OVERTIME_CLASSIFICATION_MISMATCH" | "MISSING_PAYCHECK_EVIDENCE">, string> = {
    DRAFT_TIMESHEET_EVIDENCE: "a contributing NAM Timesheet is still Draft",
    MISSING_TIMESHEET_EVIDENCE: "NAM Timesheet coverage is missing for part or all of the period",
    UNCONFIRMED_PAYCHECK_EVIDENCE: "the imported paycheck has not been confirmed",
    UNRESOLVED_EMPLOYEE_IDENTITY: "legacy Timesheet evidence has unresolved employee identity",
    AMBIGUOUS_TIMESHEET_EVIDENCE: "duplicate or ambiguous NAM Timesheet evidence exists",
    UNVERIFIED_FTO_EVIDENCE: "FTO is recorded separately but its approval, payment, and overtime treatment are not authoritative",
    OVERLAPPING_PAYROLL_EVIDENCE: "another imported payroll period overlaps this payment period",
  };
  const details = issues
    .filter((issue): issue is keyof typeof labels => issue in labels)
    .map((issue) => labels[issue]);
  return `Aggregate reconciliation needs review because ${details.join("; ") || "the evidence is incomplete"}. No individual paid dates are inferred.`;
}

export function derivePayrollDayState(input: {
  hasEntry: boolean;
  hasTimesheet: boolean;
  timesheetStatus?: "DRAFT" | "COMPLETED";
  scheduled: boolean;
  shiftEnded: boolean;
  hasPaycheck: boolean;
  aggregateStatus: PayrollStatus;
  aggregateExplanation: string;
  hasFtoRequest?: boolean;
  ftoApprovalStatus?: string;
  ftoPaymentStatus?: string;
  noWorkReason?: "SHIFT_CANCELED" | "COVERED_BY_COWORKER";
  scheduledOff?: boolean;
}) {
  if (input.hasFtoRequest) {
    if (input.aggregateStatus === "DISCREPANCY") {
      return {
        status: "DISCREPANCY" as const,
        detail: `${input.aggregateExplanation} FTO remains separate evidence: approval ${input.ftoApprovalStatus ?? "Requested"}; payment ${input.ftoPaymentStatus ?? "Unverified"}.`,
      };
    }
    return {
      status: input.ftoApprovalStatus === "APPROVED" ? "FTO_APPROVED" as const : "FTO_REQUESTED" as const,
      detail: `FTO is recorded separately from worked time. Approval: ${input.ftoApprovalStatus ?? "Requested"}; Payment: ${input.ftoPaymentStatus ?? "Unverified"}. Payroll evidence must resolve it without changing worked or overtime minutes.`,
    };
  }
  if (input.hasEntry) {
    if (input.timesheetStatus !== "COMPLETED") {
      return { status: "NEEDS_REVIEW" as const, detail: "Time is recorded in a Draft NAM Timesheet." };
    }
    if (!input.hasPaycheck) {
      return { status: "AWAITING_PAYROLL" as const, detail: "Completed NAM hours are awaiting paycheck confirmation." };
    }
    return {
      status: input.aggregateStatus,
      detail: input.aggregateStatus === "RECONCILED"
        ? "Aggregate NAM hours match the paycheck. Workday does not prove that this individual date was paid."
        : input.aggregateExplanation,
    };
  }
  if (input.noWorkReason) {
    return {
      status: input.aggregateStatus === "DISCREPANCY" ? "DISCREPANCY" as const : input.noWorkReason,
      detail: input.aggregateStatus === "DISCREPANCY"
        ? `${input.aggregateExplanation} This date is accounted for with zero worked hours as ${input.noWorkReason === "SHIFT_CANCELED" ? "a canceled shift" : "covered by a coworker"}.`
        : input.noWorkReason === "SHIFT_CANCELED"
          ? "Shift canceled; the employee was instructed not to report. Zero actual worked hours and no paid leave are inferred."
          : "The scheduled shift was covered by a coworker. Zero actual worked hours and no paid leave are recorded.",
    };
  }
  if (input.scheduled) {
    if (!input.shiftEnded) {
      return { status: "NEEDS_REVIEW" as const, detail: "Scheduled shift has not ended; no Timesheet is expected yet." };
    }
    if (!input.hasTimesheet) {
      return { status: "NEEDS_REVIEW" as const, detail: "Scheduled work exists, but NAM has no Timesheet history for this week. This is not proof of missed or unpaid work." };
    }
    return {
      status: "MISSING_TIMESHEET" as const,
      detail: input.timesheetStatus === "DRAFT"
        ? "The weekly Timesheet is Draft and has no entry for this completed scheduled shift."
        : "The Completed Timesheet has no entry for this scheduled shift.",
    };
  }
  if (input.scheduledOff) {
    return { status: "SCHEDULED_OFF" as const, detail: "Normal scheduled day off; no Timesheet explanation is required." };
  }
  if (input.hasPaycheck) {
    return { status: "NEEDS_REVIEW" as const, detail: "Payroll-period evidence exists, but this paycheck does not allocate paid hours to this date." };
  }
  return { status: "OFF" as const, detail: "No scheduled or recorded working time." };
}

export function monthCalendarRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    month: dateInputValue(first).slice(0, 7),
    first,
    last,
    calendarStart: startOfPayrollWeek(first),
    calendarEnd: endOfPayrollWeek(last),
  };
}

export function adjacentMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  return dateInputValue(new Date(Date.UTC(year, value - 1 + offset, 1))).slice(0, 7);
}
