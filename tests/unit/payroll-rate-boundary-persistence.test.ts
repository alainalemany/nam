import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { verifyExactPayRateBoundary } from "@/features/payroll/rate-boundary-persistence";

describe("Payroll rate-boundary persistence", () => {
  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
  ])("rejects impossible exact date %s before opening a transaction", async (exactEffectiveDate) => {
    const transaction = vi.fn();

    await expect(verifyExactPayRateBoundary({
      employeeId: "reviewer-1",
      employeeCode: "OWNER-1",
      displayName: "Payroll Owner",
    }, {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: "candidate-1",
      expectedEvidenceVersion: 1,
      exactEffectiveDate,
      reason: "Impossible dates must not reach authoritative persistence.",
      requestToken: "00000000-0000-4000-8000-000000000001",
    }, {
      client: { $transaction: transaction } as unknown as PrismaClient,
    })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      message: expect.stringMatching(/real calendar date/u),
    });

    expect(transaction).not.toHaveBeenCalled();
  });
});
