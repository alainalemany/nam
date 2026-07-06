# Feature Architecture

This document is the canonical implementation standard for NAM Dashboard
feature modules.

It explains how confirmed product modules become implemented vertical slices in
the Next.js application. It does not define product scope, data entities, test
policy, or local commands. Those belong in their own canonical documents.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | These feature architecture standards are approved project direction. |
| Recommended | Suggested feature architecture improvements that still need approval. |
| Open Question | Feature implementation areas that need future decisions. |

## Documentation Graph Fit

Feature architecture sits in this path:

```text
docs/philosophy.md
-> docs/engineering-principles.md
-> docs/feature-architecture.md
-> docs/application-state-and-data-flow.md
-> docs/development.md
-> implementation files
```

Related authorities:

- Product requirements live in `docs/prd.md`.
- Module workflows and capabilities live in `docs/modules.md`.
- Data entities, relationships, enums, and data rules live in
  `docs/database.md`.
- Architecture overview lives in `docs/architecture.md`.
- Durable architecture decisions live in `docs/decisions/`.
- Application state, mutation boundaries, validation boundaries, and
  revalidation strategy live in `docs/application-state-and-data-flow.md`.
- UI architecture and design-system standards live in `docs/ui-architecture.md`.
- Testing strategy lives in `docs/testing-strategy.md`.
- Development commands live in `docs/development.md`.

Do not create a new feature architecture document unless its graph location and
discovery path are clear.

## Purpose

The purpose of feature architecture is to make implementation predictable as
the repository grows.

Each feature should have clear ownership for:

- Routes and pages.
- Server actions.
- Validation.
- Data loading helpers.
- Forms and feature-specific components.
- Constants, types, and formatting helpers.
- Tests when testing tools are added.
- Documentation updates required by the feature.

## Source Of Truth Boundaries

Use the right document for the right question:

| Question | Source |
| --- | --- |
| What should the product do? | `docs/prd.md` |
| How should a module work? | `docs/modules.md` |
| What data should exist? | `docs/database.md` |
| Why was a durable architecture choice made? | `docs/decisions/` |
| How should feature code be organized? | `docs/feature-architecture.md` |
| How should state and mutations flow? | `docs/application-state-and-data-flow.md` |
| How should screens look and behave? | `docs/ui-architecture.md` |
| How should tests be layered? | `docs/testing-strategy.md` |
| Which commands should be run? | `docs/development.md` |

Feature architecture should reference these documents instead of duplicating
their contents.

## Feature-Based Module Structure

Feature-specific source code should live under:

```text
src/features/<feature-name>/
```

Current examples:

```text
src/features/equipment/
src/features/daily-logs/
```

Feature folders may own:

- `actions.ts` for server actions.
- `validation.ts` for Zod schemas and form state types.
- `constants.ts` for feature-specific option lists.
- `types.ts` for feature-specific TypeScript types.
- Data loading helpers when they are not generic shared infrastructure.
- Feature-specific forms and components.

Do not move code into shared locations only because a second feature might need
it later. Move code to shared locations when reuse is real and the shared
boundary is clear.

## App Router Responsibilities

Routes live under:

```text
src/app/
```

App Router files should own route composition:

- Page-level data loading.
- Calling feature data helpers.
- Selecting the right feature component.
- Route-level loading and error states.
- Route metadata when needed.

App Router files should avoid owning feature business rules. Validation,
normalization, persistence workflow, and reusable form behavior should live in
the relevant feature module.

## Feature Folder Responsibilities

Feature folders should own the behavior that is specific to that feature:

- Creating and editing records for that feature.
- Feature-specific validation and field normalization.
- Feature-specific forms.
- Mapping database records into view or form shapes.
- Constants and labels that belong to the feature.
- Feature-specific UI states.

Feature folders should not become dumping grounds for unrelated shared logic.

## Server Actions

Server actions are the current mutation boundary for implemented feature
workflows.

State ownership, mutation flow, validation boundaries, and revalidation
expectations are defined in `docs/application-state-and-data-flow.md`.

Server actions should:

- Parse and validate form input.
- Normalize optional values.
- Use Prisma through project-owned helpers such as `src/lib/prisma.ts`.
- Persist one coherent workflow.
- Return structured form errors when validation fails.
- Redirect only after successful mutation.
- Revalidate affected routes intentionally.

Server actions should not silently accept invalid data or rely on client-side
validation alone.

If a future feature requires public API endpoints instead of server actions,
that should be documented in the feature plan and may require an ADR if it
changes the standard mutation boundary.

## Validation

Zod is the current validation standard for feature forms.

Validation should live near the feature:

```text
src/features/<feature-name>/validation.ts
```

Validation schemas should define:

- Required fields.
- Optional field normalization.
- Length limits.
- Enum values.
- Form state and field error types when needed.

Client-side ergonomics are useful, but server-side validation is required for
all persisted records.

## Data Access And Prisma

Prisma is the persistence layer. Database schema changes belong in:

