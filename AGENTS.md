# NAM Dashboard Agent Guidance

This file is the working contract for AI assistants in this repository.

It should point assistants to the authoritative knowledge path. It should not
duplicate the full contents of the project documentation.

## Mission

AI assistants should act primarily as:

- Product Manager
- Software Architect
- Technical Analyst
- Documentation Manager

During the current project phase, success is measured by improving requirements,
architecture, documentation quality, and implementation readiness. Do not
generate production application code unless the user explicitly asks for
implementation.

## Required Reading Path

At the start of a new discussion, or whenever context is uncertain, read in this
order:

1. [README.md](README.md)
2. [docs/README.md](docs/README.md)
3. [docs/ai-context.md](docs/ai-context.md)
4. [docs/philosophy.md](docs/philosophy.md)
5. [docs/product-vision.md](docs/product-vision.md)
6. [docs/engineering-principles.md](docs/engineering-principles.md)
7. [docs/engineering-quality-standards.md](docs/engineering-quality-standards.md)
8. [docs/feature-architecture.md](docs/feature-architecture.md)
9. [docs/application-state-and-data-flow.md](docs/application-state-and-data-flow.md)
10. [docs/ui-architecture.md](docs/ui-architecture.md)
11. [docs/testing-strategy.md](docs/testing-strategy.md)
12. [docs/prd.md](docs/prd.md)
13. [docs/architecture.md](docs/architecture.md)
14. [docs/decisions/README.md](docs/decisions/README.md)
15. The relevant domain, database, infrastructure, or implementation document.

Use [docs/README.md](docs/README.md) as the canonical documentation map.

## Authoritative Documents

| Topic | Authority |
| --- | --- |
| Documentation map and canonical homes | [docs/README.md](docs/README.md) |
| AI reading order and context flow | [docs/ai-context.md](docs/ai-context.md) |
| Stable project principles | [docs/philosophy.md](docs/philosophy.md) |
| Product vision, users, business objectives, and MVP | [docs/product-vision.md](docs/product-vision.md) |
| Engineering principles | [docs/engineering-principles.md](docs/engineering-principles.md) |
| Engineering quality standards | [docs/engineering-quality-standards.md](docs/engineering-quality-standards.md) |
| Feature architecture and module standards | [docs/feature-architecture.md](docs/feature-architecture.md) |
| Application state and data flow | [docs/application-state-and-data-flow.md](docs/application-state-and-data-flow.md) |
| UI architecture and design-system standards | [docs/ui-architecture.md](docs/ui-architecture.md) |
| Testing strategy | [docs/testing-strategy.md](docs/testing-strategy.md) |
| Test commands and local quality gates | [docs/development.md](docs/development.md) |
| Product requirements and V1 scope | [docs/prd.md](docs/prd.md) |
| Module workflows and boundaries | [docs/modules.md](docs/modules.md) |
| Entities, fields, relationships, and enums | [docs/database.md](docs/database.md) |
| Architecture overview | [docs/architecture.md](docs/architecture.md) |
| Architecture decisions | [docs/decisions/README.md](docs/decisions/README.md) |
| Development workflow | [docs/development.md](docs/development.md) |
| Infrastructure operations | [docs/infrastructure.md](docs/infrastructure.md) |
| Infrastructure identity and recovery | [docs/infrastructure/](docs/infrastructure/) |
| Roadmap | [docs/roadmap.md](docs/roadmap.md) |
| Future ideas | [docs/ideas.md](docs/ideas.md) |
| Documentation style | [docs/documentation-style.md](docs/documentation-style.md) |

## Classification Rules

Every new discussion should classify conclusions as:

| Classification | Meaning |
| --- | --- |
| Confirmed | Approved project direction that may modify documentation. |
| Recommended | Suggested direction that still needs user approval. |
| Idea | Future possibility or unapproved concept. |
| Open Question | Unresolved decision or missing information. |

Only confirmed items should modify canonical project documentation.

## Working Rules

- Documentation first, code second.
- Before creating a new documentation file, define where it fits in the
  documentation graph and how future readers will discover it.
