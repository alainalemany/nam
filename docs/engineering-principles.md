# Engineering Principles

This document is the canonical home for enduring NAM Dashboard engineering
principles.

It does not replace architecture decision records, product requirements,
runbooks, or module documentation. It explains the engineering defaults that
should guide implementation when a more specific document does not decide the
question.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | These engineering principles are approved project direction. |
| Recommended | Suggested engineering improvements that still need approval. |
| Open Question | Engineering areas that need future definition. |

## Documentation Graph Fit

This document fits between:

- `docs/philosophy.md`, which defines stable project-wide principles.
- `docs/product-vision.md`, which defines product identity, users, business
  objectives, MVP, and long-term direction.
- `docs/product-roadmap.md`, which defines product delivery order, priority,
  deferred scope, and roadmap governance.
- `docs/architecture.md`, which describes the current system shape.
- `docs/engineering-quality-standards.md`, which defines Definition of Done,
  quality gates, ADR criteria, and implementation workflow.
- `docs/feature-architecture.md`, which defines feature module implementation
  standards.
- `docs/ui-architecture.md`, which defines UI architecture and design-system
  standards.
- `docs/testing-strategy.md`, which defines test layers and quality gates.
- `docs/development.md`, which describes commands and local workflow.
- `docs/decisions/`, which records durable decisions and their tradeoffs.

A future contributor or AI assistant should discover this document through:

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/ai-context.md`
5. `docs/philosophy.md`
6. `docs/product-vision.md`
7. `docs/product-roadmap.md`
8. This document
9. `docs/engineering-quality-standards.md`
10. `docs/feature-architecture.md`
11. `docs/ui-architecture.md`
12. `docs/testing-strategy.md`
13. `docs/architecture.md`
14. Relevant ADRs, module docs, data docs, operations docs, and source files

Do not create a new documentation file unless its place in this graph and its
discovery path are clear.

## Confirmed Principles

### Documentation Is The Source Of Truth

Implementation should follow confirmed documentation. When code and
documentation disagree, identify the conflict, name the authoritative document,
and update the correct source of truth before building on uncertain assumptions.

Product identity belongs in `docs/product-vision.md`, product roadmap planning
belongs in `docs/product-roadmap.md`, requirements belong in `docs/prd.md`,
module workflows in `docs/modules.md`, data model details in `docs/database.md`,
architecture decisions in `docs/decisions/`, infrastructure procedures in
`docs/infrastructure.md` or `docs/infrastructure/`, and development commands in
`docs/development.md`.

### Preserve The Documentation Graph

Documentation is a curated knowledge graph, not a pile of Markdown files.

Before proposing a new documentation file, answer:

1. Where does this document fit within the repository's documentation graph?
2. How will a future contributor or AI assistant naturally discover it while
   following the normal reading path?

If those answers are unclear, prefer improving an existing document, adding a
focused section to the canonical home, or improving the documentation map.

### Build In Vertical Slices

Feature work should move through narrow, usable vertical slices: data model,
migration, validation, server actions, UI workflow, route integration, and
verification.

Avoid broad scaffolding that creates empty modules or disconnected abstractions
without a confirmed workflow.

Feature slice implementation standards are defined in
`docs/feature-architecture.md`.

### Use Feature-Based Module Organization

Feature-specific implementation belongs near the feature. Current feature
modules live under `src/features/<feature-name>/` and may own actions,
validation, constants, types, forms, and supporting components.

Shared code should move to shared locations only when there is demonstrated
reuse across features.

Concrete module structure and boundary rules live in
`docs/feature-architecture.md`.

### Favor Production Quality Over Prototypes

Even during personal-use development, implemented workflows should be reliable,
validated, and maintainable. Avoid throwaway code paths that will immediately
need replacement before the feature can be trusted.

This does not mean overbuilding. It means small, complete, verified increments.

### Keep Commits Small And Focused

Commits should represent one coherent change: a feature slice, documentation
update, infrastructure milestone, or bug fix.

Do not mix unrelated product, infrastructure, documentation, and refactoring
changes in the same commit unless they are required for one approved objective.

### Prefer Simplicity Before Abstraction

Use the simplest design that satisfies confirmed requirements and leaves a
reasonable path for growth. Add abstractions only when they reduce real
duplication, clarify boundaries, or match an established project pattern.

### Change The Database Through Prisma Migrations

Database schema changes must be represented in `prisma/schema.prisma` and
committed Prisma migrations under `prisma/migrations/`.

Do not rely on unmanaged manual database changes for application behavior.

### Follow The Testing Strategy

Testing expectations are defined in `docs/testing-strategy.md`.

Feature work should include verification appropriate to its risk: focused unit
tests for pure logic, integration coverage for database behavior, E2E coverage
for critical workflows, and smoke checks for runtime infrastructure.

Definition of Done, required verification flow, and quality-gate process live in
`docs/engineering-quality-standards.md`.

### Treat Vendor Frameworks As Toolkits

Vendor UI frameworks, including Metronic, are implementation toolkits. They do
not define the application architecture, domain model, routing strategy, or
state-management model.

The durable decision is recorded in ADR-014.

UI architecture and design-system standards live in `docs/ui-architecture.md`.

### Document Infrastructure Changes

Infrastructure is project knowledge. Host-level configuration, Docker behavior,
Caddy routing, backup conventions, verification steps, and recovery procedures
must be documented when they change.

Repository-owned host configuration examples belong under
`infrastructure/server-config/`. Live secrets, certificates, database dumps, and
generated runtime state do not belong in Git.

### Public Traffic Flows Through Caddy

Public HTTP/S traffic should terminate at host-level Caddy. Application services
must not be exposed directly to the public Internet unless a future architecture
decision explicitly changes this.

The current development app remains bound to `127.0.0.1:3000`, with
`dev.alemany.me` reverse proxied through Caddy. `nam.alemany.me` remains
reserved for future production use.

### AI Assistants Follow AGENTS.md First

AI assistants must follow `AGENTS.md` before proposing implementation changes.
They should read the normal documentation path, classify conclusions, preserve
canonical homes, inspect existing code before editing, and request explicit
approval before system-level changes.

## Open Questions

- What security engineering principles should be added before authentication,
  authorization, public production deployment, or sensitive financial storage?
