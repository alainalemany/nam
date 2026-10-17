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

guard_database_url="${PHASE_A_TEST_DATABASE_URL}?schema=payroll_review_history_guard_failure"
postmutation_database_url="${PHASE_A_TEST_DATABASE_URL}?schema=payroll_review_history_postmutation_failure"
guard_prisma_directory="$(mktemp -d)"
postmutation_prisma_directory="$(mktemp -d)"

cleanup() {
  DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
    corepack pnpm exec prisma db execute \
      --schema prisma/schema.prisma \
      --file tests/fixtures/payroll-review-history-failure-schema-drop.sql.fixture >/dev/null 2>&1 || true
  rm -rf -- "${guard_prisma_directory}" "${postmutation_prisma_directory}"
}
trap cleanup EXIT

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma db execute \
    --schema prisma/schema.prisma \
    --file tests/fixtures/payroll-review-history-failure-schema-create.sql.fixture

prepare_through_migration_36() {
  local prisma_directory="$1"
  local database_url="$2"

  mkdir -p "${prisma_directory}/migrations"
  cp prisma/schema.prisma "${prisma_directory}/schema.prisma"
  cp prisma/migrations/migration_lock.toml "${prisma_directory}/migrations/migration_lock.toml"

  for migration_directory in prisma/migrations/*/; do
    migration_name="$(basename "${migration_directory}")"
    if [[ "${migration_name}" != "20261015000300_payroll_evidence_review_history" && "${migration_name}" != "20261017000100_progressive_pay_rate_observations" ]]; then
      cp -R "${migration_directory}" "${prisma_directory}/migrations/"
    fi
  done

  DATABASE_URL="${database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${prisma_directory}/schema.prisma"
}

prepare_through_migration_36 "${guard_prisma_directory}" "${guard_database_url}"
DATABASE_URL="${guard_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema "${guard_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-review-history-corrupt-predecessor.sql.fixture
cp -R prisma/migrations/20261015000300_payroll_evidence_review_history \
  "${guard_prisma_directory}/migrations/"

set +e
guard_output="$({
  DATABASE_URL="${guard_database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${guard_prisma_directory}/schema.prisma"
} 2>&1)"
guard_status=$?
set -e
if [[ ${guard_status} -eq 0 || ( "${guard_output}" != *"unexpected checksum"* && "${guard_output}" != *"current transaction is aborted"* ) ]]; then
  echo "Migration 37 prerequisite checksum guard did not fail as expected." >&2
  echo "${guard_output}" >&2
  exit 1
fi
DATABASE_URL="${guard_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema "${guard_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-review-history-failure-assertions.sql.fixture

prepare_through_migration_36 "${postmutation_prisma_directory}" "${postmutation_database_url}"
cp -R prisma/migrations/20261015000300_payroll_evidence_review_history \
  "${postmutation_prisma_directory}/migrations/"
sed -i '/^COMMIT;$/i DO $forced_failure$ BEGIN RAISE EXCEPTION '\''forced migration 37 failure'\''; END $forced_failure$;' \
  "${postmutation_prisma_directory}/migrations/20261015000300_payroll_evidence_review_history/migration.sql"

set +e
postmutation_output="$({
  DATABASE_URL="${postmutation_database_url}" \
    corepack pnpm exec prisma migrate deploy --schema "${postmutation_prisma_directory}/schema.prisma"
} 2>&1)"
postmutation_status=$?
set -e
if [[ ${postmutation_status} -eq 0 || ( "${postmutation_output}" != *"forced migration 37 failure"* && "${postmutation_output}" != *"current transaction is aborted"* ) ]]; then
  echo "Migration 37 post-mutation rollback test did not fail as expected." >&2
  echo "${postmutation_output}" >&2
  exit 1
fi
DATABASE_URL="${postmutation_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema "${postmutation_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-review-history-failure-assertions.sql.fixture

echo "Migration 37 checksum guard and forced post-mutation failure both rolled back cleanly."
