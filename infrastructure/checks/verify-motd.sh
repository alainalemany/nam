#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

MOTD_TARGET="/etc/update-motd.d/99-alain-server-dashboard"
MOTD_SOURCE="${REPO_ROOT}/infrastructure/motd/99-alain-server-dashboard"

if [ -f "${MOTD_TARGET}" ]; then
  pass "NAM MOTD is installed"
else
  fail "NAM MOTD is not installed at ${MOTD_TARGET}"
fi

if [ -x "${MOTD_TARGET}" ]; then
  pass "NAM MOTD is executable"
else
  fail "NAM MOTD is not executable"
fi

if [ -f "${MOTD_TARGET}" ] && cmp -s "${MOTD_SOURCE}" "${MOTD_TARGET}"; then
  pass "Installed MOTD matches repository source"
else
  fail "Installed MOTD differs from repository source"
fi

if command -v figlet >/dev/null 2>&1; then
  pass "figlet is installed"
else
  fail "figlet is not installed"
fi

if command -v run-parts >/dev/null 2>&1; then
  ACTIVE_MOTD="$(run-parts --test /etc/update-motd.d 2>/dev/null || true)"
  if printf '%s\n' "${ACTIVE_MOTD}" | grep -qx "${MOTD_TARGET}"; then
    pass "NAM MOTD is active in run-parts"
  else
    fail "NAM MOTD is not active in run-parts"
  fi

  OTHER_ACTIVE="$(printf '%s\n' "${ACTIVE_MOTD}" | grep -vx "${MOTD_TARGET}" || true)"
  if [ -z "${OTHER_ACTIVE}" ]; then
    pass "No other dynamic MOTD scripts are active"
  else
    warn "Other dynamic MOTD scripts are active: ${OTHER_ACTIVE}"
  fi
else
  fail "run-parts is not installed"
fi

finish_check
