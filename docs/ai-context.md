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
7. `docs/testing-strategy.md`
8. `docs/prd.md`
9. `docs/architecture.md`
10. `docs/decisions/README.md`
11. Relevant ADR files under `docs/decisions/`
12. `docs/modules.md`
13. `docs/database.md`
14. `docs/roadmap.md`
15. Relevant operations docs:
    - `docs/development.md`
    - `docs/infrastructure.md`
    - focused files under `docs/infrastructure/`
16. Relevant implementation files:
    - `src/`
    - `prisma/`
    - `compose.yaml`
    - `infrastructure/`
17. `docs/ideas.md` only when evaluating future or unapproved concepts.

## Why This Order

The reading order moves from broad intent to specific implementation:

- Repository identity first.
- Collaboration rules second.
- Documentation map before deep reading.
- AI context before deep domain reading so the assistant understands the
  reading path and operating rules.
- Philosophy before decisions.
- Engineering principles before implementation details.
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
- Treat `docs/testing-strategy.md` as the source for test layers, quality
  gates, and verification expectations.
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
