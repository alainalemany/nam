import "server-only";

import { Prisma } from "@prisma/client";

import { dateKeyInTimeZone } from "@/lib/zoned-date-time";
import { prisma } from "@/lib/prisma";

import { requirePayrollEvidenceReviewer } from "./auth";
import { primaryRateClassification } from "./rate-history-presentation";

const PAGE_SIZE = 20;
const HISTORY_LIMIT = 60;
const DETAIL_LIMIT = 100;

export type RateHistoryStatusFilter = "all" | "open" | "resolved" | "rejected" | "superseded";

function dateValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function candidateStatus(filter: RateHistoryStatusFilter) {
  return filter === "open" ? "OPEN" as const
    : filter === "resolved" ? "RESOLVED" as const
      : filter === "rejected" ? "REJECTED" as const
        : filter === "superseded" ? "SUPERSEDED" as const
          : undefined;
}

function observationView(link: {
  observation: {
    id: string;
    sourcePaycheckId: string;
    sourcePaycheckEvidenceRevision: number;
    sourceRowSequence: number;
    observedHourlyRate: Prisma.Decimal | null;
    regularMinutes: number | null;
    regularEarnings: Prisma.Decimal | null;
    observedDateStart: Date | null;
    observedDateEnd: Date | null;
    payPeriodStart: Date;
    payPeriodEnd: Date;
    extractionBasis: string;
    dateConfidence: string;
    observationState: string;
    parserVersion: string;
    createdAt: Date;
    classifications: Array<{ kind: string }>;
    supersession: { replacementObservationId: string } | null;
    sourcePaycheck: {
      checkDate: Date;
      reviewStatus: string;
      payrollPeriod: { periodStart: Date; periodEnd: Date };
    };
  };
}) {
  const observation = link.observation;
  return {
    id: observation.id,
    sourcePaycheckId: observation.sourcePaycheckId,
    sourcePaycheckEvidenceRevision: observation.sourcePaycheckEvidenceRevision,
    sourceRowSequence: observation.sourceRowSequence,
    observedHourlyRate: observation.observedHourlyRate?.toString() ?? null,
    regularMinutes: observation.regularMinutes,
    regularEarnings: observation.regularEarnings?.toString() ?? null,
    observedDateStart: dateValue(observation.observedDateStart),
    observedDateEnd: dateValue(observation.observedDateEnd),
    payPeriodStart: dateValue(observation.payPeriodStart)!,
    payPeriodEnd: dateValue(observation.payPeriodEnd)!,
    extractionBasis: observation.extractionBasis,
    dateConfidence: observation.dateConfidence,
    observationState: observation.observationState,
    parserVersion: observation.parserVersion,
    classifications: observation.classifications.map((item) => item.kind),
    supersededByObservationId: observation.supersession?.replacementObservationId ?? null,
    paycheck: {
      checkDate: dateValue(observation.sourcePaycheck.checkDate)!,
      reviewStatus: observation.sourcePaycheck.reviewStatus,
      periodStart: dateValue(observation.sourcePaycheck.payrollPeriod.periodStart)!,
      periodEnd: dateValue(observation.sourcePaycheck.payrollPeriod.periodEnd)!,
    },
    createdAt: observation.createdAt.toISOString(),
  };
}

const candidateObservationInclude = {
  observation: {
    include: {
      classifications: { orderBy: { createdAt: "asc" as const } },
      supersession: true,
      sourcePaycheck: { include: { payrollPeriod: true } },
    },
  },
} satisfies Prisma.PayRateBoundaryCandidateObservationInclude;

