import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { type DashboardData, PayrollDashboard } from "@/features/payroll/PayrollDashboard";

afterEach(cleanup);

function dashboardData(status: "RECONCILED" | "NEEDS_REVIEW", reviewStatus: "CONFIRMED" | "NEEDS_REVIEW") {
  const paycheck = {
    id: "paycheck-1",
    periodStart: "2026-10-12",
    periodEnd: "2026-10-18",
    periodLabel: "Oct 12, 2026 – Oct 18, 2026",
    checkDate: "2026-10-21",
    regularPaidMinutes: 2400,
    overtimePaidMinutes: 1200,
    paidMinutes: 3600,
    baseRate: "33.15",
    regularEarnings: "1326.00",
    overtimeBaseEarnings: "663.00",
    overtimePremiumEarnings: "331.50",
    otherCashEarnings: "0.00",
    grossCashPay: "2320.50",
    noncashImputedEarnings: "10.31",
    preTaxDeductions: "0.00",
    employeeTaxes: "520.00",
    postTaxDeductions: "121.04",
    adjustments: "0.00",
    netPay: "1679.46",
    reviewStatus,
    importedAt: new Date("2026-10-21T12:00:00.000Z"),
    updatedAt: "2026-10-21T12:00:00.000Z",
    notes: "",
    parserVersion: "synthetic-v1",
    fingerprint: "a".repeat(64),
    status,
    reason: status === "RECONCILED" ? "FULL_AGGREGATE_MATCH" : "UNCONFIRMED_PAYCHECK_EVIDENCE",
    reasons: [status === "RECONCILED" ? "FULL_AGGREGATE_MATCH" : "UNCONFIRMED_PAYCHECK_EVIDENCE"],
    differenceMinutes: 0,
    differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
    explanation: status === "RECONCILED"
      ? "Aggregate regular, overtime, and total hours match."
      : "The imported paycheck has not been confirmed.",
    boundaryExplanation: undefined,
  };
  return {
    employee: { id: "employee-1", displayName: "Synthetic Employee" },
    month: "2026-10",
    days: [],
    summary: {
      reconciledMinutes: status === "RECONCILED" ? 3600 : 0,
      pendingMinutes: 0,
      pendingGross: undefined,
      pendingGrossStatus: "NOT_APPLICABLE",
      pendingGrossReason: undefined,
      pendingGrossUncoveredEntryCount: 0,
      openIssues: status === "NEEDS_REVIEW" ? 1 : 0,
      latestPaycheck: paycheck,
      nextExpectedCheckDate: "2026-10-21",
      reconciledScopeLabel: "Workday periods ending in selected month",
      pendingScopeLabel: "uncovered work dates in NAM weeks ending in selected month",
      issueScopeLabel: "unique actionable calendar records and Workday periods in selected scope",
    },
    paychecks: [paycheck],
  } as DashboardData;
}

describe("PayrollDashboard reconciliation presentation", () => {
  it("shows the review entry only when server-provided capability is true", () => {
    const { rerender } = render(<PayrollDashboard data={dashboardData("RECONCILED", "CONFIRMED")} canReviewEvidence />);
    expect(screen.getByRole("link", { name: "Evidence Review" })).toHaveAttribute("href", "/payroll/evidence-review");
    rerender(<PayrollDashboard data={dashboardData("RECONCILED", "CONFIRMED")} />);
    expect(screen.queryByRole("link", { name: "Evidence Review" })).not.toBeInTheDocument();
  });
  it("presents confirmed matching evidence as an aggregate match", () => {
    render(<PayrollDashboard data={dashboardData("RECONCILED", "CONFIRMED")} preview />);

    expect(screen.getAllByText("Aggregate match").length).toBeGreaterThan(0);
    expect(screen.getByText(/Reconciled hours/).previousElementSibling).toHaveTextContent("60h");
    expect(screen.getByText("Official check date").nextElementSibling).toHaveTextContent("Oct 21, 2026");
    expect(screen.getByText("Next Expected Check")).toBeInTheDocument();
    expect(screen.queryByText("Expected check date", { exact: true })).not.toBeInTheDocument();
  });

  it("presents unconfirmed matching evidence as Needs Review with no reconciled hours", () => {
    render(<PayrollDashboard data={dashboardData("NEEDS_REVIEW", "NEEDS_REVIEW")} preview />);

    expect(screen.getAllByText("NEEDS REVIEW").length).toBeGreaterThan(0);
    expect(screen.getByText(/Reconciled hours/).previousElementSibling).toHaveTextContent("0h");
  });

  it("presents incomplete expected gross as unavailable rather than zero or a partial total", () => {
    const data = dashboardData("RECONCILED", "CONFIRMED");
    data.summary.pendingMinutes = 1_200;
    data.summary.pendingGross = undefined;
    data.summary.pendingGrossStatus = "UNAVAILABLE";
    data.summary.pendingGrossReason = "INCOMPLETE_VERIFIED_RATE_COVERAGE";
    data.summary.pendingGrossUncoveredEntryCount = 2;

    render(<PayrollDashboard data={data} preview />);

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/2 entries need verified rate evidence/)).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });
});
