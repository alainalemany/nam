# ADR-004: Manual Work Schedule Entry

Date: 2026-06-22

Status: Accepted

Category: Product workflow

## Decision

Work Schedule will use manual entry and manual editing instead of SMS import or
natural-language parsing.

## Reason

Supervisor schedule messages may contain spelling errors, grammar issues, or
accidental substitutions of numbers with other characters. Manual entry is more
reliable for the operator's actual workflow.

## Consequences

- SMS import and automatic schedule parsing are out of scope.
- The schedule UI should make manual weekly entry and editing fast.
- The system may still store source notes, but those notes are reference text,
  not parsed automation input.
