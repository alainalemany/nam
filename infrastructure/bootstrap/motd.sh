#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT_NAME="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENVIRONMENT_FILE="${REPO_ROOT}/infrastructure/environment/${ENVIRONMENT_NAME}.example"

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root, for example: sudo $0 ${ENVIRONMENT_NAME}" >&2
  exit 1
fi

if [ ! -f "${ENVIRONMENT_FILE}" ]; then
  echo "Unknown environment example: ${ENVIRONMENT_FILE}" >&2
  exit 1
fi

"${REPO_ROOT}/infrastructure/motd/install.sh" "${ENVIRONMENT_FILE}"
