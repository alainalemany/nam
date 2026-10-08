import { addDays, dateInputValue, endOfPayrollWeek, parseDateOnly, startOfPayrollWeek } from "@/features/timesheets/calculations";

import type { PayrollStatus } from "./constants";

export function payrollPeriodForDate(value: Date) {
  const periodStart = startOfPayrollWeek(value);
  const periodEnd = endOfPayrollWeek(value);
  return {
    periodStart,
    periodEnd,
    expectedCheckDate: addDays(periodEnd, 5),
  };
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

export function aggregateReconciliationState(input: {
  hasPaycheck: boolean;
  timesheetStatus?: "DRAFT" | "COMPLETED";
  recordedMinutes?: number;
  paidMinutes?: number;
}): { status: PayrollStatus; differenceMinutes: number; explanation: string } {
  if (!input.hasPaycheck) {
    if (input.timesheetStatus === "COMPLETED") {
      return {
        status: "AWAITING_PAYROLL",
        differenceMinutes: 0,
        explanation: "Completed NAM hours are waiting for paycheck confirmation.",
      };
    }
    return {
      status: "NEEDS_REVIEW",
      differenceMinutes: 0,
      explanation: input.timesheetStatus === "DRAFT"
        ? "The NAM Timesheet is still Draft."
        : "No completed NAM Timesheet exists for this period.",
    };
  }
  if (input.timesheetStatus !== "COMPLETED" || input.recordedMinutes == null) {
    return {
      status: "NEEDS_REVIEW",
      differenceMinutes: 0,
      explanation: "The paycheck is official, but NAM has no completed Timesheet evidence for comparison.",
    };
  }
  const differenceMinutes = input.recordedMinutes - (input.paidMinutes ?? 0);
  return differenceMinutes === 0
    ? {
        status: "RECONCILED",
        differenceMinutes,
        explanation: "Aggregate NAM Timesheet hours match aggregate paycheck hours; individual dates are not independently confirmed.",
      }
    : {
        status: "DISCREPANCY",
        differenceMinutes,
        explanation: `${formatHours(Math.abs(differenceMinutes))} ${differenceMinutes > 0 ? "more recorded than paid" : "more paid than recorded"}; review the source records.`,
      };
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
}) {
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
