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
- Daily Work Logs, STOP Cards, Daily Inspections, Operational Safety Checklists,
  Shift Reports, Work Authorizations, Defect Tracking, Work Schedule, and
  Timesheet feature foundations, plus Supply Requests V1 and Knowledge Base V1
- Selected-date Day View composition across eleven participating operational
  modules, including Operational Safety Checklists, Equipment Fuel Events, and
  Supply Requests
- Feature-owned list filtering for implemented modules that expose filterable
  operational history

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
NAM_CHECKLIST_RESULT_SIGNING_SECRET=replace-with-at-least-32-random-characters
NAM_PAYROLL_OWNER_EMPLOYEE_ID=replace-with-existing-owner-employee-cuid
NAM_PAYROLL_ACCESS_KEY=replace-with-at-least-32-random-characters
NAM_PAYROLL_SESSION_SECRET=replace-with-an-independent-32-character-minimum-secret
```

`NAM_CHECKLIST_RESULT_SIGNING_SECRET` is a server-only secret used to sign the
short-lived Operational Safety Checklist create/correction presentation marker.
Use at least 32 random characters. Compose parsing and image building work when
it is absent because the value is required only for runtime marker operations.
At runtime, missing or short configuration fails marker generation closed while
authoritative checklist persistence still succeeds; the action redirects to
bare saved detail and emits no unverified banner. Never expose it to client code
or commit a real value.

Payroll is independently fail-closed. Its owner ID must reference the existing
canonical Employee record, and its access key and session secret must be
different high-entropy values of at least 32 characters. Generate them
interactively, save the access key in the owner's password manager, and enter
both through a protected editor rather than command-line arguments:

```bash
umask 077
openssl rand -hex 32
openssl rand -hex 32
chmod 0600 .env
```

Use the first value only for `NAM_PAYROLL_ACCESS_KEY` and the second only for
`NAM_PAYROLL_SESSION_SECRET`. Do not capture either value in deployment logs.
After the owner confirms the existing Employee association, place that
Employee's existing ID in `NAM_PAYROLL_OWNER_EMPLOYEE_ID`; do not create a
Payroll-only duplicate Employee.

Compose forwards all three variables to the application with empty defaults so
local builds remain possible and runtime access fails closed. Validate the
rendered configuration without printing its values:

```bash
docker compose config --format json \
  | jq -e '.services.app.environment as $environment
    | ($environment.NAM_PAYROLL_OWNER_EMPLOYEE_ID | length) > 0
    and ($environment.NAM_PAYROLL_ACCESS_KEY | length) >= 32
    and ($environment.NAM_PAYROLL_SESSION_SECRET | length) >= 32'
