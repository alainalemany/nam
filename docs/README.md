# Documentation Index

This is the canonical navigation map for NAM Dashboard documentation.

Start here when deciding where information belongs. The repository should teach
future human contributors and AI assistants how to understand the project without
depending on chat history.

## Where To Start

Human contributors should start with:

1. [Repository Overview](../README.md)
2. [Project Philosophy](philosophy.md)
3. [Product Vision](product-vision.md)
4. [Product Roadmap](product-roadmap.md)
5. [Delivery Architecture](delivery-architecture.md)
6. [Dependency Architecture](dependency-architecture.md)
7. [Engineering Principles](engineering-principles.md)
8. [Engineering Quality Standards](engineering-quality-standards.md)
9. [Engineering Workflow](engineering-workflow.md)
10. [Feature Architecture](feature-architecture.md)
11. [Feature Implementation Architecture Documents](architecture/features/README.md)
12. [Application State And Data Flow](application-state-and-data-flow.md)
13. [UI Architecture](ui-architecture.md)
14. [Testing Strategy](testing-strategy.md)
15. [Product Requirements](prd.md)
16. [Architecture Overview](architecture.md)
17. [Architecture Decision Records](decisions/README.md)
18. The relevant module, data, infrastructure, or implementation document.

AI assistants should start with:

1. [Repository Overview](../README.md)
2. [Agent Guidance](../AGENTS.md)
3. [Documentation Index](README.md)
4. [AI Context Guide](ai-context.md)
5. [Project Philosophy](philosophy.md)
6. [Product Vision](product-vision.md)
7. [Product Roadmap](product-roadmap.md)
8. [Delivery Architecture](delivery-architecture.md)
9. [Dependency Architecture](dependency-architecture.md)
10. [Engineering Principles](engineering-principles.md)
11. [Engineering Quality Standards](engineering-quality-standards.md)
12. [Engineering Workflow](engineering-workflow.md)
13. [Feature Architecture](feature-architecture.md)
14. [Feature Implementation Architecture Documents](architecture/features/README.md)
15. [Application State And Data Flow](application-state-and-data-flow.md)
16. [UI Architecture](ui-architecture.md)
17. [Testing Strategy](testing-strategy.md)
18. [Product Requirements](prd.md)
19. [Architecture Overview](architecture.md)
20. [ADR Index](decisions/README.md)
21. The relevant domain and implementation documents.

The detailed AI reading order is canonical in [AI Context Guide](ai-context.md).

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This documentation structure is approved project direction. |
| Recommended | Suggested future documentation improvements that need approval. |
| Open Question | Documentation ownership that still needs more definition. |

## Documentation Layers

| Layer | Purpose | Canonical location |
| --- | --- | --- |
| 0. Repository entry | What this repository is and where to start. | `README.md` |
| 1. Collaboration rules | How AI assistants and contributors should work here. | `AGENTS.md` |
| 2. Documentation map | Where knowledge lives and which docs are authoritative. | `docs/README.md` |
| 3. AI context | Deterministic reading order and AI handoff rules. | `docs/ai-context.md` |
| 4. Project philosophy | Stable principles that rarely change. | `docs/philosophy.md` |
| 5. Product vision | Product identity, users, business objectives, MVP, and long-term direction. | `docs/product-vision.md` |
| 6. Product roadmap | Product delivery order, priority, deferred scope, and roadmap governance. | `docs/product-roadmap.md` |
| 7. Delivery architecture | Delivery lifecycle, milestone design, dependency handling, and completion flow. | `docs/delivery-architecture.md` |
| 8. Dependency architecture | Dependency types, dependency principles, and dependency evolution. | `docs/dependency-architecture.md` |
| 9. Engineering principles | Enduring implementation and documentation-graph rules. | `docs/engineering-principles.md` |
| 10. Engineering quality standards | Definition of Done, quality gates, ADR criteria, and implementation workflow. | `docs/engineering-quality-standards.md` |
| 11. Engineering workflow | Proven roadmap-to-architecture-to-implementation-to-assessment workflow. | `docs/engineering-workflow.md` |
| 12. Feature architecture | Feature module implementation standards and vertical-slice checklist. | `docs/feature-architecture.md` |
| 13. Feature implementation architecture documents | Level 2 feature-specific architecture document convention. | `docs/architecture/features/README.md` |
| 14. Application state and data flow | Server/client state, mutation boundaries, validation, and revalidation. | `docs/application-state-and-data-flow.md` |
| 15. UI architecture | Screen composition, design-system standards, and UI states. | `docs/ui-architecture.md` |
| 16. Testing strategy | Test layers, quality gates, and verification expectations. | `docs/testing-strategy.md` |
| 17. Product definition | Confirmed product requirements and scope. | `docs/prd.md` |
| 18. Architecture overview | Current architecture shape and boundaries. | `docs/architecture.md` |
| 19. Architecture decisions | Durable decisions with context and consequences. | `docs/decisions/` |
| 20. Domain modules | Module workflows, boundaries, and capabilities. | `docs/modules.md` |
| 21. Data model | Entities, fields, relationships, and enums. | `docs/database.md` |
| 22. Operations | Development, infrastructure, recovery, and runbooks. | `docs/development.md`, `docs/infrastructure.md`, `docs/infrastructure/` |
| 23. Planning | Implementation roadmap and future ideas. | `docs/roadmap.md`, `docs/ideas.md` |
| 24. Implementation | Source code, configuration, assets, and scripts. | `src/`, `prisma/`, `infrastructure/`, `public/` |

