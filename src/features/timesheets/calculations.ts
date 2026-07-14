import {
  MAX_GROSS_SHIFT_MINUTES,
  PAYROLL_WEEK_DAYS,
  WEEKLY_REGULAR_MINUTES,
} from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

export function startOfPayrollWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

export function endOfPayrollWeek(value: Date) {
  return addDays(startOfPayrollWeek(value), PAYROLL_WEEK_DAYS - 1);
}

export function buildPayrollWeekDates(value: Date) {
  const start = startOfPayrollWeek(value);
  return Array.from({ length: PAYROLL_WEEK_DAYS }, (_, index) => dateInputValue(addDays(start, index)));
}

export function normalizeIdentityKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeReferenceKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeSupportPersonKey(
  displayName: string,
  tradeOrRole: string,
  company?: string,
) {
  return [displayName, tradeOrRole, company ?? ""]
    .map((value) => normalizeIdentityKey(value))
    .join("|");
}

export function parseClockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateGrossMinutes(clockIn: string, clockOut: string) {
  const start = parseClockMinutes(clockIn);
  let end = parseClockMinutes(clockOut);
  if (end <= start) {
    end += MAX_GROSS_SHIFT_MINUTES;
  }
  return end - start;
}

export function calculateWorkedMinutes(
  clockIn: string,
  clockOut: string,
  unpaidBreakMinutes: number,
) {
  return calculateGrossMinutes(clockIn, clockOut) - unpaidBreakMinutes;
}

export type WorkedEntry = { workDate: string; workedMinutes: number };

export type TimesheetPreviewInput = {
  workDate: string;
  clockIn: string;
  clockOut: string;
  unpaidBreakMinutes: number;
  allocations: Array<{ allocatedMinutes: number }>;
};

export type TimesheetEntryPreview = {
  workDate: string;
  grossMinutes: number;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  allocatedMinutes: number;
  allocationDifferenceMinutes: number;
  balanced: boolean;
};

export function allocateWeeklyOvertime<T extends WorkedEntry>(entries: T[]) {
  let regularRemaining = WEEKLY_REGULAR_MINUTES;
  return [...entries]
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((entry) => {
      const regularMinutes = Math.min(entry.workedMinutes, Math.max(regularRemaining, 0));
      const overtimeMinutes = entry.workedMinutes - regularMinutes;
      regularRemaining -= regularMinutes;
      return { ...entry, regularMinutes, overtimeMinutes };
    });
}

function previewMinutes(value: number) {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function buildTimesheetPreview(entries: TimesheetPreviewInput[]) {
  const workedEntries = entries.map((entry) => {
    const grossMinutes = calculateGrossMinutes(entry.clockIn, entry.clockOut);
    const workedMinutes = calculateWorkedMinutes(
      entry.clockIn,
      entry.clockOut,
      previewMinutes(entry.unpaidBreakMinutes),
    );
    return {
      ...entry,
      grossMinutes: Number.isFinite(grossMinutes) ? grossMinutes : 0,
      workedMinutes: Number.isFinite(workedMinutes) ? Math.max(workedMinutes, 0) : 0,
    };
  });
  const payrollEntries = allocateWeeklyOvertime(workedEntries);
  const previews: TimesheetEntryPreview[] = payrollEntries.map((entry) => {
    const allocatedMinutes = entry.allocations.reduce(
      (sum, allocation) => sum + Math.max(previewMinutes(allocation.allocatedMinutes), 0),
      0,
    );
    const allocationDifferenceMinutes = entry.workedMinutes - allocatedMinutes;
    return {
      workDate: entry.workDate,
      grossMinutes: entry.grossMinutes,
      workedMinutes: entry.workedMinutes,
      regularMinutes: entry.regularMinutes,
      overtimeMinutes: entry.overtimeMinutes,
      allocatedMinutes,
      allocationDifferenceMinutes,
      balanced: allocationDifferenceMinutes === 0,
    };
  });

  const workedMinutes = previews.reduce((sum, entry) => sum + entry.workedMinutes, 0);
  const allocatedMinutes = previews.reduce((sum, entry) => sum + entry.allocatedMinutes, 0);
  return {
    entries: previews,
    workedMinutes,
    regularMinutes: previews.reduce((sum, entry) => sum + entry.regularMinutes, 0),
    overtimeMinutes: previews.reduce((sum, entry) => sum + entry.overtimeMinutes, 0),
    allocatedMinutes,
    allocationDifferenceMinutes: workedMinutes - allocatedMinutes,
    balanced: previews.every((entry) => entry.balanced),
  };
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}:${String(remainder).padStart(2, "0")}`;
}
