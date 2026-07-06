# Testing Strategy

This document is the canonical testing strategy for NAM Dashboard.

It defines testing goals, test layers, verification expectations, and future
quality gates. It does not install test frameworks, define package scripts, or
replace the development guide. Concrete commands belong in `docs/development.md`
after the corresponding tools are added to the project.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This testing strategy is approved project direction. |
| Recommended | Suggested testing improvements that still need implementation approval. |
| Open Question | Testing areas that need future decisions. |

## Documentation Graph Fit

Testing strategy sits in this path:

```text
docs/philosophy.md
-> docs/engineering-principles.md
-> docs/testing-strategy.md
-> docs/development.md
-> implementation files/tests
```

Purpose by layer:

- `docs/philosophy.md` defines broad project principles.
- `docs/engineering-principles.md` defines implementation defaults.
- `docs/testing-strategy.md` defines what quality means and which test layers
  should protect the system.
- `docs/development.md` documents concrete commands and local workflows.
- Implementation files and tests contain the executable checks.

Do not place testing policy only in chat history, package scripts, or CI files.
Those may enforce the strategy, but this document is the canonical testing
strategy.

## Testing Goals

Testing should protect the parts of NAM Dashboard that carry operational
history:

- Data integrity for dates, mines, equipment, logs, activities, and future
  linked records.
- Reliable form validation and server-side persistence.
- Safe Prisma migrations and schema changes.
- Confidence that Docker, PostgreSQL, Caddy, and the health endpoint work
  together.
- Fast feedback for small code changes.
- Focused end-to-end coverage for critical workflows.

Testing should scale with risk. Small pure helpers need narrow tests. Database
schema changes, server actions, infrastructure changes, and user-facing
workflows need broader verification.

## Test Pyramid

NAM Dashboard should use layered tests:

| Layer | Purpose | Examples |
| --- | --- | --- |
| Unit tests | Fast checks for pure logic and validation. | Zod schemas, date helpers, option mapping, formatting helpers. |
| Server action tests | Verify server-side workflow behavior. | Create/update actions, validation failures, redirect behavior, revalidation expectations. |
| Prisma/PostgreSQL integration tests | Verify persistence and relations against a real database. | Daily Log with activities, Equipment/Mine relations, cascade behavior. |
| Migration verification | Confirm schema changes are reproducible and applied. | Prisma generate, migration status, drift checks, migration table inspection. |
| API route tests | Verify route behavior and error handling. | `/api/health`, future API routes. |
| Playwright/E2E tests | Verify critical browser workflows. | Create/edit/list/detail flows, navigation, form validation display. |
| Smoke tests | Verify live runtime assumptions. | Docker services, local health, Caddy, HTTPS, `dev.alemany.me`, database connectivity. |

## Unit Tests

Unit tests should cover code that can be tested without Next.js runtime,
network, Docker, or a database.

Good candidates:

- Zod validation schemas.
- Date-only conversion and formatting helpers.
- Enum option labels and constants.
- Pure transformation logic.
- Future calculation helpers for schedules, timesheets, fuel totals, and work
  truck mileage.

Unit tests should be fast and deterministic.

## Server Action Tests

Server action tests should verify business workflow behavior at the server
boundary.

Coverage should include:

- Valid form input creates or updates records.
- Invalid form input returns structured field errors.
- Optional values are normalized consistently.
- Related records are connected correctly.
- Redirect and revalidation behavior is intentional.

Server action tests should avoid mocking Prisma so heavily that persistence
behavior becomes untested. When the action's value is database behavior, prefer
an integration test.

## Prisma/PostgreSQL Integration Tests

Integration tests should use PostgreSQL when testing behavior that depends on:

- Prisma relations.
- Database constraints.
- Cascading deletes.
- Date fields.
- Migration-created schema.
- Multi-record workflows.

SQLite or in-memory substitutes should not be treated as equivalent to the
production database model because NAM Dashboard uses PostgreSQL-specific
behavior and Prisma migrations.

Future implementation should define how integration test databases are created,
reset, and isolated.

## Migration Verification

Every schema change should be verified through Prisma, not through unmanaged
manual database edits.

Migration verification should include:

- Prisma Client generation.
- Migration status against the target development database.
- Confirmation that committed migrations exist for schema changes.
- Database health after applying migrations.
- Inspection of `_prisma_migrations` when direct host-based Prisma commands are
  blocked by the Docker networking model.

Migration checks should protect both local development and future CI.

## API Route Tests

API route tests should verify route responses, status codes, and failure
behavior.

Current priority:

- `/api/health` should return application and database health.

Future API routes should define:

- Expected status codes.
- Response shape.
- Authentication and authorization expectations when those features exist.
- Database error handling.

## Playwright And End-To-End Tests

Playwright/E2E tests should cover user-critical browser workflows, not every UI
detail.

Initial high-value workflows:

- Equipment create/edit/list.
- Daily Log create/edit/list/detail.
- Multiple Daily Log activity rows.
- Form validation feedback.
- Navigation between dashboard, equipment, and Daily Logs.

E2E tests should run against a known database state. Test data setup and reset
rules should be documented before broad E2E coverage is added.

## Smoke Tests

Smoke tests verify that the deployed development runtime is wired correctly.

Development smoke checks should include:

- Docker services are running.
- `nam-app` publishes only `127.0.0.1:3000`.
- `nam-postgres` has no host-published PostgreSQL port.
- Local health succeeds at `http://127.0.0.1:3000/api/health`.
- Caddy is active.
- Caddy config validates.
- HTTP redirects to HTTPS for `dev.alemany.me`.
- `https://dev.alemany.me` loads through Caddy.
- `https://dev.alemany.me/api/health` reports database health.

Smoke tests do not replace unit, integration, or E2E tests. They confirm the
runtime is reachable and connected.

## CI Quality Gates

Future CI should enforce a small but meaningful quality baseline before changes
are merged.

Recommended gates:

- Dependency install.
- TypeScript type check.
- Prisma Client generation.
- Production build.
- Unit tests.
- Integration tests that can run safely in CI.
- Playwright/E2E tests for critical workflows once the test database setup is
  reliable.
- Migration status or drift checks where feasible.

No CI workflow is added by this document. CI should be introduced as a separate
implementation change after tools and commands are selected.

## Manual Verification Expectations

Manual verification remains required when a change affects:

- System-level packages or services.
- Docker networking or published ports.
- Caddy routing.
- Database migrations.
- Data persistence.
- User-facing create/edit workflows not yet covered by E2E tests.

Manual verification should be summarized with:

- Commands run.
- Results.
- Any sandbox limitations.
- Any DNS, firewall, or host-level follow-up.

## What Not To Test Yet

Do not design tests around features that are not implemented or not approved
for the current phase.

Deferred areas:

- Authentication and authorization.
- Attachments.
- Day View.
- Global search.
- Work Authorizations.
- Inspections.
- STOP Cards.
- Analytics.
- Production deployment.
- Metronic integration details.
- External automation or third-party integrations.

Tests for these areas should be added when their requirements and
implementation exist.

## Future Test Locations

Recommended future locations:

```text
src/features/<feature>/__tests__/
src/app/**/__tests__/
tests/integration/
tests/e2e/
tests/smoke/
```

Feature-specific tests should live close to the feature when practical.
Cross-feature integration, E2E, and smoke tests should live under top-level
`tests/` directories once those test layers are implemented.

## Open Questions

- Which unit/integration test runner should be standard for the project?
- Should Playwright run in local development, CI, or both?
- How should test databases be created, migrated, seeded, and reset?
- What CI provider and branch protection rules should be used?
- What minimum quality gate is required before production deployment?