export async function getRateHistoryOverview(input: { status?: RateHistoryStatusFilter; page?: number } = {}) {
  const reviewer = await requirePayrollEvidenceReviewer();
  const status = input.status ?? "all";
  const page = Math.max(1, Math.min(input.page ?? 1, 10_000));
  const where = { employeeId: reviewer.employeeId, ...(candidateStatus(status) ? { status: candidateStatus(status) } : {}) };
  const today = new Date(`${dateKeyInTimeZone(new Date())}T00:00:00.000Z`);
  const [employee, rates, candidates, candidateCount, statusCounts] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: reviewer.employeeId },
      select: { id: true, displayName: true, employeeCode: true, isActive: true },
    }),
    prisma.employeePayRate.findMany({
      where: { employeeId: reviewer.employeeId },
      include: {
        sourcePaycheck: { include: { payrollPeriod: true } },
        observationSupports: {
          include: { observation: { include: { sourcePaycheck: { include: { payrollPeriod: true } } } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: HISTORY_LIMIT,
    }),
    prisma.payRateBoundaryCandidate.findMany({
      where,
      include: {
        observations: { include: candidateObservationInclude, orderBy: { createdAt: "asc" }, take: DETAIL_LIMIT },
        resolvedEmployeePayRate: true,
      },
      orderBy: [{ status: "asc" }, { earliestEffectiveDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payRateBoundaryCandidate.count({ where }),
    Promise.all(["OPEN", "RESOLVED", "REJECTED", "SUPERSEDED"].map((item) =>
      prisma.payRateBoundaryCandidate.count({ where: { employeeId: reviewer.employeeId, status: item as "OPEN" | "RESOLVED" | "REJECTED" | "SUPERSEDED" } }))),
  ]);
  if (!employee) throw new Error("Configured Payroll reviewer could not be found.");

  const rateViews = rates.map((rate) => {
    const supports = rate.observationSupports.map((support) => support.observation);
    return {
      id: rate.id,
      effectiveFrom: dateValue(rate.effectiveFrom)!,
      hourlyRate: rate.hourlyRate.toString(),
      verificationStatus: rate.verificationStatus,
      provenanceKind: rate.provenanceKind,
      sourceNote: rate.sourceNote,
      sourcePaycheckId: rate.sourcePaycheckId,
      evidenceVersion: rate.evidenceVersion,
      supportCount: supports.length,
      supportingPeriods: [...new Set(supports.map((item) => `${dateValue(item.payPeriodStart)}–${dateValue(item.payPeriodEnd)}`))],
      sourcePeriod: rate.sourcePaycheck ? `${dateValue(rate.sourcePaycheck.payrollPeriod.periodStart)}–${dateValue(rate.sourcePaycheck.payrollPeriod.periodEnd)}` : null,
    };
  });
  const currentVerifiedRate = rateViews.find((rate) =>
    rate.verificationStatus === "VERIFIED" &&
    (rate.provenanceKind === "PAYCHECK" || rate.provenanceKind === "INDEPENDENT") &&
    rate.effectiveFrom <= dateValue(today)!);
  const candidateViews = candidates.map((candidate) => {
    const observations = candidate.observations.map(observationView);
    const classifications = [...new Set(observations.flatMap((item) => item.classifications))];
    return {
      id: candidate.id,
      observedHourlyRate: candidate.observedHourlyRate.toString(),
      earliestEffectiveDate: dateValue(candidate.earliestEffectiveDate)!,
      latestEffectiveDate: dateValue(candidate.latestEffectiveDate),
      status: candidate.status,
      evidenceVersion: candidate.evidenceVersion,
      observationCount: observations.length,
      activeObservationCount: observations.filter((item) => item.supersededByObservationId === null).length,
      supportedObservationCount: observations.filter((item) => item.observationState === "SUPPORTED" && item.supersededByObservationId === null).length,
      sourcePaycheckCount: new Set(observations.map((item) => item.sourcePaycheckId)).size,
      classifications,
      primaryClassification: primaryRateClassification(classifications),
      resolvedRateId: candidate.resolvedEmployeePayRateId,
    };
  });

  return {
    employee,
    currentVerifiedRate,
    rates: rateViews,
    candidates: candidateViews,
    page,
    pageSize: PAGE_SIZE,
    candidateCount,
    status,
    counts: { all: statusCounts.reduce((sum, count) => sum + count, 0), open: statusCounts[0], resolved: statusCounts[1], rejected: statusCounts[2], superseded: statusCounts[3] },
  };
}

export async function getRateBoundaryCandidateDetail(id: string) {
  const reviewer = await requirePayrollEvidenceReviewer();
  const candidate = await prisma.payRateBoundaryCandidate.findFirst({
    where: { id, employeeId: reviewer.employeeId },
    include: {
      employee: { select: { id: true, displayName: true, employeeCode: true, isActive: true } },
      resolvedEmployeePayRate: true,
      observations: { include: candidateObservationInclude, orderBy: { createdAt: "asc" }, take: DETAIL_LIMIT },
      decisionEvents: { include: { employeePayRate: true }, orderBy: [{ sequence: "asc" }, { id: "asc" }], take: DETAIL_LIMIT },
    },
  });
  if (!candidate) return undefined;

  const observations = candidate.observations.map(observationView);
  const classifications = [...new Set(observations.flatMap((item) => item.classifications))];
  const latest = candidate.latestEffectiveDate ?? new Date("9999-12-31T00:00:00.000Z");
  const [previousRate, conflicts, affectedEntries] = await Promise.all([
    prisma.employeePayRate.findFirst({
      where: { employeeId: candidate.employeeId, verificationStatus: "VERIFIED", effectiveFrom: { lte: candidate.earliestEffectiveDate } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
    prisma.payRateBoundaryCandidate.findMany({
      where: {
        id: { not: candidate.id }, employeeId: candidate.employeeId, status: "OPEN",
        observedHourlyRate: { not: candidate.observedHourlyRate },
        earliestEffectiveDate: { lte: latest },
        OR: [{ latestEffectiveDate: null }, { latestEffectiveDate: { gte: candidate.earliestEffectiveDate } }],
      },
      select: { id: true, observedHourlyRate: true, earliestEffectiveDate: true, latestEffectiveDate: true },
      orderBy: [{ earliestEffectiveDate: "asc" }, { createdAt: "asc" }],
      take: 20,
    }),
    prisma.dailyTimeEntry.findMany({
      where: {
        weeklyTimesheet: { primaryEmployeeId: candidate.employeeId, primaryEmployeeIdentityStatus: { in: ["EXPLICIT_SELECTION", "OWNER_VERIFIED"] } },
        workDate: { gte: candidate.earliestEffectiveDate },
      },
      select: { id: true, workDate: true, regularMinutes: true, overtimeMinutes: true },
      orderBy: [{ workDate: "asc" }, { id: "asc" }],
      take: 40,
    }),
  ]);

  return {
    id: candidate.id,
    createdAt: candidate.createdAt.toISOString(),
    employee: candidate.employee,
    observedHourlyRate: candidate.observedHourlyRate.toString(),
    earliestEffectiveDate: dateValue(candidate.earliestEffectiveDate)!,
    latestEffectiveDate: dateValue(candidate.latestEffectiveDate),
    status: candidate.status,
    evidenceVersion: candidate.evidenceVersion,
    classifications,
    primaryClassification: primaryRateClassification(classifications),
    observations,
    previousRate: previousRate ? { id: previousRate.id, hourlyRate: previousRate.hourlyRate.toString(), effectiveFrom: dateValue(previousRate.effectiveFrom)! } : null,
    conflicts: conflicts.map((item) => ({ id: item.id, observedHourlyRate: item.observedHourlyRate.toString(), earliestEffectiveDate: dateValue(item.earliestEffectiveDate)!, latestEffectiveDate: dateValue(item.latestEffectiveDate) })),
    affectedEntries: affectedEntries.map((item) => ({ id: item.id, workDate: dateValue(item.workDate)!, regularMinutes: item.regularMinutes, overtimeMinutes: item.overtimeMinutes })),
    resolvedRate: candidate.resolvedEmployeePayRate ? { id: candidate.resolvedEmployeePayRate.id, hourlyRate: candidate.resolvedEmployeePayRate.hourlyRate.toString(), effectiveFrom: dateValue(candidate.resolvedEmployeePayRate.effectiveFrom)! } : null,
    events: candidate.decisionEvents.map((event) => ({
      id: event.id,
      sequence: event.sequence,
      decisionKind: event.decisionKind,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      previousVersion: event.previousVersion,
      newVersion: event.newVersion,
      exactEffectiveDate: dateValue(event.exactEffectiveDate),
      employeePayRateId: event.employeePayRateId,
      reviewerDisplayNameSnapshot: event.reviewerDisplayNameSnapshot,
      reviewerEmployeeCodeSnapshot: event.reviewerEmployeeCodeSnapshot,
      reason: event.reason,
      sourceEvidenceReference: event.sourceEvidenceReference,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export type RateHistoryOverviewData = Awaited<ReturnType<typeof getRateHistoryOverview>>;
export type RateBoundaryCandidateDetail = NonNullable<Awaited<ReturnType<typeof getRateBoundaryCandidateDetail>>>;
