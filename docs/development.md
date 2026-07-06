# Development Guide

This document describes the local development workflow for the NAM Dashboard application foundation.

Product requirements, module definitions, data modeling decisions, and architecture decisions remain in the primary planning documents. This guide is limited to running and verifying the approved application platform.

Enduring implementation defaults, such as vertical-slice development,
feature-based module organization, Prisma migration discipline, and
documentation-graph rules, live in `docs/engineering-principles.md`.

Testing strategy, test layers, and future quality gates live in
`docs/testing-strategy.md`. This development guide should document concrete test
commands only after the corresponding tools are added to the project.

## Current Scope

The current development platform includes:

- Next.js application foundation
- TypeScript configuration
- pnpm package management
- Prisma configuration
- Prisma Client generation
- Docker application service
- Localhost-only application publishing behind optional host-level Caddy
- Operations reference data and Daily Logs feature foundations

The current development platform does not implement authentication, user
management, production deployment, monitoring, or background workers.

## Requirements

Required local tools:

- Node.js
- Corepack
- pnpm, managed through Corepack
- Docker Engine
- Docker Compose plugin

The repository pins pnpm in `package.json` with the `packageManager` field.

Enable pnpm through Corepack if needed:

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
```

## Environment

Local secrets belong in `.env`.

Documented placeholders belong in `.env.example`.

Required variables:

```text
POSTGRES_DB=nam_dashboard
POSTGRES_USER=nam_app
POSTGRES_PASSWORD=replace-with-a-strong-local-password
DATABASE_URL=postgresql://nam_app:replace-with-a-strong-local-password@localhost:5432/nam_dashboard?schema=public
```

For Docker Compose, the `app` service builds its internal database URL from the PostgreSQL variables and connects to `postgres:5432` over `nam-network`.

For host-based development, `DATABASE_URL` points to `localhost:5432`.
PostgreSQL is not published to the host, so host-based Prisma database commands
require either a temporary approved port-publishing change or running database
commands inside Docker. Do not publish PostgreSQL casually; keeping it private
is the approved baseline.

## Package Commands

Install dependencies:

```bash
pnpm install
```

Generate Prisma Client:

```bash
pnpm prisma:generate
```

Build the application:

```bash
pnpm build
```

Run the development server:

```bash
pnpm dev
```

The local development server binds to:

```text
127.0.0.1:3000
```

External development access, when enabled on the VPS, is provided by host-level
Caddy at:

```text
https://dev.alemany.me
```

Caddy reverse proxies to `127.0.0.1:3000`. Do not publish Docker port `3000`
publicly. `nam.alemany.me` is reserved for future production use and should not
be configured for the development app.

## Docker Compose Workflow

Build and start the full development stack:

```bash
docker compose up -d --build
```

Start only PostgreSQL:

```bash
docker compose up -d postgres
```

Start only the application after PostgreSQL is healthy:

```bash
docker compose up -d app
```

Check stack status:

```bash
docker compose ps
```

Check application health:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected successful response:

```json
{"status":"ok","database":"ok"}
```

## Network Expectations

Approved development network behavior:

- Application host binding: `127.0.0.1:3000`
- PostgreSQL host binding: none
- Application-to-database path: `app` container to `postgres` container over `nam-network`
- Public Internet exposure: Caddy only, through `dev.alemany.me` on HTTP/HTTPS

Verify published ports:

```bash
docker compose ps
docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}'
docker inspect nam-app --format '{{json .NetworkSettings.Ports}}'
```

PostgreSQL should show no host-published port. The app should show `3000/tcp` bound to `127.0.0.1`.

When external development access is enabled, verify the proxy:

```bash
curl http://127.0.0.1:3000/api/health
curl -I https://dev.alemany.me
```

The local health endpoint should return:

```json
{"status":"ok","database":"ok"}
```

## Prisma

The initial Prisma schema is intentionally minimal and contains only:

- Prisma Client generator
- PostgreSQL datasource

Product data models should be added only after the relevant module requirements and database decisions are confirmed.

## Testing

The canonical testing strategy is:

```text
docs/testing-strategy.md
```

No test framework or test command is configured yet. When testing tools are
added, document the executable commands here and keep the testing policy in the
testing strategy.
