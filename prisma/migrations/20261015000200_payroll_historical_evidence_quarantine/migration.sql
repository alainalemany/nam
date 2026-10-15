BEGIN;

DO $migration_history_guard$
DECLARE
  payroll_v1_checksum CONSTANT text := '151d2efa4609d5957f25eeb04d9a1a069539a54d6a32106f48b519ff87012d16';
  review_corrections_checksum CONSTANT text := '3e0f181987c89038495ef34ea905273345a216cf89a726e8bd787fdcf9818eff';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '20261008000100_payroll_reconciliation_v1'
      AND checksum = payroll_v1_checksum
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Required migration 20261008000100_payroll_reconciliation_v1 is missing, incomplete, rolled back, or has an unexpected checksum.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '20261015000100_payroll_pr_review_corrections'
      AND checksum = review_corrections_checksum
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Required migration 20261015000100_payroll_pr_review_corrections is missing, incomplete, rolled back, or has an unexpected checksum.';
  END IF;
END
$migration_history_guard$;

CREATE TYPE "TimesheetIdentityStatus" AS ENUM (
  'NEEDS_REVIEW',
  'EXPLICIT_SELECTION',
  'OWNER_VERIFIED',
  'REVIEWED_UNASSIGNED'
);

CREATE TYPE "PayRateVerificationStatus" AS ENUM (
  'NEEDS_REVIEW',
  'VERIFIED',
  'CONFLICT',
  'SUPERSEDED',
  'EXCLUDED'
);

CREATE TYPE "PayRateProvenanceKind" AS ENUM (
  'UNKNOWN',
  'PAYCHECK',
  'INDEPENDENT'
);

ALTER TABLE "WeeklyTimesheet"
  ADD COLUMN "primaryEmployeeIdentityStatus" "TimesheetIdentityStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  ADD COLUMN "identityCandidateEmployeeId" TEXT,
  ADD COLUMN "identityVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "EmployeePayRate"
  ADD COLUMN "verificationStatus" "PayRateVerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  ADD COLUMN "provenanceKind" "PayRateProvenanceKind" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "provenanceCandidatePaycheckId" TEXT,
  ADD COLUMN "evidenceVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "WeeklyTimesheet"
SET
  "identityCandidateEmployeeId" = "primaryEmployeeId",
  "primaryEmployeeId" = NULL,
  "primaryEmployeeIdentityStatus" = 'NEEDS_REVIEW',
  "identityVersion" = 1;

UPDATE "EmployeePayRate"
SET
  "provenanceCandidatePaycheckId" = "sourcePaycheckId",
  "sourcePaycheckId" = NULL,
  "verificationStatus" = 'NEEDS_REVIEW',
  "provenanceKind" = 'UNKNOWN',
  "evidenceVersion" = 1;

ALTER TABLE "EmployeePayRate"
  DROP CONSTRAINT "EmployeePayRate_employee_fkey",
  ADD CONSTRAINT "EmployeePayRate_employee_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "EmployeePayRate_employee_effective_key";
DROP INDEX "EmployeePayRate_sourcePaycheckId_key";

ALTER TABLE "WeeklyTimesheet"
  ADD CONSTRAINT "WeeklyTimesheet_identity_relationship_check"
  CHECK (
    (
      "primaryEmployeeIdentityStatus" IN ('NEEDS_REVIEW', 'REVIEWED_UNASSIGNED')
      AND "primaryEmployeeId" IS NULL
    )
    OR
    (
      "primaryEmployeeIdentityStatus" IN ('EXPLICIT_SELECTION', 'OWNER_VERIFIED')
      AND "primaryEmployeeId" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "WeeklyTimesheet_identityVersion_check"
  CHECK ("identityVersion" > 0);

ALTER TABLE "EmployeePayRate"
  ADD CONSTRAINT "EmployeePayRate_provenance_relationship_check"
  CHECK (
    ("provenanceKind" = 'UNKNOWN' AND "sourcePaycheckId" IS NULL)
    OR ("provenanceKind" = 'PAYCHECK' AND "sourcePaycheckId" IS NOT NULL)
    OR ("provenanceKind" = 'INDEPENDENT' AND "sourcePaycheckId" IS NULL)
  ),
  ADD CONSTRAINT "EmployeePayRate_verified_provenance_check"
  CHECK ("verificationStatus" <> 'VERIFIED' OR "provenanceKind" <> 'UNKNOWN'),
  ADD CONSTRAINT "EmployeePayRate_evidenceVersion_check"
  CHECK ("evidenceVersion" > 0);

CREATE INDEX "WeeklyTimesheet_identityStatus_weekStart_idx"
  ON "WeeklyTimesheet"("primaryEmployeeIdentityStatus", "payrollWeekStartDate");

CREATE INDEX "WeeklyTimesheet_employee_identityStatus_weekStart_idx"
  ON "WeeklyTimesheet"("primaryEmployeeId", "primaryEmployeeIdentityStatus", "payrollWeekStartDate");

CREATE INDEX "EmployeePayRate_employee_verification_effective_idx"
  ON "EmployeePayRate"("employeeId", "verificationStatus", "effectiveFrom");

CREATE INDEX "EmployeePayRate_sourcePaycheckId_idx"
  ON "EmployeePayRate"("sourcePaycheckId");

CREATE UNIQUE INDEX "EmployeePayRate_verified_employee_effective_key"
  ON "EmployeePayRate"("employeeId", "effectiveFrom")
  WHERE "verificationStatus" = 'VERIFIED';

CREATE UNIQUE INDEX "EmployeePayRate_verified_paycheck_source_key"
  ON "EmployeePayRate"("sourcePaycheckId")
  WHERE "verificationStatus" = 'VERIFIED'
    AND "provenanceKind" = 'PAYCHECK';

COMMIT;
