#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PHASE_A_TEST_DATABASE_URL:-}" ]]; then
  echo "PHASE_A_TEST_DATABASE_URL is required." >&2
  exit 1
fi

node --experimental-strip-types --input-type=module -e '
  import { guardedPhaseADatabaseUrl } from "./tests/helpers/phase-a-postgres-guard.ts";
  if (!guardedPhaseADatabaseUrl(process.env)) process.exit(1);
'

if [[ "${PHASE_A_TEST_DATABASE_URL}" == *\?* ]]; then
  echo "Failure-test base URL must not include query parameters." >&2
  exit 1
fi

guard_failure_database_url="${PHASE_A_TEST_DATABASE_URL}?schema=payroll_quarantine_failure"
postmutation_failure_database_url="${PHASE_A_TEST_DATABASE_URL}?schema=payroll_quarantine_postmutation_failure"
guard_prisma_directory="$(mktemp -d)"
postmutation_prisma_directory="$(mktemp -d)"

cleanup() {
  DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
    corepack pnpm exec prisma db execute \
      --schema prisma/schema.prisma \
      --file tests/fixtures/payroll-quarantine-failure-schema-drop.sql.fixture >/dev/null 2>&1 || true
  rm -rf -- "${guard_prisma_directory}" "${postmutation_prisma_directory}"
}
trap cleanup EXIT

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma db execute \
    --schema prisma/schema.prisma \
    --file tests/fixtures/payroll-quarantine-failure-schema-create.sql.fixture

prepare_through_migration_35() {
  local prisma_directory="$1"
  local database_url="$2"

  mkdir -p "${prisma_directory}/migrations"
  cp prisma/schema.prisma "${prisma_directory}/schema.prisma"
  cp prisma/migrations/migration_lock.toml "${prisma_directory}/migrations/migration_lock.toml"

  for migration_directory in prisma/migrations/*/; do
    migration_name="$(basename "${migration_directory}")"
    case "${migration_name}" in
      20261008000100_payroll_reconciliation_v1|20261015000100_payroll_pr_review_corrections|20261015000200_payroll_historical_evidence_quarantine|20261015000300_payroll_evidence_review_history|20261017000100_progressive_pay_rate_observations)
        ;;
      *)
        cp -R "${migration_directory}" "${prisma_directory}/migrations/"
        ;;
    esac
  done

  DATABASE_URL="${database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${prisma_directory}/schema.prisma"
  DATABASE_URL="${database_url}" \
    corepack pnpm exec prisma db execute \
      --schema "${prisma_directory}/schema.prisma" \
      --file tests/fixtures/payroll-pr-review-legacy-timesheets.sql.fixture

  cp -R prisma/migrations/20261008000100_payroll_reconciliation_v1 \
    "${prisma_directory}/migrations/"
  DATABASE_URL="${database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${prisma_directory}/schema.prisma"

  cp -R prisma/migrations/20261015000100_payroll_pr_review_corrections \
    "${prisma_directory}/migrations/"
  DATABASE_URL="${database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${prisma_directory}/schema.prisma"
}

prepare_through_migration_35 "${guard_prisma_directory}" "${guard_failure_database_url}"
DATABASE_URL="${guard_failure_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema "${guard_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-quarantine-corrupt-predecessor.sql.fixture

cp -R prisma/migrations/20261015000200_payroll_historical_evidence_quarantine \
  "${guard_prisma_directory}/migrations/"

set +e
migration_output="$(
  DATABASE_URL="${guard_failure_database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${guard_prisma_directory}/schema.prisma" 2>&1
)"
migration_status=$?
set -e

if [[ ${migration_status} -eq 0 ]]; then
  echo "Migration 36 unexpectedly accepted a predecessor checksum mismatch." >&2
  exit 1
fi
if [[ "${migration_output}" != *"unexpected checksum"* && "${migration_output}" != *"current transaction is aborted"* ]]; then
  echo "Migration 36 failed for an unexpected reason." >&2
  echo "${migration_output}" >&2
  exit 1
fi

DATABASE_URL="${guard_failure_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema "${guard_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-quarantine-failure-assertions.sql.fixture

prepare_through_migration_35 "${postmutation_prisma_directory}" "${postmutation_failure_database_url}"
cp -R prisma/migrations/20261015000200_payroll_historical_evidence_quarantine \
  "${postmutation_prisma_directory}/migrations/"
sed -i '/^COMMIT;$/i ALTER TABLE "WeeklyTimesheet" ADD CONSTRAINT "forced_postmutation_failure" CHECK (FALSE);' \
  "${postmutation_prisma_directory}/migrations/20261015000200_payroll_historical_evidence_quarantine/migration.sql"

set +e
postmutation_output="$(
  DATABASE_URL="${postmutation_failure_database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${postmutation_prisma_directory}/schema.prisma" 2>&1
)"
postmutation_status=$?
set -e

if [[ ${postmutation_status} -eq 0 ]]; then
  echo "Migration 36 unexpectedly committed after the forced constraint failure." >&2
  exit 1
fi
if [[ "${postmutation_output}" != *"forced_postmutation_failure"* && "${postmutation_output}" != *"current transaction is aborted"* ]]; then
  echo "The post-mutation test failed for an unexpected reason." >&2
  echo "${postmutation_output}" >&2
  exit 1
fi

DATABASE_URL="${postmutation_failure_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema "${postmutation_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-quarantine-failure-assertions.sql.fixture

echo "Migration 36 checksum guard and post-mutation constraint failure both rolled back cleanly."
