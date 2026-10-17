import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireReviewer: vi.fn(),
  employeeFind: vi.fn(),
  rateFind: vi.fn(),
  rateFindFirst: vi.fn(),
  candidateFind: vi.fn(),
  candidateFindFirst: vi.fn(),
  candidateCount: vi.fn(),
  entryFind: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/payroll/auth", () => ({ requirePayrollEvidenceReviewer: mocks.requireReviewer }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findUnique: mocks.employeeFind },
    employeePayRate: { findMany: mocks.rateFind, findFirst: mocks.rateFindFirst },
    payRateBoundaryCandidate: { findMany: mocks.candidateFind, findFirst: mocks.candidateFindFirst, count: mocks.candidateCount },
    dailyTimeEntry: { findMany: mocks.entryFind },
  },
}));

import { getRateBoundaryCandidateDetail, getRateHistoryOverview } from "@/features/payroll/rate-history-data";

describe("rate-history data authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateFind.mockResolvedValue([]);
    mocks.rateFindFirst.mockResolvedValue(null);
    mocks.candidateFind.mockResolvedValue([]);
    mocks.candidateFindFirst.mockResolvedValue(null);
    mocks.candidateCount.mockResolvedValue(0);
  });

  it("authorizes before overview or candidate evidence queries", async () => {
    mocks.requireReviewer.mockRejectedValue(new Error("denied"));
    await expect(getRateHistoryOverview()).rejects.toThrow("denied");
    await expect(getRateBoundaryCandidateDetail("candidate-secret")).rejects.toThrow("denied");
    expect(mocks.employeeFind).not.toHaveBeenCalled();
    expect(mocks.rateFind).not.toHaveBeenCalled();
    expect(mocks.candidateFind).not.toHaveBeenCalled();
    expect(mocks.candidateFindFirst).not.toHaveBeenCalled();
    expect(mocks.entryFind).not.toHaveBeenCalled();
  });

  it("projects every persisted candidate classification for the authorized Employee", async () => {
    mocks.requireReviewer.mockResolvedValue({ employeeId: "employee-1" });
    mocks.employeeFind.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E1", isActive: true });
    mocks.rateFind.mockResolvedValue([]);
    mocks.candidateFind.mockResolvedValue([{
      id: "candidate-decrease",
      observedHourlyRate: new Prisma.Decimal("31.0000"),
      earliestEffectiveDate: new Date("2026-09-01T00:00:00.000Z"),
      latestEffectiveDate: new Date("2026-09-14T00:00:00.000Z"),
      status: "OPEN",
      evidenceVersion: 1,
      resolvedEmployeePayRateId: null,
      resolvedEmployeePayRate: null,
      observations: [{
        observation: {
          id: "observation-decrease",
          sourcePaycheckId: "paycheck-1",
          sourcePaycheckEvidenceRevision: 1,
          sourceRowSequence: 1,
          observedHourlyRate: new Prisma.Decimal("31.0000"),
          regularMinutes: 2_400,
          regularEarnings: new Prisma.Decimal("1240.00"),
          observedDateStart: new Date("2026-09-01T00:00:00.000Z"),
          observedDateEnd: new Date("2026-09-14T00:00:00.000Z"),
          payPeriodStart: new Date("2026-09-01T00:00:00.000Z"),
          payPeriodEnd: new Date("2026-09-14T00:00:00.000Z"),
          extractionBasis: "WORKDAY_REGULAR_ROW",
          dateConfidence: "EXPLICIT_ROW_RANGE",
          observationState: "SUPPORTED",
          parserVersion: "test-parser",
          createdAt: new Date("2026-09-15T00:00:00.000Z"),
          classifications: [
            { kind: "CANDIDATE_DECREASE" },
            { kind: "SAME_DATE_CONFLICT" },
            { kind: "UNCERTAIN_EFFECTIVE_DATE_CHANGE" },
          ],
          supersession: null,
          sourcePaycheck: {
            checkDate: new Date("2026-09-18T00:00:00.000Z"),
            reviewStatus: "CONFIRMED",
            payrollPeriod: {
              periodStart: new Date("2026-09-01T00:00:00.000Z"),
              periodEnd: new Date("2026-09-14T00:00:00.000Z"),
            },
          },
        },
      }],
    }]);
    mocks.candidateCount.mockImplementation(({ where }: { where: { status?: string } }) =>
      Promise.resolve(where.status && where.status !== "OPEN" ? 0 : 1));

    const result = await getRateHistoryOverview();

    expect(result.candidates[0]).toMatchObject({
      id: "candidate-decrease",
      status: "OPEN",
      primaryClassification: "SAME_DATE_CONFLICT",
      classifications: ["SAME_DATE_CONFLICT", "CANDIDATE_DECREASE", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"],
      activeObservationCount: 1,
      supportedObservationCount: 1,
      sourcePaycheckCount: 1,
    });
    expect(mocks.candidateFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { employeeId: "employee-1" },
      skip: 0,
      take: 20,
    }));
  });

  it("applies status filters and pagination without weakening Employee scope", async () => {
    mocks.requireReviewer.mockResolvedValue({ employeeId: "employee-1" });
    mocks.employeeFind.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E1", isActive: true });
    mocks.rateFind.mockResolvedValue([]);
    mocks.candidateFind.mockResolvedValue([]);
    mocks.candidateCount.mockResolvedValue(0);

    const result = await getRateHistoryOverview({ status: "rejected", page: 2 });

    expect(result).toMatchObject({ status: "rejected", page: 2, candidateCount: 0 });
    expect(mocks.candidateFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { employeeId: "employee-1", status: "REJECTED" },
      skip: 20,
      take: 20,
    }));
    expect(mocks.candidateCount).toHaveBeenCalledWith({
      where: { employeeId: "employee-1", status: "REJECTED" },
    });
  });

  it("queries and projects only authoritative VERIFIED boundaries in the history", async () => {
    mocks.requireReviewer.mockResolvedValue({ employeeId: "employee-1" });
    mocks.employeeFind.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E1", isActive: true });
    mocks.rateFind.mockResolvedValueOnce([
      rateRecord("verified", "30.0000", "2026-01-01", "VERIFIED", "PAYCHECK"),
      rateRecord("quarantined", "31.0000", "2026-02-01", "NEEDS_REVIEW", "UNKNOWN"),
      rateRecord("conflict", "32.0000", "2026-03-01", "CONFLICT", "PAYCHECK"),
      rateRecord("superseded", "33.0000", "2026-04-01", "SUPERSEDED", "PAYCHECK"),
      rateRecord("excluded", "34.0000", "2026-05-01", "EXCLUDED", "UNKNOWN"),
    ]);

    const result = await getRateHistoryOverview();

    expect(mocks.rateFind).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        employeeId: "employee-1",
        verificationStatus: "VERIFIED",
        provenanceKind: { in: ["PAYCHECK", "INDEPENDENT"] },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 60,
    }));
    expect(result.rates.map((rate) => rate.id)).toEqual(["verified"]);
  });

  it.each([
    ["CONFLICT", "32.0000", "CONFLICT"],
    ["NEEDS_REVIEW", "32.0000", "NEEDS_REVIEW"],
  ] as const)("marks the current rate uncertain for newer %s evidence", async (verificationStatus, hourlyRate, reason) => {
    const verified = currentRate("30.0000", "2026-01-01");
    mocks.requireReviewer.mockResolvedValue({ employeeId: "employee-1" });
    mocks.employeeFind.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E1", isActive: true });
    mocks.rateFind
      .mockResolvedValueOnce([rateRecord("verified", "30.0000", "2026-01-01", "VERIFIED", "PAYCHECK")])
      .mockResolvedValueOnce([{ effectiveFrom: date("2026-02-01"), hourlyRate: new Prisma.Decimal(hourlyRate), verificationStatus, provenanceKind: verificationStatus === "CONFLICT" ? "PAYCHECK" : "UNKNOWN" }]);
    mocks.rateFindFirst.mockResolvedValue(verified);

    const result = await getRateHistoryOverview();

    expect(result.currentRateTrust).toEqual({ status: "UNCERTAIN", uncertaintyStart: "2026-02-01", reasons: [reason] });
    expect(result.latestVerifiedRate).toEqual({ id: "verified", effectiveFrom: "2026-01-01", hourlyRate: "30" });
  });

  it("uses the existing date-specific open-candidate rule for increases, decreases, and overlaps", async () => {
    mocks.requireReviewer.mockResolvedValue({ employeeId: "employee-1" });
    mocks.employeeFind.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E1", isActive: true });
    mocks.rateFind.mockResolvedValueOnce([rateRecord("verified", "30.0000", "2026-01-01", "VERIFIED", "PAYCHECK")]).mockResolvedValueOnce([]);
    mocks.rateFindFirst.mockResolvedValue(currentRate("30.0000", "2026-01-01"));
    mocks.candidateFindFirst.mockResolvedValue({ earliestEffectiveDate: date("2026-02-15") });

    const result = await getRateHistoryOverview();

    expect(mocks.candidateFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ employeeId: "employee-1", status: "OPEN" }),
      orderBy: [{ earliestEffectiveDate: "asc" }, { createdAt: "asc" }],
    }));
    expect(result.currentRateTrust).toEqual({ status: "UNCERTAIN", uncertaintyStart: "2026-02-15", reasons: ["OPEN_CANDIDATE"] });
  });

  it("does not let historical, same-rate, rejected, superseded, or excluded evidence invalidate current trust", async () => {
    mocks.requireReviewer.mockResolvedValue({ employeeId: "employee-1" });
    mocks.employeeFind.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E1", isActive: true });
    mocks.rateFind
      .mockResolvedValueOnce([rateRecord("verified", "35.0000", "2026-06-01", "VERIFIED", "INDEPENDENT")])
      .mockResolvedValueOnce([{ effectiveFrom: date("2026-07-01"), hourlyRate: new Prisma.Decimal("35.0000"), verificationStatus: "NEEDS_REVIEW", provenanceKind: "UNKNOWN" }]);
    mocks.rateFindFirst.mockResolvedValue(currentRate("35.0000", "2026-06-01", "INDEPENDENT"));

    const result = await getRateHistoryOverview({ status: "rejected" });

    expect(result.currentRateTrust).toEqual({ status: "TRUSTED", uncertaintyStart: null, reasons: [] });
    expect(mocks.rateFind).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        employeeId: "employee-1",
        verificationStatus: { in: ["NEEDS_REVIEW", "CONFLICT"] },
        effectiveFrom: expect.objectContaining({ gte: date("2026-06-01") }),
      }),
    }));
  });
});

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function currentRate(hourlyRate: string, effectiveFrom: string, provenanceKind = "PAYCHECK") {
  return {
    id: "verified",
    effectiveFrom: date(effectiveFrom),
    hourlyRate: new Prisma.Decimal(hourlyRate),
    verificationStatus: "VERIFIED",
    provenanceKind,
  };
}

function rateRecord(id: string, hourlyRate: string, effectiveFrom: string, verificationStatus: string, provenanceKind: string) {
  return {
    id,
    employeeId: "employee-1",
    effectiveFrom: date(effectiveFrom),
    hourlyRate: new Prisma.Decimal(hourlyRate),
    verificationStatus,
    provenanceKind,
    sourceNote: null,
    sourcePaycheckId: null,
    evidenceVersion: 1,
    createdAt: date(effectiveFrom),
    updatedAt: date(effectiveFrom),
    provenanceCandidatePaycheckId: null,
    sourcePaycheck: null,
    observationSupports: [],
  };
}
