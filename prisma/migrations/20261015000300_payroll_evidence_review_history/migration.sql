BEGIN;

DO $migration_history_guard$
DECLARE
  payroll_v1_checksum CONSTANT text := '151d2efa4609d5957f25eeb04d9a1a069539a54d6a32106f48b519ff87012d16';
  review_corrections_checksum CONSTANT text := '3e0f181987c89038495ef34ea905273345a216cf89a726e8bd787fdcf9818eff';
  quarantine_checksum CONSTANT text := '56d2a5abf23fa38a429cdb1110f23e14ffc26ab302dbeec9a62b55e8cce2e70e';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20261008000100_payroll_reconciliation_v1'
      AND checksum = payroll_v1_checksum
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Required migration 20261008000100_payroll_reconciliation_v1 is missing, incomplete, rolled back, or has an unexpected checksum.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20261015000100_payroll_pr_review_corrections'
      AND checksum = review_corrections_checksum
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Required migration 20261015000100_payroll_pr_review_corrections is missing, incomplete, rolled back, or has an unexpected checksum.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20261015000200_payroll_historical_evidence_quarantine'
      AND checksum = quarantine_checksum
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Required migration 20261015000200_payroll_historical_evidence_quarantine is missing, incomplete, rolled back, or has an unexpected checksum.';
  END IF;
END
$migration_history_guard$;

CREATE TYPE "TimesheetIdentityReviewDecisionKind" AS ENUM (
  'OWNER_VERIFIED',
  'REVIEWED_UNASSIGNED',
  'REOPENED_UNCERTAINTY',
  'OWNER_CORRECTED'
);

CREATE TYPE "PayRateEvidenceReviewDecisionKind" AS ENUM (
  'VERIFIED_PAYCHECK',
  'VERIFIED_INDEPENDENT',
  'MARKED_CONFLICT',
  'EXCLUDED',
  'REOPENED_REVIEW',
  'SUPERSEDED',
  'PAYCHECK_CORRECTION_SUPERSEDED',
  'PAYCHECK_CORRECTION_CREATED'
);

CREATE TYPE "PayRateEvidenceEventAttributionKind" AS ENUM (
  'OWNER_REVIEWER',
  'PAYCHECK_CORRECTION_SYSTEM'
);

