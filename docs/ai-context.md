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
4. `docs/philosophy.md`
5. `docs/ai-context.md`
6. `docs/prd.md`
7. `docs/architecture.md`
8. `docs/decisions/README.md`
9. Relevant ADR files under `docs/decisions/`
10. `docs/modules.md`
11. `docs/database.md`
12. `docs/roadmap.md`
13. Relevant operations docs:
    - `docs/development.md`
    - `docs/infrastructure.md`
    - focused files under `docs/infrastructure/`
14. Relevant implementation files:
    - `src/`
    - `prisma/`
    - `compose.yaml`
    - `infrastructure/`
15. `docs/ideas.md` only when evaluating future or unapproved concepts.

## Why This Order

The reading order moves from broad intent to specific implementation:

- Repository identity first.
- Collaboration rules second.
- Documentation map before deep reading.
- Philosophy before decisions.
- Requirements before architecture.
- Architecture overview before ADR details.
- Module and database docs before implementation.
- Ideas last so future concepts are not mistaken for approved scope.

## AI Operating Rules

- Treat `docs/README.md` as the map for where knowledge belongs.
- Treat `AGENTS.md` as the collaboration contract.
- Treat `docs/decisions/` as the authority for durable architecture decisions.
- Treat `docs/ideas.md` as unapproved unless the user explicitly promotes an
  item.
- Do not update documentation with new requirements unless the user confirms the
  direction.
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