## Documentation Map

| Need | Start here |
| --- | --- |
| Understand the project quickly | [README](../README.md) |
| Understand documentation ownership | [Documentation Index](README.md) |
| Understand stable principles | [Project Philosophy](philosophy.md) |
| Understand product vision | [Product Vision](product-vision.md) |
| Understand product roadmap | [Product Roadmap](product-roadmap.md) |
| Understand delivery architecture | [Delivery Architecture](delivery-architecture.md) |
| Understand dependency architecture | [Dependency Architecture](dependency-architecture.md) |
| Understand engineering principles | [Engineering Principles](engineering-principles.md) |
| Understand engineering quality standards | [Engineering Quality Standards](engineering-quality-standards.md) |
| Understand proven feature delivery workflow | [Engineering Workflow](engineering-workflow.md) |
| Understand feature architecture | [Feature Architecture](feature-architecture.md) |
| Understand feature-specific architecture document conventions | [Feature Implementation Architecture Documents](architecture/features/README.md) |
| Understand application state and data flow | [Application State And Data Flow](application-state-and-data-flow.md) |
| Understand UI architecture | [UI Architecture](ui-architecture.md) |
| Understand testing strategy | [Testing Strategy](testing-strategy.md) |
| Run tests and local quality gates | [Development Guide](development.md) |
| Understand AI context flow | [AI Context Guide](ai-context.md) |
| Understand product scope | [Product Requirements](prd.md) |
| Understand module behavior | [Modules](modules.md) |
| Understand entities and relationships | [Database Design](database.md) |
| Understand current architecture | [Architecture Overview](architecture.md) |
| Understand Equipment Operations boundaries | [Equipment Operations Architecture Assessment](architecture/equipment-operations.md) |
| Understand Equipment Fuel Events architecture | [Equipment Fuel Events Architecture](architecture/features/equipment-fuel-events.md) |
| Review source-derived reference catalogs | [Reference Catalogs](reference/README.md) |
| Understand why decisions were made | [ADR Index](decisions/README.md) |
| Run the application foundation | [Development Guide](development.md) |
| Operate infrastructure | [Infrastructure Operations](infrastructure.md) |
| Understand server identity | [Server Environment Identity](infrastructure/server-environment.md) |
| Understand bootstrap and verification | [Bootstrap And Verification](infrastructure/bootstrap-and-verification.md) |
| Understand recovery | [Disaster Recovery](infrastructure/disaster-recovery.md) |
| Understand implementation phases | [Implementation Roadmap](roadmap.md) |
| Review unapproved future concepts | [Ideas Backlog](ideas.md) |
| Follow documentation formatting rules | [Documentation Style Guide](documentation-style.md) |

## Authoritative Sources

Every important topic should have one canonical home. Other documents may link
to that home but should not restate the same policy in detail.

