import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20261018000100_timesheet_daily_workflow/migration.sql",
  ),
  "utf8",
);

describe("Timesheet daily workflow migration", () => {
  it("adds FTO separately from worked-time and Paycheck tables", () => {
    expect(migration).toContain('CREATE TABLE "TimesheetLeaveEntry"');
    expect(migration).toContain('"approvalStatus" "TimesheetLeaveApprovalStatus" NOT NULL DEFAULT \'REQUESTED\'');
    expect(migration).toContain('"paymentStatus" "TimesheetLeavePaymentStatus" NOT NULL DEFAULT \'UNVERIFIED\'');
    expect(migration).toContain('CHECK ("requestedMinutes" > 0 AND "requestedMinutes" <= 1440)');
    expect(migration).not.toContain('ALTER TABLE "Paycheck"');
    expect(migration).not.toContain('UPDATE "Paycheck"');
  });
});
