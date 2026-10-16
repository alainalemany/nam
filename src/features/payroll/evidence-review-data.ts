import "server-only";

import { requirePayrollEvidenceReviewer } from "./auth";
import { prisma } from "@/lib/prisma";

export type EvidenceReviewQueueFilters = {
  type?: "all" | "timesheets" | "rates";
  status?: string;
  from?: string;
  to?: string;
  page?: number;
};

const PAGE_SIZE = 20;

function dateBoundary(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function getEvidenceReviewDashboard(filters: EvidenceReviewQueueFilters = {}) {
  await requirePayrollEvidenceReviewer();
  const page = Math.max(1, Math.min(filters.page ?? 1, 10_000));
  const from = dateBoundary(filters.from);
  const to = dateBoundary(filters.to);
  const showTimesheets = !filters.type || filters.type === "all" || filters.type === "timesheets";
  const showRates = !filters.type || filters.type === "all" || filters.type === "rates";
  const timesheetStatuses = ["NEEDS_REVIEW", "REVIEWED_UNASSIGNED"] as const;
  const rateStatuses = ["NEEDS_REVIEW", "CONFLICT"] as const;
  const requestedTimesheetStatus = timesheetStatuses.find((item) => item === filters.status);
  const requestedRateStatus = rateStatuses.find((item) => item === filters.status);
  const timesheetWhere = {
    primaryEmployeeIdentityStatus: requestedTimesheetStatus ?? { in: [...timesheetStatuses] },
    ...(from || to ? { payrollWeekStartDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const rateWhere = {
    verificationStatus: requestedRateStatus ?? { in: [...rateStatuses] },
    ...(from || to ? { effectiveFrom: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [timesheetCount, rateCount, conflictCount, timesheets, rates, recentTimesheetEvents, recentRateEvents] = await Promise.all([
    prisma.weeklyTimesheet.count({ where: { primaryEmployeeIdentityStatus: { in: [...timesheetStatuses] } } }),
    prisma.employeePayRate.count({ where: { verificationStatus: { in: [...rateStatuses] } } }),
    prisma.employeePayRate.count({ where: { verificationStatus: "CONFLICT" } }),
    showTimesheets && (!filters.status || requestedTimesheetStatus)
      ? prisma.weeklyTimesheet.findMany({
          where: timesheetWhere,
          orderBy: [{ payrollWeekStartDate: "desc" }, { id: "asc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [],
    showRates && (!filters.status || requestedRateStatus)
      ? prisma.employeePayRate.findMany({
          where: rateWhere,
          include: { employee: { select: { id: true, displayName: true, employeeCode: true } } },
          orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [],
    prisma.timesheetIdentityReviewEvent.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      include: { weeklyTimesheet: { select: { primaryEmployeeDisplayName: true } } },
    }),
    prisma.payRateEvidenceReviewEvent.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      include: { employeePayRate: { include: { employee: { select: { displayName: true } } } } },
    }),
  ]);
  return { page, pageSize: PAGE_SIZE, counts: { timesheets: timesheetCount, rates: rateCount, conflicts: conflictCount }, timesheets, rates, recentTimesheetEvents, recentRateEvents };
}

export async function getTimesheetIdentityReviewEvidence(id: string) {
  await requirePayrollEvidenceReviewer();
  return prisma.weeklyTimesheet.findUnique({
    where: { id },
    include: {
      primaryEmployee: { select: { id: true, displayName: true, employeeCode: true, isActive: true } },
      entries: {
        orderBy: { workDate: "asc" },
        include: {
          allocations: {
            orderBy: { sequence: "asc" },
            include: { supportPersonnel: { include: { supportPerson: true } } },
          },
          workScheduleDailyAssignment: {
            include: { weeklySchedule: true },
          },
        },
      },
      identityReviewEvents: {
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
      },
    },
  });
}

export async function getPayRateEvidenceReviewEvidence(id: string) {
  await requirePayrollEvidenceReviewer();
  const rate = await prisma.employeePayRate.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, displayName: true, employeeCode: true, isActive: true } },
      sourcePaycheck: { include: { payrollPeriod: true } },
      reviewEvents: {
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
        include: { previousSourcePaycheck: { include: { payrollPeriod: true } }, newSourcePaycheck: { include: { payrollPeriod: true } } },
      },
    },
  });
  if (!rate) return undefined;
  const [competingRates, paychecks] = await Promise.all([
    prisma.employeePayRate.findMany({
      where: { employeeId: rate.employeeId, effectiveFrom: rate.effectiveFrom },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.paycheck.findMany({
      where: { employeeId: rate.employeeId },
      include: { payrollPeriod: true },
      orderBy: [{ checkDate: "desc" }, { id: "asc" }],
    }),
  ]);
  return { rate, competingRates, paychecks };
}

export async function getHistoricalEmployeeReviewChoices() {
  await requirePayrollEvidenceReviewer();
  return prisma.employee.findMany({
    select: { id: true, displayName: true, employeeCode: true, isActive: true },
    orderBy: [{ displayName: "asc" }, { employeeCode: "asc" }, { id: "asc" }],
  });
}