CREATE TABLE "TimesheetIdentityReviewEvent" (
  "id" TEXT NOT NULL,
  "weeklyTimesheetId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "decisionKind" "TimesheetIdentityReviewDecisionKind" NOT NULL,
  "previousStatus" "TimesheetIdentityStatus" NOT NULL,
  "newStatus" "TimesheetIdentityStatus" NOT NULL,
  "previousPrimaryEmployeeId" TEXT,
  "previousEmployeeDisplayNameSnapshot" TEXT,
  "previousEmployeeCodeSnapshot" TEXT,
  "newPrimaryEmployeeId" TEXT,
  "newEmployeeDisplayNameSnapshot" TEXT,
  "newEmployeeCodeSnapshot" TEXT,
  "previousVersion" INTEGER NOT NULL,
  "newVersion" INTEGER NOT NULL,
  "reviewerEmployeeId" TEXT NOT NULL,
  "reviewerDisplayNameSnapshot" TEXT NOT NULL,
  "reviewerEmployeeCodeSnapshot" TEXT,
  "reason" VARCHAR(1000) NOT NULL,
  "sourceEvidenceReference" VARCHAR(500),
  "requestToken" UUID NOT NULL,
  "requestDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TimesheetIdentityReviewEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimesheetIdentityReviewEvent_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "TimesheetIdentityReviewEvent_version_check" CHECK (
    "previousVersion" > 0 AND "newVersion" = "previousVersion" + 1
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 1 AND 1000
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_reference_check" CHECK (
    "sourceEvidenceReference" IS NULL
    OR char_length(btrim("sourceEvidenceReference")) BETWEEN 1 AND 500
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_digest_check" CHECK (
    "requestDigest" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_reviewer_snapshot_check" CHECK (
    char_length(btrim("reviewerDisplayNameSnapshot")) > 0
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_decision_transition_check" CHECK (
    ("decisionKind" = 'OWNER_VERIFIED' AND "previousStatus" IN ('NEEDS_REVIEW', 'REVIEWED_UNASSIGNED') AND "newStatus" = 'OWNER_VERIFIED')
    OR ("decisionKind" = 'REVIEWED_UNASSIGNED' AND "previousStatus" = 'NEEDS_REVIEW' AND "newStatus" = 'REVIEWED_UNASSIGNED')
    OR ("decisionKind" = 'REOPENED_UNCERTAINTY' AND "previousStatus" = 'OWNER_VERIFIED' AND "newStatus" = 'NEEDS_REVIEW')
    OR ("decisionKind" = 'OWNER_CORRECTED' AND "previousStatus" = 'OWNER_VERIFIED' AND "newStatus" = 'OWNER_VERIFIED' AND "previousPrimaryEmployeeId" IS DISTINCT FROM "newPrimaryEmployeeId")
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_previous_relationship_check" CHECK (
    ("previousStatus" IN ('NEEDS_REVIEW', 'REVIEWED_UNASSIGNED') AND "previousPrimaryEmployeeId" IS NULL)
    OR ("previousStatus" IN ('EXPLICIT_SELECTION', 'OWNER_VERIFIED') AND "previousPrimaryEmployeeId" IS NOT NULL)
  ),
  CONSTRAINT "TimesheetIdentityReviewEvent_new_relationship_check" CHECK (
    ("newStatus" IN ('NEEDS_REVIEW', 'REVIEWED_UNASSIGNED') AND "newPrimaryEmployeeId" IS NULL)
    OR ("newStatus" = 'OWNER_VERIFIED' AND "newPrimaryEmployeeId" IS NOT NULL)
  )
);

