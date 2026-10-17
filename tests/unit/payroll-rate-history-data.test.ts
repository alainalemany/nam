import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireReviewer: vi.fn(),
  employeeFind: vi.fn(),
  rateFind: vi.fn(),
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
    employeePayRate: { findMany: mocks.rateFind, findFirst: vi.fn() },
    payRateBoundaryCandidate: { findMany: mocks.candidateFind, findFirst: mocks.candidateFindFirst, count: mocks.candidateCount },
    dailyTimeEntry: { findMany: mocks.entryFind },
  },
}));

import { getRateBoundaryCandidateDetail, getRateHistoryOverview } from "@/features/payroll/rate-history-data";

describe("rate-history data authorization", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
