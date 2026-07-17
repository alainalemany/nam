# Testing Strategy

This document is the canonical testing strategy for NAM Dashboard.

It defines testing goals, test layers, verification expectations, and quality
gates. Concrete commands belong in `docs/development.md`.

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
- `docs/feature-architecture.md` defines feature module structure and
  implementation boundaries.
- `docs/application-state-and-data-flow.md` defines state ownership, mutation
  flow, validation boundaries, and revalidation strategy.
- `docs/ui-architecture.md` defines UI architecture, design-system standards,
  and screen behavior expectations.
- `docs/testing-strategy.md` defines what quality means and which test layers
  should protect the system.
- `docs/development.md` documents concrete commands and local workflows.
- Implementation files and tests contain the executable checks.

Do not place testing policy only in chat history, package scripts, or CI files.
Those may enforce the strategy, but this document is the canonical testing
strategy.

The current executable testing foundation is recorded in ADR-016.

Engineering quality process, Definition of Done, and required verification flow
are defined in `docs/engineering-quality-standards.md`.

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

Testing is now part of the engineering quality gate. Feature work should include
the smallest meaningful automated checks when the change touches validation,
helpers, route behavior, or stable UI behavior.

## Current Test Tooling

NAM Dashboard currently uses:

- Vitest for unit, component, and route-level tests.
- jsdom for browser-like component tests.
- React Testing Library for React component behavior.
- `@testing-library/jest-dom` for DOM assertions.
- Vitest V8 coverage for optional local coverage reports.

Executable commands live in `docs/development.md`.

## Test Locations

Current top-level test directories:

```text
tests/unit/
tests/components/
tests/api/
tests/fixtures/
tests/setup/
```

Use these directories as follows:

- `tests/unit/` for pure validation, formatting, and helper tests.
- `tests/components/` for stable React component behavior.
- `tests/api/` for API route behavior that can be tested without production
  data.
- `tests/fixtures/` for small shared deterministic test data.
- `tests/setup/` for Vitest and Testing Library setup.

Feature-specific `src/features/<feature>/__tests__/` directories may be added
later if a feature becomes large enough that colocated tests improve
maintainability.

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
- Calculation helpers for schedules, timesheets, fuel totals, and approved
  checklist meter-unit behavior.

Unit tests should be fast and deterministic.

## Server Action Tests

Server action tests should verify business workflow behavior at the server
boundary.

Mutation flow, validation boundaries, and revalidation expectations are defined
in `docs/application-state-and-data-flow.md`.

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

E2E testing is deferred from the testing foundation because the project does not
yet have a standardized test database setup, seed/reset workflow, or Playwright
configuration. Add E2E tests as a separate milestone after those runtime
assumptions are documented.

UI behavior expectations are defined in `docs/ui-architecture.md`.

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

Until CI exists, local quality gates are:

- `pnpm lint`
- `pnpm test:run`
- `pnpm build`

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

Daily Work Logs, Day View, STOP Cards, Daily Inspections, Operational Safety
Checklists, Shift Reports, Work Authorizations, Defect Tracking, Work Schedule,
Timesheet, and Equipment Fuel Events are implemented and are eligible for
proportional tests. Equipment Fuel Events include unit validation,
component/route, Server Action, persistence, and explicitly opt-in rollback-only
PostgreSQL integration coverage. The normal suite does not run the PostgreSQL
tests. Broad browser end-to-end coverage remains deferred until a concrete risk
justifies that infrastructure.

Deferred areas:

- Authentication and authorization.
- Generic attachment infrastructure. Operational Safety Checklist photo
  evidence has feature-owned testing architecture, but implementation remains
  blocked by ADR-018's access and runtime gates.
- Global search.
- Analytics.
- Production deployment.
- Metronic integration details.
- External automation or third-party integrations.

Phase 23.4 meter and save-confirmation coverage, including Phase 23.4.2
acceptance corrections, is implemented across unit, component/route, Server
Action, persistence, and opt-in rollback-only PostgreSQL tests. It covers
enum/range behavior, editable category defaults, mismatch confirmation,
Equipment reset, legacy `HOURS`, correction, migration behavior, monotonic
`recordVersion`, signed Post/Redirect/Get results, post-commit bare-detail
fallback, accessible success status, Create Another, invalid/expired markers,
failed mutations, direct constructed URLs, URL consumption, and BFCache
`pageshow` handling. Pending-submit disabling and reduced-motion styling are
implemented. Browser URL/BFCache behavior has component-level coverage; broad
browser refresh/back-navigation E2E remains deferred.

Phase 23.5 requires unit and integration evidence for file-signature and decode
validation, HEIC/HEIF primary-image and auxiliary-content handling, sequence
rejection, normalization and metadata stripping, separate full-image and
thumbnail limits, photo ownership and ordering, filesystem compensation and
orphan cleanup, private serving, access fail-closed behavior, runtime volume
permissions, processor redistribution compatibility, and coordinated
database/media backup restoration. Filesystem and Docker smoke tests are
required because mocks cannot prove decoder, permission, or persistent volume
behavior. Broad browser E2E remains deferred absent a concrete gap.

Tests for these areas should be added when their requirements and
implementation exist.

## Future Test Layers

Recommended future locations when those layers are approved:

```text
tests/integration/
tests/e2e/
tests/smoke/
```

Cross-feature integration, E2E, and smoke tests should live under top-level
`tests/` directories once those test layers are implemented.

Feature module structure and ownership rules live in
`docs/feature-architecture.md`.

## AI Testing Guidance

Future AI assistants should:

- Read this document before adding or changing tests.
- Use `docs/development.md` for current test commands.
- Prefer small tests tied to the changed behavior.
- Avoid broad snapshots, production database dependencies, and large mocking
  frameworks.
- Add test helpers only when repeated setup makes them necessary.
- Keep E2E, integration database setup, and CI expansion as separate approved
  milestones.

## Open Questions

- Should Playwright run in local development, CI, or both?
- How should test databases be created, migrated, seeded, and reset?
- What CI provider and branch protection rules should be used?
- What minimum quality gate is required before production deployment?