```text
prisma/schema.prisma
prisma/migrations/
```

Feature implementation should:

- Use existing relations instead of duplicating data as text.
- Preserve date, equipment, mine, and module relationships as first-class data.
- Keep database changes aligned with `docs/database.md`.
- Commit Prisma migrations with schema changes.
- Avoid unmanaged manual database changes.

Feature-specific data loading helpers may live in the feature folder when they
serve that feature's pages or forms. Broad shared data access should be created
only when a real cross-feature need exists.

## Forms And UI Components

Feature forms should live near the feature unless they become genuinely shared.

Current pattern:

```text
src/features/<feature-name>/<FeatureName>Form.tsx
```

Forms should:

- Use server actions for persistence.
- Display field-level validation errors.
- Preserve user-entered values where practical.
- Keep workflow controls focused on the feature's confirmed scope.
- Avoid introducing future module controls before those modules are approved.

Vendor UI frameworks, including Metronic, are toolkits rather than application
architecture. ADR-014 defines that boundary.

Screen composition, form UX, responsive behavior, and design-system standards
are defined in `docs/ui-architecture.md`.

## Constants, Types, And Formatting Helpers

Feature-specific constants, labels, and simple formatting helpers may live in
the feature folder.

Use shared locations only when:

- Multiple implemented features use the same concept.
- The shared name and responsibility are stable.
- The shared abstraction reduces duplication without hiding domain behavior.

## Cross-Feature Shared Code

Shared code should be conservative.

Good candidates for shared code:

- Prisma client initialization.
- Generic date helpers after multiple features need them.
- Shared UI primitives after repeated use.
- Cross-feature query helpers after a real shared workflow exists.

Poor candidates for early sharing:

- One-feature form components.
- One-feature constants.
- Premature service layers.
- Generic repositories that hide useful Prisma relation behavior.

## Database And Migration Expectations

Feature slices that change the database should include:

- Updated Prisma schema.
- Committed migration.
- Prisma Client generation verification.
- Migration status or migration table verification.
- Documentation updates to `docs/database.md` when the data model is confirmed.

Database changes should be paired with the smallest useful feature workflow
that proves the model is usable.

## Testing Expectations

Testing policy lives in `docs/testing-strategy.md`.

Feature implementation should follow that strategy by choosing verification
appropriate to the change:

- Unit tests for pure validation or helper logic when test tooling exists.
- Integration tests for Prisma/PostgreSQL behavior when persistence behavior is
  important.
- E2E tests for critical user workflows when Playwright is added.
- Smoke tests for Docker, Caddy, health, and database connectivity when runtime
  behavior changes.

Do not add test framework configuration as part of a feature unless that work is
explicitly approved.

## Documentation Expectations For New Features

Each feature slice should update documentation only in the relevant canonical
homes:

- Product behavior: `docs/prd.md`.
- Module workflow or capability: `docs/modules.md`.
- Data model: `docs/database.md`.
- Architecture overview: `docs/architecture.md`.
- Durable decisions: `docs/decisions/`.
- Development commands: `docs/development.md`.
- Testing strategy or quality gates: `docs/testing-strategy.md`.

Avoid documenting feature behavior only in source comments, commit messages, or
chat history.

## Vertical Slice Checklist

Before implementing a new feature slice, confirm:

- The user approved the feature scope.
- Product behavior is confirmed or intentionally limited.
- Module workflow belongs in `docs/modules.md`.
- Data model changes belong in `docs/database.md`.
- Durable decisions are captured in ADRs when needed.
- The route path is clear.
- Feature folder ownership is clear.
- Validation rules are defined.
- Server action behavior is defined.
- State ownership and revalidation behavior follow
  `docs/application-state-and-data-flow.md`.
- Prisma schema and migration needs are understood.
- UI workflow is narrow and usable.
- UI patterns follow `docs/ui-architecture.md`.
- Testing and manual verification expectations are identified.
- Documentation updates have canonical homes.

After implementing a feature slice, verify:

- Prisma Client generation when schema changed.
- Migration status when migrations changed.
- Build success.
- Relevant local health checks.
- Docker and Caddy smoke checks when runtime behavior changed.
- Persistence smoke test for create/edit workflows.
- Documentation graph remains connected.

## What Not To Standardize Yet

Do not standardize these areas until real requirements justify them:

- A generic repository layer over Prisma.
- A formal service layer for every feature.
- Global client-side state management.
- A generic form builder.
- API routes as the default mutation boundary.
- Authentication-aware feature boundaries.
- Attachment handling.
- Day View architecture.
- Global search indexing.
- Analytics infrastructure.
- Metronic component import conventions beyond ADR-014.

These areas may need standards later, but premature structure would make the
current application harder to change.

## Open Questions

- When should repeated feature form patterns become shared UI primitives?
- Should future API routes live beside app routes or under feature-owned
  handlers?
- What conventions should be used for attachment-capable features?
- How should Day View and global search query across feature boundaries?
