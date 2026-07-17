# Application State And Data Flow

This document is the canonical application state and data-flow architecture for
NAM Dashboard.

It defines how persisted data, temporary UI state, validation, mutations,
loading, errors, and revalidation should flow through the application. It does
not replace product requirements, data model documentation, feature architecture,
UI architecture, testing strategy, or implementation commands.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This state and data-flow architecture is approved project direction. |
| Recommended | Suggested data-flow improvements that still need approval. |
| Open Question | State/data-flow areas that need future decisions. |

## Documentation Graph Fit

Application state and data flow sits in this path:

```text
docs/philosophy.md
-> docs/engineering-principles.md
-> docs/feature-architecture.md
-> docs/application-state-and-data-flow.md
-> docs/ui-architecture.md
-> docs/development.md
-> implementation files
```

Related authorities:

- Product behavior lives in `docs/prd.md`.
- Module workflows live in `docs/modules.md`.
- Data entities and relationships live in `docs/database.md`.
- Feature implementation standards live in `docs/feature-architecture.md`.
- UI behavior and screen states live in `docs/ui-architecture.md`.
- Testing expectations live in `docs/testing-strategy.md`.
- Durable architecture decisions live in `docs/decisions/`.
- Development commands live in `docs/development.md`.

ADR-015 records the durable decision behind this architecture.

## Purpose

NAM Dashboard is a recordkeeping application. Its most important state is
persisted operational history: dates, mines, equipment, logs, activities, and
future linked records.

The purpose of this document is to keep data flow predictable across modules:

- Persisted records are owned by the server and database.
- Temporary UI state stays local by default.
- Mutations have explicit validation and write boundaries.
- Loading, empty, and error states are intentionally handled.
- Future modules follow the same data-flow pattern unless a specific decision
  changes it.

## Source Of Truth Boundaries

Use the right document for the right question:

| Question | Source |
| --- | --- |
| What should the product do? | `docs/prd.md` |
| How should a module workflow behave? | `docs/modules.md` |
| What data exists and how is it related? | `docs/database.md` |
| How should feature code be organized? | `docs/feature-architecture.md` |
| How should screens show state? | `docs/ui-architecture.md` |
| How should state and mutations flow? | `docs/application-state-and-data-flow.md` |
| How should behavior be verified? | `docs/testing-strategy.md` |

Do not duplicate Prisma schema details, UI component rules, or test policy in
this document.

## Server State And Client State

Server state is data that represents durable application truth:

- Database records.
- Relationships between records.
- Derived data loaded from persisted records.
- Health information from server-side checks.

Client state is temporary interface state:

- In-progress form input before submit.
- Dynamic form rows.
- Local expanded/collapsed sections.
- Pending UI state during a submit.
- Temporary filters before they are applied to a server query.

Default rule: persisted operational data belongs to the server and database.
Client state should be local, small, and tied to one screen or component unless
a future requirement proves otherwise.

## Database-Backed State And Temporary UI State

Database-backed state should be modeled explicitly through Prisma and
PostgreSQL. It should not be hidden in browser-only state, local storage, or
unmanaged client caches.

Temporary UI state may exist only to support interaction. It should not become
the source of truth for operational history.

Examples:

| State | Owner |
| --- | --- |
| Daily Log record | PostgreSQL through Prisma |
| Daily Log activity rows after save | PostgreSQL through Prisma |
| Unsaved activity rows in the form | Local component state |
| Pending submit flag | React/action state |
| Health endpoint response | Server route response |
| Navigation selection | Route and application shell |

## Form State Ownership

Forms may use local component state for interaction, especially when the user
can add or remove rows before submit.

Form ownership rules:

- Initial values come from server-loaded data.
- In-progress values belong to the form.
- Validation belongs at the server boundary.
- Field errors are returned to the form.
- Successful writes redirect to the resulting list or detail page.
- Saved records become server state after persistence.

Client-side validation may improve ergonomics later, but server-side validation
is required for persisted data.

## API Route Expectations

API routes are not the default mutation boundary for current feature modules.

Current project standard: form-driven create/edit workflows use Server Actions.
Alternative mutation boundaries require documented justification and may
require an ADR.

Use API routes when:

- A route must be called outside a form workflow.
- A health, status, or integration-style endpoint is needed.
- A future feature explicitly requires a programmatic HTTP boundary.

API routes should define:

- Expected request shape.
- Response shape.
- Error response behavior.
- Authentication and authorization expectations when those features exist.
- Database interaction boundaries.

Changing the default mutation boundary from server actions to API routes should
be documented and may require a new ADR.

## Data-Fetching Conventions

Route-level pages should load the data needed to render the route.

Data-fetching expectations:

- Load durable records on the server.
- Include related records needed by the page in the query.
- Keep feature-specific loading helpers near the feature when the helper is not
  broadly shared.
- Avoid broad client-side fetching for persisted operational data unless a
  workflow requires it.
- Prefer explicit includes/selects over opaque generic repository methods.