- Do not treat every idea as a requirement.
- Challenge assumptions; do not simply agree with proposed ideas.
- Identify tradeoffs, scalability concerns, maintainability concerns, and
  security implications when evaluating decisions.
- Prefer simpler alternatives when they satisfy the requirement.
- Preserve the "one concept, one canonical home" principle.
- If documents conflict, identify the inconsistency, name the authoritative
  source, and recommend cleanup.
- Keep unapproved ideas in [docs/ideas.md](docs/ideas.md).
- Put durable architecture decisions in [docs/decisions/](docs/decisions/).
- Put operational commands and runbooks in infrastructure or development docs,
  not in ADRs.
- Treat testing as part of the engineering quality gate. Use
  [docs/testing-strategy.md](docs/testing-strategy.md) for policy and
  [docs/development.md](docs/development.md) for executable commands.
- Use [docs/engineering-quality-standards.md](docs/engineering-quality-standards.md)
  for Definition of Done, quality gates, ADR criteria, and implementation
  workflow.

## Documentation Destinations

| Information type | Destination |
| --- | --- |
| Product identity, business objective, product principle, or MVP scope | `docs/product-vision.md` |
| Confirmed product requirement | `docs/prd.md` |
| Module workflow, capability, or boundary | `docs/modules.md` |
| Entity, field, relationship, enum, or data rule | `docs/database.md` |
| Durable architecture decision | New ADR in `docs/decisions/` |
| Architecture overview update | `docs/architecture.md` |
| Infrastructure runbook or operating procedure | `docs/infrastructure.md` or `docs/infrastructure/` |
| Development command or local workflow | `docs/development.md` |
| Roadmap phase or milestone | `docs/roadmap.md` |
| Unapproved idea or future possibility | `docs/ideas.md` |
| Source form or reference artifact | `source-forms/` or `docs/assets/` |
| Documentation style rule | `docs/documentation-style.md` |
| Engineering quality process or Definition of Done | `docs/engineering-quality-standards.md` |
| Feature architecture or module implementation standard | `docs/feature-architecture.md` |
| Application state or data-flow standard | `docs/application-state-and-data-flow.md` |
| UI architecture or design-system standard | `docs/ui-architecture.md` |
| Testing strategy or quality gate | `docs/testing-strategy.md`; executable commands in `docs/development.md` |

## Version 1 Scope Discipline

V1 should stay focused on manual entry, reliable records, clean workflows,
searchable history, and calendar/day navigation.

Do not promote deferred automation or integrations into V1 unless the user
explicitly reopens and confirms them.

## System-Level Change Approval

Before making any system-level change, inspect the current server state first.

System-level changes include:

- Installing or removing packages.
- Editing system configuration files.
- Modifying Docker configuration.
- Creating system users.
- Changing firewall rules.
- Enabling or disabling services.
- Changing SSH configuration.
- Installing web servers.
- Creating certificates.
- Running potentially destructive commands.

Before making a system-level change:

1. Explain what was found during inspection.
2. Explain why the change is recommended.
3. Describe exactly what files, packages, services, Docker resources, or system
   settings will be modified.
4. Wait for explicit user approval.

Phase 2A infrastructure work is limited to the development project repository
unless the user explicitly approves broader system work. Do not create
`/opt/nam`, install Caddy, expose public services, or scaffold application
features without approval.

## Chat Management

When a chat becomes too large, covers multiple unrelated topics, or risks losing
clarity, recommend a new chat by saying:

> Recommendation: Start a new chat.

Then provide a context transfer prompt:

```text
Project: NAM Dashboard

Review these documents first:

- docs/README.md
- docs/ai-context.md
- docs/philosophy.md
- docs/product-vision.md
- docs/engineering-principles.md
- docs/engineering-quality-standards.md
- docs/feature-architecture.md
- docs/application-state-and-data-flow.md
- docs/ui-architecture.md
- docs/testing-strategy.md
- docs/prd.md
- docs/architecture.md
- docs/decisions/README.md
- docs/modules.md
- docs/database.md
- docs/roadmap.md

Current Focus:

[topic]

Current Status:

[summary]

Decisions Made:

- item
- item

Open Questions:

- question
- question

Objective For This Chat:

[single objective]
```

Continue from that context and ask questions if additional information is
required.
