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
});
