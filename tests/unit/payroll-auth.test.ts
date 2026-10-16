import { describe, expect, it } from "vitest";

import {
  assertPayrollEmployeeAccess,
  createPayrollSessionToken,
  isConfiguredPayrollValue,
  isStrongPayrollAccessKey,
  PayrollAccessDeniedError,
  safePayrollEqual,
  verifyPayrollSessionToken,
} from "@/features/payroll/security";
import { manualPaycheckFingerprint } from "@/features/payroll/fingerprint";
import {
  payrollUnlockClientKey,
  PayrollUnlockRateLimiter,
} from "@/features/payroll/unlock-rate-limit";

describe("payroll privacy and duplicate identity", () => {
  it("accepts only a signed, unexpired token for the configured employee", () => {
    const secret = "s".repeat(32);
    const token = createPayrollSessionToken("employee-a", secret, 1_000_000);
    expect(verifyPayrollSessionToken(token, "employee-a", secret, 1_000_001)?.employeeId).toBe("employee-a");
    expect(verifyPayrollSessionToken(token, "employee-b", secret, 1_000_001)).toBeUndefined();
    expect(verifyPayrollSessionToken(`${token}x`, "employee-a", secret, 1_000_001)).toBeUndefined();
    expect(verifyPayrollSessionToken(token, "employee-a", secret, 1_000_000 + 8 * 60 * 60 * 1_000)).toBeUndefined();
  });

  it("denies cross-employee payroll access", () => {
    expect(() => assertPayrollEmployeeAccess({ employeeId: "employee-a", expiresAt: 999999 }, "employee-b"))
      .toThrow(PayrollAccessDeniedError);
  });

  it("creates a stable duplicate fingerprint for the same manual paycheck", () => {
    const evidence = { periodStart: "2026-09-14", periodEnd: "2026-09-20", checkDate: "2026-09-25", grossCashPay: 2320.5, netPay: 1679.46 };
    expect(manualPaycheckFingerprint("employee-a", evidence)).toBe(manualPaycheckFingerprint("employee-a", evidence));
    expect(manualPaycheckFingerprint("employee-b", evidence)).not.toBe(manualPaycheckFingerprint("employee-a", evidence));
  });

  it("requires a high-entropy-length access key and compares candidates safely", () => {
    expect(isStrongPayrollAccessKey("a".repeat(31))).toBe(false);
    expect(isStrongPayrollAccessKey("a".repeat(32))).toBe(true);
    expect(isStrongPayrollAccessKey("replace-with-at-least-32-random-characters")).toBe(false);
    expect(isConfiguredPayrollValue("replace-with-employee-cuid")).toBe(false);
    expect(safePayrollEqual("correct-key", "correct-key")).toBe(true);
    expect(safePayrollEqual("short", "a-much-longer-invalid-value")).toBe(false);
  });

  it("blocks repeated invalid unlock attempts for the cooldown window", () => {
    const limiter = new PayrollUnlockRateLimiter({
      maxFailures: 3,
      windowMs: 1_000,
      blockMs: 2_000,
    });
    expect(limiter.recordFailure("client-a", 0).allowed).toBe(true);
    expect(limiter.recordFailure("client-a", 100).allowed).toBe(true);
    expect(limiter.recordFailure("client-a", 200)).toEqual({
      allowed: false,
      retryAfterSeconds: 2,
    });
    expect(limiter.check("client-a", 2_199).allowed).toBe(false);
    expect(limiter.check("client-a", 2_200).allowed).toBe(true);
  });

  it("clears failed attempts after a successful unlock and scopes clients", () => {
    const limiter = new PayrollUnlockRateLimiter({ maxFailures: 2 });
    limiter.recordFailure("client-a", 0);
    limiter.reset("client-a");
    expect(limiter.check("client-a", 1).allowed).toBe(true);
    expect(limiter.check("client-b", 1).allowed).toBe(true);
    expect(payrollUnlockClientKey(new Headers({ "x-forwarded-for": "100.64.0.1, 127.0.0.1" })))
      .toBe("100.64.0.1");
  });
});
