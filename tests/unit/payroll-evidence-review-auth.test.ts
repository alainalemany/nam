import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  findUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => mocks.cookieValue ? { value: mocks.cookieValue } : undefined),
    set: vi.fn(),
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { employee: { findUnique: mocks.findUnique } },
}));

import { createPayrollSessionToken } from "@/features/payroll/security";

const originalEnvironment = { ...process.env };
let auth: typeof import("@/features/payroll/auth");

describe("Payroll evidence reviewer authorization", () => {
  beforeAll(async () => {
    auth = await import("@/features/payroll/auth");
  });

  beforeEach(() => {
    process.env.NAM_PAYROLL_OWNER_EMPLOYEE_ID = "employee-owner";
    process.env.NAM_PAYROLL_ACCESS_KEY = "a".repeat(32);
    process.env.NAM_PAYROLL_SESSION_SECRET = "s".repeat(32);
    process.env.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID = "employee-owner";
    mocks.cookieValue = createPayrollSessionToken("employee-owner", "s".repeat(32));
    mocks.findUnique.mockResolvedValue({
      id: "employee-owner",
      displayName: "Owner Snapshot",
      employeeCode: "E-100",
    });
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("returns server-loaded reviewer snapshots for the explicitly configured principal", async () => {
    await expect(auth.requirePayrollEvidenceReviewer()).resolves.toMatchObject({
      employeeId: "employee-owner",
      displayName: "Owner Snapshot",
      employeeCode: "E-100",
    });
  });

  it("fails closed for missing, placeholder, or malformed reviewer configuration", async () => {
    for (const value of [undefined, "replace-with-reviewer", "employee owner"]) {
      if (value === undefined) delete process.env.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID;
      else process.env.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID = value;
      await expect(auth.requirePayrollEvidenceReviewer()).rejects.toBeInstanceOf(auth.PayrollAccessConfigurationError);
    }
  });

  it("rejects a valid Payroll principal who is not the explicit reviewer", async () => {
    process.env.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID = "employee-reviewer";
    await expect(auth.requirePayrollEvidenceReviewer()).rejects.toBeInstanceOf(auth.PayrollAccessDeniedError);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects missing sessions and reviewer IDs that no longer resolve", async () => {
    mocks.cookieValue = undefined;
    await expect(auth.requirePayrollEvidenceReviewer()).rejects.toBeInstanceOf(auth.PayrollAccessDeniedError);
    mocks.cookieValue = createPayrollSessionToken("employee-owner", "s".repeat(32));
    mocks.findUnique.mockResolvedValue(null);
    await expect(auth.requirePayrollEvidenceReviewer()).rejects.toBeInstanceOf(auth.PayrollAccessDeniedError);
  });
});
