#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

if command -v docker >/dev/null 2>&1; then
  pass "docker command is installed"
else
  fail "docker command is not installed"
  finish_check
  exit $?
fi

DOCKER_REACHABLE=false

if docker info >/dev/null 2>&1; then
  DOCKER_REACHABLE=true
  pass "Docker daemon is reachable"
else
  fail "Docker daemon is not reachable by this user"
fi

if docker compose version >/dev/null 2>&1; then
  pass "Docker Compose plugin is available"
else
  fail "Docker Compose plugin is not available"
fi

if [ "${DOCKER_REACHABLE}" != "true" ]; then
  warn "Skipping Docker label checks because the Docker daemon is not reachable"
elif [ -f /etc/nam/environment ]; then
  # shellcheck disable=SC1091
  source /etc/nam/environment
  EXPECTED_ENV="${NAM_ENVIRONMENT:-}"
  LABEL_MISMATCHES="$(docker ps -a --format '{{.Names}} {{.Label "com.nam.environment"}}' 2>/dev/null | awk -v expected="${EXPECTED_ENV}" '$2 != "" && $2 != expected {print $0}' || true)"
  if [ -z "${LABEL_MISMATCHES}" ]; then
    pass "No Docker environment label mismatches found"
  else
    warn "Docker environment label mismatches found: ${LABEL_MISMATCHES}"
  fi
else
  warn "Cannot compare Docker labels because /etc/nam/environment is missing"
fi

finish_check
