import { Prisma } from "@prisma/client";

export async function acquirePayrollEvidenceLock(
  transaction: Prisma.TransactionClient,
  scope: "paycheck" | "rate-timeline" | "rate-slot" | "review-request" | "timesheet",
  key: string,
) {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(CAST(${`nam-payroll:${scope}:${key}`} AS text), 0::bigint)
    )
  `;
}

export function rateSlotLockKey(employeeId: string, effectiveFrom: Date) {
  return `${employeeId}:${effectiveFrom.toISOString().slice(0, 10)}`;
}

export function rateTimelineLockKey(employeeId: string) {
  return employeeId;
}
