import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260829000100_equipment_fuel_events_v2_phase_2a/migration.sql"),
  "utf8",
);

describe("Fuel Events V2 Phase 2A migration safety", () => {
  it("converts both existing integer gallon columns exactly to Decimal", () => {
    expect(migration).toContain('ALTER COLUMN "totalGallons" TYPE DECIMAL(12,3)');
    expect(migration).toContain('USING "totalGallons"::DECIMAL(12,3)');
    expect(migration).toContain('ALTER COLUMN "gallons" TYPE DECIMAL(12,3)');
    expect(migration).toContain('USING "gallons"::DECIMAL(12,3)');
  });

  it("adds nullable V2 event facts without fabricated backfill or destructive data statements", () => {
    for (const column of [
      "gasStationId", "gasStationNameSnapshot", "pricePerGallon", "totalCost",
      "meterType", "meterReading", "receiptReference",
    ]) {
      expect(migration).toContain(`ADD COLUMN "${column}"`);
    }
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bUPDATE\s+"EquipmentFuelEvent"\b/i);
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)/i);
  });

  it("does not alter legacy person, Daily Log, or Equipment relationships", () => {
    expect(migration).not.toContain("FuelEvent_servicePerson_fkey");
    expect(migration).not.toContain("FuelEvent_dailyLogActivity_fkey");
    expect(migration).not.toContain("FuelEvent_equipment_fkey");
  });
});
