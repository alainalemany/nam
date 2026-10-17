import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
