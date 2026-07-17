# Dependency Architecture

This document is the canonical home for NAM Dashboard dependency architecture.

It defines the dependency relationships that influence product planning,
delivery shaping, implementation order, documentation flow, and future system
evolution.

It does not define product priority, delivery lifecycle, implementation
structure, Definition of Done, test strategy, or module requirements. Those
belong in their own canonical documents.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This dependency architecture is approved project direction. |
| Recommended | Suggested dependency improvements that still need approval. |
| Open Question | Dependency topics that need future definition. |

## Purpose

Dependency architecture explains what must exist, be understood, or be decided
before another piece of work can be delivered safely.

It should answer:

- What kinds of dependencies exist in the project?
- How should dependencies influence planning and delivery?
- How do product, technical, workflow, and documentation dependencies differ?
- How is dependency different from priority?
- How should dependencies evolve as the project grows?

## Relationship To Other Documentation

| Document | Relationship |
| --- | --- |
| `docs/product-roadmap.md` | Defines product priority, product delivery order, deferred scope, and roadmap governance. |
| `docs/dependency-architecture.md` | Defines dependency concepts and dependency-management principles. |
| `docs/delivery-architecture.md` | Defines delivery lifecycle, milestone design, and completion flow. |
| `docs/prd.md` | Defines confirmed product requirements and Version 1 scope details. |
| `docs/modules.md` | Defines module workflows, boundaries, and capability relationships. |
| `docs/database.md` | Defines entity, relationship, enum, and data-rule dependencies. |
| `docs/roadmap.md` | Defines module-by-module implementation sequencing. |
| `docs/feature-architecture.md` | Defines feature implementation structure once dependencies are understood. |
| `docs/architecture/features/README.md` | Defines where feature-specific implementation architecture documents live and how they are structured. |
| `docs/engineering-quality-standards.md` | Defines Definition of Done and quality gates. |
| `docs/decisions/` | Records durable architecture decisions when dependency choices have long-term consequences. |

## Dependency Principles

### Dependency Is Not Priority

Priority explains why a capability matters. Dependency explains what must exist
first for the capability to be delivered safely.

A capability can be high priority and still wait for a dependency. A dependency
can be low product value by itself but still necessary because it unlocks a
higher-value workflow.

### Dependencies Should Be Explicit

Delivery planning should identify dependencies before implementation begins.

If a dependency is unclear, the milestone should either resolve it directly or
exclude the dependent work from scope.

### Build Dependencies Only When Needed

Do not build broad scaffolding only because a future feature might need it.

Dependencies should be implemented when they unlock an approved milestone,
reduce immediate risk, or clarify a confirmed workflow.

### Prefer Vertical Dependency Resolution

When possible, resolve dependencies inside a narrow vertical slice instead of
creating disconnected foundation work.

For example, a feature should add the specific validation, route, data, and UI
support it needs instead of creating generic layers for imagined future modules.

### Documentation Dependencies Matter

Some work is blocked by missing documentation, unclear authority, or conflicting
canonical sources. These are real dependencies because they can cause
implementation drift.

## Product Dependencies

Product dependencies describe relationships between product capabilities,
workflow concepts, or user outcomes.

Examples:

| Dependency | Meaning |
| --- | --- |
| Daily Log depends on mine and equipment context | Workday records are more useful when they can link to operational reference data. |
| Work Authorizations depend on Shift Reports | A Work Authorization should belong to the shift where the work occurred. |
| Day View depends on date-aware records | Day View becomes useful only when modules expose records that can be grouped by date. |
| Search depends on meaningful structured records | Search is valuable after modules produce reliable records to search. |

Product dependency questions should be answered with:

- `docs/product-roadmap.md` for product priority and sequencing.
- `docs/prd.md` for confirmed requirements.
- `docs/modules.md` for workflow and module relationships.

## Technical Dependencies

Technical dependencies describe implementation prerequisites or system
relationships.

Examples:

