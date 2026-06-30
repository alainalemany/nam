# Infrastructure Operations

This document is the operational infrastructure reference for NAM Dashboard. It should contain runbooks, environment conventions, deployment workflow notes, backup and restore procedures, and maintenance tasks.

Architecture decisions and long-term tradeoffs belong in `docs/architecture.md`. This document should describe how approved infrastructure decisions are operated.

## Current Scope

Phase 2B establishes the development application platform foundation in `/home/alain/projects/nam`.

Server identity and reusable host configuration are now tracked as repository
infrastructure assets under:

```text
infrastructure/
```

Detailed server identity documentation lives under:

```text
docs/infrastructure/
```

Key documents:

- `docs/infrastructure/server-environment.md`
- `docs/infrastructure/motd.md`
- `docs/infrastructure/bootstrap-and-verification.md`
- `docs/infrastructure/server-config.md`
- `docs/infrastructure/disaster-recovery.md`

Phase 2B includes:

- The PostgreSQL service from Phase 2A
- A Next.js application service named `app`
- Private Docker networking between `app` and `postgres`
- Application publishing on `127.0.0.1:3000` only

Phase 2B does not include:

- Creating `/opt/nam`
- Installing or configuring Caddy
- Opening public ports
- Creating staging or production environments
- Authentication, authorization, user management, feature modules, monitoring, or background workers

## Confirmed Platform Standards

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

Phase 2B creates both `postgres` and `app`.

## Docker Compose

The Phase 2B Docker Compose configuration defines PostgreSQL and the application service.

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
- The application runs in Docker as the `app` service.
- The application depends on PostgreSQL health.
- The application connects to PostgreSQL over `nam-network`.
- The application publishes only `127.0.0.1:3000:3000`.

## Docker Networking

`nam-network` is the private Docker network for NAM Dashboard services.

Phase 2B attaches PostgreSQL and the application container to this network so the application can reach PostgreSQL without exposing the database publicly.

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

Phase 2B also documents:

```text
DATABASE_URL=postgresql://nam_app:replace-with-a-strong-local-password@localhost:5432/nam_dashboard?schema=public
```

The Compose `app` service uses the Docker-internal database host `postgres`, not `localhost`.

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

Build and start the application stack:

```bash
docker compose up -d --build
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

Check application health and app-to-database connectivity:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected successful response:

```json
{"status":"ok","database":"ok"}
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

Verify the application is bound only to localhost:

```bash
docker inspect nam-app --format '{{json .NetworkSettings.Ports}}'
```

The `3000/tcp` value should show `HostIp` as `127.0.0.1`.

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

Phase 2B deployment workflow should remain development-only.

The expected sequence is:

1. Create or update the Phase 2B application, Docker Compose, and environment files.
2. Start PostgreSQL.
3. Verify PostgreSQL health.
4. Verify database connectivity.
5. Generate Prisma Client.
6. Build the Next.js application.
7. Start the application container.
8. Verify localhost-only application access.
9. Verify app-to-database connectivity.
10. Verify no unintended public ports are exposed.

## Caddy Configuration

Caddy is future Phase 3 work.

No Caddy package installation, Caddyfile creation, public reverse proxy configuration, or TLS setup should occur during Phase 2B.

## Firewall Considerations

Phase 2B should not expose PostgreSQL to the host or Internet. The application should be reachable only through `127.0.0.1:3000`.

Firewall changes are not part of Phase 2B unless explicitly approved after inspecting current server state.

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

## Server Identity

The canonical host identity file is:

```text
/etc/nam/environment
```

The NAM MOTD reads this file and renders the environment-specific login banner.
Shell variables are not the authority for server identity.

Reusable assets:

```text
infrastructure/bootstrap/
infrastructure/checks/
infrastructure/motd/
infrastructure/environment/
infrastructure/server-config/
```

The repository is the source of truth for reusable NAM infrastructure whenever
the material is safe to store in Git. Host runtime state, secrets, database
dumps, private keys, and live certificates remain outside Git and are represented
by documented examples or restore procedures instead.
