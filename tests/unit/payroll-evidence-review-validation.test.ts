import { describe, expect, it } from "vitest";

import {
  payRateEvidenceResolutionInputSchema,
  payRateEvidenceReviewInputSchema,
  timesheetIdentityReviewInputSchema,
} from "@/features/payroll/evidence-review-validation";

const token = "123e4567-e89b-42d3-a456-426614174000";

describe("Payroll evidence review validation", () => {
  it("requires explicit Timesheet decisions, reasons, versions, and stable Employee IDs", () => {
    expect(timesheetIdentityReviewInputSchema.safeParse({
      decision: "VERIFY_OWNER",
      timesheetId: "timesheet-1",
      expectedIdentityVersion: 1,
      employeeId: "employee-1",
      reason: "Reviewed original hiring and shift records.",
      requestToken: token,
    }).success).toBe(true);
    expect(timesheetIdentityReviewInputSchema.safeParse({
      decision: "VERIFY_OWNER",
      timesheetId: "timesheet-1",
      expectedIdentityVersion: 1,
      reason: "Missing employee",
      requestToken: token,
    }).success).toBe(false);
  });

  it("requires bounded independent evidence references", () => {
    expect(payRateEvidenceReviewInputSchema.safeParse({
      decision: "VERIFY_INDEPENDENT",
      rateId: "rate-1",
      expectedEvidenceVersion: 1,
      reason: "Confirmed from the retained wage notice.",
      sourceEvidenceReference: "Wage notice dated 2026-06-01, section 2",
      requestToken: token,
    }).success).toBe(true);
    for (const sourceEvidenceReference of ["", "x".repeat(501)]) {
      expect(payRateEvidenceReviewInputSchema.safeParse({
        decision: "VERIFY_INDEPENDENT",
        rateId: "rate-1",
        expectedEvidenceVersion: 1,
        reason: "Confirmed",
        sourceEvidenceReference,
        requestToken: token,
      }).success).toBe(false);
    }
  });

  it("requires an explicit disposition for distinct competing rate rows", () => {
    const base = {
      decision: "RESOLVE_COMPETITORS" as const,
      selectedRateId: "rate-1",
      selectedExpectedEvidenceVersion: 1,
      selectedProvenance: "INDEPENDENT" as const,
      reason: "Resolved from independent evidence.",
      sourceEvidenceReference: "Wage notice dated 2026-06-01",
      requestToken: token,
    };
    expect(payRateEvidenceResolutionInputSchema.safeParse({
      ...base,
      competitors: [{ rateId: "rate-2", expectedEvidenceVersion: 2, disposition: "EXCLUDED" }],
    }).success).toBe(true);
    expect(payRateEvidenceResolutionInputSchema.safeParse({
      ...base,
      competitors: [{ rateId: "rate-1", expectedEvidenceVersion: 1, disposition: "CONFLICT" }],
    }).success).toBe(false);
  });
});