```

Do not run unfiltered `docker compose config` in captured deployment logs once
secrets are populated.

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

## GitHub Actions CI

`.github/workflows/ci.yml` runs on pull requests targeting `main`, pushes to
`main`, and explicit manual dispatch. `Application Quality` installs the frozen
lockfile with Corepack-managed pnpm 10.18.3, generates Prisma Client, runs an
explicit TypeScript check, runs the existing `pnpm lint` TypeScript gate, runs
the unit/component suite, and builds with a deliberately unreachable synthetic
database URL.

`PostgreSQL Integration` starts an ephemeral PostgreSQL 18 service on the
GitHub-hosted runner, applies all committed migrations, verifies migration
status, exercises staged migrations 34, 35, and 36 with synthetic historical
identity/rate fixtures, verifies both checksum-guard and forced post-mutation
constraint-failure rollback in isolated schemas, and runs the Phase A integration
suite. The job sets
`PHASE_A_POSTGRES_REQUIRED=1`, so missing test configuration fails rather than
silently skipping the suite.

The Phase A database helper accepts two test-only profiles:

- Default/local: the existing `nam-phase-a-test-postgres` container identity.
- Explicit local loopback: exact `127.0.0.1:55439`, the dedicated Phase A test
  database and user, and `PHASE_A_TEST_DATABASE_PROFILE=local-loopback`.
- `github-actions`: exact `127.0.0.1:5432` loopback, the dedicated Phase A test
  database and user, and both GitHub's `GITHUB_ACTIONS=true` and `CI=true`
  markers.

Neither profile reads or falls back to `DATABASE_URL`. CI sets `DATABASE_URL`
only for `prisma migrate deploy` and `prisma migrate status`, scoped to the same
disposable service. CI contains no production connection, SSH, deployment, or
application mutation step.

The staged Payroll migration command is:

```bash
bash scripts/test/prepare-payroll-review-migration-db.sh
```

The fresh empty-schema migration command is:

```bash
bash scripts/test/verify-payroll-fresh-migration-db.sh
```

The failure-path command is:

```bash
bash scripts/test/verify-payroll-quarantine-migration-failure.sh
```

All three require the guarded `PHASE_A_TEST_DATABASE_URL`; they must never be pointed
at an application or production database.

Run the development server:

```bash
pnpm dev
```

The local development server binds to:

```text
127.0.0.1:3000
```

Private application access on the VPS is provided by Tailscale Serve at:

```text
https://ops-console.tailf57e61.ts.net
```

The app stays bound to `127.0.0.1:3000`. Do not publish Docker port `3000`,
enable Tailscale Funnel, or introduce a public application route.

## Docker Compose Workflow

These commands support local development. A controlled real-data pilot must use
separately authorized procedures conforming to the current gate order in the
[Controlled Pilot Readiness Re-baseline](infrastructure/controlled-pilot-readiness-rebaseline.md).
The [Operational Pilot Runbook](infrastructure/operational-pilot-runbook.md)
continues to define durable pilot requirements; its mutation procedures are not
current execution authority.

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
- Private HTTPS exposure: Tailscale Serve only, through
  `ops-console.tailf57e61.ts.net`
- Public Internet exposure: none; Tailscale Funnel remains disabled

These bullets describe the current development runtime, not the approved pilot
boundary. The pilot must remove the public Caddy application route while
preserving the loopback application binding and unpublished PostgreSQL service.

Verify published ports:

```bash
docker compose ps
docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}'
docker inspect nam-app --format '{{json .NetworkSettings.Ports}}'
```

PostgreSQL should show no host-published port. The app should show `3000/tcp` bound to `127.0.0.1`.

When private access is enabled, verify Tailscale Serve:

```bash
curl http://127.0.0.1:3000/api/health
curl -I https://ops-console.tailf57e61.ts.net
```

The local health endpoint should return:

```json
{"status":"ok","database":"ok"}
```

## Prisma

The Prisma schema contains the PostgreSQL datasource, generated client
configuration, shared operations reference data, and implemented operational
models for Daily Work Logs, STOP Cards, Daily Inspections, Operational Safety
Checklists, Shift Reports, Work Authorizations, Defect Tracking, Work Schedule,
Timesheet, and Equipment Fuel Events. The Equipment Fuel Events aggregate uses
the implemented `EquipmentFuelEvent`, `EquipmentFuelEventTankFill`, and
`FuelServicePerson` models. Schema changes must continue through reviewed
Prisma migrations after the relevant module requirements and data decisions are
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
- Playwright for the focused DDR Chromium/WebKit stability suite

Test files live under:

```text
tests/unit/
tests/components/
tests/api/
tests/e2e/
tests/fixtures/
tests/setup/
```

Use `pnpm test:run` before handing off a code change. Use `pnpm build` for the
current production-build quality gate. Use `pnpm lint` for the current
TypeScript no-emit gate.

Run the focused DDR browser suite at all configured Chromium/WebKit iPad-like
viewports:

```bash
pnpm test:e2e:ddr
```

The Playwright configuration starts an isolated development server on port
3100 with `NAM_DDR_STRESS_TEST=1`. That flag exposes a database-free 50-row
stress route backed only by in-process test state. Without the flag, the route
returns Not Found. The suite must never be aimed at the live application or
production data.

Install matching local browser binaries and system dependencies only on an
approved development machine. When host dependencies are unavailable, use the
matching official Playwright image and keep the repository read-only; redirect
`.next` and Playwright artifacts to container-temporary storage. Docker resource
creation remains a system-level action and requires inspection and explicit
approval under this repository's agent guidance.

Physical-iPad follow-up should use
[Safari Web Inspector for iOS and iPadOS](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios)
from a trusted Mac with the iPad connected and Settings > Apps > Safari >
Advanced > Web Inspector enabled. Inspect the DDR page while repeating the
long-form scenario, record console/network output and memory timelines, and
capture any `WebContent` process termination or iPadOS diagnostic log. Desktop
Playwright WebKit can detect application errors and renderer crashes, but it
cannot prove or disprove an iPadOS whole-app memory-pressure termination.

Operational Safety Checklist meter persistence has an explicitly opt-in,
rollback-only PostgreSQL check. Run it through the private Docker network so no
database host port is required:

```bash
docker compose run --rm --no-deps \
  -v "$PWD:/workspace" -w /workspace app \
  sh -c 'OPERATIONAL_SAFETY_CHECKLIST_TEST_DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/vitest run tests/integration/operational-safety-checklist-postgres.test.ts'
```

The test rolls back its fixture transactions and verifies that no checklist
fixture rows remain. The normal suite skips this file unless
`OPERATIONAL_SAFETY_CHECKLIST_TEST_DATABASE_URL` is set explicitly.

## U.S. Geography Dataset And Import

The committed offline geography artifacts and source provenance live in
`data/geography/`. Regeneration requires separately downloaded official Census
Gazetteer State and Place text files; normal application builds and selectors
require no internet access.

Regenerate reviewed artifacts with:

```bash
node scripts/geography/normalize-census-gazetteer.mjs \
  /path/to/2025_Gaz_state_national.txt \
  /path/to/2025_Gaz_place_national.txt \
  data/geography
```

The database import is an explicit deployment operation, not an application
startup seed. Apply the reviewed geography migration first, verify migration
status and backup/recovery safeguards, then run against the intentionally
selected target database:

```bash
corepack pnpm geography:import
```

Never guess a database URL or run the import against production during ordinary
development/testing. Re-running the import reuses normalized State and
City-within-State matches, preserves IDs and status, and creates only missing
reference rows.
