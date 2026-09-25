import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260925000100_maintenance_historical_lifecycle_anchors/migration.sql"),
  "utf8",
);

describe("maintenance historical lifecycle anchor migration", () => {
  it("adds a truthful date-only event kind and machine-meter evidence", () => {
    expect(migration).toContain("MaintenanceServiceEventKind");
    expect(migration).toContain("LIFECYCLE_INITIALIZATION");
    expect(migration).toContain('"effectiveDate" DATE');
    expect(migration).toContain('"machineMeterSnapshot" DECIMAL(12,2)');
    expect(migration).toContain("MaintenanceServiceEvent_boundary_check");
  });

  it("permits unknown prior-lifecycle values only for initialization anchors", () => {
    expect(migration).toContain('ALTER COLUMN "intervalValueAtService" DROP NOT NULL');
    expect(migration).toContain("MaintenanceServiceEvent_initialization_values_check");
    expect(migration).toContain('"serviceSequence" = 0');
  });

  it("does not remove tables, columns, or production rows", () => {
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });
});
