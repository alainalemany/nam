#!/usr/bin/env bash

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS: %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf 'WARN: %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'FAIL: %s\n' "$1"
}

finish_check() {
  printf '\nSummary: %s passed, %s warnings, %s failures\n' \
    "${PASS_COUNT}" "${WARN_COUNT}" "${FAIL_COUNT}"

  if [ "${FAIL_COUNT}" -gt 0 ]; then
    return 1
  fi

  return 0
}

repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}
