import { Prisma } from "@prisma/client";

import { homeShiftInterval } from "@/features/work-schedule/home-summary";
import {
  dateInputValue,
  normalizeIdentityKey,
  parseDateOnly,
  startOfPayrollWeek,
} from "@/features/timesheets/calculations";
import { prisma } from "@/lib/prisma";
import { dateKeyInTimeZone } from "@/lib/zoned-date-time";

import {
  dateRangeLabel,
  derivePayrollDayState,
  estimatedGrossCents,
  formatCents,
  formatHours,
  monthCalendarRange,
  payrollPeriodForDate,
  reconcilePayrollEvidence,
  type MinuteBreakdown,
  type ReconciliationReason,
} from "./calculations";
import { payrollStatusLabels, type PayrollStatus } from "./constants";
import type { PayrollCalendarDay } from "./types";

const paycheckInclude = { payrollPeriod: true } satisfies Prisma.PaycheckInclude;
type PaycheckRecord = Prisma.PaycheckGetPayload<{ include: typeof paycheckInclude }>;
const timesheetInclude = { entries: true } satisfies Prisma.WeeklyTimesheetInclude;
type TimesheetRecord = Prisma.WeeklyTimesheetGetPayload<{ include: typeof timesheetInclude }>;

function paycheckView(paycheck: PaycheckRecord) {
  const paidMinutes = paycheck.regularPaidMinutes + paycheck.overtimePaidMinutes;
  return {
    id: paycheck.id,
    periodStart: dateInputValue(paycheck.payrollPeriod.periodStart),
    periodEnd: dateInputValue(paycheck.payrollPeriod.periodEnd),
    periodLabel: dateRangeLabel(paycheck.payrollPeriod.periodStart, paycheck.payrollPeriod.periodEnd),
    checkDate: dateInputValue(paycheck.checkDate),
    regularPaidMinutes: paycheck.regularPaidMinutes,
    overtimePaidMinutes: paycheck.overtimePaidMinutes,
    paidMinutes,
    baseRate: paycheck.baseRate?.toString(),
    regularEarnings: paycheck.regularEarnings.toString(),
    overtimeBaseEarnings: paycheck.overtimeBaseEarnings.toString(),
    overtimePremiumEarnings: paycheck.overtimePremiumEarnings.toString(),
    otherCashEarnings: paycheck.otherCashEarnings.toString(),
    grossCashPay: paycheck.grossCashPay.toString(),
    noncashImputedEarnings: paycheck.noncashImputedEarnings.toString(),
    preTaxDeductions: paycheck.preTaxDeductions.toString(),
    employeeTaxes: paycheck.employeeTaxes.toString(),
    postTaxDeductions: paycheck.postTaxDeductions.toString(),
    adjustments: paycheck.adjustments.toString(),
    netPay: paycheck.netPay.toString(),
    reviewStatus: paycheck.reviewStatus,
    importedAt: paycheck.importedAt,
    notes: paycheck.notes ?? "",
    parserVersion: paycheck.parserVersion,
    fingerprint: paycheck.sourceFingerprint,
  };
}

function effectiveRate(
  rates: Array<{ effectiveFrom: Date; hourlyRate: Prisma.Decimal }>,
  date: string,
  paychecks: PaycheckRecord[],
) {
  const configured = [...rates]
    .reverse()
    .find((rate) => dateInputValue(rate.effectiveFrom) <= date)?.hourlyRate.toString();
  if (configured) return configured;
  return paychecks.find(
    (paycheck) =>
      paycheck.baseRate && dateInputValue(paycheck.payrollPeriod.periodStart) <= date,
  )?.baseRate?.toString();
}

