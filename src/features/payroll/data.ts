import { Prisma } from "@prisma/client";

import { homeShiftInterval } from "@/features/work-schedule/home-summary";
import { dateInputValue, normalizeIdentityKey, parseDateOnly } from "@/features/timesheets/calculations";
import { prisma } from "@/lib/prisma";
import { dateKeyInTimeZone } from "@/lib/zoned-date-time";

import {
  aggregateReconciliationState,
  dateRangeLabel,
  derivePayrollDayState,
  estimatedGrossCents,
  formatCents,
  formatHours,
  monthCalendarRange,
  payrollPeriodForDate,
} from "./calculations";
import { payrollStatusLabels, type PayrollStatus } from "./constants";
import type { PayrollCalendarDay } from "./types";

const paycheckInclude = { payrollPeriod: true } satisfies Prisma.PaycheckInclude;
type PaycheckRecord = Prisma.PaycheckGetPayload<{ include: typeof paycheckInclude }>;

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

export async function getPayrollDashboardData(employeeId: string, requestedMonth: string) {
  const range = monthCalendarRange(requestedMonth);
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Configured payroll owner could not be found.");
  const ownerKey = normalizeIdentityKey(employee.displayName);
  const [assignments, entries, timesheets, paychecks, payRates] = await Promise.all([
    prisma.dailyAssignment.findMany({
      where: {
        assignmentDate: { gte: range.calendarStart, lte: range.calendarEnd },
        weeklySchedule: { primaryEmployeeId: employeeId },
      },
      include: { weeklySchedule: true },
      orderBy: { assignmentDate: "asc" },
    }),
    prisma.dailyTimeEntry.findMany({
      where: {
        workDate: { gte: range.calendarStart, lte: range.calendarEnd },
        weeklyTimesheet: {
          OR: [{ primaryEmployeeId: employeeId }, { primaryEmployeeKey: ownerKey }],
        },
      },
      include: { weeklyTimesheet: true },
      orderBy: { workDate: "asc" },
    }),
    prisma.weeklyTimesheet.findMany({
      where: { OR: [{ primaryEmployeeId: employeeId }, { primaryEmployeeKey: ownerKey }] },
      orderBy: { payrollWeekStartDate: "desc" },
    }),
    prisma.paycheck.findMany({
      where: { employeeId },
      include: paycheckInclude,
      orderBy: { checkDate: "desc" },
    }),
    prisma.employeePayRate.findMany({ where: { employeeId }, orderBy: { effectiveFrom: "asc" } }),
  ]);

  const assignmentByDate = new Map(assignments.map((item) => [dateInputValue(item.assignmentDate), item]));
  const entryByDate = new Map(entries.map((item) => [dateInputValue(item.workDate), item]));
  const timesheetByStart = new Map(timesheets.map((item) => [dateInputValue(item.payrollWeekStartDate), item]));
  const paycheckByStart = new Map(paychecks.map((item) => [dateInputValue(item.payrollPeriod.periodStart), item]));
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
    const entry = entryByDate.get(key);
    const timesheet = timesheetByStart.get(periodStart);
    const paycheck = paycheckByStart.get(periodStart);
    const aggregate = aggregateReconciliationState({
      hasPaycheck: Boolean(paycheck),
      timesheetStatus: timesheet?.status,
      recordedMinutes: timesheet?.workedMinutesTotal,
      paidMinutes: paycheck
        ? paycheck.regularPaidMinutes + paycheck.overtimePaidMinutes
        : undefined,
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
    const dayState = derivePayrollDayState({
      hasEntry: Boolean(entry),
      hasTimesheet: Boolean(timesheet),
      timesheetStatus: timesheet?.status,
      scheduled: effectiveStatus === "SCHEDULED",
      shiftEnded,
      hasPaycheck: Boolean(paycheck),
      aggregateStatus: aggregate.status,
      aggregateExplanation: aggregate.explanation,
    });
    const status: PayrollStatus = dayState.status;
    const detail = dayState.detail;
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

  const periodSummaries = timesheets.map((timesheet) => {
    const start = dateInputValue(timesheet.payrollWeekStartDate);
    const paycheck = paycheckByStart.get(start);
    const paidMinutes = paycheck
      ? paycheck.regularPaidMinutes + paycheck.overtimePaidMinutes
      : undefined;
    return {
      timesheet,
      paycheck,
      ...aggregateReconciliationState({
        hasPaycheck: Boolean(paycheck),
        timesheetStatus: timesheet.status,
        recordedMinutes: timesheet.workedMinutesTotal,
        paidMinutes,
      }),
    };
  });
  const reconciledMinutes = periodSummaries
    .filter((item) => item.status === "RECONCILED")
    .reduce((sum, item) => sum + item.timesheet.workedMinutesTotal, 0);
  const pendingTimesheets = periodSummaries.filter((item) => item.status === "AWAITING_PAYROLL");
  const pendingMinutes = pendingTimesheets.reduce((sum, item) => sum + item.timesheet.workedMinutesTotal, 0);
  const pendingGrossCents = pendingTimesheets.reduce((sum, item) => {
    const rate = effectiveRate(payRates, dateInputValue(item.timesheet.payrollWeekStartDate), paychecks);
    return rate
      ? sum + estimatedGrossCents(item.timesheet.regularMinutesTotal, item.timesheet.overtimeMinutesTotal, rate)
      : sum;
  }, 0);
  const openIssues = days.filter((day) => day.inMonth && day.status === "MISSING_TIMESHEET").length +
    periodSummaries.filter((item) => item.status === "DISCREPANCY").length;
  const latest = paychecks[0];
  const currentPeriod = payrollPeriodForDate(now);

  return {
    employee: { id: employee.id, displayName: employee.displayName },
    month: range.month,
    days,
    summary: {
      reconciledMinutes,
      pendingMinutes,
      pendingGross: pendingTimesheets.length > 0 ? formatCents(pendingGrossCents) : undefined,
      openIssues,
      latestPaycheck: latest ? paycheckView(latest) : undefined,
      nextExpectedCheckDate: dateInputValue(currentPeriod.expectedCheckDate),
    },
    paychecks: paychecks.map((paycheck) => {
      const timesheet = timesheetByStart.get(dateInputValue(paycheck.payrollPeriod.periodStart));
      const state = aggregateReconciliationState({
        hasPaycheck: true,
        timesheetStatus: timesheet?.status,
        recordedMinutes: timesheet?.workedMinutesTotal,
        paidMinutes: paycheck.regularPaidMinutes + paycheck.overtimePaidMinutes,
      });
      return { ...paycheckView(paycheck), ...state };
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
