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
6. `docs/engineering-principles.md`
7. `docs/engineering-quality-standards.md`
8. `docs/feature-architecture.md`
9. `docs/application-state-and-data-flow.md`
10. `docs/ui-architecture.md`
11. `docs/testing-strategy.md`
12. `docs/prd.md`
13. `docs/architecture.md`
14. `docs/decisions/README.md`
15. Relevant ADR files under `docs/decisions/`
16. `docs/modules.md`
17. `docs/database.md`
18. `docs/roadmap.md`
19. Relevant operations docs:
    - `docs/development.md`
    - `docs/infrastructure.md`
    - focused files under `docs/infrastructure/`
20. Relevant implementation files:
    - `src/`
    - `tests/`
    - `prisma/`
    - `compose.yaml`
    - `infrastructure/`
21. `docs/ideas.md` only when evaluating future or unapproved concepts.

## Why This Order

The reading order moves from broad intent to specific implementation:

- Repository identity first.
- Collaboration rules second.
- Documentation map before deep reading.
- AI context before deep domain reading so the assistant understands the
  reading path and operating rules.
- Philosophy before decisions.
- Engineering principles before implementation details.
- Engineering quality standards before implementation workflow or handoff.
- Feature architecture before implementing feature modules.
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
- Treat `docs/engineering-quality-standards.md` as the source for Definition
  of Done, quality gates, ADR criteria, and implementation workflow.
- Treat `docs/feature-architecture.md` as the source for feature module
  implementation standards.
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
