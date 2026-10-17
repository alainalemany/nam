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
  echo "Fresh-migration base URL must not include query parameters." >&2
  exit 1
fi

fresh_database_url="${PHASE_A_TEST_DATABASE_URL}?schema=payroll_quarantine_fresh"

cleanup() {
  DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
    corepack pnpm exec prisma db execute \
      --schema prisma/schema.prisma \
      --file tests/fixtures/payroll-quarantine-fresh-schema-drop.sql.fixture >/dev/null 2>&1 || true
}
trap cleanup EXIT

DATABASE_URL="${PHASE_A_TEST_DATABASE_URL}" \
  corepack pnpm exec prisma db execute \
    --schema prisma/schema.prisma \
    --file tests/fixtures/payroll-quarantine-fresh-schema-create.sql.fixture

DATABASE_URL="${fresh_database_url}" \
  corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
DATABASE_URL="${fresh_database_url}" \
  corepack pnpm exec prisma migrate status --schema prisma/schema.prisma
DATABASE_URL="${fresh_database_url}" \
  corepack pnpm exec prisma db execute \
    --schema prisma/schema.prisma \
    --file tests/fixtures/payroll-quarantine-fresh-assertions.sql.fixture

echo "Fresh migration chain, including migration 38, applied successfully in an isolated schema."
