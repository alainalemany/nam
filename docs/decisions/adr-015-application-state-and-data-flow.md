# ADR-015: Application State And Data Flow

Date: 2026-07-06

Status: Accepted

Category: Application architecture

## Decision

NAM Dashboard prefers server-owned persisted data, explicit mutation
boundaries, local UI state by default, predictable validation and error
boundaries, and a consistent state/data-flow pattern across future modules.

Persisted operational records should live in PostgreSQL and be accessed through
Prisma. Form-driven writes should use explicit server-side mutation boundaries,
currently server actions, unless a future feature requires another boundary.
Temporary UI state should remain local to the relevant screen or component by
default.

NAM Dashboard should not introduce a global client state layer until a confirmed
cross-route workflow requires it.

## Context

The project has entered active feature development. Operations reference data
and Daily Logs already use a predictable pattern:

- Server-loaded records.
- Feature-owned validation.
- Server actions for writes.
- Prisma persistence.
- Route revalidation.
- Redirects to durable list or detail pages.
- Local component state only for temporary form interaction.

Future modules should follow the same pattern unless their requirements justify
a different architecture.

## Options Considered

- Keep state and data-flow conventions implicit in existing code.
- Introduce a global client state layer early.
- Prefer API routes as the default mutation boundary for all writes.
- Document a server-owned, feature-oriented data-flow pattern and defer global
  state until it is justified.

## Reason

NAM Dashboard's core value is reliable operational history. Persisted records
must remain authoritative in the database, not in browser-only state.

Server-owned data flow keeps feature modules simpler, makes Prisma relations
visible, reduces cache synchronization problems, and fits the current Next.js
App Router and server action foundation.

Local UI state is still appropriate for temporary interaction, such as unsaved
form rows or pending submit state. That does not require a global state system.

Deferring global state avoids premature architecture while preserving the
option to add it later for real cross-route workflows such as Day View, global
search, authentication, notifications, or background job status.

## Consequences

- Feature modules should load durable data on the server.
- Form mutations should use explicit server actions unless another boundary is
  approved.
- Validation should happen at the server-side mutation boundary.
- Prisma remains the persistence boundary for database-backed state.
- Routes affected by mutations should be deliberately revalidated.
- UI components may own temporary interaction state.
- Global client state should not be introduced for basic CRUD, forms, route
  navigation, or one-screen toggles.
- Future modules should follow the same state/data-flow pattern unless an ADR
  or approved module architecture changes it.

## Related Documents

- `docs/application-state-and-data-flow.md`
- `docs/architecture.md`
- `docs/feature-architecture.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`
- `docs/engineering-principles.md`
