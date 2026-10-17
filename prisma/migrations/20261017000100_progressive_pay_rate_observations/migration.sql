BEGIN;

DO $migration_history_guard$
DECLARE
  review_history_checksum CONSTANT text := '9675d39ba47747498ed48cdecf9e127477fa12cd43d0d978fdb8638c1538a83a';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = '20261015000300_payroll_evidence_review_history'
      AND checksum = review_history_checksum
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Required migration 20261015000300_payroll_evidence_review_history is missing, incomplete, rolled back, or has an unexpected checksum.';
  END IF;
END
$migration_history_guard$;

CREATE TYPE "PayRateObservationExtractionBasis" AS ENUM (
  'WORKDAY_REGULAR_ROW',
  'MANUAL_ENTRY',
  'PAYCHECK_CORRECTION'
);

CREATE TYPE "PayRateObservationDateConfidence" AS ENUM (
  'EXPLICIT_ROW_RANGE',
  'PAY_PERIOD_ONLY',
  'UNKNOWN'
);

CREATE TYPE "PayRateObservationState" AS ENUM (
  'SUPPORTED',
  'REVIEW_REQUIRED',
  'UNSUPPORTED'
);

CREATE TYPE "PayRateObservationClassificationKind" AS ENUM (
  'FIRST_RATE_CANDIDATE',
  'REPEATED_SUPPORTING_OBSERVATION',
  'CANDIDATE_INCREASE',
  'CANDIDATE_DECREASE',
  'MULTIPLE_RATE_SPLIT',
  'SAME_DATE_CONFLICT',
  'UNCERTAIN_EFFECTIVE_DATE_CHANGE',
  'UNSUPPORTED_OBSERVATION',
  'CORRECTED_OR_SUPERSEDED_OBSERVATION'
);

CREATE TYPE "PayRateObservationSupportKind" AS ENUM (
  'PRIMARY',
  'REINFORCING'
);

CREATE TYPE "PayRateBoundaryCandidateStatus" AS ENUM (
  'OPEN',
  'RESOLVED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE "PayRateBoundaryDecisionKind" AS ENUM (
  'VERIFIED_EXACT_BOUNDARY',
  'REJECTED'
);

ALTER TABLE "Paycheck"
  ADD COLUMN "evidenceRevision" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "Paycheck_evidenceRevision_check" CHECK ("evidenceRevision" > 0);

CREATE TABLE "PayRateObservation" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourcePaycheckId" TEXT NOT NULL,
  "sourcePaycheckEvidenceRevision" INTEGER NOT NULL,
  "sourceRowSequence" INTEGER NOT NULL,
  "observedHourlyRate" DECIMAL(10,4),
  "regularMinutes" INTEGER,
  "regularEarnings" DECIMAL(12,4),
  "observedDateStart" DATE,
  "observedDateEnd" DATE,
  "payPeriodStart" DATE NOT NULL,
  "payPeriodEnd" DATE NOT NULL,
  "extractionBasis" "PayRateObservationExtractionBasis" NOT NULL,
  "dateConfidence" "PayRateObservationDateConfidence" NOT NULL,
  "observationState" "PayRateObservationState" NOT NULL,
  "parserVersion" VARCHAR(80) NOT NULL,
  "observationDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PayRateObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayRateObservation_revision_check" CHECK ("sourcePaycheckEvidenceRevision" > 0),
  CONSTRAINT "PayRateObservation_sequence_check" CHECK ("sourceRowSequence" > 0),
  CONSTRAINT "PayRateObservation_minutes_check" CHECK ("regularMinutes" IS NULL OR "regularMinutes" >= 0),
  CONSTRAINT "PayRateObservation_rate_check" CHECK ("observedHourlyRate" IS NULL OR "observedHourlyRate" >= 0),
  CONSTRAINT "PayRateObservation_earnings_check" CHECK ("regularEarnings" IS NULL OR "regularEarnings" >= 0),
  CONSTRAINT "PayRateObservation_period_check" CHECK ("payPeriodEnd" >= "payPeriodStart"),
  CONSTRAINT "PayRateObservation_row_dates_check" CHECK (
    ("observedDateStart" IS NULL AND "observedDateEnd" IS NULL)
    OR ("observedDateStart" IS NOT NULL AND "observedDateEnd" IS NOT NULL AND "observedDateEnd" >= "observedDateStart")
  ),
  CONSTRAINT "PayRateObservation_date_confidence_check" CHECK (
    ("dateConfidence" = 'EXPLICIT_ROW_RANGE' AND "observedDateStart" IS NOT NULL AND "observedDateEnd" IS NOT NULL)
    OR ("dateConfidence" <> 'EXPLICIT_ROW_RANGE')
  ),
  CONSTRAINT "PayRateObservation_digest_check" CHECK ("observationDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PayRateObservation_parser_check" CHECK (char_length(btrim("parserVersion")) BETWEEN 1 AND 80)
);

