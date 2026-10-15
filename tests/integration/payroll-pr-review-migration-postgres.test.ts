import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { guardedPhaseADatabaseUrl } from "../helpers/phase-a-postgres-guard";

const databaseUrl = guardedPhaseADatabaseUrl();
const describePostgres = databaseUrl ? describe.sequential : describe.skip;

let prisma: PrismaClient;

describePostgres("Payroll PR review migration", () => {
  beforeAll(() => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("backfills only unique normalized Employee matches, including inactive historical Employees", async () => {
    const timesheets = await prisma.weeklyTimesheet.findMany({
      where: { id: { startsWith: "migration-timesheet-" } },
      orderBy: { id: "asc" },
    });

    expect(timesheets).toHaveLength(4);
    expect(timesheets.find((item) => item.id === "migration-timesheet-unique"))
      .toMatchObject({
        primaryEmployeeId: "migration-employee-unique",
        primaryEmployeeDisplayName: "Historical UNIQUE Operator Snapshot",
        primaryEmployeeKey: "unique operator",
      });
    expect(timesheets.find((item) => item.id === "migration-timesheet-inactive"))
      .toMatchObject({
        primaryEmployeeId: "migration-employee-inactive",
        primaryEmployeeDisplayName: "Historical Inactive Operator Snapshot",
        primaryEmployeeKey: "inactive operator",
      });
  });

  it("leaves missing and ambiguous normalized identities unresolved without changing snapshots", async () => {
    const ambiguous = await prisma.weeklyTimesheet.findUniqueOrThrow({
      where: { id: "migration-timesheet-duplicate" },
    });
    const missing = await prisma.weeklyTimesheet.findUniqueOrThrow({
      where: { id: "migration-timesheet-missing" },
    });

    expect(ambiguous).toMatchObject({
      primaryEmployeeId: null,
      primaryEmployeeDisplayName: "Historical Duplicate Operator Snapshot",
      primaryEmployeeKey: "duplicate operator",
    });
    expect(missing).toMatchObject({
      primaryEmployeeId: null,
      primaryEmployeeDisplayName: "Historical Missing Operator Snapshot",
      primaryEmployeeKey: "missing operator",
    });
  });

  it("has the complete forward migration ledger and rate-provenance constraints", async () => {
    const ledger = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
      ORDER BY "migration_name"
    `;
    expect(ledger.at(-1)?.migration_name)
      .toBe("20261015000100_payroll_pr_review_corrections");

    const foreignKey = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conname = 'EmployeePayRate_sourcePaycheck_fkey'
    `;
    const uniqueIndex = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE indexname = 'EmployeePayRate_sourcePaycheckId_key'
    `;
    expect(foreignKey).toEqual([{ name: "EmployeePayRate_sourcePaycheck_fkey" }]);
    expect(uniqueIndex).toEqual([{ name: "EmployeePayRate_sourcePaycheckId_key" }]);
  });

  it("backfills only uniquely supported paycheck-derived rate provenance", async () => {
    const rates = await prisma.employeePayRate.findMany({
      where: { id: { startsWith: "migration-rate-" } },
      orderBy: { id: "asc" },
    });

    expect(rates.find((rate) => rate.id === "migration-rate-unique")?.sourcePaycheckId)
      .toBe("migration-paycheck-unique-rate");
    expect(rates.find((rate) => rate.id === "migration-rate-ambiguous")?.sourcePaycheckId)
      .toBeNull();
    expect(rates.find((rate) => rate.id === "migration-rate-manual")?.sourcePaycheckId)
      .toBeNull();
  });
});
