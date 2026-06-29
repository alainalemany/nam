# Infrastructure Operations

This document is the operational infrastructure reference for NAM Dashboard. It should contain runbooks, environment conventions, deployment workflow notes, backup and restore procedures, and maintenance tasks.

Architecture decisions and long-term tradeoffs belong in `docs/architecture.md`. This document should describe how approved infrastructure decisions are operated.

## Current Scope

Phase 2A is limited to the development Docker PostgreSQL foundation in `/home/alain/projects/nam`.

Phase 2A does not include:

- Creating `/opt/nam`
- Creating the Next.js application container
- Scaffolding application code
- Installing or configuring Caddy
- Opening public ports
- Creating staging or production environments

## Confirmed Phase 2A Standards

PostgreSQL:

- Use PostgreSQL 18.
- Pin the Docker image to the PostgreSQL 18 major version.
- Do not use `latest`.

Docker Compose naming:

- Project name: `nam`
- Services: `app`, `postgres`
- Network: `nam-network`
- PostgreSQL named volume: `postgres-data`
- Explicit container names, if used: `nam-app`, `nam-postgres`

Phase 2A only creates the `postgres` service. The `app` service name is reserved for Phase 2B.

## Docker Compose

The Phase 2A Docker Compose configuration should define PostgreSQL only.

The Compose file is:

```text
compose.yaml
```

Required behavior:

- PostgreSQL runs in Docker.
- PostgreSQL uses the `postgres-data` named volume.
- `postgres-data` is mounted at `/var/lib/postgresql`.
- PostgreSQL connects only to the private `nam-network` Docker network.
- PostgreSQL is not published to the host.
- PostgreSQL is not exposed to the Internet.
- PostgreSQL includes a health check.

## Docker Networking

`nam-network` is the private Docker network for NAM Dashboard services.

Phase 2A should attach only PostgreSQL to this network. Phase 2B will attach the application container to the same network so the application can reach PostgreSQL without exposing the database publicly.

## Volumes

`postgres-data` is the persistent named Docker volume for PostgreSQL data.

Operational caution:

- The PostgreSQL container may be replaced.
- The PostgreSQL volume must not be deleted unless the operator intentionally wants to destroy the database.
- Avoid `docker compose down -v` unless data loss is intended and confirmed.

## Environment Variables

Local secrets belong in `.env`.

Documented placeholders belong in `.env.example`.

`.env` must not be committed to Git.

Phase 2A variables:

```text
POSTGRES_DB=nam_dashboard
POSTGRES_USER=nam_app
POSTGRES_PASSWORD=replace-with-a-strong-local-password
```

The local `.env` file should replace the placeholder password with a local-only secret.

## PostgreSQL Backups

Backup files must not be stored inside the Git repository.

Development PostgreSQL backups should be written to:

```text
/home/alain/backups/nam/postgres/
```

Manual backup documentation should be created before backup automation is introduced.

Create the backup directory outside the repository before running backups:

```bash
mkdir -p /home/alain/backups/nam/postgres
```

Manual custom-format backup:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "/home/alain/backups/nam/postgres/nam_$(date +%Y%m%d_%H%M%S).dump"
```

Verify backup files:

```bash
ls -lh /home/alain/backups/nam/postgres/
```

## PostgreSQL Restore

Restore procedures should be documented before production use.

Manual restore into an existing database should be handled carefully because it can overwrite data.

Example restore command for a selected backup file:

```bash
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < /home/alain/backups/nam/postgres/example.dump
```

Before restoring:

- Confirm the backup file path.
- Confirm whether the target database should be emptied or overwritten.
- Confirm whether the existing `postgres-data` volume should be reused.
- Take a fresh backup first if preserving current data matters.

After restoring, verify database connectivity and inspect expected tables or records.

## Verification Commands

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Check container status and health:

```bash
docker compose ps
```

Check PostgreSQL readiness:

```bash
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Check database connectivity:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select current_database(), current_user;"'
```

Verify persistence across container recreation:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "create table if not exists phase2a_persistence_check (id integer primary key, note text); insert into phase2a_persistence_check (id, note) values (1, '\''persistent'\'') on conflict (id) do update set note = excluded.note;"'
docker compose up -d --force-recreate postgres
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select * from phase2a_persistence_check;"'
```

Verify PostgreSQL has no published ports:

```bash
docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}'
```

The `5432/tcp` value should be `null`, showing that PostgreSQL is exposed only inside Docker networking and not published to the host.

## Rollback Notes

For Compose configuration errors:

```bash
docker compose down
```

For failed container startup without data destruction:

```bash
docker compose up -d postgres
docker compose logs postgres
```

Avoid this command unless data loss is intended and confirmed:

```bash
docker compose down -v
```

## Deployment Workflow

Phase 2A deployment workflow should remain development-only.

The expected sequence is:

1. Create the Phase 2A Docker Compose and environment files.
2. Start PostgreSQL.
3. Verify PostgreSQL health.
4. Verify database connectivity.
5. Verify data persists across container restart.
6. Verify backup command behavior.
7. Verify restore command behavior or document restore validation limits.

## Caddy Configuration

Caddy is future Phase 3 work.

No Caddy package installation, Caddyfile creation, public reverse proxy configuration, or TLS setup should occur during Phase 2A.

## Firewall Considerations

Phase 2A should not expose PostgreSQL to the host or Internet.

Firewall changes are not part of Phase 2A unless explicitly approved after inspecting current server state.

## Maintenance Tasks

Future infrastructure maintenance documentation should cover:

- Backup automation
- Restore testing
- Backup retention
- Off-server backup evaluation
- PostgreSQL upgrade approach
- Docker image update process
- Disk usage checks
- Container health review
- Log review
- Monitoring, only when it solves a real operational need
