-- Preserve the checksum of the already-versioned Payroll migration while
-- correcting ambiguous legacy identity matches in a forward-only migration.
-- Only rows that existed when the original migration completed and still
-- point at one of multiple normalized-name matches are cleared.
WITH "originalMigration" AS (
  SELECT max("finished_at") AS "finishedAt"
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20261008000100_payroll_reconciliation_v1'
    AND "rolled_back_at" IS NULL
),
"ambiguousLegacyTimesheets" AS (
  SELECT wt."id"
  FROM "WeeklyTimesheet" AS wt
  CROSS JOIN "originalMigration" AS migration
  JOIN "Employee" AS current_employee
    ON current_employee."id" = wt."primaryEmployeeId"
  WHERE migration."finishedAt" IS NOT NULL
    AND wt."createdAt" <= migration."finishedAt"
    AND wt."primaryEmployeeKey" = lower(regexp_replace(trim(current_employee."displayName"), '[[:space:]]+', ' ', 'g'))
    AND (
      SELECT count(*)
      FROM "Employee" AS candidate
      WHERE wt."primaryEmployeeKey" = lower(regexp_replace(trim(candidate."displayName"), '[[:space:]]+', ' ', 'g'))
    ) <> 1
)
UPDATE "WeeklyTimesheet" AS wt
SET "primaryEmployeeId" = NULL
FROM "ambiguousLegacyTimesheets" AS ambiguous
WHERE wt."id" = ambiguous."id";

-- A direct Paycheck relation is the narrow provenance needed to update or
-- remove only rates demonstrably derived from that Paycheck during correction.
ALTER TABLE "EmployeePayRate" ADD COLUMN "sourcePaycheckId" TEXT;

-- Backfill provenance only when the existing source note, employee, effective
-- date, and amount identify exactly one supporting Paycheck.
WITH "rateMatches" AS (
  SELECT
    rate."id" AS "rateId",
    min(paycheck."id") AS "paycheckId"
  FROM "EmployeePayRate" AS rate
  JOIN "PayrollPeriod" AS period
    ON period."employeeId" = rate."employeeId"
   AND period."periodStart" = rate."effectiveFrom"
  JOIN "Paycheck" AS paycheck
    ON paycheck."payrollPeriodId" = period."id"
   AND paycheck."employeeId" = rate."employeeId"
   AND paycheck."baseRate" = rate."hourlyRate"
  WHERE rate."sourceNote" IN (
    'Imported Workday paycheck evidence',
    'Corrected Workday paycheck evidence'
  )
  GROUP BY rate."id"
  HAVING count(paycheck."id") = 1
)
UPDATE "EmployeePayRate" AS rate
SET "sourcePaycheckId" = matches."paycheckId"
FROM "rateMatches" AS matches
WHERE rate."id" = matches."rateId";

CREATE UNIQUE INDEX "EmployeePayRate_sourcePaycheckId_key"
  ON "EmployeePayRate"("sourcePaycheckId");

ALTER TABLE "EmployeePayRate"
  ADD CONSTRAINT "EmployeePayRate_sourcePaycheck_fkey"
  FOREIGN KEY ("sourcePaycheckId") REFERENCES "Paycheck"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