function intervalsOverlap(firstStart: Date, firstEnd: Date, secondStart: Date, secondEnd: Date) {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

function uniqueEntries(timesheets: TimesheetRecord[], start: Date, end: Date) {
  const byId = new Map(
    timesheets.flatMap((timesheet) => timesheet.entries)
      .filter((entry) => entry.workDate >= start && entry.workDate <= end)
      .map((entry) => [entry.id, entry]),
  );
  return [...byId.values()];
}

function minuteBreakdown(entries: ReturnType<typeof uniqueEntries>): MinuteBreakdown {
  return entries.reduce(
    (sum, entry) => ({
      totalMinutes: sum.totalMinutes + entry.workedMinutes,
      regularMinutes: sum.regularMinutes + entry.regularMinutes,
      overtimeMinutes: sum.overtimeMinutes + entry.overtimeMinutes,
    }),
    { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
  );
}

function expectedWeekStarts(periodStart: Date, periodEnd: Date) {
  const result = new Set<string>();
  for (let date = periodStart; date <= periodEnd; date = new Date(date.getTime() + 86_400_000)) {
    result.add(dateInputValue(startOfPayrollWeek(date)));
  }
  return result;
}

function reconcilePaycheck(
  paycheck: PaycheckRecord,
  canonicalTimesheets: TimesheetRecord[],
  legacyTimesheets: TimesheetRecord[],
  paychecks: PaycheckRecord[],
  assignments: Array<{
    assignmentDate: Date;
    plannedStatus: string;
    actualStatus: string;
  }>,
) {
  const { periodStart, periodEnd } = paycheck.payrollPeriod;
  const contributing = canonicalTimesheets.filter((timesheet) =>
    intervalsOverlap(timesheet.payrollWeekStartDate, timesheet.payrollWeekEndDate, periodStart, periodEnd));
  const entries = uniqueEntries(contributing, periodStart, periodEnd);
  const recorded = minuteBreakdown(entries);
  const paid = {
    totalMinutes: paycheck.regularPaidMinutes + paycheck.overtimePaidMinutes,
    regularMinutes: paycheck.regularPaidMinutes,
    overtimeMinutes: paycheck.overtimePaidMinutes,
  };
  const issues: ReconciliationReason[] = [];
  if (paycheck.reviewStatus !== "CONFIRMED") {
    issues.push("UNCONFIRMED_PAYCHECK_EVIDENCE");
  }
  const weekStarts = expectedWeekStarts(periodStart, periodEnd);
  const contributingByWeek = new Map<string, TimesheetRecord[]>();
  for (const timesheet of contributing) {
    const key = dateInputValue(timesheet.payrollWeekStartDate);
    contributingByWeek.set(key, [...(contributingByWeek.get(key) ?? []), timesheet]);
  }
  if ([...weekStarts].some((key) => !contributingByWeek.has(key)) || entries.length === 0) {
    issues.push("MISSING_TIMESHEET_EVIDENCE");
  }
  const entryDates = new Set(entries.map((entry) => dateInputValue(entry.workDate)));
  if (assignments.some((assignment) => {
    const effectiveStatus = assignment.actualStatus !== "UNKNOWN"
      ? assignment.actualStatus
      : assignment.plannedStatus;
    return effectiveStatus === "SCHEDULED" &&
      assignment.assignmentDate >= periodStart &&
      assignment.assignmentDate <= periodEnd &&
      !entryDates.has(dateInputValue(assignment.assignmentDate));
  })) {
    issues.push("MISSING_TIMESHEET_EVIDENCE");
  }
  if (contributing.some((timesheet) => timesheet.status === "DRAFT")) {
    issues.push("DRAFT_TIMESHEET_EVIDENCE");
  }
  if ([...contributingByWeek.values()].some((items) => items.length > 1)) {
    issues.push("AMBIGUOUS_TIMESHEET_EVIDENCE");
  }
  const dates = entries.map((entry) => dateInputValue(entry.workDate));
  if (new Set(dates).size !== dates.length) {
    issues.push("AMBIGUOUS_TIMESHEET_EVIDENCE");
  }
  if (legacyTimesheets.some((timesheet) =>
    timesheet.entries.some((entry) => entry.workDate >= periodStart && entry.workDate <= periodEnd))) {
    issues.push("UNRESOLVED_EMPLOYEE_IDENTITY");
  }
  if (paychecks.some((candidate) => candidate.id !== paycheck.id && intervalsOverlap(
    candidate.payrollPeriod.periodStart,
    candidate.payrollPeriod.periodEnd,
    periodStart,
    periodEnd,
  ))) {
    issues.push("OVERLAPPING_PAYROLL_EVIDENCE");
  }
  const dayBeforePeriod = new Date(periodStart.getTime() - 86_400_000);
  const crossesStartBoundary = canonicalTimesheets.some((timesheet) =>
    timesheet.entries.some((entry) =>
      dateInputValue(entry.workDate) === dateInputValue(dayBeforePeriod) &&
      entry.clockOut <= entry.clockIn));
  const crossesEndBoundary = entries.some((entry) =>
    entry.clockOut <= entry.clockIn &&
    dateInputValue(entry.workDate) === dateInputValue(periodEnd));
  return {
    entries,
    recorded,
    paid,
    boundaryExplanation: crossesStartBoundary || crossesEndBoundary
      ? "An overnight entry intersects a payment-period boundary. All minutes remain attributed to its start-date workDate."
      : undefined,
    ...reconcilePayrollEvidence({ hasPaycheck: true, recorded, paid, evidenceIssues: issues }),
  };
}

export async function getPayrollDashboardData(employeeId: string, requestedMonth: string) {
  const range = monthCalendarRange(requestedMonth);
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Configured payroll owner could not be found.");
  const ownerKey = normalizeIdentityKey(employee.displayName);
  const [timesheets, legacyTimesheets, paychecks, payRates] = await Promise.all([
    prisma.weeklyTimesheet.findMany({
      where: { primaryEmployeeId: employeeId },
      include: timesheetInclude,
      orderBy: { payrollWeekStartDate: "desc" },
    }),
    prisma.weeklyTimesheet.findMany({
      where: { primaryEmployeeId: null, primaryEmployeeKey: ownerKey },
      include: timesheetInclude,
      orderBy: { payrollWeekStartDate: "desc" },
    }),
    prisma.paycheck.findMany({
      where: { employeeId },
      include: paycheckInclude,
      orderBy: { checkDate: "desc" },
    }),
    prisma.employeePayRate.findMany({ where: { employeeId }, orderBy: { effectiveFrom: "asc" } }),
  ]);
  const assignmentStart = paychecks.reduce(
    (earliest, paycheck) => paycheck.payrollPeriod.periodStart < earliest ? paycheck.payrollPeriod.periodStart : earliest,
    range.calendarStart,
  );
  const assignmentEnd = paychecks.reduce(
    (latest, paycheck) => paycheck.payrollPeriod.periodEnd > latest ? paycheck.payrollPeriod.periodEnd : latest,
    range.calendarEnd,
  );
  const assignments = await prisma.dailyAssignment.findMany({
    where: {
      assignmentDate: { gte: assignmentStart, lte: assignmentEnd },
      weeklySchedule: { primaryEmployeeId: employeeId, status: "ACTIVE" },
    },
    include: { weeklySchedule: true },
    orderBy: { assignmentDate: "asc" },
  });

  const assignmentByDate = new Map(assignments.map((item) => [dateInputValue(item.assignmentDate), item]));
  const entries = timesheets.flatMap((timesheet) => timesheet.entries.map((entry) => ({ ...entry, weeklyTimesheet: timesheet })));
  const legacyTimesheetIdsByDate = new Map<string, string[]>();
  for (const timesheet of legacyTimesheets) {
    for (const entry of timesheet.entries) {
      const key = dateInputValue(entry.workDate);
      legacyTimesheetIdsByDate.set(key, [
        ...(legacyTimesheetIdsByDate.get(key) ?? []),
        timesheet.id,
      ]);
    }
  }
  const entriesByDate = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = dateInputValue(entry.workDate);
    entriesByDate.set(key, [...(entriesByDate.get(key) ?? []), entry]);
  }
  const timesheetsByStart = new Map<string, TimesheetRecord[]>();
  for (const timesheet of timesheets) {
    const key = dateInputValue(timesheet.payrollWeekStartDate);
    timesheetsByStart.set(key, [...(timesheetsByStart.get(key) ?? []), timesheet]);
  }
  const reconciliationByPaycheckId = new Map(paychecks.map((paycheck) => [
    paycheck.id,
    reconcilePaycheck(paycheck, timesheets, legacyTimesheets, paychecks, assignments),
  ]));
  const monthPaychecks = paychecks.filter((paycheck) =>
    paycheck.payrollPeriod.periodEnd >= range.first && paycheck.payrollPeriod.periodEnd <= range.last);
  const monthReconciliations = monthPaychecks.map((paycheck) => ({
    paycheck,
    reconciliation: reconciliationByPaycheckId.get(paycheck.id)!,
  }));
  const openIssueKeys = new Set(
    monthReconciliations
      .filter((item) => item.reconciliation.status === "DISCREPANCY" || item.reconciliation.status === "NEEDS_REVIEW")
      .map((item) => `paycheck:${item.paycheck.id}`),
  );
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  const days: PayrollCalendarDay[] = [];

  for (
    let date = range.calendarStart;
    date <= range.calendarEnd;
    date = new Date(date.getTime() + 86_400_000)
  ) {
    const key = dateInputValue(date);
    const period = payrollPeriodForDate(date);
    const periodStart = dateInputValue(period.periodStart);
    const assignment = assignmentByDate.get(key);
    const dateEntries = entriesByDate.get(key) ?? [];
    const entry = dateEntries[0];
    const dateTimesheets = timesheetsByStart.get(periodStart) ?? [];
    const timesheet = dateTimesheets[0];
    const matchingPaychecks = paychecks.filter((item) =>
      parseDateOnly(key) >= item.payrollPeriod.periodStart && parseDateOnly(key) <= item.payrollPeriod.periodEnd);
    const paycheck = matchingPaychecks.length === 1 ? matchingPaychecks[0] : undefined;
    const aggregate = paycheck
      ? reconciliationByPaycheckId.get(paycheck.id)!
      : reconcilePayrollEvidence({
          hasPaycheck: false,
          recorded: entry ? minuteBreakdown([entry]) : undefined,
          evidenceIssues: dateEntries.length > 1 ? ["AMBIGUOUS_TIMESHEET_EVIDENCE"] : undefined,
        });
    const effectiveStatus = assignment && assignment.actualStatus !== "UNKNOWN"
      ? assignment.actualStatus
      : assignment?.plannedStatus;
    const effectiveShift = assignment && assignment.actualStatus !== "UNKNOWN"
      ? assignment.actualShift
      : assignment?.plannedShift;
    const shiftEnded = effectiveShift === "DAY" || effectiveShift === "NIGHT"
      ? homeShiftInterval(key, effectiveShift).end <= now
      : parseDateOnly(key) < parseDateOnly(today);
    const derivedDayState = derivePayrollDayState({
      hasEntry: Boolean(entry),
      hasTimesheet: Boolean(timesheet),
      timesheetStatus: timesheet?.status,
      scheduled: effectiveStatus === "SCHEDULED",
      shiftEnded,
      hasPaycheck: matchingPaychecks.length > 0,
      aggregateStatus: matchingPaychecks.length > 1 ? "NEEDS_REVIEW" : aggregate.status,
      aggregateExplanation: matchingPaychecks.length > 1
        ? "More than one imported payroll period covers this date. Aggregate evidence needs review."
        : [
            aggregate.explanation,
            "boundaryExplanation" in aggregate ? aggregate.boundaryExplanation : undefined,
          ].filter(Boolean).join(" "),
    });
    const legacyTimesheetIds = legacyTimesheetIdsByDate.get(key) ?? [];
    const dayState = legacyTimesheetIds.length > 0
      ? {
          status: "NEEDS_REVIEW" as const,
          detail: "A legacy Timesheet entry with a matching historical name snapshot exists, but its Employee ID is unresolved. It is not counted as this employee's confirmed Payroll evidence.",
        }
      : derivedDayState;
    const status: PayrollStatus = dayState.status;
    const detail = dayState.detail;
    if (date >= range.first && date <= range.last) {
      const issuePaychecks = matchingPaychecks.filter((item) => {
        const reconciliation = reconciliationByPaycheckId.get(item.id)!;
        return reconciliation.status === "DISCREPANCY" || reconciliation.status === "NEEDS_REVIEW";
      });
      for (const item of issuePaychecks) openIssueKeys.add(`paycheck:${item.id}`);
      const coveredReasons = new Set(issuePaychecks.flatMap((item) =>
        reconciliationByPaycheckId.get(item.id)!.reasons));
      if (!coveredReasons.has("UNRESOLVED_EMPLOYEE_IDENTITY")) {
        for (const id of legacyTimesheetIds) openIssueKeys.add(`legacy-timesheet:${id}`);
      }
      if (entry && timesheet?.status === "DRAFT" && !coveredReasons.has("DRAFT_TIMESHEET_EVIDENCE")) {
        openIssueKeys.add(`draft-timesheet:${timesheet.id}`);
      }
      if (dateEntries.length > 1 && !coveredReasons.has("AMBIGUOUS_TIMESHEET_EVIDENCE")) {
        openIssueKeys.add(`ambiguous-timesheet-date:${key}`);
      }
      if (
        effectiveStatus === "SCHEDULED" &&
        shiftEnded &&
        !entry &&
        !coveredReasons.has("MISSING_TIMESHEET_EVIDENCE")
      ) {
        openIssueKeys.add(`missing-timesheet-date:${key}`);
      }
    }
    let actionHref: string | undefined;
    let actionLabel: string | undefined;
    if (entry) {
      if (timesheet?.status !== "COMPLETED") {
        actionHref = `/timesheets/${entry.weeklyTimesheetId}/edit`;
        actionLabel = "Finish Timesheet";
      }
    } else if (status === "MISSING_TIMESHEET" && timesheet) {
      actionHref = `/timesheets/${timesheet.id}${timesheet.status === "DRAFT" ? "/edit" : ""}`;
      actionLabel = "Open Timesheet";
    }
    const rate = effectiveRate(payRates, key, paychecks);
    days.push({
      date: key,
      dayNumber: date.getUTCDate(),
      inMonth: date.getUTCMonth() === range.first.getUTCMonth(),
      status,
      statusLabel: status === "RECONCILED" && paycheck
        ? "Aggregate match"
        : payrollStatusLabels[status],
      scheduledLabel: assignment
        ? effectiveStatus === "NON_WORKING" ? "Off" : `${effectiveShift === "NIGHT" ? "Night" : effectiveShift === "DAY" ? "Day" : "Scheduled"} shift`
        : undefined,
      equipmentLabel: assignment
        ? (assignment.actualStatus !== "UNKNOWN" ? assignment.actualEquipmentDisplayName : assignment.plannedEquipmentDisplayName) ?? undefined
        : undefined,
      timesheetMinutes: entry?.workedMinutes,
      payrollPeriodLabel: paycheck ? dateRangeLabel(paycheck.payrollPeriod.periodStart, paycheck.payrollPeriod.periodEnd) : undefined,
      paidEvidenceLabel: paycheck ? `${formatHours(paycheck.regularPaidMinutes + paycheck.overtimePaidMinutes)} aggregate paid` : undefined,
      evidenceLevel: paycheck ? "aggregate" : undefined,
      estimatedGross: entry && rate ? formatCents(estimatedGrossCents(entry.regularMinutes, entry.overtimeMinutes, rate)) : undefined,
      detail,
      actionHref,
      actionLabel,
    });
  }

  const reconciledMinutes = monthReconciliations
    .filter((item) => item.reconciliation.status === "RECONCILED")
    .reduce((sum, item) => sum + item.reconciliation.recorded.totalMinutes, 0);
  const pendingEntries = timesheets
    .filter((timesheet) =>
      timesheet.status === "COMPLETED" &&
      timesheet.payrollWeekEndDate >= range.first &&
      timesheet.payrollWeekEndDate <= range.last)
    .flatMap((timesheet) => timesheet.entries)
    .filter((entry) => !paychecks.some((paycheck) =>
      entry.workDate >= paycheck.payrollPeriod.periodStart &&
      entry.workDate <= paycheck.payrollPeriod.periodEnd));
  const pendingMinutes = pendingEntries.reduce((sum, item) => sum + item.workedMinutes, 0);
  const pendingGrossCents = pendingEntries.reduce((sum, item) => {
    const rate = effectiveRate(payRates, dateInputValue(item.workDate), paychecks);
    return rate
      ? sum + estimatedGrossCents(item.regularMinutes, item.overtimeMinutes, rate)
      : sum;
  }, 0);
  const openIssues = openIssueKeys.size;
  const latest = paychecks[0];
  const currentPeriod = payrollPeriodForDate(now);

  return {
    employee: { id: employee.id, displayName: employee.displayName },
    month: range.month,
    days,
    summary: {
      reconciledMinutes,
      pendingMinutes,
      pendingGross: pendingEntries.length > 0 ? formatCents(pendingGrossCents) : undefined,
      openIssues,
      latestPaycheck: latest ? paycheckView(latest) : undefined,
      nextExpectedCheckDate: dateInputValue(currentPeriod.expectedCheckDate),
      reconciledScopeLabel: "Workday periods ending in selected month",
      pendingScopeLabel: "uncovered work dates in NAM weeks ending in selected month",
      issueScopeLabel: "unique actionable calendar records and Workday periods in selected scope",
    },
    paychecks: paychecks.map((paycheck) => {
      const state = reconciliationByPaycheckId.get(paycheck.id)!;
      return {
        ...paycheckView(paycheck),
        status: state.status,
        reason: state.reason,
        reasons: state.reasons,
        differenceMinutes: state.differenceMinutes,
        differences: state.differences,
        explanation: state.explanation,
        boundaryExplanation: state.boundaryExplanation,
      };
    }),
  };
}

export async function getPaycheckDetail(employeeId: string, id: string) {
  const paycheck = await prisma.paycheck.findFirst({
    where: { id, employeeId },
    include: paycheckInclude,
  });
  return paycheck ? paycheckView(paycheck) : undefined;
}

export async function getPayrollHomeSummary(employeeId: string) {
  const data = await getPayrollDashboardData(employeeId, dateKeyInTimeZone(new Date()).slice(0, 7));
  return data.summary;
}
