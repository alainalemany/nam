# Delivery Architecture

This document is the canonical home for NAM Dashboard delivery architecture.

It defines how planned product capabilities move from product roadmap intent to
implemented, verified, documented, and completed software.

It does not define product scope, detailed requirements, module behavior,
database schema, dependency architecture, code organization, test policy,
executable commands, or release operations. Those belong in their own canonical
documents.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This delivery architecture is approved project direction. |
| Recommended | Suggested delivery improvements that still need approval. |
| Open Question | Delivery topics that need future definition. |

## Purpose

Delivery architecture connects product planning to implementation.

It should answer:

- How does work move from Product Roadmap to implementation?
- What lifecycle should every feature follow?
- What makes an engineering milestone well-shaped?
- How should dependencies affect delivery order?
- How is completion determined?
- How does current delivery architecture relate to future implementation
  architecture?

## Relationship To Other Documentation

| Document | Relationship |
| --- | --- |
| `docs/product-vision.md` | Defines product identity, users, MVP, and long-term direction. |
| `docs/product-roadmap.md` | Defines product delivery order, priority, deferred scope, and roadmap governance. |
| `docs/delivery-architecture.md` | Defines how planned work becomes completed software. |
| `docs/dependency-architecture.md` | Defines dependency types, dependency principles, and dependency evolution. |
| `docs/prd.md` | Defines confirmed product requirements and Version 1 scope details. |
| `docs/modules.md` | Defines module workflows, capabilities, and boundaries. |
| `docs/database.md` | Defines entities, relationships, enums, and data rules. |
| `docs/roadmap.md` | Defines module-by-module implementation sequencing. |
| `docs/feature-architecture.md` | Defines how approved feature slices are organized in code. |
| `docs/architecture/features/README.md` | Defines the convention for Level 2 feature implementation architecture documents. |
| `docs/engineering-workflow.md` | Captures the proven feature delivery workflow from roadmap selection through capability assessment and closure. |
| `docs/application-state-and-data-flow.md` | Defines state ownership, mutation flow, validation boundaries, and revalidation. |
| `docs/ui-architecture.md` | Defines screen composition, UI states, and design-system standards. |
| `docs/testing-strategy.md` | Defines testing layers and verification expectations. |
| `docs/engineering-quality-standards.md` | Defines Definition of Done, quality gates, ADR criteria, and handoff expectations. |
| `docs/development.md` | Defines executable local commands. |

## Delivery Principles

### Product Intent Comes First

Delivery should start from confirmed product direction. Product identity and MVP
scope come from `docs/product-vision.md`; product priority and deferred scope
come from `docs/product-roadmap.md`; detailed requirements come from
`docs/prd.md`.

### Deliver In Small Vertical Slices

Milestones should produce coherent, reviewable increments. A feature slice
should include the minimum product behavior, data changes, validation, UI,
documentation, and verification needed for that increment to stand on its own.

Feature implementation structure lives in `docs/feature-architecture.md`.

### Completion Requires Evidence

A milestone is complete only when the implemented behavior is verified at the
appropriate level and the relevant documentation remains consistent.

Definition of Done lives in `docs/engineering-quality-standards.md`. Test
policy lives in `docs/testing-strategy.md`. Executable commands live in
`docs/development.md`. The proven feature delivery workflow lives in
`docs/engineering-workflow.md`.

### Dependencies Shape Delivery, Not Product Value

Product priority describes why a capability matters. Dependencies describe what
must exist before the capability can be implemented safely.

A high-value feature can wait if its parent workflow, data model, reference
records, or verification foundation is not ready.

### Avoid Premature Delivery Infrastructure

Delivery process should stay lightweight until the project needs more structure.
Do not add project-management systems, release trains, branching complexity, or
automation layers before they solve a real coordination problem.

## Delivery Lifecycle

Every feature or milestone should move through this lifecycle:

```text
Product roadmap intent
-> delivery shaping
-> requirement and dependency check
-> implementation plan
-> vertical-slice implementation
-> verification
-> documentation alignment
-> completion handoff
```

The operational workflow proven by Daily Work Logs, STOP Cards, and Daily
Inspections is captured in `docs/engineering-workflow.md`.

### 1. Product Roadmap Intent

Start with a planned capability, deferred capability, or candidate future item
from `docs/product-roadmap.md`.

Before delivery begins, confirm:

- The capability is approved for the current milestone.
- The capability is not still only an unapproved idea.
- The milestone does not quietly promote deferred scope.

### 2. Delivery Shaping

Define the smallest useful increment.

The delivery shape should identify:

- Product outcome.
- User-facing workflow.
- Primary module or feature owner.
- Expected data model impact.
- Expected UI surface.
- Required validation and mutation boundaries.
- Expected verification level.
- Documentation that may need updates.

If the feature is complex enough to need durable implementation architecture
guidance, use `docs/architecture/features/README.md` before creating a
feature-specific architecture document.

### 3. Requirement And Dependency Check

Before implementation, inspect the relevant canonical documents:

- Product requirements in `docs/prd.md`.
- Module behavior in `docs/modules.md`.
- Data rules in `docs/database.md`.
- Implementation phases in `docs/roadmap.md`.
- Feature, state, UI, testing, and quality standards.

