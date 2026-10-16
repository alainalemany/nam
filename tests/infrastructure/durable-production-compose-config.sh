#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
EXPECTED_IMAGE='sha256:4e41f290122b0984da795eb4bc1f9769f635c1bc73c367ccc1438805ce0605b9'

COMPOSE_JSON="$(
  docker compose \
    --env-file /dev/null \
    -f "$REPOSITORY_ROOT/compose.yaml" \
    -f "$REPOSITORY_ROOT/infrastructure/server-config/docker/production-image.override.yaml" \
    config --no-interpolate --format json
)"

jq -e --arg expected_image "$EXPECTED_IMAGE" '
  .name == "nam"
  and (.services | keys | sort) == ["app", "postgres"]
  and (.networks | keys) == ["nam-network"]
  and (.volumes | keys) == ["postgres-data"]
  and .services.app.container_name == "nam-app"
  and .services.postgres.container_name == "nam-postgres"
  and .services.app.image == $expected_image
  and (.services.app | has("build") | not)
  and .services.app.pull_policy == "never"
  and .services.app.restart == "unless-stopped"
  and .services.postgres.image == "postgres:18"
  and .services.postgres.restart == "unless-stopped"
  and .services.app.depends_on.postgres.condition == "service_healthy"
  and .services.app.depends_on.postgres.required == true
  and .services.postgres.healthcheck.test == [
    "CMD-SHELL",
    "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""
  ]
  and .services.postgres.healthcheck.interval == "10s"
  and .services.postgres.healthcheck.timeout == "5s"
  and .services.postgres.healthcheck.retries == 5
  and .services.postgres.healthcheck.start_period == "10s"
  and (.services.app.ports | length) == 1
  and .services.app.ports[0].host_ip == "127.0.0.1"
  and .services.app.ports[0].published == "3000"
  and .services.app.ports[0].target == 3000
  and ((.services.postgres.ports // []) | length) == 0
  and (.services.app.networks | keys) == ["nam-network"]
  and (.services.postgres.networks | keys) == ["nam-network"]
  and .networks["nam-network"].name == "nam-network"
  and .networks["nam-network"].driver == "bridge"
  and (.services.postgres.volumes | length) == 1
  and .services.postgres.volumes[0].source == "postgres-data"
  and .services.postgres.volumes[0].target == "/var/lib/postgresql"
  and ((.services.app.volumes // []) | length) == 0
  and .volumes["postgres-data"].name == "postgres-data"
  and .services.app.environment.NAM_PAYROLL_OWNER_EMPLOYEE_ID == "${NAM_PAYROLL_OWNER_EMPLOYEE_ID:-}"
  and .services.app.environment.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID == "${NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID:-}"
  and .services.app.environment.NAM_PAYROLL_ACCESS_KEY == "${NAM_PAYROLL_ACCESS_KEY:-}"
  and .services.app.environment.NAM_PAYROLL_SESSION_SECRET == "${NAM_PAYROLL_SESSION_SECRET:-}"
  and .services.app.environment.NAM_CHECKLIST_RESULT_SIGNING_SECRET == "${NAM_CHECKLIST_RESULT_SIGNING_SECRET:-}"
  and .services.app.environment.DATABASE_URL == "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
  and .services.postgres.environment.POSTGRES_DB == "${POSTGRES_DB}"
  and .services.postgres.environment.POSTGRES_USER == "${POSTGRES_USER}"
  and .services.postgres.environment.POSTGRES_PASSWORD == "${POSTGRES_PASSWORD}"
  and .services.postgres.environment.PGDATA == "/var/lib/postgresql/data/pgdata"
' >/dev/null <<<"$COMPOSE_JSON"

printf '%s\n' 'durable production Compose configuration: PASS'
