# Architecture Overview

This document is the canonical architecture overview for NAM Dashboard.

Architecture decisions are recorded separately under:

```text
docs/decisions/
```

Use this document to understand the current architecture shape. Use ADRs to
understand why a decision was made, when it was made, and what tradeoffs were
accepted.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This architecture overview reflects approved project direction. |
| Recommended | Future architecture improvements that need approval. |
| Open Question | Architecture topics that are not settled. |

## System Intent

NAM Dashboard is a personal mining operations dashboard designed to preserve a
permanent operational history. The system centers on this question:

> What happened on a given workday, what equipment was involved, what paperwork
> or related records existed, and what historical context surrounds that date?

The application is initially personal-use software, but it should be built with
professional architecture so it can grow into a more complete operational system
later.

The canonical source for product identity, users, business objectives, MVP, and
long-term product direction is `docs/product-vision.md`.

The canonical source for product delivery order, capability priority, deferred
scope, and roadmap governance is `docs/product-roadmap.md`.

The canonical source for delivery lifecycle, milestone design, dependency
handling, and completion flow is `docs/delivery-architecture.md`.

The canonical source for dependency types, dependency principles, and dependency
evolution is `docs/dependency-architecture.md`.

## Architecture Principles

The canonical source for cross-project principles is:

```text
docs/philosophy.md
```

The canonical source for implementation and documentation-graph principles is:

```text
docs/engineering-principles.md
```

The canonical source for Definition of Done, quality gates, ADR criteria, and
implementation workflow is:

```text
docs/engineering-quality-standards.md
```

Architecture-specific principles:

- Prefer simple, durable architecture over premature platform complexity.
- Model the domain relationally because dates, shifts, equipment, mines,
  modules, attachments, and historical records are highly connected.
- Preserve source artifacts where useful, but capture important records as
  structured data.
- Treat Day View, search, equipment links, date ranges, and attachments as
  cross-module capabilities.
- Keep sensitive financial data separated from general operational records.
- Add infrastructure components only when a real requirement justifies them.
- Prefer server-owned persisted data and local UI state by default; detailed
  state and mutation rules live in `docs/application-state-and-data-flow.md`.
- Public HTTP/S traffic should terminate at host-level Caddy; application
  services should not be exposed directly to the public Internet.

## Current Platform Baseline

Confirmed stack:

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- React Hook Form
- Zod
- Vitest
- React Testing Library
- TanStack Table
- ApexCharts
- Metronic UI Template

Confirmed deployment baseline:

- Docker Compose is the standard deployment method.
- PostgreSQL runs in Docker with persistent named storage.
- The application runs in Docker.
- The current development app is published only on `127.0.0.1:3000`.
- Host-level Caddy reverse proxies `dev.alemany.me` to `127.0.0.1:3000` for
  external development access.
- `nam.alemany.me` is reserved for future production use.
- Staging and production deployment remain future work.

## Major Architectural Areas

| Area | Canonical document |
| --- | --- |
| Product vision | `docs/product-vision.md` |
| Product roadmap | `docs/product-roadmap.md` |
| Delivery architecture | `docs/delivery-architecture.md` |
| Dependency architecture | `docs/dependency-architecture.md` |
| Product requirements | `docs/prd.md` |
| Engineering principles | `docs/engineering-principles.md` |
| Engineering quality standards | `docs/engineering-quality-standards.md` |
| Feature architecture | `docs/feature-architecture.md` |
| Application state and data flow | `docs/application-state-and-data-flow.md` |
| UI architecture | `docs/ui-architecture.md` |
| Testing strategy | `docs/testing-strategy.md` |
| Module boundaries and workflows | `docs/modules.md` |
| Data model | `docs/database.md` |
| Architecture overview | `docs/architecture.md` |
| Architecture decisions | `docs/decisions/README.md` |
| Development workflow | `docs/development.md` |
| Infrastructure operations | `docs/infrastructure.md` |
| Infrastructure identity and recovery | `docs/infrastructure/` |
| Implementation roadmap | `docs/roadmap.md` |
| Future ideas | `docs/ideas.md` |

## Architecture Decision Records

The ADR index is:

```text
docs/decisions/README.md
```

Current ADR categories:

- Product and domain architecture
- Data architecture
- Application architecture
- Infrastructure and deployment
- Repository operations

New durable architecture decisions should be added as new ADR files under
`docs/decisions/` using `docs/decisions/template.md`.

## Recommended Future Architecture Map

Recommended: Keep `docs/architecture.md` as the architecture overview for now.
Do not create `docs/architecture/` yet because the current repository does not
need another nested documentation layer.

If architecture material grows substantially, migrate to:

```text
docs/architecture/
  README.md
  principles.md
  runtime.md
  data-flow.md
  diagrams/
```

Advantages:

- Better separation of runtime, data, security, and deployment architecture.
- More room for diagrams and subsystem-specific architecture notes.
- Easier navigation once the system has many implemented subsystems.

Disadvantages:

- More files to maintain before the project needs them.
- Higher risk of duplicate architecture statements.
- Requires migrating existing links from `docs/architecture.md`.

Current decision: defer this migration until architecture content outgrows a
single overview document.

## Open Questions

- Security architecture for authentication, authorization, financial data, and
  attachment access still needs deeper design.
- Testing strategy and quality gates are defined in `docs/testing-strategy.md`.
- Engineering quality process and Definition of Done are defined in
  `docs/engineering-quality-standards.md`.
- Application state and data-flow standards are defined in
  `docs/application-state-and-data-flow.md`.
- UI architecture and design-system standards are defined in
  `docs/ui-architecture.md`.
