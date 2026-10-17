import { describe, expect, it } from "vitest";

import { parseWorkdayPaycheckText } from "@/features/payroll/parser";
import {
  realisticWorkdayLayout,
  workdayPaycheckTextFixtures as fixtures,
} from "../fixtures/workday-paycheck-text";

function issueCodes(result: ReturnType<typeof parseWorkdayPaycheckText>) {
  return result.rateExtraction?.issues.map((issue) => issue.code) ?? [];
}

describe("Workday paycheck parser", () => {
  it("preserves the previously supported single-rate extraction", () => {
    const result = parseWorkdayPaycheckText(fixtures.ordinarySingleRate, "a".repeat(64));

    expect(result).toMatchObject({
      regularHours: "40.00",
      baseRate: "33.15",
      regularEarnings: "1326.00",
      periodStart: "2026-09-14",
      periodEnd: "2026-09-20",
      checkDate: "2026-09-25",
      rateExtraction: { disposition: "SUPPORTED" },
    });
    expect(result.rateExtraction?.observations).toHaveLength(1);
    expect(result.rateExtraction?.observations[0]).toMatchObject({
      sequence: 1,
      hourlyRate: "33.15",
      regularHours: "40.00",
      regularMinutes: 2400,
      regularEarnings: "1326.00",
      dateConfidence: "PAY_PERIOD_ONLY",
      eligibleForVerification: true,
    });
  });

  it("preserves multiple regular rows in source order and consolidates an agreeing rate", () => {
    const result = parseWorkdayPaycheckText(fixtures.multipleRegularRowsSameRate);

    expect(result.rateExtraction?.disposition).toBe("SUPPORTED");
    expect(result.rateExtraction?.observations.map((row) => ({
      sequence: row.sequence,
      hours: row.regularHours,
      rate: row.hourlyRate,
      start: row.rowDateStart,
    }))).toEqual([
      { sequence: 1, hours: "24.00", rate: "33.15", start: "2026-09-14" },
      { sequence: 2, hours: "16.00", rate: "33.15", start: "2026-09-17" },
    ]);
    expect(result).toMatchObject({ regularHours: "40.00", regularEarnings: "1326.00", baseRate: "33.15" });
    expect(issueCodes(result)).toContain("MULTIPLE_REGULAR_ROWS");
  });

  it("requires review for multiple rates even when explicit row dates are available", () => {
    const result = parseWorkdayPaycheckText(fixtures.multipleRegularRowsDifferentRatesWithDates);

    expect(result.rateExtraction?.disposition).toBe("REVIEW_REQUIRED");
    expect(result.baseRate).toBe("");
    expect(result.rateExtraction?.observations.map((row) => row.hourlyRate)).toEqual(["33.15", "35.25"]);
    expect(issueCodes(result)).toContain("MULTIPLE_REGULAR_RATES");
    expect(issueCodes(result)).not.toContain("MULTIPLE_REGULAR_RATES_WITHOUT_EXPLICIT_DATES");
  });

  it("rejects multiple rates without reliable row dates as unsupported", () => {
    const result = parseWorkdayPaycheckText(fixtures.multipleRegularRowsDifferentRatesWithoutDates);

    expect(result.rateExtraction?.disposition).toBe("UNSUPPORTED");
    expect(result.baseRate).toBe("");
    expect(issueCodes(result)).toContain("MULTIPLE_REGULAR_RATES_WITHOUT_EXPLICIT_DATES");
  });

  it.each([
    ["missing base rate", fixtures.missingRate, "MISSING_REGULAR_RATE"],
    ["missing regular earnings", fixtures.missingRegularEarnings, "MISSING_REGULAR_EARNINGS"],
    ["rate and earnings mismatch", fixtures.rateEarningsMismatch, "RATE_EARNINGS_MISMATCH"],
    ["zero-hour regular row", fixtures.zeroHourRegularRow, "ZERO_HOUR_REGULAR_ROW"],
  ])("requires review for %s", (_name, text, code) => {
    const result = parseWorkdayPaycheckText(text);

    expect(result.rateExtraction?.disposition).toBe("REVIEW_REQUIRED");
    expect(result.baseRate).toBe("");
    expect(issueCodes(result)).toContain(code);
    expect(result.rateExtraction?.observations[0]?.eligibleForVerification).toBe(false);
  });

  it("reports a collapsed two-value regular row as column-ambiguous", () => {
    const result = parseWorkdayPaycheckText(fixtures.missingRegularEarnings);

    expect(issueCodes(result)).toContain("AMBIGUOUS_REGULAR_COLUMNS");
    expect(result.rateExtraction?.observations[0]?.eligibleForVerification).toBe(false);
  });

  it("classifies an adjustment-only document as unsupported", () => {
    const result = parseWorkdayPaycheckText(fixtures.adjustmentOnly);

    expect(result.rateExtraction).toMatchObject({ disposition: "UNSUPPORTED", observations: [] });
    expect(issueCodes(result)).toContain("ADJUSTMENT_ONLY_DOCUMENT");
  });

  it("does not substitute YTD values when current-period columns are ambiguous", () => {
    const result = parseWorkdayPaycheckText(fixtures.currentYtdAmbiguity);

    expect(result.regularHours).toBe("40.00");
    expect(result.baseRate).toBe("");
    expect(result.regularEarnings).toBe("");
    expect(result.rateExtraction?.disposition).toBe("REVIEW_REQUIRED");
    expect(issueCodes(result)).toContain("CURRENT_YTD_AMBIGUOUS");
  });

  it("does not double-count split overtime components", () => {
    const result = parseWorkdayPaycheckText(fixtures.splitOvertime);

    expect(result.overtimeHours).toBe("20.00");
    expect(Number(result.regularHours) + Number(result.overtimeHours)).toBe(60);
    expect(result.overtimeBaseEarnings).toBe("663.00");
    expect(result.overtimePremiumEarnings).toBe("331.50");
  });

  it("fails closed on unfamiliar extra numeric columns", () => {
    const result = parseWorkdayPaycheckText(fixtures.unfamiliarAmbiguousColumns);

    expect(result.rateExtraction?.disposition).toBe("UNSUPPORTED");
    expect(result.baseRate).toBe("");
    expect(issueCodes(result)).toContain("AMBIGUOUS_REGULAR_COLUMNS");
  });

  it("reports invalid row date evidence without crashing", () => {
    const result = parseWorkdayPaycheckText(
      fixtures.ordinarySingleRate.replace(
        "REGULAR 40.00",
        "REGULAR 09/18/2026 - 09/17/2026 40.00",
      ),
    );

    expect(result.rateExtraction?.disposition).toBe("UNSUPPORTED");
    expect(issueCodes(result)).toContain("ROW_DATE_RANGE_INVALID");
  });

  it("rejects an invalid calendar date and non-minute hour precision", () => {
    const result = parseWorkdayPaycheckText(fixtures.ordinarySingleRate.replace(
      "REGULAR 40.00 33.15",
      "REGULAR 13/40/2026 - 09/20/2026 40.001 33.15",
    ));

    expect(result.rateExtraction?.disposition).toBe("UNSUPPORTED");
    expect(issueCodes(result)).toEqual(expect.arrayContaining([
      "ROW_DATE_RANGE_INVALID",
      "REGULAR_HOURS_NOT_WHOLE_MINUTES",
    ]));
  });

  it("accepts ordinary cent rounding without weakening larger mismatch detection", () => {
    const result = parseWorkdayPaycheckText(fixtures.ordinarySingleRate.replace(
      "REGULAR 40.00 33.15 1,326.00",
      "REGULAR 3.00 33.3333 100.00",
    ).replace("Gross Cash Pay 1,326.00", "Gross Cash Pay 100.00"));

    expect(result.rateExtraction?.disposition).toBe("SUPPORTED");
    expect(issueCodes(result)).not.toContain("RATE_EARNINGS_MISMATCH");
  });

  it("parses the established aligned Workday current and YTD layout", () => {
    const result = parseWorkdayPaycheckText(
      fixtures.realisticCurrentAndYtd,
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
      rateExtraction: { disposition: "SUPPORTED" },
    });
  });

  it("flags inconsistent paired overtime hours for review", () => {
    const result = parseWorkdayPaycheckText(
      fixtures.splitOvertime.replace("Overtime Premium - 0.5X 20.00", "Overtime Premium - 0.5X 18.00"),
    );
    expect(result.warnings).toContain("Overtime 1X and 0.5X components report different hours; review required.");
  });
});
