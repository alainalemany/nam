# Documentation Index

This is the canonical navigation map for NAM Dashboard documentation.

Start here when deciding where information belongs. The repository should teach
future human contributors and AI assistants how to understand the project without
depending on chat history.

## Where To Start

Human contributors should start with:

1. [Repository Overview](../README.md)
2. [Project Philosophy](philosophy.md)
3. [Product Requirements](prd.md)
4. [Architecture Overview](architecture.md)
5. [Architecture Decision Records](decisions/README.md)
6. The relevant module, data, infrastructure, or implementation document.

AI assistants should start with:

1. [Repository Overview](../README.md)
2. [Agent Guidance](../AGENTS.md)
3. [Documentation Index](README.md)
4. [AI Context Guide](ai-context.md)
5. [Project Philosophy](philosophy.md)
6. [Product Requirements](prd.md)
7. [Architecture Overview](architecture.md)
8. [ADR Index](decisions/README.md)
9. The relevant domain and implementation documents.

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
| 3. Project philosophy | Stable principles that rarely change. | `docs/philosophy.md` |
| 4. AI context | Deterministic reading order and AI handoff rules. | `docs/ai-context.md` |
| 5. Product definition | Confirmed product requirements and scope. | `docs/prd.md` |
| 6. Architecture overview | Current architecture shape and boundaries. | `docs/architecture.md` |
| 7. Architecture decisions | Durable decisions with context and consequences. | `docs/decisions/` |
| 8. Domain modules | Module workflows, boundaries, and capabilities. | `docs/modules.md` |
| 9. Data model | Entities, fields, relationships, and enums. | `docs/database.md` |
| 10. Operations | Development, infrastructure, recovery, and runbooks. | `docs/development.md`, `docs/infrastructure.md`, `docs/infrastructure/` |
| 11. Planning | Roadmap and future ideas. | `docs/roadmap.md`, `docs/ideas.md` |
| 12. Implementation | Source code, configuration, assets, and scripts. | `src/`, `prisma/`, `infrastructure/`, `public/` |

## Documentation Map

| Need | Start here |
| --- | --- |
| Understand the project quickly | [README](../README.md) |
| Understand documentation ownership | [Documentation Index](README.md) |
| Understand stable principles | [Project Philosophy](philosophy.md) |
| Understand AI context flow | [AI Context Guide](ai-context.md) |
| Understand product scope | [Product Requirements](prd.md) |
| Understand module behavior | [Modules](modules.md) |
| Understand entities and relationships | [Database Design](database.md) |
| Understand current architecture | [Architecture Overview](architecture.md) |
| Understand why decisions were made | [ADR Index](decisions/README.md) |
| Run the application foundation | [Development Guide](development.md) |
| Operate infrastructure | [Infrastructure Operations](infrastructure.md) |
| Understand server identity | [Server Environment Identity](infrastructure/server-environment.md) |
| Understand bootstrap and verification | [Bootstrap And Verification](infrastructure/bootstrap-and-verification.md) |
| Understand recovery | [Disaster Recovery](infrastructure/disaster-recovery.md) |
| Understand implementation phases | [Roadmap](roadmap.md) |
| Review unapproved future concepts | [Ideas Backlog](ideas.md) |
| Follow documentation formatting rules | [Documentation Style Guide](documentation-style.md) |

## Authoritative Sources

Every important topic should have one canonical home. Other documents may link
to that home but should not restate the same policy in detail.

| Topic | Canonical home |
| --- | --- |
| Project identity and goals | `README.md`, detailed scope in `docs/prd.md` |
| Documentation philosophy | `docs/philosophy.md` |
| AI collaboration philosophy | `AGENTS.md`, context flow in `docs/ai-context.md` |
| Product requirements | `docs/prd.md` |
| Version 1 scope | `docs/prd.md` |
| Module definitions | `docs/modules.md` |
| Database philosophy and entities | `docs/database.md` |
| Architecture philosophy | `docs/architecture.md`, principles in `docs/philosophy.md` |
| Architecture decisions | `docs/decisions/` |
| Infrastructure philosophy | `docs/infrastructure.md`, durable decisions in `docs/decisions/` |
| Environment identity | `docs/infrastructure/server-environment.md` |
| Deployment philosophy | `docs/architecture.md`, deployment operations in `docs/infrastructure.md` |
| Recovery philosophy | `docs/infrastructure/disaster-recovery.md` |
| Development workflow | `docs/development.md` |
| Coding philosophy | `docs/philosophy.md`; implementation details belong near code when created |
| Testing philosophy | Open question; create a canonical testing document before broad feature work |
| UI philosophy | `docs/prd.md` for product UX goals; future detailed UI guidance should get a canonical doc |
| Documentation style | `docs/documentation-style.md` |
| Future ideas | `docs/ideas.md` |
| Roadmap and phases | `docs/roadmap.md` |

## Where Should New Information Go?

| Information type | Destination |
| --- | --- |
| Confirmed product requirement | `docs/prd.md` |
| Module workflow, capability, or boundary | `docs/modules.md` |
| Entity, field, relationship, enum, or data rule | `docs/database.md` |
| Durable architecture decision | New ADR in `docs/decisions/` |
| Architecture overview update | `docs/architecture.md` |
| Infrastructure runbook or operating procedure | `docs/infrastructure.md` or a focused file under `docs/infrastructure/` |
| Development command or local workflow | `docs/development.md` |
| Roadmap phase or milestone | `docs/roadmap.md` |
| Unapproved idea or future possibility | `docs/ideas.md` |
| Source form or reference artifact | `source-forms/` or `docs/assets/` |
| AI operating rule | `AGENTS.md`; reading-order support in `docs/ai-context.md` |

## Navigation Rules

- Prefer links to canonical documents over copying policy text.
- Keep each document responsible for one kind of knowledge.
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
- Create a testing strategy document before module implementation accelerates.
- Create a UI/UX guidelines document when Metronic usage and screen patterns are
  confirmed.
