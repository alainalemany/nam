#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXIT_CODE=0

run_check() {
  local name="$1"
  local script="$2"

  printf '\n== %s ==\n' "${name}"
  if ! "${script}"; then
    EXIT_CODE=1
  fi
}

run_check "Environment" "${SCRIPT_DIR}/verify-environment.sh"
run_check "MOTD" "${SCRIPT_DIR}/verify-motd.sh"
run_check "Docker" "${SCRIPT_DIR}/verify-docker.sh"

exit "${EXIT_CODE}"