CREATE TABLE "PayRateEvidenceReviewEvent" (
  "id" TEXT NOT NULL,
  "employeePayRateId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "decisionKind" "PayRateEvidenceReviewDecisionKind" NOT NULL,
  "attributionKind" "PayRateEvidenceEventAttributionKind" NOT NULL DEFAULT 'OWNER_REVIEWER',
  "previousStatus" "PayRateVerificationStatus",
  "newStatus" "PayRateVerificationStatus" NOT NULL,
  "previousProvenanceKind" "PayRateProvenanceKind",
  "newProvenanceKind" "PayRateProvenanceKind" NOT NULL,
  "previousSourcePaycheckId" TEXT,
  "newSourcePaycheckId" TEXT,
  "previousVersion" INTEGER NOT NULL,
  "newVersion" INTEGER NOT NULL,
  "reviewerEmployeeId" TEXT,
  "reviewerDisplayNameSnapshot" TEXT,
  "reviewerEmployeeCodeSnapshot" TEXT,
  "initiatedByEmployeeId" TEXT,
  "initiatedByDisplayNameSnapshot" TEXT,
  "initiatedByEmployeeCodeSnapshot" TEXT,
  "reason" VARCHAR(1000) NOT NULL,
  "sourceEvidenceReference" VARCHAR(500),
  "requestToken" UUID NOT NULL,
  "requestDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PayRateEvidenceReviewEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayRateEvidenceReviewEvent_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "PayRateEvidenceReviewEvent_version_check" CHECK (
    ("decisionKind" = 'PAYCHECK_CORRECTION_CREATED' AND "previousVersion" = 0 AND "newVersion" > 0)
    OR ("decisionKind" <> 'PAYCHECK_CORRECTION_CREATED' AND "previousVersion" > 0 AND "newVersion" = "previousVersion" + 1)
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 1 AND 1000
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_reference_check" CHECK (
    "sourceEvidenceReference" IS NULL
    OR char_length(btrim("sourceEvidenceReference")) BETWEEN 1 AND 500
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_digest_check" CHECK (
    "requestDigest" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_previous_provenance_check" CHECK (
    ("previousStatus" IS NULL AND "previousProvenanceKind" IS NULL AND "previousSourcePaycheckId" IS NULL)
    OR ("previousStatus" IS NOT NULL AND "previousProvenanceKind" = 'PAYCHECK' AND "previousSourcePaycheckId" IS NOT NULL)
    OR ("previousStatus" IS NOT NULL AND "previousProvenanceKind" IN ('UNKNOWN', 'INDEPENDENT') AND "previousSourcePaycheckId" IS NULL)
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_new_provenance_check" CHECK (
    ("newProvenanceKind" = 'PAYCHECK' AND "newSourcePaycheckId" IS NOT NULL)
    OR ("newProvenanceKind" IN ('UNKNOWN', 'INDEPENDENT') AND "newSourcePaycheckId" IS NULL)
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_verified_provenance_check" CHECK (
    "newStatus" <> 'VERIFIED' OR "newProvenanceKind" <> 'UNKNOWN'
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_attribution_check" CHECK (
    ("attributionKind" = 'OWNER_REVIEWER'
      AND "reviewerEmployeeId" IS NOT NULL
      AND char_length(btrim("reviewerDisplayNameSnapshot")) > 0
      AND "initiatedByEmployeeId" IS NULL
      AND "initiatedByDisplayNameSnapshot" IS NULL
      AND "decisionKind" NOT IN ('PAYCHECK_CORRECTION_SUPERSEDED', 'PAYCHECK_CORRECTION_CREATED'))
    OR ("attributionKind" = 'PAYCHECK_CORRECTION_SYSTEM'
      AND "reviewerEmployeeId" IS NULL
      AND "reviewerDisplayNameSnapshot" IS NULL
      AND "reviewerEmployeeCodeSnapshot" IS NULL
      AND "initiatedByEmployeeId" IS NOT NULL
      AND char_length(btrim("initiatedByDisplayNameSnapshot")) > 0
      AND "decisionKind" IN ('PAYCHECK_CORRECTION_SUPERSEDED', 'PAYCHECK_CORRECTION_CREATED'))
  ),
  CONSTRAINT "PayRateEvidenceReviewEvent_decision_transition_check" CHECK (
    ("decisionKind" = 'VERIFIED_PAYCHECK' AND "previousStatus" IN ('NEEDS_REVIEW', 'CONFLICT') AND "newStatus" = 'VERIFIED' AND "newProvenanceKind" = 'PAYCHECK')
    OR ("decisionKind" = 'VERIFIED_INDEPENDENT' AND "previousStatus" IN ('NEEDS_REVIEW', 'CONFLICT') AND "newStatus" = 'VERIFIED' AND "newProvenanceKind" = 'INDEPENDENT')
    OR ("decisionKind" = 'MARKED_CONFLICT' AND "previousStatus" IN ('NEEDS_REVIEW', 'VERIFIED') AND "newStatus" = 'CONFLICT')
    OR ("decisionKind" = 'EXCLUDED' AND "previousStatus" IN ('NEEDS_REVIEW', 'VERIFIED', 'CONFLICT') AND "newStatus" = 'EXCLUDED')
    OR ("decisionKind" = 'REOPENED_REVIEW' AND "previousStatus" IN ('VERIFIED', 'CONFLICT', 'SUPERSEDED', 'EXCLUDED') AND "newStatus" = 'NEEDS_REVIEW' AND "newProvenanceKind" = 'UNKNOWN')
    OR ("decisionKind" = 'SUPERSEDED' AND "previousStatus" IN ('NEEDS_REVIEW', 'VERIFIED', 'CONFLICT') AND "newStatus" = 'SUPERSEDED')
    OR ("decisionKind" = 'PAYCHECK_CORRECTION_SUPERSEDED' AND "previousStatus" IN ('VERIFIED', 'CONFLICT') AND "newStatus" = 'SUPERSEDED')
    OR ("decisionKind" = 'PAYCHECK_CORRECTION_CREATED' AND "previousStatus" IS NULL AND "newStatus" IN ('VERIFIED', 'CONFLICT') AND "previousVersion" = 0 AND "newVersion" > 0 AND "newProvenanceKind" = 'PAYCHECK')
  )
);

