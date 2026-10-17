import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  classifyPayRateDirection,
  payRateObservationDigest,
  payRateObservationBounds,
  type RateObservationDraft,
} from "@/features/payroll/rate-observations";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function observation(overrides: Partial<RateObservationDraft> = {}): RateObservationDraft {
  return {
    sourceRowSequence: 1,
    observedHourlyRate: "33.15",
    regularMinutes: 2400,
    regularEarnings: "1326.00",
    observedDateStart: null,
    observedDateEnd: null,
    payPeriodStart: date("2026-09-14"),
    payPeriodEnd: date("2026-09-20"),
    extractionBasis: "WORKDAY_REGULAR_ROW",
    dateConfidence: "PAY_PERIOD_ONLY",
    observationState: "SUPPORTED",
    parserVersion: "workday-v3",
    ...overrides,
  };
}

describe("progressive pay-rate observation digest", () => {
  it("normalizes equivalent decimal evidence to one stable digest", () => {
    expect(payRateObservationDigest(observation({ observedHourlyRate: "33.15", regularEarnings: "1326" })))
      .toBe(payRateObservationDigest(observation({ observedHourlyRate: "33.1500", regularEarnings: "1326.0000" })));
  });

  it("changes when a rate-relevant fact or parser provenance changes", () => {
    const baseline = payRateObservationDigest(observation());
    expect(payRateObservationDigest(observation({ observedHourlyRate: "34.00" }))).not.toBe(baseline);
    expect(payRateObservationDigest(observation({ payPeriodStart: date("2026-09-15") }))).not.toBe(baseline);
    expect(payRateObservationDigest(observation({ parserVersion: "workday-v4" }))).not.toBe(baseline);
  });

  it("preserves both explicit row-date bounds instead of inventing an exact effective date", () => {
    expect(payRateObservationBounds(observation({
      observedDateStart: date("2026-09-17"),
      observedDateEnd: date("2026-09-21"),
      dateConfidence: "EXPLICIT_ROW_RANGE",
    }))).toEqual({
      earliestEffectiveDate: date("2026-09-17"),
      latestEffectiveDate: date("2026-09-21"),
    });
    expect(payRateObservationBounds(observation())).toEqual({
      earliestEffectiveDate: date("2026-09-14"),
      latestEffectiveDate: date("2026-09-20"),
    });
  });

  it("classifies increases and decreases without treating equal rates as changes", () => {
    const prior = new Prisma.Decimal("30.0000");
    expect(classifyPayRateDirection(new Prisma.Decimal("35.0000"), prior)).toBe("CANDIDATE_INCREASE");
    expect(classifyPayRateDirection(new Prisma.Decimal("29.5000"), prior)).toBe("CANDIDATE_DECREASE");
    expect(classifyPayRateDirection(new Prisma.Decimal("30.0000"), prior)).toBeUndefined();
  });
});
