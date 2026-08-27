import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260827000100_equipment_number_identity/migration.sql",
  "utf8",
);

describe("Equipment identity schema", () => {
  it("uses nullable Equipment Number uniqueness instead of display-name identity", () => {
    expect(schema).toContain(
      'equipmentNumber         String?                       @unique(map: "Equipment_equipmentNumber_key")',
    );
    expect(schema).not.toContain("@@unique([mineId, displayName])");
  });

  it("replaces only the old Equipment identity index in the additive migration", () => {
    expect(migration).toContain('DROP INDEX "Equipment_mineId_displayName_key";');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "Equipment_equipmentNumber_key"',
    );
    expect(migration).toContain('ON "Equipment"("equipmentNumber");');
    expect(migration).not.toContain("DELETE FROM");
    expect(migration).not.toContain('UPDATE "Equipment"');
  });
});
