#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root, for example: sudo $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

"${SCRIPT_DIR}/ubuntu-base.sh"
"${SCRIPT_DIR}/docker.sh"
"${SCRIPT_DIR}/motd.sh" development

echo "Development server identity bootstrap complete."
echo "Run: ${REPO_ROOT}/infrastructure/checks/verify-server.sh"
