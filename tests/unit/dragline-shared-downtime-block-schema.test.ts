import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260903000100_dragline_delay_report_shared_downtime_blocks/migration.sql",
  "utf8",
);

describe("Dragline Shared Downtime Block schema", () => {
  it("uses normalized report-owned parent and ordered activity models", () => {
    expect(schema).toContain("model DraglineDelayReportDowntimeBlock {");
    expect(schema).toContain(
      "activities        DraglineDelayReportDowntimeBlockActivity[]",
    );
    expect(schema).toContain(
      "model DraglineDelayReportDowntimeBlockActivity {",
    );
    expect(schema).not.toMatch(
      /model DraglineDelayReportDowntimeBlockActivity \{[^}]*durationMinutes/,
    );
    expect(schema).not.toMatch(
      /model DraglineDelayReportDowntimeBlockActivity \{[^}]*causesDowntime/,
    );
  });

  it("creates additive ownership, ordering, duration, and Code 13 constraints", () => {
    expect(migration).toContain(
      'CREATE TABLE "DraglineDelayReportDowntimeBlock"',
    );
    expect(migration).toContain(
      'CREATE TABLE "DraglineDelayReportDowntimeBlockActivity"',
    );
    expect(migration).toContain(
      'CONSTRAINT "DraglineDelayReportDowntimeBlock_duration_check" CHECK ("durationMinutes" > 0)',
    );
    expect(migration).toContain(
      'CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_shift_change_check" CHECK ("delayCode" <> \'13\')',
    );
    expect(migration.match(/ON DELETE CASCADE/g)).toHaveLength(2);
  });
});
