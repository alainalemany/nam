# AI Context Guide

This document defines the recommended reading order for AI assistants working in
the NAM Dashboard repository.

The goal is deterministic context. An assistant should know what to read first,
where authoritative information lives, and how to avoid promoting unapproved
ideas into requirements.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This reading order is approved project direction. |
| Recommended | Suggested AI-context improvements that still need approval. |
| Open Question | Context gaps that still need documentation. |

## AI Reading Order

Use this order at the start of a new chat or when context is uncertain:

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/ai-context.md`
5. `docs/philosophy.md`
6. `docs/product-vision.md`
7. `docs/product-roadmap.md`
8. `docs/delivery-architecture.md`
9. `docs/dependency-architecture.md`
10. `docs/engineering-principles.md`
11. `docs/engineering-quality-standards.md`
12. `docs/feature-architecture.md`
13. `docs/architecture/features/README.md`
14. `docs/application-state-and-data-flow.md`
15. `docs/ui-architecture.md`
16. `docs/testing-strategy.md`
17. `docs/prd.md`
18. `docs/architecture.md`
19. `docs/decisions/README.md`
20. Relevant ADR files under `docs/decisions/`
21. `docs/modules.md`
22. `docs/database.md`
23. `docs/roadmap.md`
24. Relevant operations docs:
    - `docs/development.md`
    - `docs/infrastructure.md`
    - focused files under `docs/infrastructure/`
25. Relevant implementation files:
    - `src/`
    - `tests/`
    - `prisma/`
    - `compose.yaml`
    - `infrastructure/`
26. `docs/ideas.md` only when evaluating future or unapproved concepts.

## Why This Order

The reading order moves from broad intent to specific implementation:

- Repository identity first.
- Collaboration rules second.
- Documentation map before deep reading.
- AI context before deep domain reading so the assistant understands the
  reading path and operating rules.
- Philosophy before decisions.
- Product vision before requirements, architecture, and implementation so the
  assistant understands the product identity, users, MVP, and scope categories.
- Product roadmap before requirements and implementation roadmap so the
  assistant understands delivery priority, deferred scope, and governance.
- Delivery architecture before engineering standards so the assistant
  understands how planned work becomes completed software.
- Dependency architecture before implementation standards so the assistant
  understands dependency types and how dependencies differ from priority.
- Engineering principles before implementation details.
- Engineering quality standards before implementation workflow or handoff.
- Feature architecture before implementing feature modules.
- Feature implementation architecture document conventions before creating
  Level 2 feature-specific architecture documents.
- Application state and data flow before choosing mutation, validation,
  revalidation, or client-state patterns.
- UI architecture before implementing screen or component patterns.
- Testing strategy before adding or evaluating test implementation.
- Requirements before architecture.
- Architecture overview before ADR details.
- Module and database docs before implementation.
- Ideas last so future concepts are not mistaken for approved scope.

## AI Operating Rules

- Treat `docs/README.md` as the map for where knowledge belongs.
- Treat `AGENTS.md` as the collaboration contract.
- Treat `docs/engineering-principles.md` as the source for implementation
  defaults and documentation-graph discipline.
- Treat `docs/product-vision.md` as the source for product identity, users,
  business objectives, MVP, and long-term product direction.
- Treat `docs/product-roadmap.md` as the source for product delivery order,
  priority, deferred scope, and roadmap governance.
- Treat `docs/delivery-architecture.md` as the source for delivery lifecycle,
  milestone design, dependency handling, and completion flow.
- Treat `docs/dependency-architecture.md` as the source for dependency types,
  dependency principles, and dependency evolution.
- Treat `docs/engineering-quality-standards.md` as the source for Definition
  of Done, quality gates, ADR criteria, and implementation workflow.
- Treat `docs/feature-architecture.md` as the source for feature module
  implementation standards.
- Treat `docs/architecture/features/README.md` as the source for
  feature-specific implementation architecture document conventions.
- Treat `docs/application-state-and-data-flow.md` as the source for
  server/client state, mutation flow, validation boundaries, and revalidation
  strategy.
- Treat `docs/ui-architecture.md` as the source for UI architecture,
  design-system standards, and screen patterns.
- Treat `docs/testing-strategy.md` as the source for test layers, quality
  gates, and verification expectations.
- Treat `docs/development.md` as the source for executable test commands and
  local quality-gate workflow.
- Treat `docs/decisions/` as the authority for durable architecture decisions.
- Treat `docs/ideas.md` as unapproved unless the user explicitly promotes an
  item.
- Do not update documentation with new requirements unless the user confirms the
  direction.
- Do not create orphan documentation. Before proposing a new document, identify
  where it fits and how future readers will discover it.
- When documentation conflicts, identify the conflict and recommend the
  authoritative source before editing.
- For system-level changes, inspect current server state and wait for explicit
  approval as required by `AGENTS.md`.

## Context Transfer Prompt

When a chat becomes too large, use the transfer prompt defined in `AGENTS.md`.
Include the most relevant canonical documents from this guide rather than a long
copy of prior chat history.

## AI Context Improvement Backlog

Recommended:

- Add `docs/glossary.md` once core domain terms stabilize.
- Add a documentation health checklist for reviewing duplicate or stale content.
- Add diagram files only when they explain architecture better than prose.
