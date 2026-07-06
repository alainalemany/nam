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
| [ADR-006](adr-006-fuel-log-structured-operational-module.md) | 2026-06-24 | Product/data architecture | Fuel Log is a structured operational module with optional price enrichment. |
| [ADR-007](adr-007-work-truck-log-personal-record.md) | 2026-06-24 | Product workflow | Work Truck Log is a structured personal log, not official website automation. |
| [ADR-008](adr-008-docker-compose-deployment-baseline.md) | 2026-06-29 | Infrastructure/deployment | Docker Compose is the standard deployment method with host-level Caddy planned for public ingress. |
| [ADR-009](adr-009-phase-2a-development-postgresql-foundation.md) | 2026-06-29 | Infrastructure/development | Phase 2A establishes a development-only PostgreSQL Docker foundation. |
| [ADR-010](adr-010-phase-2a-infrastructure-standards.md) | 2026-06-29 | Infrastructure/operations | Phase 2A infrastructure naming, PostgreSQL versioning, backup location, and operational docs are standardized. |
| [ADR-011](adr-011-phase-2b-application-platform-foundation.md) | 2026-06-30 | Infrastructure/application platform | Phase 2B establishes the Next.js, TypeScript, Prisma, pnpm, and Docker app foundation. |
| [ADR-012](adr-012-server-identity-and-motd-reproducibility.md) | 2026-06-30 | Infrastructure/recovery | Server identity and MOTD customization must be reproducible from Git. |
| [ADR-013](adr-013-bootstrap-checks-and-server-config.md) | 2026-06-30 | Infrastructure/recovery | Infrastructure uses repository-owned bootstrap scripts, read-only verification checks, and server-config templates. |
| [ADR-014](adr-014-metronic-integration-strategy.md) | 2026-07-01 | UI architecture | Metronic is a vendor UI toolkit, not the application architecture. |
| [ADR-015](adr-015-application-state-and-data-flow.md) | 2026-07-06 | Application architecture | Server-owned persisted data, explicit mutation boundaries, local UI state by default, and no premature global state layer. |

## Categories

Product and domain architecture:

- ADR-002
- ADR-003
- ADR-004
- ADR-006
- ADR-007

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

UI architecture:

- ADR-014

UI architecture standards are documented in `docs/ui-architecture.md`.
Application state and data-flow standards are documented in
`docs/application-state-and-data-flow.md`.

## Process

- Create a new ADR from `template.md` when a durable decision is confirmed.
- Use the next sequential ADR number.
- Keep each ADR focused on one decision.
- Link related ADRs instead of repeating their full content.
- If a decision changes, preserve the original ADR and add a superseding ADR.
- Use `docs/architecture.md` for the current architecture overview.

## Status Values

Use these statuses when needed:

- Proposed
- Accepted
- Superseded
- Deprecated

Existing migrated ADRs are treated as accepted historical decisions.
