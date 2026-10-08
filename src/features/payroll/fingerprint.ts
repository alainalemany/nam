import { createHash } from "node:crypto";

export function manualPaycheckFingerprint(employeeId: string, value: {
  periodStart: string;
  periodEnd: string;
  checkDate: string;
  grossCashPay: number;
  netPay: number;
}) {
  return createHash("sha256")
    .update(JSON.stringify({ employeeId, ...value }))
    .digest("hex");
}
