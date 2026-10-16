import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewer: vi.fn(),
  timesheetFind: vi.fn(),
  rateFind: vi.fn(),
  employeeFindMany: vi.fn(),
  timesheetCount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/payroll/auth", () => ({ requirePayrollEvidenceReviewer: mocks.requireReviewer }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    weeklyTimesheet: { findUnique: mocks.timesheetFind, count: mocks.timesheetCount, findMany: vi.fn() },
    employeePayRate: { findUnique: mocks.rateFind, findMany: vi.fn() },
    paycheck: { findMany: vi.fn() },
    employee: { findMany: mocks.employeeFindMany },
  },
}));

import {
  getHistoricalEmployeeReviewChoices,
  getEvidenceReviewDashboard,
  getPayRateEvidenceReviewEvidence,
  getTimesheetIdentityReviewEvidence,
} from "@/features/payroll/evidence-review-data";

describe("Payroll evidence review data authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authorizes before every target or global review query", async () => {
    mocks.requireReviewer.mockRejectedValue(new Error("denied"));
    await expect(getTimesheetIdentityReviewEvidence("secret-timesheet")).rejects.toThrow("denied");
    await expect(getPayRateEvidenceReviewEvidence("secret-rate")).rejects.toThrow("denied");
    await expect(getHistoricalEmployeeReviewChoices()).rejects.toThrow("denied");
    await expect(getEvidenceReviewDashboard()).rejects.toThrow("denied");
    expect(mocks.timesheetFind).not.toHaveBeenCalled();
    expect(mocks.rateFind).not.toHaveBeenCalled();
    expect(mocks.employeeFindMany).not.toHaveBeenCalled();
    expect(mocks.timesheetCount).not.toHaveBeenCalled();
  });
});