CREATE TABLE "PayRateObservationClassification" (
  "id" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "kind" "PayRateObservationClassificationKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayRateObservationClassification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayRateObservationSupersession" (
  "id" TEXT NOT NULL,
  "priorObservationId" TEXT NOT NULL,
  "replacementObservationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayRateObservationSupersession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayRateObservationSupersession_distinct_check" CHECK ("priorObservationId" <> "replacementObservationId")
);

CREATE TABLE "PayRateBoundaryCandidate" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "observedHourlyRate" DECIMAL(10,4) NOT NULL,
  "earliestEffectiveDate" DATE NOT NULL,
  "latestEffectiveDate" DATE,
  "status" "PayRateBoundaryCandidateStatus" NOT NULL DEFAULT 'OPEN',
  "evidenceVersion" INTEGER NOT NULL DEFAULT 1,
  "resolvedEmployeePayRateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PayRateBoundaryCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayRateBoundaryCandidate_rate_check" CHECK ("observedHourlyRate" >= 0),
  CONSTRAINT "PayRateBoundaryCandidate_dates_check" CHECK (
    "latestEffectiveDate" IS NULL OR "latestEffectiveDate" >= "earliestEffectiveDate"
  ),
  CONSTRAINT "PayRateBoundaryCandidate_version_check" CHECK ("evidenceVersion" > 0),
  CONSTRAINT "PayRateBoundaryCandidate_resolution_check" CHECK (
    ("status" = 'RESOLVED' AND "resolvedEmployeePayRateId" IS NOT NULL)
    OR ("status" <> 'RESOLVED' AND "resolvedEmployeePayRateId" IS NULL)
  )
);

