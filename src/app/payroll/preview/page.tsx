import { notFound } from "next/navigation";

import { payrollStatusLabels, type PayrollStatus } from "@/features/payroll/constants";
import { type DashboardData, PayrollDashboard } from "@/features/payroll/PayrollDashboard";

function previewDays(): DashboardData["days"] {
  const start = new Date("2026-09-28T00:00:00.000Z");
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    let status: PayrollStatus = "OFF";
    let timesheetMinutes: number | undefined;
    let scheduledLabel: string | undefined = "Off";
    let detail = "Scheduled day off with no recorded working time.";
    if ([1, 2, 3, 8, 9].includes(index)) {
      status = index === 8 ? "MISSING_TIMESHEET" : index < 4 ? "AWAITING_PAYROLL" : "RECONCILED";
      scheduledLabel = index % 2 ? "Night shift" : "Day shift";
      timesheetMinutes = index === 8 ? undefined : 720;
      detail = status === "MISSING_TIMESHEET"
        ? "This completed scheduled shift has no corresponding NAM Timesheet entry."
        : status === "RECONCILED"
          ? "Aggregate NAM hours match the paycheck. Workday does not prove that this individual date was paid."
          : "Completed NAM hours are awaiting paycheck confirmation.";
    }
    return {
      date: key,
      dayNumber: date.getUTCDate(),
      inMonth: date.getUTCMonth() === 9,
      status,
      statusLabel: status === "RECONCILED" ? "Aggregate match" : payrollStatusLabels[status],
      scheduledLabel,
      equipmentLabel: scheduledLabel !== "Off" ? "Dragline 8200" : undefined,
      timesheetMinutes,
      payrollPeriodLabel: status === "RECONCILED" ? "Oct 5, 2026 – Oct 11, 2026" : undefined,
      paidEvidenceLabel: status === "RECONCILED" ? "60h aggregate paid" : undefined,
      evidenceLevel: status === "RECONCILED" ? "aggregate" : undefined,
      estimatedGross: timesheetMinutes ? "$397.80" : undefined,
      estimatedGrossStatus: timesheetMinutes ? "AVAILABLE" as const : undefined,
      detail,
      actionHref: status === "MISSING_TIMESHEET" ? "/timesheets" : undefined,
      actionLabel: status === "MISSING_TIMESHEET" ? "Open Timesheets" : undefined,
    };
  });
}

export default function PayrollPreviewPage() {
  if (process.env.NAM_PAYROLL_PREVIEW !== "1") notFound();
  const data = {
    employee: { id: "preview", displayName: "Alex Morgan" },
    month: "2026-10",
    days: previewDays(),
    summary: {
      reconciledMinutes: 3600,
      pendingMinutes: 2520,
      pendingGross: "$1,657.50",
      pendingGrossStatus: "AVAILABLE" as const,
      pendingGrossReason: undefined,
      pendingGrossUncoveredEntryCount: 0,
      openIssues: 1,
      nextExpectedCheckDate: "2026-10-21",
      reconciledScopeLabel: "Workday periods ending in selected month",
      pendingScopeLabel: "uncovered work dates in NAM weeks ending in selected month",
      issueScopeLabel: "unique actionable calendar records and Workday periods in selected scope",
      latestPaycheck: {
        id: "preview-paycheck",
        periodStart: "2026-09-21",
        periodEnd: "2026-09-27",
        periodLabel: "Sep 21, 2026 – Sep 27, 2026",
        checkDate: "2026-10-02",
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
        reviewStatus: "CONFIRMED" as const,
        importedAt: new Date("2026-10-02T12:00:00.000Z"),
        notes: "",
        parserVersion: "workday-v1.0.0",
        fingerprint: "a".repeat(64),
      },
    },
    paychecks: [{
      id: "preview-paycheck",
      periodStart: "2026-09-21",
      periodEnd: "2026-09-27",
      periodLabel: "Sep 21, 2026 – Sep 27, 2026",
      checkDate: "2026-10-02",
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
      reviewStatus: "CONFIRMED" as const,
      importedAt: new Date("2026-10-02T12:00:00.000Z"),
      notes: "",
      parserVersion: "workday-v1.0.0",
      fingerprint: "a".repeat(64),
      status: "RECONCILED" as const,
      reason: "FULL_AGGREGATE_MATCH" as const,
      reasons: ["FULL_AGGREGATE_MATCH" as const],
      differenceMinutes: 0,
      differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
      explanation: "Aggregate match.",
      boundaryExplanation: undefined,
    }],
  } satisfies DashboardData;
  return <PayrollDashboard data={data} preview />;
}
