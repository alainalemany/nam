import { describe, expect, it } from "vitest";

import { parseWorkdayPaycheckText } from "@/features/payroll/parser";

const sanitizedPayslip = `
Pay Period Begin 09/14/2026
Pay Period End 09/20/2026
Check Date 09/25/2026
REGULAR 40.00 33.15 1,326.00
Overtime 1X 20.00 33.15 663.00
Overtime Premium - 0.5X 20.00 16.575 331.50
Imputed GTL 1.15
Imputed LTD 9.16
Gross Cash Pay 2,320.50
Employee Taxes 520.00
Post Tax Deductions 121.04
Net Pay 1,679.46
`;

const realisticWorkdayText = `
Pay Period Begin Pay Period End Check Date
09/21/2026 09/27/2026 10/02/2026
Earnings Work Dates Hours Rate Current YTD
Imputed GTL 09/21/2026 - 09/27/2026 0.00 0.00 1.15 101.15
Imputed LTD 09/21/2026 - 09/27/2026 0.00 0.00 9.16 209.16
Overtime 1X 09/21/2026 - 09/27/2026 20.00 33.15 663.00 29,016.63
Overtime Premium - 0.5X 09/21/2026 - 09/27/2026 20.00 16.575 331.50 14,550.62
REGULAR 09/21/2026 - 09/27/2026 40.00 33.15 1,326.00 38,480.60
`;

const realisticWorkdayLayout = {
  tables: [
    [
      ["Document", "Pay Period Begin", "Pay Period End", "Check Date"],
      ["Statement", "09/21/2026", "09/27/2026", "10/02/2026"],
    ],
    [
      ["Hours Worked", "Gross Pay", "Deductions", "Employee Taxes", "Net Pay"],
      ["60.00", "$2,320.50", "$121.04", "$520.00", "$1,679.46"],
    ],
  ],
};

describe("Workday paycheck parser", () => {
  it("does not double-count paired overtime components", () => {
    const result = parseWorkdayPaycheckText(sanitizedPayslip, "a".repeat(64));
    expect(result.regularHours).toBe("40.00");
    expect(result.overtimeHours).toBe("20.00");
    expect(Number(result.regularHours) + Number(result.overtimeHours)).toBe(60);
    expect(result.overtimeBaseEarnings).toBe("663.00");
    expect(result.overtimePremiumEarnings).toBe("331.50");
  });

  it("separates cash gross from noncash imputed earnings", () => {
    const result = parseWorkdayPaycheckText(sanitizedPayslip);
    expect(result.grossCashPay).toBe("2320.50");
    expect(result.noncashImputedEarnings).toBe("10.31");
    expect(result.netPay).toBe("1679.46");
    expect(result.periodStart).toBe("2026-09-14");
    expect(result.periodEnd).toBe("2026-09-20");
    expect(result.checkDate).toBe("2026-09-25");
    expect(result.warnings).not.toContain("Gross cash pay less parsed deductions and taxes does not equal net pay; review unclassified deductions.");
  });

  it("flags inconsistent paired overtime hours for review", () => {
    const result = parseWorkdayPaycheckText(
      sanitizedPayslip.replace("Overtime Premium - 0.5X 20.00", "Overtime Premium - 0.5X 18.00"),
    );
    expect(result.warnings).toContain("Overtime 1X and 0.5X components report different hours; review required.");
  });

  it("parses aligned Workday headers and current-versus-YTD earnings columns", () => {
    const result = parseWorkdayPaycheckText(
      realisticWorkdayText,
      "b".repeat(64),
      realisticWorkdayLayout,
    );

    expect(result).toMatchObject({
      periodStart: "2026-09-21",
      periodEnd: "2026-09-27",
      checkDate: "2026-10-02",
      regularHours: "40.00",
      overtimeHours: "20.00",
      baseRate: "33.15",
      regularEarnings: "1326.00",
      overtimeBaseEarnings: "663.00",
      overtimePremiumEarnings: "331.50",
      grossCashPay: "2320.50",
      noncashImputedEarnings: "10.31",
      employeeTaxes: "520.00",
      netPay: "1679.46",
    });
    expect(Number(result.regularHours) + Number(result.overtimeHours)).toBe(60);
    expect(Number(result.overtimeBaseEarnings) + Number(result.overtimePremiumEarnings)).toBe(994.5);
  });

  it("does not substitute YTD values when current-period columns are ambiguous", () => {
    const result = parseWorkdayPaycheckText(`
      Earnings Hours Rate Current YTD
      REGULAR 09/21/2026 - 09/27/2026 40.00 33.15 38,480.60
      Gross Cash Pay 1,326.00
      Net Pay 1,000.00
    `);

    expect(result.regularHours).toBe("40.00");
    expect(result.baseRate).toBe("33.15");
    expect(result.regularEarnings).toBe("");
    expect(result.warnings).toContain(
      "Current-period earnings were not confidently identified; review required.",
    );
    expect(result.warnings).toContain("Confirm the payroll period and official check date.");
  });
});
