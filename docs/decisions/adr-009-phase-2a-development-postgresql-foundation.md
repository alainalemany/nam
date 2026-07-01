# ADR-009: Phase 2A Development PostgreSQL Foundation

Date: 2026-06-29

Status: Accepted

Category: Infrastructure/development

## Decision

Phase 2A will establish a development-only Docker Compose foundation for
PostgreSQL inside the existing project repository at
`/home/alain/projects/nam`.

Phase 2A will not create the Next.js application container, scaffold
application code, install Caddy, expose public services, or create `/opt/nam`.

## Reason

The project is still following an architecture-first and documentation-first
workflow. The next useful infrastructure step is to validate the database
container, persistent storage, private Docker networking, environment
conventions, health checks, backup approach, and rollback procedure before
introducing application code. Keeping Phase 2A inside the existing repository
preserves development simplicity while leaving `/opt/nam` available for a future
production deployment location if that separation becomes useful.

## Environment Boundaries

- Development is the current VPS project repository at
  `/home/alain/projects/nam`.
- Staging is an optional future environment and is not implemented in Phase 2A.
- Production is a future deployed environment, possibly under `/opt/nam`, and is
  not implemented in Phase 2A.

## Phase 2A Scope

- Create Docker Compose infrastructure for PostgreSQL only.
- Run PostgreSQL on a private Docker network.
- Store PostgreSQL data in a persistent named Docker volume.
- Keep PostgreSQL unexposed to the host and Internet.
- Use `.env` for local secrets and `.env.example` for documented placeholders.
- Document manual PostgreSQL backup and restore strategy before automating
  backups.
- Verify database health, connectivity, and persistence before adding an
  application container.

## Consequences

- Docker Compose infrastructure can be tested before application scaffolding
  begins.
- The future Next.js application container will be introduced separately in
  Phase 2B.
- The future production deployment location remains undecided and should not be
  assumed from the development layout.
- Database data must be protected from accidental volume deletion, especially
  commands such as `docker compose down -v`.
- Backup files must live outside the PostgreSQL container lifecycle.
- ADR-008 remains the high-level deployment baseline; this ADR refines the
  development infrastructure foundation for Phase 2A.
