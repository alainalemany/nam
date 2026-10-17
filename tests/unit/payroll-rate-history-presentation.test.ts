import { describe, expect, it } from "vitest";

import { orderedRateClassifications, primaryRateClassification, validateCandidateDate } from "@/features/payroll/rate-history-presentation";

describe("rate-history presentation rules", () => {
  it.each([
    ["2026-02-30", "2026-02-01", "2026-02-28", "real calendar date"],
    ["2025-02-29", "2025-02-01", "2025-02-28", "real calendar date"],
    ["2024-02-29", "2024-02-01", "2024-02-29", undefined],
    ["2026-04-31", "2026-04-01", "2026-04-30", "real calendar date"],
    ["2026-12-31", "2026-01-01", "2026-12-31", undefined],
    ["2026-13-01", "2026-01-01", "2026-12-31", "real calendar date"],
    ["2026-00-10", "2026-01-01", "2026-12-31", "real calendar date"],
    ["2026-09-30", "2026-09-01", "2026-09-14", "inside the evidence window"],
  ])("validates candidate date %s", (value, earliest, latest, message) => {
    const result = validateCandidateDate(value, earliest, latest);
    if (message) expect(result).toContain(message);
    else expect(result).toBeUndefined();
  });

  it("prioritizes conflict and direction labels over generic uncertainty", () => {
    expect(primaryRateClassification(["UNCERTAIN_EFFECTIVE_DATE_CHANGE", "CANDIDATE_INCREASE"])).toBe("CANDIDATE_INCREASE");
    expect(primaryRateClassification(["CANDIDATE_DECREASE", "SAME_DATE_CONFLICT"])).toBe("SAME_DATE_CONFLICT");
  });

  it("retains every distinct classification in deterministic presentation order", () => {
    expect(orderedRateClassifications([
      "UNCERTAIN_EFFECTIVE_DATE_CHANGE",
      "CANDIDATE_DECREASE",
      "SAME_DATE_CONFLICT",
      "CANDIDATE_DECREASE",
    ])).toEqual([
      "SAME_DATE_CONFLICT",
      "CANDIDATE_DECREASE",
      "UNCERTAIN_EFFECTIVE_DATE_CHANGE",
    ]);
  });
});
