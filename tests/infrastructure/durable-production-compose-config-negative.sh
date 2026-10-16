#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
REGRESSION_SCRIPT="$SCRIPT_DIR/durable-production-compose-config.sh"
BASE_OVERRIDE="$REPOSITORY_ROOT/infrastructure/server-config/docker/production-image.override.yaml"
BASE_RUNBOOK="$REPOSITORY_ROOT/docs/infrastructure/durable-immutable-deployment.md"
TEMPORARY_FIXTURES="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEMPORARY_FIXTURES"
}
trap cleanup EXIT

expect_rejected() {
  local label="$1"
  local override_file="$2"
  local runbook_file="$3"

  if NAM_DURABLE_OVERRIDE_FILE="$override_file" \
    NAM_DURABLE_RUNBOOK_FILE="$runbook_file" \
    bash "$REGRESSION_SCRIPT" >/dev/null 2>&1; then
    printf 'negative case unexpectedly passed: %s\n' "$label" >&2
    exit 1
  fi

  printf 'durable production Compose negative case rejected: %s\n' "$label"
}

STALE_RUNBOOK="$TEMPORARY_FIXTURES/stale-runbook.md"
sed -E \
  '0,/sha256:[0-9a-f]{64}/s//sha256:0000000000000000000000000000000000000000000000000000000000000000/' \
  "$BASE_RUNBOOK" >"$STALE_RUNBOOK"
expect_rejected 'stale documented image ID' "$BASE_OVERRIDE" "$STALE_RUNBOOK"

STALE_SELECTOR="$TEMPORARY_FIXTURES/stale-selector.override.yaml"
sed \
  's/image: \*nam-production-image/image: sha256:0000000000000000000000000000000000000000000000000000000000000000/' \
  "$BASE_OVERRIDE" >"$STALE_SELECTOR"
expect_rejected 'service image differs from approved release identity' "$STALE_SELECTOR" "$BASE_RUNBOOK"

MISSING_BUILD_RESET="$TEMPORARY_FIXTURES/missing-build-reset.override.yaml"
sed '/build: !reset null/d' "$BASE_OVERRIDE" >"$MISSING_BUILD_RESET"
expect_rejected 'inherited application build is not reset' "$MISSING_BUILD_RESET" "$BASE_RUNBOOK"

MISSING_PULL_POLICY="$TEMPORARY_FIXTURES/missing-pull-policy.override.yaml"
sed '/pull_policy: never/d' "$BASE_OVERRIDE" >"$MISSING_PULL_POLICY"
expect_rejected 'pull policy is not fail-closed' "$MISSING_PULL_POLICY" "$BASE_RUNBOOK"

printf '%s\n' 'durable production Compose negative tests: PASS'