CREATE UNIQUE INDEX "WeeklyTimesheet_trusted_employee_week_key"
  ON "WeeklyTimesheet"("primaryEmployeeId", "payrollWeekStartDate")
  WHERE "primaryEmployeeIdentityStatus" IN ('EXPLICIT_SELECTION', 'OWNER_VERIFIED');

CREATE UNIQUE INDEX "TimesheetIdentityReviewEvent_target_sequence_key"
  ON "TimesheetIdentityReviewEvent"("weeklyTimesheetId", "sequence");
CREATE UNIQUE INDEX "TimesheetIdentityReviewEvent_target_previousVersion_key"
  ON "TimesheetIdentityReviewEvent"("weeklyTimesheetId", "previousVersion");
CREATE UNIQUE INDEX "TimesheetIdentityReviewEvent_target_newVersion_key"
  ON "TimesheetIdentityReviewEvent"("weeklyTimesheetId", "newVersion");
CREATE UNIQUE INDEX "TimesheetIdentityReviewEvent_target_requestToken_key"
  ON "TimesheetIdentityReviewEvent"("weeklyTimesheetId", "requestToken");
CREATE INDEX "TimesheetIdentityReviewEvent_reviewer_requestToken_idx"
  ON "TimesheetIdentityReviewEvent"("reviewerEmployeeId", "requestToken");
CREATE INDEX "TimesheetIdentityReviewEvent_target_createdAt_idx"
  ON "TimesheetIdentityReviewEvent"("weeklyTimesheetId", "createdAt");
CREATE INDEX "TimesheetIdentityReviewEvent_createdAt_idx"
  ON "TimesheetIdentityReviewEvent"("createdAt");

CREATE UNIQUE INDEX "PayRateEvidenceReviewEvent_target_sequence_key"
  ON "PayRateEvidenceReviewEvent"("employeePayRateId", "sequence");
CREATE UNIQUE INDEX "PayRateEvidenceReviewEvent_target_previousVersion_key"
  ON "PayRateEvidenceReviewEvent"("employeePayRateId", "previousVersion");
CREATE UNIQUE INDEX "PayRateEvidenceReviewEvent_target_newVersion_key"
  ON "PayRateEvidenceReviewEvent"("employeePayRateId", "newVersion");
CREATE UNIQUE INDEX "PayRateEvidenceReviewEvent_target_requestToken_key"
  ON "PayRateEvidenceReviewEvent"("employeePayRateId", "requestToken");
CREATE INDEX "PayRateEvidenceReviewEvent_reviewer_requestToken_idx"
  ON "PayRateEvidenceReviewEvent"("reviewerEmployeeId", "requestToken");
CREATE INDEX "PayRateEvidenceReviewEvent_target_createdAt_idx"
  ON "PayRateEvidenceReviewEvent"("employeePayRateId", "createdAt");
CREATE INDEX "PayRateEvidenceReviewEvent_createdAt_idx"
  ON "PayRateEvidenceReviewEvent"("createdAt");

