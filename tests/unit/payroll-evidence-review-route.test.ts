import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireReviewer: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/payroll/auth", async () => {
  const security = await import("@/features/payroll/security");
  return { requirePayrollEvidenceReviewer: mocks.requireReviewer, PayrollAccessConfigurationError: security.PayrollAccessConfigurationError, PayrollAccessDeniedError: security.PayrollAccessDeniedError };
});

import { requireEvidenceReviewRoute } from "@/features/payroll/evidence-review-route";
import { PayrollAccessConfigurationError, PayrollAccessDeniedError } from "@/features/payroll/security";

describe("evidence review route authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only an authorized reviewer", async () => {
    const reviewer = { employeeId: "owner", displayName: "Owner", employeeCode: null, expiresAt: 1 };
    mocks.requireReviewer.mockResolvedValue(reviewer);
    await expect(requireEvidenceReviewRoute()).resolves.toBe(reviewer);
  });

  it("redirects missing configuration without querying route evidence", async () => {
    mocks.requireReviewer.mockRejectedValue(new PayrollAccessConfigurationError("missing"));
    await expect(requireEvidenceReviewRoute()).rejects.toThrow("redirect:/payroll/access?configuration=missing");
  });

  it("redirects a missing, expired, or wrong reviewer session", async () => {
    mocks.requireReviewer.mockRejectedValue(new PayrollAccessDeniedError("denied"));
    await expect(requireEvidenceReviewRoute()).rejects.toThrow("redirect:/payroll/access");
  });
});
