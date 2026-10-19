import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Timesheet no-work migration", () => {
  it("adds explicit zero-hour explanations without changing worked-time tables", () => {
    const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261019000100_timesheet_no_work_explanations/migration.sql"), "utf8");
    expect(sql).toContain("CREATE TYPE \"TimesheetNoWorkReason\"");
    expect(sql).toContain("'SHIFT_CANCELED', 'COVERED_BY_COWORKER'");
    expect(sql).toContain("CREATE TABLE \"TimesheetNoWorkEntry\"");
    expect(sql).toContain("TimesheetNoWorkEntry_week_date_key");
    expect(sql).not.toContain("INSERT INTO");
    expect(sql).not.toContain("UPDATE \"DailyTimeEntry\"");
  });
});
