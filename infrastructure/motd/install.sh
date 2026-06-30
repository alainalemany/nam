#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root, for example: sudo $0 infrastructure/environment/development.example" >&2
  exit 1
fi

ENV_FILE_SOURCE="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOTD_SOURCE="${REPO_ROOT}/infrastructure/motd/99-alain-server-dashboard"
MOTD_TARGET="/etc/update-motd.d/99-alain-server-dashboard"
ENV_DIR="/etc/nam"
ENV_TARGET="${ENV_DIR}/environment"
BACKUP_DIR="/etc/update-motd.d/backups"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

if [ -z "${ENV_FILE_SOURCE}" ]; then
  echo "Usage: sudo $0 infrastructure/environment/development.example" >&2
  exit 1
fi

if [ ! -f "${ENV_FILE_SOURCE}" ]; then
  echo "Environment source file not found: ${ENV_FILE_SOURCE}" >&2
  exit 1
fi

if [ ! -f "${MOTD_SOURCE}" ]; then
  echo "MOTD source file not found: ${MOTD_SOURCE}" >&2
  exit 1
fi

if ! command -v figlet >/dev/null 2>&1; then
  apt-get update
  apt-get install -y figlet
fi

mkdir -p "${ENV_DIR}" "${BACKUP_DIR}"

if [ -e "${MOTD_TARGET}" ]; then
  cp -a "${MOTD_TARGET}" "${BACKUP_DIR}/99-alain-server-dashboard.${STAMP}.bak"
fi

if [ -e "${ENV_TARGET}" ]; then
  cp -a "${ENV_TARGET}" "${ENV_TARGET}.${STAMP}.bak"
fi

install -m 0755 "${MOTD_SOURCE}" "${MOTD_TARGET}"
install -m 0644 "${ENV_FILE_SOURCE}" "${ENV_TARGET}"

find /etc/update-motd.d -maxdepth 1 -type f ! -name "99-alain-server-dashboard" -exec chmod -x {} +

run-parts --test /etc/update-motd.d
run-parts /etc/update-motd.d >/dev/null

echo "Installed NAM MOTD and environment file."
