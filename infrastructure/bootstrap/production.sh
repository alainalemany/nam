#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'MESSAGE'
Production bootstrap is intentionally disabled.

Before this script becomes active, define and approve:
- production hostname and project root
- domain and reverse proxy plan
- secrets storage and recovery plan
- PostgreSQL backup, restore, and off-server retention policy
- deployment workflow and rollback procedure
- environment verification requirements
MESSAGE

exit 1
