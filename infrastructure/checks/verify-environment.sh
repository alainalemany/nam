#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

ENV_FILE="/etc/nam/environment"

if [ -f "${ENV_FILE}" ]; then
  pass "Environment file exists at ${ENV_FILE}"
else
  fail "Environment file missing at ${ENV_FILE}"
  finish_check
  exit $?
fi

# shellcheck disable=SC1091
source "${ENV_FILE}"

case "${NAM_ENVIRONMENT:-}" in
  development|staging|production|testing|lab)
    pass "NAM_ENVIRONMENT is canonical: ${NAM_ENVIRONMENT}"
    ;;
  "")
    fail "NAM_ENVIRONMENT is not set"
    ;;
  *)
    fail "NAM_ENVIRONMENT is not canonical: ${NAM_ENVIRONMENT}"
    ;;
esac

if [ -n "${NAM_ENVIRONMENT_ROLE:-}" ]; then
  pass "NAM_ENVIRONMENT_ROLE is set: ${NAM_ENVIRONMENT_ROLE}"
else
  fail "NAM_ENVIRONMENT_ROLE is not set"
fi

if [ -n "${NAM_PROJECT_NAME:-}" ]; then
  pass "NAM_PROJECT_NAME is set: ${NAM_PROJECT_NAME}"
else
  fail "NAM_PROJECT_NAME is not set"
fi

if [ -n "${NAM_PROJECT_ROOT:-}" ] && [ -d "${NAM_PROJECT_ROOT}" ]; then
  pass "NAM_PROJECT_ROOT exists: ${NAM_PROJECT_ROOT}"
else
  fail "NAM_PROJECT_ROOT is missing or not a directory: ${NAM_PROJECT_ROOT:-unset}"
fi

HOSTNAME_NOW="$(hostname 2>/dev/null || true)"
case "${NAM_ENVIRONMENT:-}" in
  development)
    case "${HOSTNAME_NOW}" in
      nam|nam-dev|nam-development) pass "Hostname is acceptable for development: ${HOSTNAME_NOW}" ;;
      *) warn "Development hostname is non-standard: ${HOSTNAME_NOW}" ;;
    esac
    ;;
  staging)
    [ "${HOSTNAME_NOW}" = "nam-staging" ] && pass "Hostname matches staging convention" || warn "Expected staging hostname nam-staging, found ${HOSTNAME_NOW}"
    ;;
  production)
    [ "${HOSTNAME_NOW}" = "nam-prod" ] && pass "Hostname matches production convention" || warn "Expected production hostname nam-prod, found ${HOSTNAME_NOW}"
    ;;
  testing)
    [ "${HOSTNAME_NOW}" = "nam-test" ] && pass "Hostname matches testing convention" || warn "Expected testing hostname nam-test, found ${HOSTNAME_NOW}"
    ;;
  lab)
    [ "${HOSTNAME_NOW}" = "nam-lab" ] && pass "Hostname matches lab convention" || warn "Expected lab hostname nam-lab, found ${HOSTNAME_NOW}"
    ;;
esac

finish_check