ALTER TABLE "TimesheetIdentityReviewEvent"
  ADD CONSTRAINT "TimesheetIdentityReviewEvent_timesheet_fkey"
    FOREIGN KEY ("weeklyTimesheetId") REFERENCES "WeeklyTimesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TimesheetIdentityReviewEvent_previousEmployee_fkey"
    FOREIGN KEY ("previousPrimaryEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TimesheetIdentityReviewEvent_newEmployee_fkey"
    FOREIGN KEY ("newPrimaryEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TimesheetIdentityReviewEvent_reviewer_fkey"
    FOREIGN KEY ("reviewerEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateEvidenceReviewEvent"
  ADD CONSTRAINT "PayRateEvidenceReviewEvent_rate_fkey"
    FOREIGN KEY ("employeePayRateId") REFERENCES "EmployeePayRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateEvidenceReviewEvent_previousPaycheck_fkey"
    FOREIGN KEY ("previousSourcePaycheckId") REFERENCES "Paycheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateEvidenceReviewEvent_newPaycheck_fkey"
    FOREIGN KEY ("newSourcePaycheckId") REFERENCES "Paycheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateEvidenceReviewEvent_reviewer_fkey"
    FOREIGN KEY ("reviewerEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateEvidenceReviewEvent_initiator_fkey"
    FOREIGN KEY ("initiatedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_payroll_review_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $immutable_review_event$
BEGIN
  RAISE EXCEPTION 'Payroll evidence review events are append-only and cannot be updated or deleted.'
    USING ERRCODE = '55000';
END
$immutable_review_event$;

CREATE FUNCTION "validate_timesheet_identity_review_event_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_timesheet_event$
DECLARE
  expected_sequence integer;
  target_status "TimesheetIdentityStatus";
  target_employee_id text;
  target_version integer;
BEGIN
  SELECT COALESCE(MAX("sequence"), 0) + 1
    INTO expected_sequence
    FROM "TimesheetIdentityReviewEvent"
    WHERE "weeklyTimesheetId" = NEW."weeklyTimesheetId";
  IF NEW."sequence" <> expected_sequence THEN
    RAISE EXCEPTION 'Timesheet review event sequence is not contiguous.' USING ERRCODE = '23514';
  END IF;

  SELECT "primaryEmployeeIdentityStatus", "primaryEmployeeId", "identityVersion"
    INTO target_status, target_employee_id, target_version
    FROM "WeeklyTimesheet"
    WHERE "id" = NEW."weeklyTimesheetId";
  IF NOT FOUND OR target_status <> NEW."newStatus"
    OR target_employee_id IS DISTINCT FROM NEW."newPrimaryEmployeeId"
    OR target_version <> NEW."newVersion" THEN
    RAISE EXCEPTION 'Timesheet review event does not match target state.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_timesheet_event$;

CREATE FUNCTION "validate_pay_rate_evidence_review_event_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_rate_event$
DECLARE
  expected_sequence integer;
  target_status "PayRateVerificationStatus";
  target_provenance "PayRateProvenanceKind";
  target_paycheck_id text;
  target_version integer;
BEGIN
  SELECT COALESCE(MAX("sequence"), 0) + 1
    INTO expected_sequence
    FROM "PayRateEvidenceReviewEvent"
    WHERE "employeePayRateId" = NEW."employeePayRateId";
  IF NEW."sequence" <> expected_sequence THEN
    RAISE EXCEPTION 'Pay-rate review event sequence is not contiguous.' USING ERRCODE = '23514';
  END IF;

  SELECT "verificationStatus", "provenanceKind", "sourcePaycheckId", "evidenceVersion"
    INTO target_status, target_provenance, target_paycheck_id, target_version
    FROM "EmployeePayRate"
    WHERE "id" = NEW."employeePayRateId";
  IF NOT FOUND OR target_status <> NEW."newStatus"
    OR target_provenance <> NEW."newProvenanceKind"
    OR target_paycheck_id IS DISTINCT FROM NEW."newSourcePaycheckId"
    OR target_version <> NEW."newVersion" THEN
    RAISE EXCEPTION 'Pay-rate review event does not match target state.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_rate_event$;

CREATE TRIGGER "TimesheetIdentityReviewEvent_validate_insert"
  BEFORE INSERT ON "TimesheetIdentityReviewEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_timesheet_identity_review_event_insert"();

CREATE TRIGGER "PayRateEvidenceReviewEvent_validate_insert"
  BEFORE INSERT ON "PayRateEvidenceReviewEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_evidence_review_event_insert"();

CREATE TRIGGER "TimesheetIdentityReviewEvent_immutable"
  BEFORE UPDATE OR DELETE ON "TimesheetIdentityReviewEvent"
  FOR EACH ROW EXECUTE FUNCTION "reject_payroll_review_event_mutation"();

CREATE TRIGGER "PayRateEvidenceReviewEvent_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateEvidenceReviewEvent"
  FOR EACH ROW EXECUTE FUNCTION "reject_payroll_review_event_mutation"();

COMMIT;
