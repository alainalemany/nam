# ADR-016: Testing Foundation

Date: 2026-07-06

Status: Accepted

Category: Testing architecture

## Decision

NAM Dashboard uses Vitest, jsdom, React Testing Library,
`@testing-library/jest-dom`, and top-level `tests/` directories as the initial
executable testing foundation.

The current testing foundation includes unit, component, and API route smoke
tests. E2E testing, integration database setup, and CI workflow enforcement are
deferred to later approved milestones.

## Context

The repository architecture audit found that the primary maturity gap was
testing rather than application architecture. The project already has documented
testing strategy and quality gates, but it did not have executable test tooling
or test directory conventions.

The foundation needs to prove the setup works without changing business
behavior, refactoring application architecture, introducing service layers, or
requiring production database data.

## Options Considered

- Keep testing strategy as documentation only.
- Add a broad testing stack with Playwright, integration databases, and CI in
  one milestone.
- Add a minimal Vitest-based foundation with a few smoke tests and defer larger
  layers.

## Reason

Vitest fits the TypeScript and React application foundation with low setup
overhead. jsdom and React Testing Library support stable component tests without
browser automation. API route tests can mock infrastructure boundaries without
requiring a real production database.

A small foundation gives future modules an executable quality baseline while
avoiding premature E2E, integration, or CI complexity.

## Consequences

- Testing is now part of the local engineering quality gate.
- `pnpm test:run` is the default one-time test command.
- `pnpm test` and `pnpm test:watch` run Vitest in watch mode.
- `pnpm test:coverage` produces optional local coverage output.
- Tests live under `tests/unit/`, `tests/components/`, and `tests/api/`.
- Shared deterministic fixtures live under `tests/fixtures/`.
- Vitest setup lives under `tests/setup/`.
- E2E and database integration testing remain deferred until their runtime
  setup is intentionally designed.

## Related Documents

- `docs/testing-strategy.md`
- `docs/development.md`
- `docs/engineering-principles.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/decisions/README.md`
