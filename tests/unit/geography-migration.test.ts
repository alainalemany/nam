import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260829000200_us_geography_reference_data/migration.sql"),
  "utf8",
);

describe("canonical geography migration safety", () => {
  it("adds State and nullable canonical City fields without replacing City", () => {
    expect(migration).toContain('CREATE TABLE "State"');
    expect(migration).toContain('ADD COLUMN "stateId" TEXT');
    expect(migration).toContain('ADD COLUMN "normalizedKey" TEXT');
    expect(migration).toContain('REFERENCES "State"("id")');
    expect(migration).toContain("ON DELETE RESTRICT");
  });

  it("enforces State uniqueness and City uniqueness within State", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "State_abbreviation_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "State_normalizedKey_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "City_stateId_normalizedKey_key"');
  });

  it("contains no data mutation or destructive schema operation", () => {
    expect(migration).not.toMatch(/^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)/im);
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+"(?:Mine|GasStation)"/i);
  });
});
