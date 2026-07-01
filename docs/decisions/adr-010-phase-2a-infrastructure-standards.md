# ADR-010: Phase 2A Infrastructure Standards

Date: 2026-06-29

Status: Accepted

Category: Infrastructure/operations

## Decision

Phase 2A infrastructure naming, PostgreSQL versioning, backup location, and
operational documentation location are standardized.

## Standards

- PostgreSQL will use the PostgreSQL 18 major version.
- Docker images must pin to the PostgreSQL 18 major version rather than
  `latest`.
- Docker Compose project name: `nam`.
- Docker Compose services: `app` and `postgres`.
- Docker network: `nam-network`.
- PostgreSQL named volume: `postgres-data`.
- Explicit container names, if used: `nam-app` and `nam-postgres`.
- PostgreSQL backup files must not be stored inside the Git repository.
- Development PostgreSQL backups should use
  `/home/alain/backups/nam/postgres/`.
- Operational infrastructure procedures belong in `docs/infrastructure.md`.
- `docs/architecture.md` should remain focused on architecture overview,
  decisions, tradeoffs, and consequences rather than command-level operating
  procedures.

## Reason

Stable infrastructure names reduce operational ambiguity, make backup and
restore procedures easier to document, and avoid accidental drift between
development and future deployment environments. Pinning PostgreSQL to a major
version improves repeatability while still allowing compatible patch updates.
Keeping backups outside the repository prevents sensitive database dumps from
being committed. Separating operational procedures into `docs/infrastructure.md`
keeps architecture documentation focused on durable decisions rather than
runbooks.

## Consequences

- Phase 2A implementation files should use these names unless a later approved
  ADR changes them.
- Backup and restore documentation should reference
  `/home/alain/backups/nam/postgres/` as the development backup location.
- `.env` must remain local and uncommitted; `.env.example` may document required
  variable names with placeholder values.
- Future Phase 2B application container work should reuse the `app` service name
  and `nam-app` container name if explicit container names are used.
- Future Caddy, firewall, deployment workflow, and maintenance procedures should
  be documented in `docs/infrastructure.md` when those phases are approved.