If a requirement, dependency, or architecture boundary is unclear, resolve that
uncertainty before building on it.

If confirmed operational evidence invalidates the premise of a planned
capability, correct the canonical roadmap and supersede the affected ADR before
architecture or implementation continues. Do not preserve a duplicate module
merely because it appeared in an earlier plan.

### 4. Implementation Plan

Implementation plans should be narrow and concrete.

They should name:

- Files or feature areas likely to change.
- Schema and migration impact, if any.
- Server action, API route, validation, or state-flow impact.
- UI workflow impact.
- Tests and verification commands.
- Documentation updates.
- Known exclusions.

### 5. Vertical-Slice Implementation

Implementation should follow the existing feature architecture and current
application patterns.

For feature work, that usually means moving through:

- Data model and migration, when needed.
- Validation.
- Server action or approved mutation boundary.
- Route and UI workflow.
- Feature-specific tests.
- Documentation alignment.

The detailed standards for this work live in `docs/feature-architecture.md`,
`docs/application-state-and-data-flow.md`, `docs/ui-architecture.md`, and
`docs/testing-strategy.md`.

### 6. Verification

Verification should match the risk and scope of the change.

Use `docs/testing-strategy.md` for test-layer expectations,
`docs/engineering-quality-standards.md` for quality gates, and
`docs/development.md` for commands.

### 7. Documentation Alignment

Documentation should be updated only in the relevant canonical homes.

Examples:

- Product identity or MVP changes belong in `docs/product-vision.md`.
- Product sequencing changes belong in `docs/product-roadmap.md`.
- Requirements belong in `docs/prd.md`.
- Module behavior belongs in `docs/modules.md`.
- Data rules belong in `docs/database.md`.
- Implementation sequencing belongs in `docs/roadmap.md`.
- Durable architecture decisions belong in `docs/decisions/`.

### 8. Completion Handoff

A milestone handoff should summarize:

- What was delivered.
- Files changed.
- Documentation updated.
- Verification commands and results.
- Known risks or follow-ups.
- Any scope intentionally left out.

## Milestone Design

A good engineering milestone is:

- Small enough to review.
- Valuable enough to use or validate.
- Explicit about what is in scope.
- Explicit about what is out of scope.
- Connected to a product roadmap phase.
- Aligned with module, data, UI, state, testing, and quality standards.
- Verifiable without relying on chat history.

Avoid milestones that:

- Only create empty scaffolding.
- Mix unrelated product, infrastructure, and refactoring work.
- Combine broad documentation rewrites with application behavior changes unless
  that is the approved objective.
- Depend on unapproved candidate future ideas.
- Treat implementation convenience as product priority.

Milestones may be documentation-only, infrastructure-only, testing-only, or
application feature slices. The milestone type should be clear before work
begins.

When one enhancement mixes an ordinary application/schema change with a new
security or infrastructure boundary, split delivery at that dependency. Phase
23.3 applies this rule to Operational Safety Checklists: explicit meter units
and NAM save confirmation form one implementation-ready slice, while photo
metadata, media processing, persistent storage, private serving, and backup
form a later access-gated slice under ADR-018. Do not pull the blocked media
dependency into the meter milestone or enable real photo use merely because its
domain architecture is approved.

## Dependency Considerations

Dependencies should be identified before implementation begins.

Dependency concepts and dependency-management principles live in
`docs/dependency-architecture.md`.

Common dependency types:

| Dependency type | Example |
| --- | --- |
| Product dependency | Work Authorizations depend on the Shift Report context where the work occurred. |
| Data dependency | Daily Log activities depend on mine and equipment reference data for useful linking. |
| UI dependency | Day View depends on date-aware records before it can show meaningful history. |
| State-flow dependency | Form workflows need validation and mutation boundaries before persistence. |
| Verification dependency | Risky persistence or workflow changes need tests or smoke checks before completion. |
| Infrastructure dependency | Public traffic and runtime checks depend on documented Docker and Caddy boundaries. |

Dependency decisions should not create broad scaffolding by default. Build the
dependency only when it is needed for an approved milestone.

## Verification Before Completion

Completion requires verification evidence.

Use the right verification source:

- `docs/testing-strategy.md` for which test layers matter.
- `docs/engineering-quality-standards.md` for Definition of Done and quality
  gates.
- `docs/development.md` for executable commands.
- `docs/infrastructure.md` for infrastructure checks and operating procedures.

If verification cannot be run, or if it fails, the handoff should say so
plainly with the command, result, and likely cause.

## Relationship To Future Implementation Architecture

Delivery architecture defines the lifecycle for turning planned capabilities
into completed software.

Implementation architecture would describe the internal technical structure of
the application at a deeper level than the current overview documents.

Current decision:

- Keep delivery architecture in this document.
- Keep implementation standards in `docs/feature-architecture.md`,
  `docs/application-state-and-data-flow.md`, and `docs/ui-architecture.md`.
- Keep the current architecture overview in `docs/architecture.md`.
- Do not create a broader implementation architecture document until the codebase
  needs a deeper technical map.

If future implementation architecture is created, it should not replace this
document. It should answer how the implemented system is structured, while this
document continues to answer how work moves from roadmap intent to completed
software.