| Topic | Canonical home |
| --- | --- |
| Product identity, users, business objectives, MVP, and long-term vision | `docs/product-vision.md` |
| Product delivery order, priority, deferred scope, and roadmap governance | `docs/product-roadmap.md` |
| Delivery lifecycle, milestone design, dependency handling, and completion flow | `docs/delivery-architecture.md` |
| Dependency types, dependency principles, and dependency evolution | `docs/dependency-architecture.md` |
| Repository identity and quick overview | `README.md` |
| Documentation philosophy | `docs/philosophy.md` |
| AI collaboration philosophy | `AGENTS.md`, context flow in `docs/ai-context.md` |
| Engineering principles | `docs/engineering-principles.md` |
| Engineering quality standards and Definition of Done | `docs/engineering-quality-standards.md` |
| Proven feature delivery workflow and capability assessment process | `docs/engineering-workflow.md` |
| Feature architecture and module implementation standards | `docs/feature-architecture.md` |
| Feature-specific implementation architecture document convention | `docs/architecture/features/README.md` |
| Application state and data flow | `docs/application-state-and-data-flow.md` |
| UI architecture and design-system standards | `docs/ui-architecture.md` |
| Testing strategy | `docs/testing-strategy.md` |
| Product requirements | `docs/prd.md` |
| Version 1 scope | `docs/prd.md` |
| Module definitions | `docs/modules.md` |
| Database philosophy and entities | `docs/database.md` |
| Source-derived field, item, ordering, and response catalogs | `docs/reference/` |
| Architecture philosophy | `docs/architecture.md`, principles in `docs/philosophy.md` |
| Architecture decisions | `docs/decisions/` |
| Infrastructure philosophy | `docs/infrastructure.md`, durable decisions in `docs/decisions/` |
| Environment identity | `docs/infrastructure/server-environment.md` |
| Deployment philosophy | `docs/architecture.md`, deployment operations in `docs/infrastructure.md` |
| Recovery philosophy | `docs/infrastructure/disaster-recovery.md` |
| Development workflow | `docs/development.md` |
| Coding and implementation philosophy | `docs/engineering-principles.md`; implementation details belong near code |
| Testing philosophy and quality gates | `docs/testing-strategy.md` |
| Test commands and local workflow | `docs/development.md` |
| UI philosophy and design-system standards | `docs/ui-architecture.md`; product UX goals remain in `docs/prd.md` |
| Documentation style | `docs/documentation-style.md` |
| Documentation graph rules | `docs/engineering-principles.md`, navigation details in `docs/README.md` |
| Future ideas | `docs/ideas.md` |
| Product roadmap and capability priority | `docs/product-roadmap.md` |
| Implementation roadmap and module phases | `docs/roadmap.md` |

## Where Should New Information Go?

| Information type | Destination |
| --- | --- |
| Product identity, business objective, product principle, or MVP scope | `docs/product-vision.md` |
| Product delivery priority, product roadmap phase, or deferred capability | `docs/product-roadmap.md` |
| Delivery lifecycle, milestone design, or dependency planning | `docs/delivery-architecture.md` |
| Dependency type, dependency principle, or dependency-management rule | `docs/dependency-architecture.md` |
| Confirmed product requirement | `docs/prd.md` |
| Module workflow, capability, or boundary | `docs/modules.md` |
| Entity, field, relationship, enum, or data rule | `docs/database.md` |
| Durable architecture decision | New ADR in `docs/decisions/` |
| Architecture overview update | `docs/architecture.md` |
| Infrastructure runbook or operating procedure | `docs/infrastructure.md` or a focused file under `docs/infrastructure/` |
| Development command or local workflow | `docs/development.md` |
| Implementation roadmap phase or milestone | `docs/roadmap.md` |
| Unapproved idea or future possibility | `docs/ideas.md` |
| Source form or reference artifact | `source-forms/` or `docs/assets/` |
| AI operating rule | `AGENTS.md`; reading-order support in `docs/ai-context.md` |
| Engineering principle or implementation default | `docs/engineering-principles.md` |
| Engineering quality process, Definition of Done, or ADR criteria | `docs/engineering-quality-standards.md` |
| Proven feature delivery workflow or capability assessment process | `docs/engineering-workflow.md` |
| Feature architecture or module implementation standard | `docs/feature-architecture.md` |
| Feature-specific implementation architecture document convention | `docs/architecture/features/README.md` |
| Application state, data-flow rule, or mutation boundary | `docs/application-state-and-data-flow.md` |
| UI architecture, design-system standard, or screen pattern | `docs/ui-architecture.md` |
| Testing strategy, test layer, or quality gate | `docs/testing-strategy.md` |
| Test command or local quality-gate workflow | `docs/development.md` |

## Navigation Rules

- Prefer links to canonical documents over copying policy text.
- Keep each document responsible for one kind of knowledge.
- Before creating a new documentation file, identify its documentation-graph
  location and normal discovery path.
- If two documents disagree, update the non-authoritative copy to reference the
  authoritative source.
- Put durable decisions in ADRs; put operating commands in runbooks.
- Avoid placing confirmed requirements only in chat history.
- When a topic grows too large for a section, split it into a focused document
  and add it to this index.

## Recommended Cleanup Backlog

Recommended:

- Normalize escaped Markdown artifacts in older planning docs.
- Add a glossary once terminology stabilizes across mines, equipment, shifts,
  work authorizations, defects, and payroll.
- Add a dedicated accessibility checklist when UI verification outgrows
  `docs/ui-architecture.md`.
