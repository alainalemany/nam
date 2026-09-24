import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260924000100_maintenance_tracking_foundation/migration.sql"),
  "utf8",
);

describe("maintenance tracking migration", () => {
  it("creates configurable components, rules, live trackers, and retained history", () => {
    for (const table of [
      "TrackedMaintenanceComponent",
      "MaintenanceRule",
      "EquipmentMaintenanceTracker",
      "MaintenanceCounterEntry",
      "MaintenanceServiceEvent",
    ]) expect(migration).toContain(`CREATE TABLE "${table}"`);
  });

  it("seeds the initial records and thresholds from data", () => {
    expect(migration).toContain("'Drag Cable'");
    expect(migration).toContain("'Hoist Cable'");
    expect(migration).toContain("'Teeth'");
    expect(migration).toContain("1300.00::DECIMAL, 1400.00::DECIMAL");
    expect(migration).toContain("500.00::DECIMAL, 4");
    expect(migration).toContain("'SERVICE_INTERVAL'");
    expect(migration).toContain("'COMPONENT_LIFECYCLE'");
    expect(migration).toContain("ON CONFLICT");
  });

  it("uses derived DDR boundaries and immutable service-rule snapshots", () => {
    expect(migration).toContain('"trackingStartedAt"');
    expect(migration).not.toContain('"currentValue"');
    expect(migration).toContain('"effectiveAt"');
    expect(migration).toContain('"thresholdSnapshot"');
    expect(migration).toContain('"upperThresholdSnapshot"');
    expect(migration).toContain('"lifecycleValueAtService"');
    expect(migration).toContain('"startsNewLifecycleSnapshot"');
  });

  it("contains no destructive statements against existing data", () => {
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });
});