| Dependency | Meaning |
| --- | --- |
| Persistence depends on Prisma schema and migrations | Database-backed behavior must be represented in schema and committed migrations. |
| Form writes depend on validation and mutation boundaries | Persisted user input needs server-side validation and a documented write path. |
| Public development access depends on Caddy routing | The current synthetic-data development endpoint uses host-level Caddy, not direct application exposure; it is not approved for real pilot data. |
| Real operational use depends on pilot authorization gates | ADR-019 approves a managed private overlay, but its implementation and verification, current deployment, reviewed reference data, current-schema disposable restore, and pilot scope must all pass before real pilot entry. See `docs/infrastructure/operational-pilot-runbook.md`. |
| Checklist photo evidence depends on private access and media operations | Real photo use requires ADR-018's authentication/authorization or approved deny-by-default access boundary, proven HEIC/HEIF processing, persistent private storage, cleanup, and matched database/media recovery. |
| Runtime confidence depends on verification commands | Build, test, health, and infrastructure checks provide evidence before completion. |

Technical dependency questions should be answered with:

- `docs/architecture.md` for current system shape.
- `docs/database.md` for data model dependencies.
- `docs/application-state-and-data-flow.md` for state, mutation, validation, and
  revalidation dependencies.
- `docs/infrastructure.md` and focused infrastructure docs for runtime
  dependencies.

## Workflow Dependencies

Workflow dependencies describe user-process order and module relationships.

Examples:

| Dependency | Meaning |
| --- | --- |
| A workday record depends on date context | Operational history is organized around dates and shifts. |
| Work Authorization completion depends on required checklist context | Closing safety or maintenance work requires completion evidence. |
| Timesheet reconciliation depends on date and schedule context | Time records become more useful when compared with schedule and workday history. |
| Fuel and Equipment inspection records depend on date and Equipment context | Supporting records need enough context to be useful in history and search. |
| Mid-shift Equipment replacement depends only on workday narrative context | Daily Work Logs can preserve the event without a standalone truck module or Fleet assignment dependency. |

Workflow dependency questions should be answered with:

- `docs/modules.md` for module behavior.
- `docs/prd.md` for confirmed requirements.
- `docs/product-roadmap.md` for product sequencing.
- `docs/delivery-architecture.md` for milestone shaping.

## Documentation Dependencies

Documentation dependencies describe required knowledge flow before work can be
planned or implemented safely.

Examples:

| Dependency | Meaning |
| --- | --- |
| New docs depend on graph placement | A new document should not exist unless future readers can discover it naturally. |
| Feature architecture docs depend on the Level 2 convention | Feature-specific implementation architecture documents should follow `docs/architecture/features/README.md`. |
| Feature work depends on confirmed scope | Implementation should follow approved requirements rather than chat-only ideas. |
| Architecture changes depend on ADR review | Durable cross-cutting decisions may require an ADR before implementation. |
| Verification changes depend on testing and development docs | Test policy and executable commands have separate canonical homes. |

Documentation dependency questions should be answered with:

- `AGENTS.md` for AI collaboration rules.
- `docs/README.md` for canonical homes and documentation graph.
- `docs/ai-context.md` for reading order.
- `docs/engineering-principles.md` for documentation graph discipline.
- `docs/engineering-quality-standards.md` for Definition of Done and ADR
  criteria.

## Dependency Evolution

Dependency architecture should evolve as the project grows, but it should remain
conceptual and practical.

Current approach:

- Keep dependency concepts in this document.
- Keep product sequencing in `docs/product-roadmap.md`.
- Keep delivery lifecycle in `docs/delivery-architecture.md`.
- Keep implementation sequencing in `docs/roadmap.md`.
- Keep detailed module relationships in `docs/modules.md`.
- Keep database relationships in `docs/database.md`.

Future dependency documentation may be useful when:

- Cross-module relationships become too complex to understand from prose.
- Multiple modules depend on the same shared workflow.
- Security, authorization, or attachment access introduces cross-cutting
  dependency rules.
- Release, CI, or production deployment introduces dependency gates.

Do not create large static diagrams or dependency catalogs until they answer a
real maintenance question better than the current documents.
