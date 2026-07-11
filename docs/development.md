# Development Guide

This document describes the local development workflow for the NAM Dashboard application foundation.

Product requirements, module definitions, data modeling decisions, and architecture decisions remain in the primary planning documents. This guide is limited to running and verifying the approved application platform.

Enduring implementation defaults, such as vertical-slice development,
feature-based module organization, Prisma migration discipline, and
documentation-graph rules, live in `docs/engineering-principles.md`.

Engineering quality standards, Definition of Done, ADR criteria, and quality
gate expectations live in `docs/engineering-quality-standards.md`.

Feature module implementation standards live in `docs/feature-architecture.md`.
This development guide should document executable commands and local workflow,
not duplicate feature architecture policy.

UI architecture and design-system standards live in `docs/ui-architecture.md`.

Testing strategy, test layers, and future quality gates live in
`docs/testing-strategy.md`. This development guide documents concrete commands
for the testing tools currently implemented in the project.

## Current Scope

The current development platform includes:

- Next.js application foundation
- TypeScript configuration
- pnpm package management
- Prisma configuration
- Prisma Client generation
- Docker application service
- Localhost-only application publishing behind optional host-level Caddy
- Operations reference data
- Daily Work Logs, STOP Cards, Daily Inspections, Shift Reports, and Work
  Authorizations feature foundations
- Selected-date Day View composition across the implemented operational modules
- Feature-owned list filtering for Daily Logs and STOP Cards

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

Run the current lint/type-check gate:

```bash
pnpm lint
```

The current `lint` script runs TypeScript with `--noEmit`. Add a dedicated
ESLint configuration later only when the project is ready to standardize lint
rules.

Run tests once:

```bash
pnpm test:run
```

Run tests in watch mode:

```bash
pnpm test
pnpm test:watch
```

Run coverage:

```bash
pnpm test:coverage
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

The Prisma schema contains the PostgreSQL datasource, generated client
configuration, shared operations reference data, and implemented operational
models for Daily Work Logs, STOP Cards, Daily Inspections, Shift Reports, and
Work Authorizations. Schema changes must continue through reviewed Prisma
migrations after the relevant module requirements and data decisions are
confirmed.

## Testing

The canonical testing strategy is:

```text
docs/testing-strategy.md
```

The current executable testing foundation uses:

- Vitest
- jsdom
- React Testing Library
- `@testing-library/jest-dom`
- V8 coverage through Vitest

Test files live under:

```text
tests/unit/
tests/components/
tests/api/
tests/fixtures/
tests/setup/
```

Use `pnpm test:run` before handing off a code change. Use `pnpm build` for the
current production-build quality gate. Use `pnpm lint` for the current
TypeScript no-emit gate.
