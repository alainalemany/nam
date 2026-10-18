import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  rejectPayRateBoundaryCandidate,
  verifyExactPayRateBoundary,
} from "@/features/payroll/rate-boundary-persistence";
import {
  ingestPayRateObservations,
  supersedePaycheckRateEvidenceForCorrection,
  type RateObservationDraft,
} from "@/features/payroll/rate-observations";
import { reviewPayRateEvidence } from "@/features/payroll/evidence-review-persistence";
import { guardedPhaseADatabaseUrl } from "../helpers/phase-a-postgres-guard";

const databaseUrl = guardedPhaseADatabaseUrl();
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const actor = { employeeId: "reviewer", displayName: "Synthetic Reviewer", employeeCode: "REV-1" };
let prisma: PrismaClient;
let sequence = 0;
const token = () => `123e4567-e89b-42d3-a456-${String(++sequence).padStart(12, "0")}`;

async function clearFixtures() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "PayRateBoundaryDecisionEvent",
      "PayRateObservationSupport",
      "PayRateBoundaryCandidateObservation",
      "PayRateBoundaryCandidate",
      "PayRateObservationSupersession",
      "PayRateObservationClassification",
      "PayRateObservation",
      "TimesheetIdentityReviewEvent",
      "PayRateEvidenceReviewEvent",
      "Paycheck",
      "PayrollPeriod",
      "EmployeePayRate",
      "Employee"
    RESTART IDENTITY CASCADE
  `);
}

async function employee(id: string) {
  return prisma.employee.create({
    data: { id, displayName: `Synthetic ${id}`, employeeCode: `${id}-code` },
  });
}

async function paycheck(
  id: string,
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  options: { reviewStatus?: "CONFIRMED" | "NEEDS_REVIEW"; revision?: number; rate?: string } = {},
) {
  const period = await prisma.payrollPeriod.create({
    data: {
      id: `${id}-period`,
      employeeId,
      periodStart: date(periodStart),
      periodEnd: date(periodEnd),
      expectedCheckDate: new Date(date(periodEnd).getTime() + 3 * 86_400_000),
      actualCheckDate: new Date(date(periodEnd).getTime() + 3 * 86_400_000),
    },
  });
  return prisma.paycheck.create({
    data: {
      id,
      employeeId,
      payrollPeriodId: period.id,
      checkDate: new Date(date(periodEnd).getTime() + 3 * 86_400_000),
      regularPaidMinutes: 2400,
      overtimePaidMinutes: 0,
      baseRate: new Prisma.Decimal(options.rate ?? "33.1500"),
      regularEarnings: new Prisma.Decimal("1326.00"),
      grossCashPay: new Prisma.Decimal("1326.00"),
      netPay: new Prisma.Decimal("1000.00"),
      sourceFingerprint: createHash("sha256").update(id).digest("hex"),
      parserVersion: "workday-v3",
      evidenceRevision: options.revision ?? 1,
      reviewStatus: options.reviewStatus ?? "CONFIRMED",
    },
  });
}

function observation(
  periodStart: string,
  periodEnd: string,
  overrides: Partial<RateObservationDraft> = {},
): RateObservationDraft {
  return {
    sourceRowSequence: 1,
    observedHourlyRate: "33.1500",
    regularMinutes: 2400,
    regularEarnings: "1326.00",
    observedDateStart: null,
    observedDateEnd: null,
    payPeriodStart: date(periodStart),
    payPeriodEnd: date(periodEnd),
    extractionBasis: "WORKDAY_REGULAR_ROW",
    dateConfidence: "PAY_PERIOD_ONLY",
    observationState: "SUPPORTED",
    parserVersion: "workday-v3",
    ...overrides,
  };
}

async function ingest(
  paycheckId: string,
  employeeId: string,
  evidenceRevision: number,
  observations: RateObservationDraft[],
  supersedePriorRevision = false,
) {
  return prisma.$transaction((tx) => ingestPayRateObservations(tx, {
    paycheckId,
    employeeId,
    evidenceRevision,
    observations,
    supersedePriorRevision,
  }));
}

describePostgres("progressive hourly-rate observations", () => {
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    await prisma.$connect();
  });

  beforeEach(async () => {
    sequence = 0;
    await clearFixtures();
    await employee("employee-1");
    await employee("reviewer");
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("installs migration 38 without reinterpreting quarantined history", async () => {
    const migration = await prisma.$queryRaw<Array<{ checksum: string }>>`
      SELECT checksum
      FROM "_prisma_migrations"
      WHERE migration_name = '20261017000100_progressive_pay_rate_observations'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `;
    expect(migration).toEqual([{
      checksum: "7f97235ad4ab02cf2e0ca82deff1012076e389f363ad2d38f0ea254d26869657",
    }]);
    await prisma.employeePayRate.create({
      data: {
        id: "quarantined-rate",
        employeeId: "employee-1",
        effectiveFrom: date("2026-01-01"),
        hourlyRate: new Prisma.Decimal("30.0000"),
        verificationStatus: "NEEDS_REVIEW",
        provenanceKind: "UNKNOWN",
        provenanceCandidatePaycheckId: "historical-paycheck-reference",
      },
    });
    await paycheck("first-paycheck", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("first-paycheck", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    expect(await prisma.employeePayRate.findUniqueOrThrow({ where: { id: "quarantined-rate" } }))
      .toMatchObject({
        verificationStatus: "NEEDS_REVIEW",
        provenanceKind: "UNKNOWN",
        provenanceCandidatePaycheckId: "historical-paycheck-reference",
      });
  });

  it("persists downgraded original PDF bounds across correction while rejecting supported mismatched periods", async () => {
    await paycheck("edited-period", "employee-1", "2026-09-15", "2026-09-21");
    const originalDraft = observation("2026-09-14", "2026-09-20", {
      observedDateStart: date("2026-09-17"),
      observedDateEnd: date("2026-09-18"),
      dateConfidence: "EXPLICIT_ROW_RANGE",
      observationState: "REVIEW_REQUIRED",
    });
    const first = await ingest("edited-period", "employee-1", 1, [originalDraft]);
    expect(first[0]).toMatchObject({
      sourceRowSequence: 1,
      payPeriodStart: date("2026-09-14"),
      payPeriodEnd: date("2026-09-20"),
      observedDateStart: date("2026-09-17"),
      observedDateEnd: date("2026-09-18"),
      observationState: "REVIEW_REQUIRED",
      extractionBasis: "WORKDAY_REGULAR_ROW",
    });
    const firstCandidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
      where: { observations: { some: { observationId: first[0].id } } },
    });
    await expect(verifyExactPayRateBoundary(actor, {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: firstCandidate.id,
      expectedEvidenceVersion: firstCandidate.evidenceVersion,
      exactEffectiveDate: "2026-09-17",
      reason: "Downgraded evidence must not support promotion.",
      requestToken: token(),
    }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await prisma.employeePayRate.count()).toBe(0);
    expect(await prisma.payRateBoundaryDecisionEvent.count()).toBe(0);

    await prisma.paycheck.update({
      where: { id: "edited-period" },
      data: { evidenceRevision: 2 },
    });
    const replacement = await ingest("edited-period", "employee-1", 2, [originalDraft], true);
    expect(await prisma.payRateObservation.count({ where: { sourcePaycheckId: "edited-period" } })).toBe(2);
    expect(await prisma.payRateObservationSupersession.findUniqueOrThrow({
      where: { priorObservationId: first[0].id },
    })).toMatchObject({ replacementObservationId: replacement[0].id });
    expect(replacement[0]).toMatchObject({
      payPeriodStart: date("2026-09-14"),
      payPeriodEnd: date("2026-09-20"),
      observationState: "REVIEW_REQUIRED",
    });

    await paycheck("supported-period-mismatch", "employee-1", "2026-10-02", "2026-10-08");
    await expect(ingest(
      "supported-period-mismatch",
      "employee-1",
      1,
      [observation("2026-10-01", "2026-10-07")],
    )).rejects.toThrow(/does not match its source Paycheck evidence revision/i);
    expect(await prisma.payRateObservation.count({ where: { sourcePaycheckId: "supported-period-mismatch" } })).toBe(0);
  });

  it("rejects a normalized impossible exact boundary without creating a rate or audit event", async () => {
    await paycheck("invalid-calendar-boundary", "employee-1", "2026-02-28", "2026-03-07", { rate: "36.0000" });
    await ingest("invalid-calendar-boundary", "employee-1", 1, [observation("2026-02-28", "2026-03-07", {
      observedHourlyRate: "36.0000",
      regularEarnings: "1440.00",
    })]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
      where: { status: "OPEN", observedHourlyRate: new Prisma.Decimal("36.0000") },
    });

    await expect(verifyExactPayRateBoundary(actor, {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: "2026-02-30",
      reason: "This impossible date must not normalize into March.",
      requestToken: token(),
    }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    expect(await prisma.employeePayRate.count()).toBe(0);
    expect(await prisma.payRateBoundaryDecisionEvent.count()).toBe(0);
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: candidate.id } }))
      .toMatchObject({ status: "OPEN", evidenceVersion: candidate.evidenceVersion });
  });

  it("keeps first and repeated period-only rates in one uncertain candidate while a row range narrows without inventing an exact date", async () => {
    await paycheck("first", "employee-1", "2026-09-14", "2026-09-20");
    const first = await ingest("first", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    expect(first[0].classifications.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "FIRST_RATE_CANDIDATE",
      "UNCERTAIN_EFFECTIVE_DATE_CHANGE",
    ]));
    expect(await prisma.employeePayRate.count()).toBe(0);

    await paycheck("repeat", "employee-1", "2026-09-21", "2026-09-27");
    const repeated = await ingest("repeat", "employee-1", 1, [observation("2026-09-21", "2026-09-27")]);
    expect(repeated[0].classifications.map((item) => item.kind)).toContain("REPEATED_SUPPORTING_OBSERVATION");
    expect(await prisma.payRateBoundaryCandidate.count({ where: { status: "OPEN" } })).toBe(1);

    await paycheck("stronger", "employee-1", "2026-09-14", "2026-09-21");
    await ingest("stronger", "employee-1", 1, [observation("2026-09-14", "2026-09-21", {
      observedDateStart: date("2026-09-17"),
      observedDateEnd: date("2026-09-21"),
      dateConfidence: "EXPLICIT_ROW_RANGE",
    })]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({ where: { status: "OPEN" } });
    expect(candidate.earliestEffectiveDate).toEqual(date("2026-09-17"));
    expect(candidate.latestEffectiveDate).toEqual(date("2026-09-20"));
    expect(candidate.evidenceVersion).toBe(2);
  });

  it("moves one same-rate candidate earlier when an older Payslip arrives out of order", async () => {
    await paycheck("newer-first", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("newer-first", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    await paycheck("older-second", "employee-1", "2026-09-01", "2026-09-07");
    await ingest("older-second", "employee-1", 1, [observation("2026-09-01", "2026-09-07")]);

    const candidates = await prisma.payRateBoundaryCandidate.findMany({
      where: { employeeId: "employee-1", status: "OPEN" },
      include: { observations: true },
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      earliestEffectiveDate: date("2026-09-01"),
      latestEffectiveDate: date("2026-09-07"),
      evidenceVersion: 2,
    });
    expect(candidates[0].observations).toHaveLength(2);
  });

  it.each(["chronological", "return-first"] as const)(
    "retains a later return to the old rate after approving an earlier raise (%s)",
    async (order) => {
      await prisma.employeePayRate.create({
        data: {
          id: "verified-thirty",
          employeeId: "employee-1",
          effectiveFrom: date("2026-01-01"),
          hourlyRate: new Prisma.Decimal("30.0000"),
          verificationStatus: "VERIFIED",
          provenanceKind: "INDEPENDENT",
        },
      });
      await paycheck("raise", "employee-1", "2026-01-08", "2026-01-14", { rate: "35.0000" });
      await paycheck("return", "employee-1", "2026-01-15", "2026-01-21", { rate: "30.0000" });
      const raiseDraft = observation("2026-01-08", "2026-01-14", {
        observedHourlyRate: "35.0000",
        regularEarnings: "1400.00",
      });
      const returnDraft = observation("2026-01-15", "2026-01-21", {
        observedHourlyRate: "30.0000",
        regularEarnings: "1200.00",
      });
      if (order === "chronological") {
        await ingest("raise", "employee-1", 1, [raiseDraft]);
        await ingest("return", "employee-1", 1, [returnDraft]);
      } else {
        await ingest("return", "employee-1", 1, [returnDraft]);
        await ingest("raise", "employee-1", 1, [raiseDraft]);
      }

      const raiseCandidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
        where: { employeeId: "employee-1", status: "OPEN", observedHourlyRate: new Prisma.Decimal("35.0000") },
      });
      const returnObservation = await prisma.payRateObservation.findFirstOrThrow({
        where: { sourcePaycheckId: "return" },
        include: { classifications: true },
      });
      expect(returnObservation.classifications.map((item) => item.kind)).toContain("CANDIDATE_DECREASE");

      await verifyExactPayRateBoundary(actor, {
        decision: "VERIFY_EXACT_BOUNDARY",
        candidateId: raiseCandidate.id,
        expectedEvidenceVersion: raiseCandidate.evidenceVersion,
        exactEffectiveDate: "2026-01-10",
        reason: "Synthetic evidence confirms the earlier raise boundary.",
        requestToken: token(),
      }, { client: prisma });

      const openCandidates = await prisma.payRateBoundaryCandidate.findMany({
        where: { employeeId: "employee-1", status: "OPEN" },
        include: { observations: true },
      });
      expect(openCandidates).toHaveLength(1);
      expect(openCandidates[0]).toMatchObject({
        observedHourlyRate: new Prisma.Decimal("30.0000"),
        earliestEffectiveDate: date("2026-01-15"),
        latestEffectiveDate: date("2026-01-21"),
      });
      expect(openCandidates[0].observations.map((item) => item.observationId))
        .toContain(returnObservation.id);
    },
  );

  it("promotes only an owner-confirmed exact date and records immutable support and audit history", async () => {
    await paycheck("candidate-paycheck", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("candidate-paycheck", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    const input = {
      decision: "VERIFY_EXACT_BOUNDARY" as const,
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: "2026-09-17",
      reason: "Synthetic owner decision confirms the exact supported boundary.",
      requestToken: token(),
    };
    const result = await verifyExactPayRateBoundary(actor, input, { client: prisma });
    expect(result).toMatchObject({ ok: true, newState: "RESOLVED", idempotencyReplay: false });
    const replay = await verifyExactPayRateBoundary(actor, input, { client: prisma });
    expect(replay).toMatchObject({
      idempotencyReplay: true,
      auditEventId: result.auditEventId,
      newVersion: result.newVersion,
    });
    const rate = await prisma.employeePayRate.findFirstOrThrow({ where: { verificationStatus: "VERIFIED" } });
    expect(rate).toMatchObject({
      employeeId: "employee-1",
      effectiveFrom: date("2026-09-17"),
      provenanceKind: "PAYCHECK",
    });
    expect(await prisma.payRateObservationSupport.count({ where: { employeePayRateId: rate.id } })).toBe(1);
    expect(await prisma.payRateBoundaryDecisionEvent.count({ where: { candidateId: candidate.id } })).toBe(1);
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: candidate.id } }))
      .toMatchObject({ status: "RESOLVED", evidenceVersion: 2, resolvedEmployeePayRateId: rate.id });
    await expect(prisma.payRateBoundaryDecisionEvent.update({
      where: { id: result.auditEventId },
      data: { reason: "tampered" },
    })).rejects.toThrow(/append-only/i);
  });

  it("fails closed for a changed payload with a reused token and for a stale version with a new token", async () => {
    await paycheck("token-payload", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("token-payload", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    const requestToken = token();
    const input = {
      decision: "VERIFY_EXACT_BOUNDARY" as const,
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: "2026-09-17",
      reason: "Synthetic owner decision confirms the exact supported boundary.",
      requestToken,
    };
    const result = await verifyExactPayRateBoundary(actor, input, { client: prisma });

    await expect(verifyExactPayRateBoundary(actor, {
      ...input,
      reason: "A changed payload must not reuse the original decision identity.",
    }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_TOKEN" });
    await expect(verifyExactPayRateBoundary(actor, {
      ...input,
      requestToken: token(),
    }, { client: prisma })).rejects.toMatchObject({ code: "STALE_REVIEW" });

    const storedCandidate = await prisma.payRateBoundaryCandidate.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    expect(storedCandidate).toMatchObject({
      status: "RESOLVED",
      evidenceVersion: result.newVersion,
      resolvedEmployeePayRateId: expect.any(String),
    });
    expect(await prisma.payRateBoundaryDecisionEvent.count({ where: { candidateId: candidate.id } })).toBe(1);
    expect(await prisma.employeePayRate.count({
      where: { employeeId: "employee-1", effectiveFrom: date("2026-09-17"), verificationStatus: "VERIFIED" },
    })).toBe(1);
  });

  it("serializes concurrent identical promotion requests into one authoritative decision", async () => {
    await paycheck("concurrent-token", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("concurrent-token", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    const input = {
      decision: "VERIFY_EXACT_BOUNDARY" as const,
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: "2026-09-17",
      reason: "Concurrent retries represent the same owner decision.",
      requestToken: token(),
    };

    const results = await Promise.all([
      verifyExactPayRateBoundary(actor, input, { client: prisma }),
      verifyExactPayRateBoundary(actor, input, { client: prisma }),
    ]);
    expect(results.map((result) => result.idempotencyReplay).sort()).toEqual([false, true]);
    expect(new Set(results.map((result) => result.auditEventId))).toEqual(new Set([results[0].auditEventId]));
    expect(new Set(results.map((result) => result.newVersion))).toEqual(new Set([2]));

    const rate = await prisma.employeePayRate.findFirstOrThrow({
      where: { employeeId: "employee-1", effectiveFrom: date("2026-09-17"), verificationStatus: "VERIFIED" },
    });
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: candidate.id } }))
      .toMatchObject({ status: "RESOLVED", evidenceVersion: 2, resolvedEmployeePayRateId: rate.id });
    expect(await prisma.payRateBoundaryDecisionEvent.count({ where: { candidateId: candidate.id } })).toBe(1);
    expect(await prisma.employeePayRate.count({ where: { id: rate.id } })).toBe(1);
    expect(await prisma.payRateObservationSupport.count({ where: { employeePayRateId: rate.id } })).toBe(1);
  });

  it("rejects a candidate with immutable owner history and stops treating it as open uncertainty", async () => {
    await paycheck("rejected", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("rejected", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    const input = {
      decision: "REJECT_BOUNDARY_CANDIDATE" as const,
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      reason: "Synthetic owner review disproved this candidate.",
      requestToken: token(),
    };
    const result = await rejectPayRateBoundaryCandidate(actor, input, { client: prisma });
    expect(result).toMatchObject({ newState: "REJECTED", idempotencyReplay: false });
    await expect(rejectPayRateBoundaryCandidate(actor, input, { client: prisma }))
      .resolves.toMatchObject({ idempotencyReplay: true, auditEventId: result.auditEventId });
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: candidate.id } }))
      .toMatchObject({ status: "REJECTED", evidenceVersion: 2, resolvedEmployeePayRateId: null });
    expect(await prisma.payRateBoundaryDecisionEvent.findUniqueOrThrow({ where: { id: result.auditEventId } }))
      .toMatchObject({ decisionKind: "REJECTED", previousStatus: "OPEN", newStatus: "REJECTED" });
  });

  it("rejects stale candidate rejection and rolls back when its decision event cannot be inserted", async () => {
    await paycheck("reject-rollback", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("reject-rollback", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    const base = {
      decision: "REJECT_BOUNDARY_CANDIDATE" as const,
      candidateId: candidate.id,
      reason: "Synthetic rejected evidence.",
      requestToken: token(),
    };
    await expect(rejectPayRateBoundaryCandidate(actor, {
      ...base,
      expectedEvidenceVersion: candidate.evidenceVersion + 1,
    }, { client: prisma })).rejects.toMatchObject({ code: "STALE_REVIEW" });
    await expect(rejectPayRateBoundaryCandidate(actor, {
      ...base,
      expectedEvidenceVersion: candidate.evidenceVersion,
      requestToken: token(),
    }, {
      client: prisma,
      hooks: { beforeCommit: async () => { throw new Error("forced rejection audit failure"); } },
    })).rejects.toThrow("forced rejection audit failure");
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: candidate.id } }))
      .toMatchObject({ status: "OPEN", evidenceVersion: candidate.evidenceVersion });
    expect(await prisma.payRateBoundaryDecisionEvent.count()).toBe(0);
  });

  it("rejects cross-domain reviewer token reuse", async () => {
    await paycheck("token-boundary", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("token-boundary", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    const requestToken = token();
    await rejectPayRateBoundaryCandidate(actor, {
      decision: "REJECT_BOUNDARY_CANDIDATE",
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      reason: "Synthetic boundary rejection.",
      requestToken,
    }, { client: prisma });
    await prisma.employeePayRate.create({
      data: {
        id: "cross-domain-rate",
        employeeId: "employee-1",
        effectiveFrom: date("2026-10-01"),
        hourlyRate: new Prisma.Decimal("40.0000"),
        verificationStatus: "NEEDS_REVIEW",
        provenanceKind: "UNKNOWN",
      },
    });
    await expect(reviewPayRateEvidence(actor, {
      decision: "VERIFY_INDEPENDENT",
      rateId: "cross-domain-rate",
      expectedEvidenceVersion: 1,
      reason: "Synthetic independent review.",
      sourceEvidenceReference: "Synthetic evidence",
      requestToken,
    }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_TOKEN" });

    const packageTwoToken = token();
    await prisma.employeePayRate.create({
      data: {
        id: "package-two-first-rate",
        employeeId: "employee-1",
        effectiveFrom: date("2026-10-08"),
        hourlyRate: new Prisma.Decimal("41.0000"),
        verificationStatus: "NEEDS_REVIEW",
        provenanceKind: "UNKNOWN",
      },
    });
    await reviewPayRateEvidence(actor, {
      decision: "VERIFY_INDEPENDENT",
      rateId: "package-two-first-rate",
      expectedEvidenceVersion: 1,
      reason: "Synthetic independent review completed first.",
      sourceEvidenceReference: "Synthetic wage notice",
      requestToken: packageTwoToken,
    }, { client: prisma });
    await paycheck("token-after-package-two", "employee-1", "2026-10-15", "2026-10-21", { rate: "42.0000" });
    await ingest("token-after-package-two", "employee-1", 1, [observation("2026-10-15", "2026-10-21", {
      observedHourlyRate: "42.0000",
      regularEarnings: "1680.00",
    })]);
    const laterCandidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
      where: { status: "OPEN", observedHourlyRate: new Prisma.Decimal("42.0000") },
    });
    await expect(rejectPayRateBoundaryCandidate(actor, {
      decision: "REJECT_BOUNDARY_CANDIDATE",
      candidateId: laterCandidate.id,
      expectedEvidenceVersion: laterCandidate.evidenceVersion,
      reason: "A Package 2A token cannot be reused for a boundary decision.",
      requestToken: packageTwoToken,
    }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_TOKEN" });
  });

  it("enforces supported Workday provenance and current Paycheck evidence in PostgreSQL", async () => {
    await paycheck("manual-supported", "employee-1", "2026-03-01", "2026-03-07");
    await expect(prisma.payRateObservation.create({
      data: {
        employeeId: "employee-1",
        sourcePaycheckId: "manual-supported",
        sourcePaycheckEvidenceRevision: 1,
        sourceRowSequence: 1,
        observedHourlyRate: new Prisma.Decimal("30.0000"),
        regularMinutes: 2400,
        regularEarnings: new Prisma.Decimal("1200.0000"),
        payPeriodStart: date("2026-03-01"),
        payPeriodEnd: date("2026-03-07"),
        extractionBasis: "MANUAL_ENTRY",
        dateConfidence: "PAY_PERIOD_ONLY",
        observationState: "SUPPORTED",
        parserVersion: "manual-test",
        observationDigest: "a".repeat(64),
      },
    })).rejects.toThrow(/supported observations require current confirmed Workday/i);

    await paycheck("needs-review-supported", "employee-1", "2026-03-08", "2026-03-14", {
      reviewStatus: "NEEDS_REVIEW",
    });
    await expect(prisma.payRateObservation.create({
      data: {
        employeeId: "employee-1",
        sourcePaycheckId: "needs-review-supported",
        sourcePaycheckEvidenceRevision: 1,
        sourceRowSequence: 1,
        observedHourlyRate: new Prisma.Decimal("30.0000"),
        regularMinutes: 2400,
        regularEarnings: new Prisma.Decimal("1200.0000"),
        payPeriodStart: date("2026-03-08"),
        payPeriodEnd: date("2026-03-14"),
        extractionBasis: "WORKDAY_REGULAR_ROW",
        dateConfidence: "PAY_PERIOD_ONLY",
        observationState: "SUPPORTED",
        parserVersion: "workday-v3",
        observationDigest: "b".repeat(64),
      },
    })).rejects.toThrow(/does not match its source Paycheck evidence revision/i);

    await paycheck("stale-revision-supported", "employee-1", "2026-03-15", "2026-03-21", {
      revision: 2,
    });
    await expect(prisma.payRateObservation.create({
      data: {
        employeeId: "employee-1",
        sourcePaycheckId: "stale-revision-supported",
        sourcePaycheckEvidenceRevision: 1,
        sourceRowSequence: 1,
        observedHourlyRate: new Prisma.Decimal("30.0000"),
        regularMinutes: 2400,
        regularEarnings: new Prisma.Decimal("1200.0000"),
        payPeriodStart: date("2026-03-15"),
        payPeriodEnd: date("2026-03-21"),
        extractionBasis: "WORKDAY_REGULAR_ROW",
        dateConfidence: "PAY_PERIOD_ONLY",
        observationState: "SUPPORTED",
        parserVersion: "workday-v3",
        observationDigest: "c".repeat(64),
      },
    })).rejects.toThrow(/does not match its source Paycheck evidence revision/i);

    await paycheck("support-becomes-stale", "employee-1", "2026-03-22", "2026-03-28", { rate: "30.0000" });
    const staleSource = await ingest("support-becomes-stale", "employee-1", 1, [observation("2026-03-22", "2026-03-28", {
      observedHourlyRate: "30.0000",
      regularEarnings: "1200.00",
    })]);
    await prisma.paycheck.update({ where: { id: "support-becomes-stale" }, data: { evidenceRevision: 2 } });
    const staleRate = await prisma.employeePayRate.create({
      data: {
        id: "stale-support-rate",
        employeeId: "employee-1",
        effectiveFrom: date("2026-03-22"),
        hourlyRate: new Prisma.Decimal("30.0000"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await expect(prisma.payRateObservationSupport.create({
      data: { employeePayRateId: staleRate.id, observationId: staleSource[0].id, supportKind: "PRIMARY" },
    })).rejects.toThrow(/only matching supported observations/i);

    await paycheck("support-becomes-unconfirmed", "employee-1", "2026-03-29", "2026-04-04", { rate: "32.0000" });
    const unconfirmedSource = await ingest("support-becomes-unconfirmed", "employee-1", 1, [observation("2026-03-29", "2026-04-04", {
      observedHourlyRate: "32.0000",
      regularEarnings: "1280.00",
    })]);
    await prisma.paycheck.update({ where: { id: "support-becomes-unconfirmed" }, data: { reviewStatus: "NEEDS_REVIEW" } });
    const unconfirmedRate = await prisma.employeePayRate.create({
      data: {
        id: "unconfirmed-support-rate",
        employeeId: "employee-1",
        effectiveFrom: date("2026-03-29"),
        hourlyRate: new Prisma.Decimal("32.0000"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await expect(prisma.payRateObservationSupport.create({
      data: { employeePayRateId: unconfirmedRate.id, observationId: unconfirmedSource[0].id, supportKind: "PRIMARY" },
    })).rejects.toThrow(/only matching supported observations/i);

    await paycheck("eligible-support-source", "employee-1", "2026-04-05", "2026-04-11", { rate: "34.0000" });
    const eligibleSource = await ingest("eligible-support-source", "employee-1", 1, [observation("2026-04-05", "2026-04-11", {
      observedHourlyRate: "34.0000",
      regularEarnings: "1360.00",
    })]);
    await employee("employee-2");
    const invalidRates = await Promise.all([
      prisma.employeePayRate.create({
        data: {
          id: "cross-employee-support-rate",
          employeeId: "employee-2",
          effectiveFrom: date("2026-04-05"),
          hourlyRate: new Prisma.Decimal("34.0000"),
          verificationStatus: "VERIFIED",
          provenanceKind: "INDEPENDENT",
        },
      }),
      prisma.employeePayRate.create({
        data: {
          id: "mismatched-amount-support-rate",
          employeeId: "employee-1",
          effectiveFrom: date("2026-04-05"),
          hourlyRate: new Prisma.Decimal("99.0000"),
          verificationStatus: "VERIFIED",
          provenanceKind: "INDEPENDENT",
        },
      }),
      prisma.employeePayRate.create({
        data: {
          id: "invalid-date-support-rate",
          employeeId: "employee-1",
          effectiveFrom: date("2026-04-12"),
          hourlyRate: new Prisma.Decimal("34.0000"),
          verificationStatus: "VERIFIED",
          provenanceKind: "INDEPENDENT",
        },
      }),
    ]);
    for (const invalidRate of invalidRates) {
      await expect(prisma.payRateObservationSupport.create({
        data: { employeePayRateId: invalidRate.id, observationId: eligibleSource[0].id, supportKind: "PRIMARY" },
      })).rejects.toThrow(/only matching supported observations/i);
    }
  });

  it("rejects referenced Paycheck changes that would invalidate the only current verified support", async () => {
    await paycheck("supported-boundary", "employee-1", "2026-05-01", "2026-05-07", { rate: "36.0000" });
    await ingest("supported-boundary", "employee-1", 1, [observation("2026-05-01", "2026-05-07", {
      observedHourlyRate: "36.0000",
      regularEarnings: "1440.00",
    })]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
      where: { status: "OPEN", observedHourlyRate: new Prisma.Decimal("36.0000") },
    });
    await verifyExactPayRateBoundary(actor, {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: "2026-05-03",
      reason: "Synthetic exact-date owner decision.",
      requestToken: token(),
    }, { client: prisma });

    await expect(prisma.paycheck.update({
      where: { id: "supported-boundary" },
      data: { reviewStatus: "NEEDS_REVIEW" },
    })).rejects.toThrow(/must retain current confirmed Workday observation support/i);
    await expect(prisma.paycheck.update({
      where: { id: "supported-boundary" },
      data: { evidenceRevision: { increment: 1 } },
    })).rejects.toThrow(/must retain current confirmed Workday observation support/i);
    expect(await prisma.paycheck.findUniqueOrThrow({ where: { id: "supported-boundary" } }))
      .toMatchObject({ reviewStatus: "CONFIRMED", evidenceRevision: 1 });
  });

  it("rejects superseded observation support and naked terminal candidate transitions", async () => {
    await paycheck("superseded-support", "employee-1", "2026-04-01", "2026-04-07", { rate: "30.0000" });
    const original = await ingest("superseded-support", "employee-1", 1, [observation("2026-04-01", "2026-04-07", {
      observedHourlyRate: "30.0000",
      regularEarnings: "1200.00",
    })]);
    await prisma.paycheck.update({
      where: { id: "superseded-support" },
      data: { evidenceRevision: 2 },
    });
    const replacement = await ingest("superseded-support", "employee-1", 2, [observation("2026-04-01", "2026-04-07", {
      observedHourlyRate: "31.0000",
      regularEarnings: "1240.00",
      extractionBasis: "PAYCHECK_CORRECTION",
      observationState: "REVIEW_REQUIRED",
    })], true);
    const verifiedRate = await prisma.employeePayRate.create({
      data: {
        id: "independent-thirty",
        employeeId: "employee-1",
        effectiveFrom: date("2026-04-01"),
        hourlyRate: new Prisma.Decimal("30.0000"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await expect(prisma.payRateObservationSupport.create({
      data: {
        employeePayRateId: verifiedRate.id,
        observationId: original[0].id,
        supportKind: "PRIMARY",
      },
    })).rejects.toThrow(/only matching supported observations/i);
    expect(await prisma.payRateObservationSupersession.findUniqueOrThrow({
      where: { priorObservationId: original[0].id },
    })).toMatchObject({ replacementObservationId: replacement[0].id });

    const openCandidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
      where: { status: "OPEN", observedHourlyRate: new Prisma.Decimal("31.0000") },
    });
    const resolvedRate = await prisma.employeePayRate.create({
      data: {
        id: "naked-resolution-rate",
        employeeId: "employee-1",
        effectiveFrom: date("2026-04-02"),
        hourlyRate: new Prisma.Decimal("31.0000"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await expect(prisma.$transaction((tx) => tx.payRateBoundaryCandidate.update({
      where: { id: openCandidate.id },
      data: {
        status: "RESOLVED",
        resolvedEmployeePayRateId: resolvedRate.id,
        evidenceVersion: { increment: 1 },
      },
    }))).rejects.toThrow(/requires its matching immutable event/i);
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: openCandidate.id } }))
      .toMatchObject({ status: "OPEN", evidenceVersion: openCandidate.evidenceVersion });
  });

  it("detects increases, decreases, same-date conflicts, and multiple-rate splits without verifying them", async () => {
    await prisma.employeePayRate.create({
      data: {
        id: "verified-base",
        employeeId: "employee-1",
        effectiveFrom: date("2026-09-01"),
        hourlyRate: new Prisma.Decimal("33.1500"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await paycheck("increase", "employee-1", "2026-10-01", "2026-10-07", { rate: "35.0000" });
    const increase = await ingest("increase", "employee-1", 1, [observation("2026-10-01", "2026-10-07", {
      observedHourlyRate: "35.0000",
      regularEarnings: "1400.00",
    })]);
    expect(increase[0].classifications.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "CANDIDATE_INCREASE",
      "UNCERTAIN_EFFECTIVE_DATE_CHANGE",
    ]));

    await paycheck("decrease", "employee-1", "2026-10-08", "2026-10-14", { rate: "32.0000" });
    const decrease = await ingest("decrease", "employee-1", 1, [observation("2026-10-08", "2026-10-14", {
      observedHourlyRate: "32.0000",
      regularEarnings: "1280.00",
      observedDateStart: date("2026-10-08"),
      observedDateEnd: date("2026-10-14"),
      dateConfidence: "EXPLICIT_ROW_RANGE",
    })]);
    expect(decrease[0].classifications.map((item) => item.kind)).toContain("CANDIDATE_DECREASE");
    expect(await prisma.employeePayRate.count({ where: { verificationStatus: "VERIFIED" } })).toBe(1);

    await prisma.employeePayRate.create({
      data: {
        id: "verified-conflict",
        employeeId: "employee-1",
        effectiveFrom: date("2026-10-15"),
        hourlyRate: new Prisma.Decimal("36.0000"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await paycheck("same-date", "employee-1", "2026-10-15", "2026-10-21", { rate: "37.0000" });
    const conflict = await ingest("same-date", "employee-1", 1, [observation("2026-10-15", "2026-10-21", {
      observedHourlyRate: "37.0000",
      regularEarnings: "1480.00",
      observedDateStart: date("2026-10-15"),
      observedDateEnd: date("2026-10-21"),
      dateConfidence: "EXPLICIT_ROW_RANGE",
    })]);
    expect(conflict[0].classifications.map((item) => item.kind)).toContain("SAME_DATE_CONFLICT");

    await paycheck("split", "employee-1", "2026-10-22", "2026-10-28", { rate: "38.0000" });
    const split = await ingest("split", "employee-1", 1, [
      observation("2026-10-22", "2026-10-28", { sourceRowSequence: 1, observedHourlyRate: "37.0000", regularMinutes: 1200, regularEarnings: "740.00" }),
      observation("2026-10-22", "2026-10-28", { sourceRowSequence: 2, observedHourlyRate: "38.0000", regularMinutes: 1200, regularEarnings: "760.00" }),
    ]);
    expect(split).toHaveLength(2);
    expect(split.every((item) => item.classifications.some((classification) => classification.kind === "MULTIPLE_RATE_SPLIT"))).toBe(true);
    expect(await prisma.employeePayRate.count({ where: { verificationStatus: "VERIFIED" } })).toBe(2);
  });

  it("preserves unsupported, zero-hour, manual, out-of-order, and unconfirmed evidence safely", async () => {
    await paycheck("unsupported", "employee-1", "2026-11-01", "2026-11-07");
    const unsupported = await ingest("unsupported", "employee-1", 1, [observation("2026-11-01", "2026-11-07", {
      observedHourlyRate: null,
      regularMinutes: 0,
      regularEarnings: null,
      observationState: "UNSUPPORTED",
    })]);
    expect(unsupported[0].classifications.map((item) => item.kind)).toEqual(["UNSUPPORTED_OBSERVATION"]);
    expect(await prisma.payRateBoundaryCandidate.count()).toBe(0);

    await paycheck("manual", "employee-1", "2026-11-08", "2026-11-14", { rate: "40.0000" });
    const manual = await ingest("manual", "employee-1", 1, [observation("2026-11-08", "2026-11-14", {
      observedHourlyRate: "40.0000",
      regularEarnings: "1600.00",
      extractionBasis: "MANUAL_ENTRY",
      observationState: "REVIEW_REQUIRED",
    })]);
    const manualCandidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow({
      where: { observations: { some: { observationId: manual[0].id } } },
    });
    await expect(verifyExactPayRateBoundary(actor, {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: manualCandidate.id,
      expectedEvidenceVersion: manualCandidate.evidenceVersion,
      exactEffectiveDate: "2026-11-10",
      reason: "Manual values alone must not pass this boundary.",
      requestToken: token(),
    }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    await paycheck("older", "employee-1", "2026-08-01", "2026-08-07");
    await expect(ingest("older", "employee-1", 1, [observation("2026-08-01", "2026-08-07")]))
      .resolves.toHaveLength(1);

    await paycheck("unconfirmed", "employee-1", "2026-12-01", "2026-12-07", { reviewStatus: "NEEDS_REVIEW" });
    await expect(ingest("unconfirmed", "employee-1", 1, [observation("2026-12-01", "2026-12-07")]))
      .rejects.toThrow("PAY_RATE_OBSERVATION_SOURCE_INVALID");
  });

  it("keeps exact submissions idempotent and serializes concurrent neighboring imports", async () => {
    await paycheck("idempotent", "employee-1", "2026-09-01", "2026-09-07");
    const draft = observation("2026-09-01", "2026-09-07");
    await Promise.all([
      ingest("idempotent", "employee-1", 1, [draft]),
      ingest("idempotent", "employee-1", 1, [draft]),
    ]);
    expect(await prisma.payRateObservation.count({ where: { sourcePaycheckId: "idempotent" } })).toBe(1);
    await expect(ingest("idempotent", "employee-1", 1, [{
      ...draft,
      observedHourlyRate: "34.0000",
      regularEarnings: "1360.00",
    }])).rejects.toThrow("PAY_RATE_OBSERVATION_REVISION_CONFLICT");

    await paycheck("neighbor-a", "employee-1", "2026-12-08", "2026-12-14", { rate: "41.0000" });
    await paycheck("neighbor-b", "employee-1", "2026-12-15", "2026-12-21", { rate: "42.0000" });
    await Promise.all([
      ingest("neighbor-a", "employee-1", 1, [observation("2026-12-08", "2026-12-14", { observedHourlyRate: "41.0000", regularEarnings: "1640.00" })]),
      ingest("neighbor-b", "employee-1", 1, [observation("2026-12-15", "2026-12-21", { observedHourlyRate: "42.0000", regularEarnings: "1680.00" })]),
    ]);
    expect(await prisma.payRateObservation.count()).toBe(3);
  });

  it("preserves correction lineage, supersedes stale uncertainty, and rejects observation mutation", async () => {
    await paycheck("corrected", "employee-1", "2026-09-14", "2026-09-20");
    const original = await ingest("corrected", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    await prisma.paycheck.update({ where: { id: "corrected" }, data: { evidenceRevision: 2 } });
    const replacement = await ingest("corrected", "employee-1", 2, [observation("2026-09-14", "2026-09-20", {
      observedHourlyRate: "34.0000",
      regularEarnings: "1360.00",
      extractionBasis: "PAYCHECK_CORRECTION",
      observationState: "REVIEW_REQUIRED",
    })], true);
    expect(await prisma.payRateObservationSupersession.findUniqueOrThrow({
      where: { priorObservationId: original[0].id },
    })).toMatchObject({ replacementObservationId: replacement[0].id });
    expect((await prisma.payRateBoundaryCandidate.findMany({ orderBy: { createdAt: "asc" } })).map((item) => item.status))
      .toEqual(["SUPERSEDED", "OPEN"]);
    await expect(prisma.payRateObservation.update({
      where: { id: original[0].id },
      data: { observedHourlyRate: new Prisma.Decimal("99.0000") },
    })).rejects.toThrow(/append-only/i);
    await expect(prisma.payRateObservation.delete({ where: { id: original[0].id } }))
      .rejects.toThrow(/append-only/i);
    const mismatchedCandidate = await prisma.payRateBoundaryCandidate.create({
      data: {
        id: "mismatched-candidate",
        employeeId: "employee-1",
        observedHourlyRate: new Prisma.Decimal("99.0000"),
        earliestEffectiveDate: date("2026-09-14"),
        latestEffectiveDate: date("2026-09-20"),
      },
    });
    await expect(prisma.payRateBoundaryCandidateObservation.create({
      data: { candidateId: mismatchedCandidate.id, observationId: original[0].id },
    })).rejects.toThrow(/must match one open Employee\/rate candidate/i);
  });

  it("rolls back exact-boundary creation when mandatory audit work fails", async () => {
    await paycheck("rollback", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("rollback", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "reject_test_boundary_event"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced boundary audit insertion failure';
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "reject_test_boundary_event_trigger"
        BEFORE INSERT ON "PayRateBoundaryDecisionEvent"
        FOR EACH ROW EXECUTE FUNCTION "reject_test_boundary_event"()
    `);
    try {
      await expect(verifyExactPayRateBoundary(actor, {
        decision: "VERIFY_EXACT_BOUNDARY",
        candidateId: candidate.id,
        expectedEvidenceVersion: candidate.evidenceVersion,
        exactEffectiveDate: "2026-09-17",
        reason: "Synthetic rollback proof.",
        requestToken: token(),
      }, { client: prisma })).rejects.toThrow(/forced boundary audit insertion failure/i);
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "reject_test_boundary_event_trigger" ON "PayRateBoundaryDecisionEvent"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "reject_test_boundary_event"()`);
    }
    expect(await prisma.employeePayRate.count()).toBe(0);
    expect(await prisma.payRateBoundaryDecisionEvent.count()).toBe(0);
    expect(await prisma.payRateBoundaryCandidate.findUniqueOrThrow({ where: { id: candidate.id } }))
      .toMatchObject({ status: "OPEN", evidenceVersion: candidate.evidenceVersion, resolvedEmployeePayRateId: null });
  });

  it("serializes exact-boundary review against correction and preserves valid supersession audit history", async () => {
    await paycheck("racing", "employee-1", "2026-09-14", "2026-09-20");
    await ingest("racing", "employee-1", 1, [observation("2026-09-14", "2026-09-20")]);
    const candidate = await prisma.payRateBoundaryCandidate.findFirstOrThrow();
    let releaseReview!: () => void;
    let reviewUpdated!: () => void;
    const reviewReached = new Promise<void>((resolve) => { reviewUpdated = resolve; });
    const reviewRelease = new Promise<void>((resolve) => { releaseReview = resolve; });
    const review = verifyExactPayRateBoundary(actor, {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: "2026-09-17",
      reason: "Synthetic concurrent review.",
      requestToken: token(),
    }, {
      client: prisma,
      hooks: {
        afterCandidateUpdate: async () => {
          reviewUpdated();
          await reviewRelease;
        },
      },
    });
    await reviewReached;

    let correctionSettled = false;
    const correction = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(CAST(${"nam-payroll:paycheck:racing"} AS text), 0::bigint)
        )
      `;
      const updated = await tx.paycheck.update({
        where: { id: "racing" },
        data: {
          evidenceRevision: { increment: 1 },
          baseRate: new Prisma.Decimal("34.0000"),
          regularEarnings: new Prisma.Decimal("1360.00"),
          grossCashPay: new Prisma.Decimal("1360.00"),
        },
      });
      await supersedePaycheckRateEvidenceForCorrection(tx, {
        paycheckId: updated.id,
        employeeId: updated.employeeId,
        evidenceRevision: updated.evidenceRevision,
      });
      await ingestPayRateObservations(tx, {
        paycheckId: updated.id,
        employeeId: updated.employeeId,
        evidenceRevision: updated.evidenceRevision,
        observations: [observation("2026-09-14", "2026-09-20", {
          observedHourlyRate: "34.0000",
          regularEarnings: "1360.00",
          extractionBasis: "PAYCHECK_CORRECTION",
          observationState: "REVIEW_REQUIRED",
        })],
        supersedePriorRevision: true,
      });
    }).finally(() => { correctionSettled = true; });

    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(correctionSettled).toBe(false);
    releaseReview();
    await Promise.all([review, correction]);

    expect(await prisma.employeePayRate.findFirstOrThrow()).toMatchObject({
      verificationStatus: "SUPERSEDED",
      evidenceVersion: 2,
    });
    expect(await prisma.payRateEvidenceReviewEvent.findFirstOrThrow()).toMatchObject({
      decisionKind: "PAYCHECK_CORRECTION_SUPERSEDED",
      previousStatus: "VERIFIED",
      newStatus: "SUPERSEDED",
    });
    expect(await prisma.payRateObservationSupersession.count()).toBe(1);
    expect(await prisma.payRateBoundaryCandidate.count({ where: { status: "OPEN" } })).toBe(1);
  });
});
