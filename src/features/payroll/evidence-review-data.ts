import "server-only";

import { requirePayrollEvidenceReviewer } from "./auth";
import { prisma } from "@/lib/prisma";

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
            include: { supportPersonnel: true },
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
      reviewEvents: { orderBy: [{ sequence: "asc" }, { id: "asc" }] },
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
