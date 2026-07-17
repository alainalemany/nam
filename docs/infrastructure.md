# Infrastructure Operations

This document is the operational infrastructure reference for NAM Dashboard. It should contain runbooks, environment conventions, deployment workflow notes, backup and restore procedures, and maintenance tasks.

Architecture overview belongs in `docs/architecture.md`. Durable architecture
decisions and long-term tradeoffs belong in `docs/decisions/`. This document
should describe how approved infrastructure decisions are operated.

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
- `docs/infrastructure/operational-pilot-runbook.md`

Phase 2B includes:

- The PostgreSQL service from Phase 2A
- A Next.js application service named `app`
- Private Docker networking between `app` and `postgres`
- Application publishing on `127.0.0.1:3000` only

Phase 3.2 external development access adds host-level Caddy in front of the
existing development app:

- `dev.alemany.me` is the external development hostname.
- Caddy terminates HTTPS and reverse proxies to `127.0.0.1:3000`.
- The Docker application service remains bound only to localhost.
- Port `3000` must not be exposed directly to the public Internet.
- `nam.alemany.me` is reserved for a future production deployment and is not
  configured in Caddy yet.

ADR-019 approves a managed private overlay, with Tailscale as the implementation
reference, for the controlled real-data pilot. That boundary is not implemented
yet. The current public Caddy route remains development-only and does not
authorize real operational data. The later access milestone must establish
tailnet-only HTTPS, remove the public NAM route, and close public HTTP/HTTPS
ingress over IPv4 and IPv6 before the Access Gate can pass.

Phase 2B does not include:

- Creating `/opt/nam`
- Creating staging or production environments
- Authentication, authorization, user management, feature modules, monitoring, or background workers

Phase 3.2 development access does not create production hosting, production
data separation, authentication, monitoring, staging, or public access to
PostgreSQL.

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

The Caddy reverse proxy runs at the host level and connects to the application
through the host loopback binding:

```text
Internet -> Caddy :443 -> 127.0.0.1:3000 -> nam-app
```

Docker should continue to publish the app only on `127.0.0.1:3000`.

The approved but unimplemented pilot path is:

```text
Approved tailnet device -> private HTTPS -> 127.0.0.1:3000 -> nam-app
```

The public Caddy path must be absent when the pilot Access Gate passes. See
[ADR-019](decisions/adr-019-managed-private-overlay-operational-pilot.md) and
the [Operational Pilot Runbook](infrastructure/operational-pilot-runbook.md).

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

Phase 23.4 also requires this application-only server secret:

```text
NAM_CHECKLIST_RESULT_SIGNING_SECRET=replace-with-at-least-32-random-characters
```

It signs five-minute Operational Safety Checklist save-result markers. It is
not an authentication credential or corporate-submission proof. Use at least
32 random characters, keep the real value only in ignored/deployment secret
configuration, and pass it to the application container. Compose configuration
parsing and image builds do not require the runtime value and never bake it into
the image. At runtime, missing or invalid configuration fails marker signing
closed: authoritative checklist persistence still succeeds, the action logs a
safe server-side diagnostic, and the user is redirected to saved detail without
a marker or unverified success banner.

The Compose `app` service uses the Docker-internal database host `postgres`, not `localhost`.

The local `.env` file should replace the placeholder password with a local-only secret.

## PostgreSQL Backups

Backup files must not be stored inside the Git repository.

Development PostgreSQL backups should be written to:

```text
/home/alain/backups/nam/postgres/
```

The canonical current-schema pilot backup procedure is the
[Operational Pilot Runbook](infrastructure/operational-pilot-runbook.md). It
defines private file permissions, custom-format `pg_dump`, partial-file failure
handling, a manifest, migration and record-count context, SHA-256 validation,
and a mandatory disposable restore before real pilot data is authorized.

Older Phase 2A archives and archive listings are not current-schema recovery
evidence. No pilot backup or restore is considered proven until the runbook is
executed successfully in a separately authorized operations milestone.

## Planned Operational Safety Checklist Media Storage

