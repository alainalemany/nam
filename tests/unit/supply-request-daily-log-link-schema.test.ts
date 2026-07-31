import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260731000100_supply_request_daily_log_links/migration.sql",
  "utf8",
);

describe("Supply Request Daily Log link schema and migration", () => {
  it("adds only the approved Activity classification and role enum", () => {
    expect(
      readdirSync("prisma/migrations").filter((name) =>
        name.endsWith("_supply_request_daily_log_links"),
      ),
    ).toEqual(["20260731000100_supply_request_daily_log_links"]);
    expect(schema).toMatch(/enum DailyLogActivityType[\s\S]*SUPPLY_REQUEST/);
    expect(schema).toMatch(
      /enum SupplyRequestDailyLogRole\s*{\s*SUBMISSION\s*FULFILLMENT\s*}/,
    );
    expect(migration).toContain(
      `ALTER TYPE "DailyLogActivityType" ADD VALUE 'SUPPLY_REQUEST'`,
    );
    expect(migration).toContain(
      `CREATE TYPE "SupplyRequestDailyLogRole" AS ENUM ('SUBMISSION', 'FULFILLMENT')`,
    );
  });

  it("owns links from the stable root and targets Daily Log Activities", () => {
    const model = schema.match(
      /model SupplyRequestDailyLogLink \{[\s\S]*?\n}/,
    )?.[0];
    expect(model).toContain("supplyRequestId");
    expect(model).toContain("dailyLogActivityId");
    expect(model).not.toContain("supplyRequestVersionId");
    expect(model).not.toContain("dailyLogId");
    expect(model).toContain("onDelete: Cascade");
  });

  it("enforces one link per request role and global Activity uniqueness", () => {
    expect(schema).toContain(
      '@@unique([supplyRequestId, role], map: "SupplyRequestDailyLogLink_request_role_key")',
    );
    expect(schema).toContain(
      '@unique(map: "SupplyRequestDailyLogLink_activity_key")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "SupplyRequestDailyLogLink_activity_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "SupplyRequestDailyLogLink_request_role_key"',
    );
  });

  it("uses link-only cascades in both ownership directions", () => {
    expect(migration).toMatch(
      /SupplyRequestDailyLogLink_request_fkey[\s\S]*REFERENCES "SupplyRequest"\("id"\)[\s\S]*ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /SupplyRequestDailyLogLink_activity_fkey[\s\S]*REFERENCES "DailyLogActivity"\("id"\)[\s\S]*ON DELETE CASCADE/,
    );
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
  });
});
