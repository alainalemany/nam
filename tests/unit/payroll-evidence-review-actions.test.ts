import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewer: vi.fn(),
  reviewTimesheet: vi.fn(),
  reviewRate: vi.fn(),
  resolveRates: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/payroll/auth", async () => {
  const security = await import("@/features/payroll/security");
  return {
    PayrollAccessConfigurationError: security.PayrollAccessConfigurationError,
    PayrollAccessDeniedError: security.PayrollAccessDeniedError,
    requirePayrollEvidenceReviewer: mocks.requireReviewer,
  };
});
vi.mock("@/features/payroll/evidence-review-persistence", () => ({
  reviewTimesheetIdentity: mocks.reviewTimesheet,
  reviewPayRateEvidence: mocks.reviewRate,
  resolvePayRateEvidenceCompetitors: mocks.resolveRates,
}));

import {
  resolvePayRateEvidenceCompetitorsAction,
  reviewPayRateEvidenceAction,
  reviewTimesheetIdentityAction,
} from "@/features/payroll/evidence-review-actions";
import { PayrollAccessDeniedError } from "@/features/payroll/security";
import { EvidenceReviewError } from "@/features/payroll/evidence-review-types";

const idle = { ok: false as const, code: "INVALID_TRANSITION" as const, message: "" };

function formData() {
  const data = new FormData();
  data.set("payload", JSON.stringify({
    decision: "REVIEW_UNASSIGNED",
    timesheetId: "timesheet-1",
    expectedIdentityVersion: 1,
    reason: "Ownership could not be established.",
    requestToken: "123e4567-e89b-42d3-a456-426614174000",
  }));
  return data;
}

function rateFormData(resolve = false) {
  const data = new FormData();
  data.set("payload", JSON.stringify(resolve ? {
    decision: "RESOLVE_COMPETITORS", selectedRateId: "rate-1", selectedExpectedEvidenceVersion: 1,
    selectedProvenance: "INDEPENDENT", competitors: [{ rateId: "rate-2", expectedEvidenceVersion: 1, disposition: "EXCLUDED" }],
    reason: "Explicit resolution.", sourceEvidenceReference: "Synthetic wage notice",
    requestToken: "123e4567-e89b-42d3-a456-426614174001",
  } : {
    decision: "VERIFY_INDEPENDENT", rateId: "rate-1", expectedEvidenceVersion: 1,
    reason: "Explicit review.", sourceEvidenceReference: "Synthetic wage notice",
    requestToken: "123e4567-e89b-42d3-a456-426614174002",
  }));
  return data;
}

describe("Payroll evidence review Server Actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authorizes before calling persistence and hides target existence on denial", async () => {
    mocks.requireReviewer.mockRejectedValue(new PayrollAccessDeniedError("denied"));
    await expect(reviewTimesheetIdentityAction(idle, formData())).resolves.toEqual({
      ok: false,
      code: "UNAUTHORIZED_REVIEW",
      message: "Payroll evidence review access denied.",
    });
    expect(mocks.reviewTimesheet).not.toHaveBeenCalled();
  });

  it("protects both rate actions before persistence", async () => {
    mocks.requireReviewer.mockRejectedValue(new PayrollAccessDeniedError("expired or wrong reviewer"));
    await expect(reviewPayRateEvidenceAction(idle, rateFormData())).resolves.toMatchObject({ code: "UNAUTHORIZED_REVIEW" });
    await expect(resolvePayRateEvidenceCompetitorsAction(idle, rateFormData(true))).resolves.toMatchObject({ code: "UNAUTHORIZED_REVIEW" });
    expect(mocks.reviewRate).not.toHaveBeenCalled();
    expect(mocks.resolveRates).not.toHaveBeenCalled();
  });

  it("maps invalid payloads and persistence errors to structured contracts", async () => {
    mocks.requireReviewer.mockResolvedValue({ employeeId: "reviewer-1", displayName: "Reviewer", employeeCode: null });
    const invalid = rateFormData();
    invalid.set("payload", JSON.stringify({ decision: "VERIFY_INDEPENDENT", rateId: "rate-1" }));
    await expect(reviewPayRateEvidenceAction(idle, invalid)).resolves.toMatchObject({ code: "INVALID_EVIDENCE_REFERENCE" });
    expect(mocks.reviewRate).not.toHaveBeenCalled();
    mocks.reviewRate.mockRejectedValue(new EvidenceReviewError("STALE_REVIEW", "stale"));
    await expect(reviewPayRateEvidenceAction(idle, rateFormData())).resolves.toEqual({ ok: false, code: "STALE_REVIEW", message: "stale" });
  });

  it("passes only the server-derived reviewer actor to persistence", async () => {
    const actor = { employeeId: "reviewer-1", displayName: "Reviewer", employeeCode: "R-1" };
    mocks.requireReviewer.mockResolvedValue(actor);
    mocks.reviewTimesheet.mockResolvedValue({
      ok: true,
      targetId: "timesheet-1",
      newState: "REVIEWED_UNASSIGNED",
      newVersion: 2,
      auditEventId: "event-1",
      idempotencyReplay: false,
    });
    const result = await reviewTimesheetIdentityAction(idle, formData());
    expect(result.ok).toBe(true);
    expect(mocks.reviewTimesheet).toHaveBeenCalledWith(actor, expect.objectContaining({ timesheetId: "timesheet-1" }));
  });
});
