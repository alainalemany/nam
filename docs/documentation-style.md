# Documentation Style Guide

This document defines basic Markdown and documentation rules for NAM Dashboard.

The goal is readable GitHub rendering, mobile-friendly navigation, and reliable
AI context.

## Basic Rules

- Use one `#` heading per document.
- Use heading levels in order; do not skip from `##` to `####`.
- Prefer short sections with descriptive headings.
- Use bullets for simple lists and tables for matrices or comparisons.
- Use fenced code blocks with language tags such as `bash`, `text`, `json`,
  `yaml`, or `ts`.
- Avoid raw unformatted command dumps.
- Prefer links to canonical documents over duplicated text.
- Keep one concept in one canonical home.
- Do not create orphan documents. Before adding a new file, identify its
  documentation-graph location and how future readers will discover it.
- Explain why a decision exists, not only how to run a command.
- Keep architecture decisions in ADRs and operational commands in runbooks.

## Links

- Use relative links for repository documents.
- Link to directory indexes such as `decisions/README.md` instead of bare
  directories when GitHub navigation would be clearer.
- When renaming or moving docs, update `docs/README.md`, `README.md`, and
  `AGENTS.md`.

## Code Blocks

Use language tags:

```bash
docker compose ps
```

```text
/etc/nam/environment
```

```yaml
services:
  app:
    image: example
```

## Tables

Use tables when showing ownership, statuses, destinations, or comparisons.

| Topic | Canonical home |
| --- | --- |
| Architecture decisions | `docs/decisions/` |
| Infrastructure operations | `docs/infrastructure.md` |

## ADRs

- Use `docs/decisions/template.md`.
- Keep each ADR focused on one durable decision.
- Preserve old ADRs when direction changes; add a superseding ADR instead of
  rewriting history.

## Long Documents

Long documents should include a table of contents when the GitHub outline is not
enough for quick mobile navigation.
