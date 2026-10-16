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

temporary_prisma_directory="$(mktemp -d)"
cleanup() {
  rm -rf -- "${temporary_prisma_directory}"
}
trap cleanup EXIT

mkdir -p "${temporary_prisma_directory}/migrations"
cp prisma/schema.prisma "${temporary_prisma_directory}/schema.prisma"
cp prisma/migrations/migration_lock.toml "${temporary_prisma_directory}/migrations/migration_lock.toml"

for migration_directory in prisma/migrations/*/; do
  migration_name="$(basename "${migration_directory}")"
  case "${migration_name}" in
    20261008000100_payroll_reconciliation_v1|20261015000100_payroll_pr_review_corrections|20261015000200_payroll_historical_evidence_quarantine|20261015000300_payroll_evidence_review_history)
      ;;
    *)
      cp -R "${migration_directory}" "${temporary_prisma_directory}/migrations/"
      ;;
  esac
done

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma migrate deploy --schema "${temporary_prisma_directory}/schema.prisma"
DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma db execute \
    --schema "${temporary_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-pr-review-legacy-timesheets.sql.fixture

cp -R prisma/migrations/20261008000100_payroll_reconciliation_v1 \
  "${temporary_prisma_directory}/migrations/"
DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma migrate deploy --schema "${temporary_prisma_directory}/schema.prisma"
DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma db execute \
    --schema "${temporary_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-pr-review-rate-provenance.sql.fixture

cp -R prisma/migrations/20261015000100_payroll_pr_review_corrections \
  "${temporary_prisma_directory}/migrations/"

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma migrate deploy --schema "${temporary_prisma_directory}/schema.prisma"
DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma db execute \
    --schema "${temporary_prisma_directory}/schema.prisma" \
    --file tests/fixtures/payroll-historical-evidence-quarantine.sql.fixture

cp -R prisma/migrations/20261015000200_payroll_historical_evidence_quarantine \
  "${temporary_prisma_directory}/migrations/"

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma migrate deploy --schema "${temporary_prisma_directory}/schema.prisma"

cp -R prisma/migrations/20261015000300_payroll_evidence_review_history \
  "${temporary_prisma_directory}/migrations/"

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma migrate deploy --schema "${temporary_prisma_directory}/schema.prisma"
DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma migrate status --schema "${temporary_prisma_directory}/schema.prisma"
