# ADR-014: Metronic Integration Strategy

Date: 2026-07-01

Status: Accepted

Category: UI architecture

## Decision

Metronic is a vendor UI toolkit, not the NAM Dashboard application
architecture.

The original premium Metronic distribution must remain outside the repository as
a pristine vendor reference. NAM Dashboard must not copy the full Metronic
package into the repository.

## Context

NAM Dashboard plans to use the Metronic UI Template where appropriate, but the
application has its own domain architecture, product workflow, data model,
routing, validation, persistence, and operational history requirements.

Using Metronic as the application architecture would create avoidable coupling
to a vendor package and make future upgrades harder. The project needs the
benefit of proven UI patterns without letting vendor code own business behavior
or domain boundaries.

## Options Considered

- Copy the full Metronic package into the repository.
- Build all UI from scratch and avoid Metronic entirely.
- Keep Metronic external as a vendor reference and selectively adapt only the
  pieces NAM Dashboard needs.

## Reason

Selective integration keeps the application maintainable. It allows NAM
Dashboard to use useful Metronic components, layouts, styles, and interaction
patterns while preserving the project-owned architecture and avoiding a large
vendor-code import.

Keeping the original Metronic distribution pristine and outside the repository
also makes future comparison, upgrade, and re-import decisions clearer.

## Consequences

- The original premium Metronic distribution remains outside the repository.
- The full Metronic package must not be copied into the repository.
- Specific Metronic components, layouts, styles, or patterns may be imported
  only when the application actually needs them.
- Imported Metronic-derived code must be adapted to NAM Dashboard conventions.
- Business logic must never live inside vendor-derived UI code.
- NAM Dashboard owns domain architecture, routing, validation, persistence, and
  workflow patterns.
- Future Metronic upgrades remain possible because vendor-derived code is kept
  limited, intentional, and documented.
- When Metronic-derived code is added, the relevant source, purpose, and
  adaptation should be documented near the imported code or in the feature
  documentation.

## Related Documents

- `docs/architecture.md`
- `docs/documentation-style.md`
- `docs/README.md`
