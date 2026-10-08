import { describe, expect, it } from "vitest";

import {
  assertPayrollEmployeeAccess,
  createPayrollSessionToken,
  PayrollAccessDeniedError,
  verifyPayrollSessionToken,
} from "@/features/payroll/security";
import { manualPaycheckFingerprint } from "@/features/payroll/fingerprint";

describe("payroll privacy and duplicate identity", () => {
  it("accepts only a signed, unexpired token for the configured employee", () => {
    const secret = "s".repeat(32);
    const token = createPayrollSessionToken("employee-a", secret, 1_000_000);
    expect(verifyPayrollSessionToken(token, "employee-a", secret, 1_000_001)?.employeeId).toBe("employee-a");
    expect(verifyPayrollSessionToken(token, "employee-b", secret, 1_000_001)).toBeUndefined();
    expect(verifyPayrollSessionToken(`${token}x`, "employee-a", secret, 1_000_001)).toBeUndefined();
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
});