App Router pages should compose route data and pass it into feature components.
Feature components should not silently fetch unrelated server state.

## Mutation And Write Flow

The default write flow is:

```text
form input
-> server action
-> Zod validation
-> normalization
-> Prisma write
-> revalidate affected routes
-> redirect to list or detail page
```

Mutation expectations:

- Validate before write.
- Normalize optional values consistently.
- Use transactions when a workflow writes multiple dependent records.
- Keep writes scoped to one coherent user action.
- Redirect after successful persistence.
- Return structured errors on validation failure.
- Avoid optimistic persistence for operational records until the need is clear.

## Validation Boundaries

Validation belongs at the server-side mutation boundary.

Feature validation should live near the feature, usually in:

```text
src/features/<feature-name>/validation.ts
```

Validation should cover:

- Required fields.
- Enum values.
- Optional field normalization.
- Length limits.
- Nested or repeated form rows.
- Cross-field rules when needed.

Database constraints are still necessary, but they should not be the only
validation mechanism for user-facing workflows.

## Loading, Error, And Empty-State Expectations

UI state expectations live in `docs/ui-architecture.md`; this section defines
the data-flow expectations behind those states.

Loading states should represent a pending data load or pending mutation.

Error states should distinguish:

- Validation errors that the user can correct.
- Not-found records.
- Recoverable route-level failures.
- Runtime or infrastructure failures.

Empty states should be shown when a query succeeds but returns no records.

Do not use an error state for a valid empty result.

## Refresh And Revalidation Strategy

After a successful mutation, affected routes should be revalidated deliberately.

Revalidation expectations:

- Revalidate list pages that display the changed records.
- Revalidate detail pages for updated records.
- Revalidate dashboard or summary pages when they depend on changed data.
- Redirect after successful writes so the user lands on durable server state.

Avoid broad revalidation when a narrower route is enough. Avoid relying on stale
client state after a write.

## When Not To Introduce Global State

Do not introduce a global client state layer for:

- Persisted database records.
- Basic form editing.
- Route navigation.
- Simple filters.
- One-screen UI toggles.
- Data that can be loaded directly by the route.

Global state may be considered later if there is a confirmed cross-route
interaction need that cannot be handled cleanly by routes, server-loaded data,
or local component state.

Examples that might justify future evaluation:

- Cross-module Day View coordination.
- Global search interaction state.
- Auth/session UI after authentication is introduced.
- Complex notification or background job state.

Any durable global state decision should be documented and may require an ADR.

## Operational Module Pattern

Future modules should follow the same state/data-flow pattern:

1. Load persisted records on the server.
2. Keep temporary interaction state local.
3. Submit mutations through explicit server actions unless another boundary is
   approved.
4. Validate through feature-owned Zod schemas.
5. Write through Prisma.
6. Revalidate affected routes.
7. Redirect to durable server-rendered state.
8. Verify the workflow according to `docs/testing-strategy.md`.

Implemented modules including Work Schedule, Timesheet, Operational Safety
Checklists, and Equipment Fuel Events follow this pattern. Equipment Fuel
Events use server-rendered reads, feature-owned queries, Server Actions for
mutations, transactional aggregate persistence, and limited client interaction
state. Validation, derived totals, and historical snapshots remain
server-authoritative. Day View loads Operational Safety Checklist and Equipment
Fuel Event display summaries through explicit feature-owned selected-date
queries in the existing parallel server composition; it owns no mutation or
domain interpretation for either feature. Supply Requests and other future
operational modules should follow the established pattern unless their
requirements justify a different one.

The implemented Operational Safety Checklist enhancement preserves this flow.
Meter defaults are client interaction hints; the submitted `HOURS`/`MILES`
unit, integer reading, and transient mismatch confirmation are server-validated.
Save confirmation uses a short-lived signed Post/Redirect/Get marker verified
against checklist ID and monotonic persisted `recordVersion` before
server-rendered detail, with narrow client state only for URL consumption and
BFCache hiding. After persistence commits, marker or route-revalidation failure
falls back to bare saved detail rather than converting a successful mutation
into an error. Future photo actions remain checklist-owned and
separate from completed checklist creation. Filesystem placement and Prisma
metadata cannot share one transaction, so photo actions require staging,
atomic same-volume moves, database transactions, and explicit compensation;
ADR-018's access gate must fail closed before those actions are enabled.

## What Not To Standardize Yet

Do not standardize these areas until requirements justify them:

- A global client state library.
- Client-side cache synchronization.
- Offline state.
- Optimistic updates for operational records.
- API routes as the default mutation boundary.
- Background job state.
- Real-time subscriptions.
- Auth/session state patterns.
- Global search state.
- Day View cross-module state coordination.

These may become necessary later, but they should not be introduced before the
workflow requires them.

## Open Questions

- What state pattern should Day View use when it combines multiple modules?
- Should global search state live in routes, local state, or a future shared
  state layer?
- What API route conventions will be needed when integrations or exports are
  introduced?
- How should auth/session state be represented when authentication is approved?
