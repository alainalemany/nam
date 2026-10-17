import { describe, expect, it } from "vitest";

import {
  payRateEvidenceResolutionInputSchema,
  payRateEvidenceReviewInputSchema,
  payRateBoundaryVerificationInputSchema,
  payRateBoundaryRejectionInputSchema,
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

  it("requires a versioned exact-date boundary decision with a reason and idempotency token", () => {
    const valid = {
      decision: "VERIFY_EXACT_BOUNDARY" as const,
      candidateId: "candidate-1",
      expectedEvidenceVersion: 2,
      exactEffectiveDate: "2026-09-17",
      reason: "Owner confirmed the exact effective date from authenticated evidence.",
      requestToken: token,
    };
    expect(payRateBoundaryVerificationInputSchema.safeParse(valid).success).toBe(true);
    expect(payRateBoundaryVerificationInputSchema.safeParse({ ...valid, exactEffectiveDate: "09/17/2026" }).success).toBe(false);
    expect(payRateBoundaryVerificationInputSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
    expect(payRateBoundaryVerificationInputSchema.safeParse({ ...valid, expectedEvidenceVersion: 0 }).success).toBe(false);
  });

  it.each([
    ["2026-02-30", false],
    ["2025-02-29", false],
    ["2024-02-29", true],
    ["2026-04-31", false],
    ["2026-12-31", true],
    ["2026-13-01", false],
    ["2026-00-10", false],
  ])("validates exact boundary calendar date %s", (exactEffectiveDate, expected) => {
    expect(payRateBoundaryVerificationInputSchema.safeParse({
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: "candidate-1",
      expectedEvidenceVersion: 2,
      exactEffectiveDate,
      reason: "Owner confirmed the exact effective date from authenticated evidence.",
      requestToken: token,
    }).success).toBe(expected);
  });

  it("requires a versioned candidate rejection with a reason and idempotency token", () => {
    const valid = {
      decision: "REJECT_BOUNDARY_CANDIDATE" as const,
      candidateId: "candidate-1",
      expectedEvidenceVersion: 2,
      reason: "The authenticated source disproves this rate-change candidate.",
      requestToken: token,
    };
    expect(payRateBoundaryRejectionInputSchema.safeParse(valid).success).toBe(true);
    expect(payRateBoundaryRejectionInputSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
    expect(payRateBoundaryRejectionInputSchema.safeParse({ ...valid, expectedEvidenceVersion: 0 }).success).toBe(false);
    expect(payRateBoundaryRejectionInputSchema.safeParse({ ...valid, requestToken: "not-a-uuid" }).success).toBe(false);
  });
});