CREATE TABLE "PayRateBoundaryCandidateObservation" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayRateBoundaryCandidateObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayRateObservationSupport" (
  "id" TEXT NOT NULL,
  "employeePayRateId" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "supportKind" "PayRateObservationSupportKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayRateObservationSupport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayRateBoundaryDecisionEvent" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "decisionKind" "PayRateBoundaryDecisionKind" NOT NULL,
  "previousStatus" "PayRateBoundaryCandidateStatus" NOT NULL,
  "newStatus" "PayRateBoundaryCandidateStatus" NOT NULL,
  "previousVersion" INTEGER NOT NULL,
  "newVersion" INTEGER NOT NULL,
  "exactEffectiveDate" DATE,
  "employeePayRateId" TEXT,
  "reviewerEmployeeId" TEXT NOT NULL,
  "reviewerDisplayNameSnapshot" TEXT NOT NULL,
  "reviewerEmployeeCodeSnapshot" TEXT,
  "reason" VARCHAR(1000) NOT NULL,
  "sourceEvidenceReference" VARCHAR(500),
  "requestToken" UUID NOT NULL,
  "requestDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PayRateBoundaryDecisionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayRateBoundaryDecisionEvent_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "PayRateBoundaryDecisionEvent_version_check" CHECK (
    "previousVersion" > 0 AND "newVersion" = "previousVersion" + 1
  ),
  CONSTRAINT "PayRateBoundaryDecisionEvent_transition_check" CHECK (
    "previousStatus" = 'OPEN'
    AND (
      ("decisionKind" = 'VERIFIED_EXACT_BOUNDARY' AND "newStatus" = 'RESOLVED')
      OR ("decisionKind" = 'REJECTED' AND "newStatus" = 'REJECTED')
    )
  ),
  CONSTRAINT "PayRateBoundaryDecisionEvent_payload_check" CHECK (
    (
      "decisionKind" = 'VERIFIED_EXACT_BOUNDARY'
      AND "exactEffectiveDate" IS NOT NULL
      AND "employeePayRateId" IS NOT NULL
    )
    OR (
      "decisionKind" = 'REJECTED'
      AND "exactEffectiveDate" IS NULL
      AND "employeePayRateId" IS NULL
    )
  ),
  CONSTRAINT "PayRateBoundaryDecisionEvent_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "PayRateBoundaryDecisionEvent_reference_check" CHECK (
    "sourceEvidenceReference" IS NULL OR char_length(btrim("sourceEvidenceReference")) BETWEEN 1 AND 500
  ),
  CONSTRAINT "PayRateBoundaryDecisionEvent_reviewer_check" CHECK (char_length(btrim("reviewerDisplayNameSnapshot")) > 0),
  CONSTRAINT "PayRateBoundaryDecisionEvent_digest_check" CHECK ("requestDigest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "PayRateObservation_paycheck_revision_row_key"
  ON "PayRateObservation"("sourcePaycheckId", "sourcePaycheckEvidenceRevision", "sourceRowSequence");
CREATE INDEX "PayRateObservation_employee_period_idx"
  ON "PayRateObservation"("employeeId", "payPeriodStart", "payPeriodEnd");
CREATE INDEX "PayRateObservation_employee_digest_idx"
  ON "PayRateObservation"("employeeId", "observationDigest");
CREATE INDEX "PayRateObservation_paycheck_revision_idx"
  ON "PayRateObservation"("sourcePaycheckId", "sourcePaycheckEvidenceRevision");
CREATE UNIQUE INDEX "PayRateObservationClassification_observation_kind_key"
  ON "PayRateObservationClassification"("observationId", "kind");
CREATE INDEX "PayRateObservationClassification_kind_created_idx"
  ON "PayRateObservationClassification"("kind", "createdAt");
CREATE UNIQUE INDEX "PayRateObservationSupersession_prior_key"
  ON "PayRateObservationSupersession"("priorObservationId");
CREATE INDEX "PayRateObservationSupersession_replacement_idx"
  ON "PayRateObservationSupersession"("replacementObservationId");
CREATE INDEX "PayRateBoundaryCandidate_employee_status_earliest_idx"
  ON "PayRateBoundaryCandidate"("employeeId", "status", "earliestEffectiveDate");
CREATE INDEX "PayRateBoundaryCandidate_resolvedRate_idx"
  ON "PayRateBoundaryCandidate"("resolvedEmployeePayRateId");
CREATE UNIQUE INDEX "PayRateBoundaryCandidateObservation_candidate_observation_key"
  ON "PayRateBoundaryCandidateObservation"("candidateId", "observationId");
CREATE INDEX "PayRateBoundaryCandidateObservation_observation_idx"
  ON "PayRateBoundaryCandidateObservation"("observationId");
CREATE UNIQUE INDEX "PayRateObservationSupport_rate_observation_key"
  ON "PayRateObservationSupport"("employeePayRateId", "observationId");
CREATE UNIQUE INDEX "PayRateObservationSupport_observation_key"
  ON "PayRateObservationSupport"("observationId");
CREATE INDEX "PayRateObservationSupport_rate_kind_idx"
  ON "PayRateObservationSupport"("employeePayRateId", "supportKind");
CREATE UNIQUE INDEX "PayRateBoundaryDecisionEvent_candidate_sequence_key"
  ON "PayRateBoundaryDecisionEvent"("candidateId", "sequence");
CREATE UNIQUE INDEX "PayRateBoundaryDecisionEvent_candidate_previousVersion_key"
  ON "PayRateBoundaryDecisionEvent"("candidateId", "previousVersion");
CREATE UNIQUE INDEX "PayRateBoundaryDecisionEvent_candidate_newVersion_key"
  ON "PayRateBoundaryDecisionEvent"("candidateId", "newVersion");
CREATE UNIQUE INDEX "PayRateBoundaryDecisionEvent_candidate_requestToken_key"
  ON "PayRateBoundaryDecisionEvent"("candidateId", "requestToken");
CREATE INDEX "PayRateBoundaryDecisionEvent_reviewer_requestToken_idx"
  ON "PayRateBoundaryDecisionEvent"("reviewerEmployeeId", "requestToken");
CREATE INDEX "PayRateBoundaryDecisionEvent_candidate_createdAt_idx"
  ON "PayRateBoundaryDecisionEvent"("candidateId", "createdAt");

ALTER TABLE "PayRateObservation"
  ADD CONSTRAINT "PayRateObservation_employee_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateObservation_paycheck_fkey"
    FOREIGN KEY ("sourcePaycheckId") REFERENCES "Paycheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateObservationClassification"
  ADD CONSTRAINT "PayRateObservationClassification_observation_fkey"
    FOREIGN KEY ("observationId") REFERENCES "PayRateObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateObservationSupersession"
  ADD CONSTRAINT "PayRateObservationSupersession_prior_fkey"
    FOREIGN KEY ("priorObservationId") REFERENCES "PayRateObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateObservationSupersession_replacement_fkey"
    FOREIGN KEY ("replacementObservationId") REFERENCES "PayRateObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateBoundaryCandidate"
  ADD CONSTRAINT "PayRateBoundaryCandidate_employee_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateBoundaryCandidate_resolvedRate_fkey"
    FOREIGN KEY ("resolvedEmployeePayRateId") REFERENCES "EmployeePayRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateBoundaryCandidateObservation"
  ADD CONSTRAINT "PayRateBoundaryCandidateObservation_candidate_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "PayRateBoundaryCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateBoundaryCandidateObservation_observation_fkey"
    FOREIGN KEY ("observationId") REFERENCES "PayRateObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateObservationSupport"
  ADD CONSTRAINT "PayRateObservationSupport_rate_fkey"
    FOREIGN KEY ("employeePayRateId") REFERENCES "EmployeePayRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateObservationSupport_observation_fkey"
    FOREIGN KEY ("observationId") REFERENCES "PayRateObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayRateBoundaryDecisionEvent"
  ADD CONSTRAINT "PayRateBoundaryDecisionEvent_candidate_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "PayRateBoundaryCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateBoundaryDecisionEvent_rate_fkey"
    FOREIGN KEY ("employeePayRateId") REFERENCES "EmployeePayRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayRateBoundaryDecisionEvent_reviewer_fkey"
    FOREIGN KEY ("reviewerEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_pay_rate_observation_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $immutable_observation_history$
BEGIN
  RAISE EXCEPTION 'Pay-rate observation history is append-only and cannot be updated or deleted.'
    USING ERRCODE = '55000';
END
$immutable_observation_history$;

CREATE FUNCTION "validate_pay_rate_observation_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_observation$
DECLARE
  paycheck_employee_id text;
  paycheck_revision integer;
  paycheck_period_start date;
  paycheck_period_end date;
  paycheck_review_status "PayrollReviewStatus";
BEGIN
  SELECT p."employeeId", p."evidenceRevision", pp."periodStart", pp."periodEnd", p."reviewStatus"
    INTO paycheck_employee_id, paycheck_revision, paycheck_period_start, paycheck_period_end, paycheck_review_status
    FROM "Paycheck" p
    JOIN "PayrollPeriod" pp ON pp."id" = p."payrollPeriodId"
    WHERE p."id" = NEW."sourcePaycheckId";
  IF NOT FOUND
    OR paycheck_employee_id <> NEW."employeeId"
    OR paycheck_revision <> NEW."sourcePaycheckEvidenceRevision"
    OR paycheck_period_start <> NEW."payPeriodStart"
    OR paycheck_period_end <> NEW."payPeriodEnd"
    OR paycheck_review_status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'Pay-rate observation does not match its source Paycheck evidence revision.' USING ERRCODE = '23514';
  END IF;
  IF NEW."observationState" = 'SUPPORTED' AND (
    NEW."extractionBasis" <> 'WORKDAY_REGULAR_ROW'
    OR NEW."observedHourlyRate" IS NULL
    OR NEW."observedHourlyRate" <= 0
    OR NEW."regularMinutes" IS NULL
    OR NEW."regularMinutes" <= 0
    OR NEW."regularEarnings" IS NULL
    OR (
      NEW."observedDateStart" IS NOT NULL
      AND (
        NEW."observedDateStart" < NEW."payPeriodStart"
        OR NEW."observedDateEnd" > NEW."payPeriodEnd"
      )
    )
  ) THEN
    RAISE EXCEPTION 'Supported observations require current confirmed Workday row evidence inside the source period.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_observation$;

CREATE FUNCTION "validate_pay_rate_observation_supersession_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_observation_supersession$
DECLARE
  prior_employee text;
  prior_paycheck text;
  prior_revision integer;
  replacement_employee text;
  replacement_paycheck text;
  replacement_revision integer;
BEGIN
  SELECT "employeeId", "sourcePaycheckId", "sourcePaycheckEvidenceRevision"
    INTO prior_employee, prior_paycheck, prior_revision
    FROM "PayRateObservation" WHERE "id" = NEW."priorObservationId";
  SELECT "employeeId", "sourcePaycheckId", "sourcePaycheckEvidenceRevision"
    INTO replacement_employee, replacement_paycheck, replacement_revision
    FROM "PayRateObservation" WHERE "id" = NEW."replacementObservationId";
  IF prior_employee IS NULL
    OR prior_employee <> replacement_employee
    OR prior_paycheck <> replacement_paycheck
    OR prior_revision >= replacement_revision THEN
    RAISE EXCEPTION 'Pay-rate observation supersession lineage is invalid.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_observation_supersession$;

CREATE FUNCTION "validate_pay_rate_observation_support_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_observation_support$
DECLARE
  rate_employee text;
  rate_amount numeric;
  rate_effective date;
  rate_status "PayRateVerificationStatus";
  observation_employee text;
  observation_amount numeric;
  observation_state "PayRateObservationState";
  observation_basis "PayRateObservationExtractionBasis";
  observation_revision integer;
  observation_evidence_end date;
  paycheck_revision integer;
  paycheck_review_status "PayrollReviewStatus";
  observation_is_superseded boolean;
BEGIN
  SELECT "employeeId", "hourlyRate", "effectiveFrom", "verificationStatus"
    INTO rate_employee, rate_amount, rate_effective, rate_status
    FROM "EmployeePayRate" WHERE "id" = NEW."employeePayRateId";
  SELECT o."employeeId", o."observedHourlyRate", o."observationState", o."extractionBasis",
         o."sourcePaycheckEvidenceRevision", COALESCE(o."observedDateEnd", o."payPeriodEnd"),
         p."evidenceRevision", p."reviewStatus",
         EXISTS (
           SELECT 1 FROM "PayRateObservationSupersession" supersession
           WHERE supersession."priorObservationId" = o."id"
         )
    INTO observation_employee, observation_amount, observation_state, observation_basis,
         observation_revision, observation_evidence_end, paycheck_revision, paycheck_review_status,
         observation_is_superseded
    FROM "PayRateObservation" o
    JOIN "Paycheck" p ON p."id" = o."sourcePaycheckId"
    WHERE o."id" = NEW."observationId";
  IF rate_employee IS NULL
    OR rate_employee <> observation_employee
    OR rate_amount IS DISTINCT FROM observation_amount
    OR rate_status <> 'VERIFIED'
    OR observation_state <> 'SUPPORTED'
    OR observation_basis <> 'WORKDAY_REGULAR_ROW'
    OR observation_revision <> paycheck_revision
    OR paycheck_review_status <> 'CONFIRMED'
    OR observation_is_superseded
    OR rate_effective > observation_evidence_end THEN
    RAISE EXCEPTION 'Only matching supported observations may support a verified pay-rate boundary.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_observation_support$;

CREATE FUNCTION "validate_pay_rate_candidate_observation_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_candidate_observation$
DECLARE
  candidate_employee text;
  candidate_rate numeric;
  candidate_status "PayRateBoundaryCandidateStatus";
  observation_employee text;
  observation_rate numeric;
BEGIN
  SELECT "employeeId", "observedHourlyRate", "status"
    INTO candidate_employee, candidate_rate, candidate_status
    FROM "PayRateBoundaryCandidate" WHERE "id" = NEW."candidateId";
  SELECT "employeeId", "observedHourlyRate"
    INTO observation_employee, observation_rate
    FROM "PayRateObservation" WHERE "id" = NEW."observationId";
  IF candidate_employee IS NULL
    OR candidate_status <> 'OPEN'
    OR candidate_employee IS DISTINCT FROM observation_employee
    OR candidate_rate IS DISTINCT FROM observation_rate THEN
    RAISE EXCEPTION 'Pay-rate candidate observations must match one open Employee/rate candidate.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_candidate_observation$;

CREATE FUNCTION "validate_pay_rate_candidate_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_candidate_update$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pay-rate boundary candidates cannot be deleted.' USING ERRCODE = '55000';
  END IF;
  IF OLD."employeeId" IS DISTINCT FROM NEW."employeeId"
    OR OLD."observedHourlyRate" IS DISTINCT FROM NEW."observedHourlyRate"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
    OR OLD."status" <> 'OPEN'
    OR NEW."evidenceVersion" <> OLD."evidenceVersion" + 1
    OR (
      NEW."status" = 'OPEN'
      AND (
        NEW."resolvedEmployeePayRateId" IS NOT NULL
        OR NOT (
          (
            NEW."earliestEffectiveDate" >= OLD."earliestEffectiveDate"
            AND (
              OLD."latestEffectiveDate" IS NULL
              OR (NEW."latestEffectiveDate" IS NOT NULL AND NEW."latestEffectiveDate" <= OLD."latestEffectiveDate")
            )
          )
          OR (
            NEW."latestEffectiveDate" IS NOT NULL
            AND NEW."latestEffectiveDate" < OLD."earliestEffectiveDate"
          )
        )
      )
    )
    OR (
      NEW."status" IN ('RESOLVED', 'REJECTED', 'SUPERSEDED')
      AND (
        OLD."earliestEffectiveDate" IS DISTINCT FROM NEW."earliestEffectiveDate"
        OR OLD."latestEffectiveDate" IS DISTINCT FROM NEW."latestEffectiveDate"
      )
    )
    OR NEW."status" NOT IN ('OPEN', 'RESOLVED', 'REJECTED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'Pay-rate boundary candidate transition is invalid.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_candidate_update$;

CREATE FUNCTION "validate_pay_rate_boundary_decision_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_boundary_decision$
DECLARE
  expected_sequence integer;
  candidate_employee text;
  candidate_rate numeric;
  candidate_earliest date;
  candidate_latest date;
  candidate_status "PayRateBoundaryCandidateStatus";
  candidate_version integer;
  candidate_resolved_rate text;
  rate_employee text;
  rate_amount numeric;
  rate_effective date;
  rate_status "PayRateVerificationStatus";
BEGIN
  SELECT COALESCE(MAX("sequence"), 0) + 1
    INTO expected_sequence
    FROM "PayRateBoundaryDecisionEvent"
    WHERE "candidateId" = NEW."candidateId";
  IF NEW."sequence" <> expected_sequence THEN
    RAISE EXCEPTION 'Pay-rate boundary decision sequence is not contiguous.' USING ERRCODE = '23514';
  END IF;

  SELECT "employeeId", "observedHourlyRate", "earliestEffectiveDate", "latestEffectiveDate", "status", "evidenceVersion", "resolvedEmployeePayRateId"
    INTO candidate_employee, candidate_rate, candidate_earliest, candidate_latest, candidate_status, candidate_version, candidate_resolved_rate
    FROM "PayRateBoundaryCandidate" WHERE "id" = NEW."candidateId";
  SELECT "employeeId", "hourlyRate", "effectiveFrom", "verificationStatus"
    INTO rate_employee, rate_amount, rate_effective, rate_status
    FROM "EmployeePayRate" WHERE "id" = NEW."employeePayRateId";
  IF candidate_status <> NEW."newStatus"
    OR candidate_version <> NEW."newVersion"
    OR (
      NEW."decisionKind" = 'VERIFIED_EXACT_BOUNDARY'
      AND (
        candidate_resolved_rate <> NEW."employeePayRateId"
        OR rate_employee <> candidate_employee
        OR rate_amount <> candidate_rate
        OR rate_effective <> NEW."exactEffectiveDate"
        OR rate_status <> 'VERIFIED'
        OR NOT EXISTS (
          SELECT 1
          FROM "PayRateObservationSupport" support
          JOIN "PayRateBoundaryCandidateObservation" candidate_observation
            ON candidate_observation."observationId" = support."observationId"
          JOIN "PayRateObservation" observation
            ON observation."id" = support."observationId"
          JOIN "Paycheck" paycheck
            ON paycheck."id" = observation."sourcePaycheckId"
          LEFT JOIN "PayRateObservationSupersession" supersession
            ON supersession."priorObservationId" = observation."id"
          WHERE support."employeePayRateId" = NEW."employeePayRateId"
            AND candidate_observation."candidateId" = NEW."candidateId"
            AND observation."extractionBasis" = 'WORKDAY_REGULAR_ROW'
            AND observation."observationState" = 'SUPPORTED'
            AND observation."sourcePaycheckEvidenceRevision" = paycheck."evidenceRevision"
            AND paycheck."reviewStatus" = 'CONFIRMED'
            AND supersession."id" IS NULL
            AND NEW."exactEffectiveDate" BETWEEN
              COALESCE(observation."observedDateStart", observation."payPeriodStart")
              AND COALESCE(observation."observedDateEnd", observation."payPeriodEnd")
        )
        OR NEW."exactEffectiveDate" < candidate_earliest
        OR (candidate_latest IS NOT NULL AND NEW."exactEffectiveDate" > candidate_latest)
      )
    )
    OR (
      NEW."decisionKind" = 'REJECTED'
      AND candidate_resolved_rate IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Pay-rate boundary decision does not match the resolved candidate and verified rate.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$validate_boundary_decision$;

CREATE FUNCTION "has_current_eligible_pay_rate_support"(rate_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $eligible_support$
  SELECT EXISTS (
    SELECT 1
    FROM "EmployeePayRate" rate
    JOIN "PayRateObservationSupport" support
      ON support."employeePayRateId" = rate."id"
    JOIN "PayRateObservation" observation
      ON observation."id" = support."observationId"
    JOIN "Paycheck" paycheck
      ON paycheck."id" = observation."sourcePaycheckId"
    LEFT JOIN "PayRateObservationSupersession" supersession
      ON supersession."priorObservationId" = observation."id"
    WHERE rate."id" = rate_id
      AND rate."verificationStatus" = 'VERIFIED'
      AND rate."employeeId" = observation."employeeId"
      AND rate."hourlyRate" = observation."observedHourlyRate"
      AND rate."effectiveFrom" <= COALESCE(observation."observedDateEnd", observation."payPeriodEnd")
      AND observation."extractionBasis" = 'WORKDAY_REGULAR_ROW'
      AND observation."observationState" = 'SUPPORTED'
      AND observation."sourcePaycheckEvidenceRevision" = paycheck."evidenceRevision"
      AND paycheck."reviewStatus" = 'CONFIRMED'
      AND supersession."id" IS NULL
  )
$eligible_support$;

CREATE FUNCTION "validate_paycheck_supported_rate_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_paycheck_support$
DECLARE
  affected_rate_id text;
BEGIN
  FOR affected_rate_id IN
    SELECT DISTINCT support."employeePayRateId"
    FROM "PayRateObservationSupport" support
    JOIN "PayRateObservation" observation
      ON observation."id" = support."observationId"
    JOIN "EmployeePayRate" rate
      ON rate."id" = support."employeePayRateId"
    WHERE observation."sourcePaycheckId" = NEW."id"
      AND rate."verificationStatus" = 'VERIFIED'
  LOOP
    IF NOT "has_current_eligible_pay_rate_support"(affected_rate_id) THEN
      RAISE EXCEPTION 'A verified pay-rate boundary must retain current confirmed Workday observation support.' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END
$validate_paycheck_support$;

CREATE FUNCTION "validate_superseded_observation_support_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $validate_superseded_support$
DECLARE
  affected_rate_id text;
BEGIN
  FOR affected_rate_id IN
    SELECT DISTINCT support."employeePayRateId"
    FROM "PayRateObservationSupport" support
    JOIN "EmployeePayRate" rate
      ON rate."id" = support."employeePayRateId"
    WHERE support."observationId" = NEW."priorObservationId"
      AND rate."verificationStatus" = 'VERIFIED'
  LOOP
    IF NOT "has_current_eligible_pay_rate_support"(affected_rate_id) THEN
      RAISE EXCEPTION 'A superseded observation cannot remain the only current support for a verified pay-rate boundary.' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END
$validate_superseded_support$;

CREATE FUNCTION "require_pay_rate_candidate_decision_event"()
RETURNS trigger
LANGUAGE plpgsql
AS $require_candidate_decision$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "PayRateBoundaryDecisionEvent" event
    WHERE event."candidateId" = NEW."id"
      AND event."previousVersion" = OLD."evidenceVersion"
      AND event."newVersion" = NEW."evidenceVersion"
      AND event."previousStatus" = OLD."status"
      AND event."newStatus" = NEW."status"
      AND (
        (
          NEW."status" = 'RESOLVED'
          AND event."decisionKind" = 'VERIFIED_EXACT_BOUNDARY'
          AND event."employeePayRateId" = NEW."resolvedEmployeePayRateId"
        )
        OR (
          NEW."status" = 'REJECTED'
          AND event."decisionKind" = 'REJECTED'
          AND event."employeePayRateId" IS NULL
          AND event."exactEffectiveDate" IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'A terminal pay-rate candidate decision requires its matching immutable event.' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$require_candidate_decision$;

CREATE TRIGGER "PayRateObservation_validate_insert"
  BEFORE INSERT ON "PayRateObservation"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_observation_insert"();
CREATE TRIGGER "PayRateObservation_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateObservation"
  FOR EACH ROW EXECUTE FUNCTION "reject_pay_rate_observation_history_mutation"();
CREATE TRIGGER "PayRateObservationClassification_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateObservationClassification"
  FOR EACH ROW EXECUTE FUNCTION "reject_pay_rate_observation_history_mutation"();
CREATE TRIGGER "PayRateObservationSupersession_validate_insert"
  BEFORE INSERT ON "PayRateObservationSupersession"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_observation_supersession_insert"();
CREATE TRIGGER "PayRateObservationSupersession_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateObservationSupersession"
  FOR EACH ROW EXECUTE FUNCTION "reject_pay_rate_observation_history_mutation"();
CREATE TRIGGER "PayRateBoundaryCandidate_validate_update"
  BEFORE UPDATE OR DELETE ON "PayRateBoundaryCandidate"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_candidate_update"();
CREATE TRIGGER "PayRateBoundaryCandidateObservation_validate_insert"
  BEFORE INSERT ON "PayRateBoundaryCandidateObservation"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_candidate_observation_insert"();
CREATE TRIGGER "PayRateBoundaryCandidateObservation_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateBoundaryCandidateObservation"
  FOR EACH ROW EXECUTE FUNCTION "reject_pay_rate_observation_history_mutation"();
CREATE TRIGGER "PayRateObservationSupport_validate_insert"
  BEFORE INSERT ON "PayRateObservationSupport"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_observation_support_insert"();
CREATE TRIGGER "PayRateObservationSupport_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateObservationSupport"
  FOR EACH ROW EXECUTE FUNCTION "reject_pay_rate_observation_history_mutation"();
CREATE TRIGGER "PayRateBoundaryDecisionEvent_validate_insert"
  BEFORE INSERT ON "PayRateBoundaryDecisionEvent"
  FOR EACH ROW EXECUTE FUNCTION "validate_pay_rate_boundary_decision_insert"();
CREATE TRIGGER "PayRateBoundaryDecisionEvent_immutable"
  BEFORE UPDATE OR DELETE ON "PayRateBoundaryDecisionEvent"
  FOR EACH ROW EXECUTE FUNCTION "reject_pay_rate_observation_history_mutation"();
CREATE CONSTRAINT TRIGGER "Paycheck_verified_rate_support_deferred"
  AFTER UPDATE ON "Paycheck"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "validate_paycheck_supported_rate_state"();
CREATE CONSTRAINT TRIGGER "PayRateObservationSupersession_verified_support_deferred"
  AFTER INSERT ON "PayRateObservationSupersession"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "validate_superseded_observation_support_state"();
CREATE CONSTRAINT TRIGGER "PayRateBoundaryCandidate_decision_required"
  AFTER UPDATE ON "PayRateBoundaryCandidate"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD."status" = 'OPEN' AND NEW."status" IN ('RESOLVED', 'REJECTED'))
  EXECUTE FUNCTION "require_pay_rate_candidate_decision_event"();

COMMIT;