ADR-018 approves private local persistent storage for future checklist photo
evidence on the current single-node deployment. Phase 23.3 defines the
architecture only; no Docker volume, media directory, processor package, or
media route exists yet.

Phase 23.5 may mount a private named volume into the application container at:

```text
/var/lib/nam/media
```

The implementation must verify ownership and write permissions for the
non-root application runtime user. Media must not be placed under `public/`,
served as direct static files, or named from uploaded filenames. The
feature-owned storage adapter uses staging, final checklist/photo paths, and a
trash area on the same volume. Real workplace-photo upload and serving remain
disabled until ADR-018's authentication/authorization or separately approved
deny-by-default access boundary exists.

Planned development media backups belong outside the repository at:

```text
/home/alain/backups/nam/media/
```

A media backup is valid only as part of a matched backup set. Photo mutations
must be paused while operators create a PostgreSQL dump and a read-only media
archive plus a key/size/SHA-256 manifest. Database and media files should share
one backup-set identifier and retention decision. This is coordinated
consistency, not a transaction across PostgreSQL and the filesystem.

Restore must occur with the application stopped: restore PostgreSQL, restore
the matching media archive, run checksum/missing/orphan reconciliation, and
then start the application. Named volumes survive container recreation but not
explicit volume deletion or host loss. Future production use requires
encrypted off-host copies and regular restore exercises.

## PostgreSQL Restore

Never validate a pilot backup by restoring over the live database. Use the
guarded disposable-database procedure in the
[Operational Pilot Runbook](infrastructure/operational-pilot-runbook.md), then
drop only that unmistakably named validation database after comparing migration
and record counts with the backup manifest.

An actual disaster recovery restore is a separate, destructive operation that
requires explicit authorization and the
[Server Identity Disaster Recovery](infrastructure/disaster-recovery.md)
boundary. A successful disposable restore test is recovery evidence, not
permission to overwrite live data.

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

The exact pilot deployment gate, stale-image replacement checks, route and
ten-contributor Day View verification, evidence record, and application-only
rollback are defined in the
[Operational Pilot Runbook](infrastructure/operational-pilot-runbook.md). The
pilot remains unauthorized until that procedure is executed after an approved
private-access boundary is active. ADR-019 approves the boundary architecture;
it does not make the current public deployment eligible for pilot data.

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

Phase 3.2 currently uses host-level Caddy for external development access. This
public route is not approved for real pilot data.

The repository-owned Caddy example is:

```text
infrastructure/server-config/caddy/Caddyfile.dev.example
```

The live host file is:

```text
/etc/caddy/Caddyfile
```

Approved development route:

```caddyfile
dev.alemany.me {
  reverse_proxy 127.0.0.1:3000
}
```

Do not add a `nam.alemany.me` site block until production deployment is
explicitly designed and approved. `nam.alemany.me` remains reserved for future
production use.

Verify Caddy:

```bash
systemctl is-active caddy
caddy validate --config /etc/caddy/Caddyfile
curl -I https://dev.alemany.me
```

If HTTPS does not load externally, verify:

- DNS `A dev.alemany.me` points to the server public IP.
- Host firewall allows inbound TCP `80` and `443`.
- Provider firewall/security group allows inbound TCP `80` and `443`.
- The local app health endpoint succeeds at `http://127.0.0.1:3000/api/health`.

The later ADR-019 implementation must remove this public application route,
remove public DNS reachability for `dev.alemany.me`, and verify that Caddy does
not provide an IPv4 or IPv6 bypass. Do not restore unauthenticated public Caddy
access as a fallback when private overlay access is unavailable.

## Firewall Considerations

PostgreSQL must not be exposed to the host or Internet. The application should
remain reachable directly only through `127.0.0.1:3000`.

For current synthetic-data development access, public traffic terminates at
Caddy on ports `80` and `443`. Do not open port `3000` publicly.

For the controlled pilot, public TCP `80` and `443` and UDP `443` must be
closed over IPv4 and IPv6 after the private path is verified. Exact privileged
UFW state must be captured before implementation and verified afterward.

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
