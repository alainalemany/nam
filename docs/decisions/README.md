# Architecture Decision Records

This directory is the canonical home for NAM Dashboard architecture decisions.

Use ADRs for durable decisions that affect architecture, data modeling,
infrastructure, security, deployment, module boundaries, or long-term
maintainability.

## ADR Index

| ADR | Date | Category | Decision |
| --- | --- | --- | --- |
| [ADR-001](adr-001-postgresql-over-mongodb.md) | 2026-06-04 | Data architecture | PostgreSQL selected instead of MongoDB. |
| [ADR-002](adr-002-work-authorizations-child-of-shift-reports.md) | 2026-06-05 | Product/domain architecture | Work Authorizations are structured child records of Shift Reports. |
| [ADR-003](adr-003-permanent-operational-history.md) | 2026-06-22 | Product architecture | NAM Dashboard prioritizes permanent operational history with search and calendar navigation. |
| [ADR-004](adr-004-manual-work-schedule-entry.md) | 2026-06-22 | Product workflow | Work Schedule uses manual entry and manual editing instead of SMS import or parsing. |
| [ADR-005](adr-005-payslip-financial-bounded-context.md) | 2026-06-23 | Security/data boundaries | Payslip Repository is a dedicated financial bounded context. |
| [ADR-006](adr-006-fuel-log-structured-operational-module.md) | 2026-06-24 | Product/data architecture | Structured fuel records preserve base facts; a 2026-07-14 clarification separates Equipment Fuel Events from Fleet purchases. |
| [ADR-007](adr-007-work-truck-log-personal-record.md) | 2026-06-24 | Product workflow | Superseded historical proposal for a standalone Work Truck Log; see ADR-017. |
| [ADR-008](adr-008-docker-compose-deployment-baseline.md) | 2026-06-29 | Infrastructure/deployment | Docker Compose is the standard deployment method with host-level Caddy planned for public ingress. |
| [ADR-009](adr-009-phase-2a-development-postgresql-foundation.md) | 2026-06-29 | Infrastructure/development | Phase 2A establishes a development-only PostgreSQL Docker foundation. |
| [ADR-010](adr-010-phase-2a-infrastructure-standards.md) | 2026-06-29 | Infrastructure/operations | Phase 2A infrastructure naming, PostgreSQL versioning, backup location, and operational docs are standardized. |
| [ADR-011](adr-011-phase-2b-application-platform-foundation.md) | 2026-06-30 | Infrastructure/application platform | Phase 2B establishes the Next.js, TypeScript, Prisma, pnpm, and Docker app foundation. |
| [ADR-012](adr-012-server-identity-and-motd-reproducibility.md) | 2026-06-30 | Infrastructure/recovery | Server identity and MOTD customization must be reproducible from Git. |
| [ADR-013](adr-013-bootstrap-checks-and-server-config.md) | 2026-06-30 | Infrastructure/recovery | Infrastructure uses repository-owned bootstrap scripts, read-only verification checks, and server-config templates. |
| [ADR-014](adr-014-metronic-integration-strategy.md) | 2026-07-01 | UI architecture | Metronic is a vendor UI toolkit, not the application architecture. |
| [ADR-015](adr-015-application-state-and-data-flow.md) | 2026-07-06 | Application architecture | Server-owned persisted data, explicit mutation boundaries, local UI state by default, and no premature global state layer. |
| [ADR-016](adr-016-testing-foundation.md) | 2026-07-06 | Testing architecture | Vitest, jsdom, React Testing Library, and top-level test directories establish the executable testing foundation. |
| [ADR-017](adr-017-supersede-standalone-work-truck-log.md) | 2026-07-16 | Product/domain architecture | Operational Safety Checklists and Daily Work Logs supersede the proposed standalone Work Truck Log. |
| [ADR-018](adr-018-private-operational-safety-checklist-photo-storage.md) | 2026-07-16 | Infrastructure/security architecture | Checklist photo evidence uses private feature-owned metadata and local persistent media storage behind an explicit access gate. |
| [ADR-019](adr-019-managed-private-overlay-operational-pilot.md) | 2026-07-17 | Infrastructure/security architecture | The controlled operational pilot uses a managed private overlay with Tailscale as the implementation reference and independent key-only SSH recovery. |

## Categories

Product and domain architecture:

- ADR-002
- ADR-003
- ADR-004
- ADR-006
- ADR-007
- ADR-017

Data architecture and boundaries:

- ADR-001
- ADR-005

Application architecture:

- ADR-015

Infrastructure and deployment:

- ADR-008
- ADR-009
- ADR-010
- ADR-011
- ADR-012
- ADR-013
- ADR-018
- ADR-019

UI architecture:

- ADR-014

Testing architecture:

- ADR-016

UI architecture standards are documented in `docs/ui-architecture.md`.
Application state and data-flow standards are documented in
`docs/application-state-and-data-flow.md`.
Testing strategy and executable foundation standards are documented in
`docs/testing-strategy.md`.

## Process

- Create a new ADR from `template.md` when a durable decision is confirmed.
- Use the next sequential ADR number.
- Keep each ADR focused on one decision.
- Link related ADRs instead of repeating their full content.
- If a decision changes, preserve the original ADR and add a superseding ADR.
- Use `docs/architecture.md` for the current architecture overview.
- Use `docs/engineering-quality-standards.md` for ADR decision criteria and
  Definition of Done.

## Status Values

Use these statuses when needed:

- Proposed
- Accepted
- Superseded
- Deprecated

Existing migrated ADRs are treated as accepted historical decisions.
