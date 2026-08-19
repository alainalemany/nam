# NAM Dashboard

A personal mining operations dashboard for centralizing daily work records, safety activity, equipment notes, schedules, timesheets, fuel tracking, and long-term operational history.

NAM Dashboard is a professional, modular web application for personal use by a
dragline operator. Its accepted operational foundations are implemented, while
documentation remains the source of truth for current capability, deferred
scope, architecture, infrastructure, and future implementation direction.

## Project Goals

- Replace scattered notes and paperwork with structured, searchable records.
- Preserve a permanent historical timeline of work activity by date, equipment, mine, and module.
- Connect daily logs, Dragline Delay Reports, shift reports, inspections, work authorizations, defects, schedules, fuel records, and related documents.
- Build a maintainable foundation that can grow from a personal tool into a more complete operations system.
- Keep Version 1 focused on manual entry, clean workflows, and reliable historical records.

## Planned Stack

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- React Hook Form
- Zod
- Vitest
- React Testing Library
- TanStack Table
- ApexCharts
- Metronic UI Template

## Core Modules

| Module | Purpose |
| --- | --- |
| Dashboard Home | High-level view of open items, recent activity, safety, maintenance, and operational stats. |
| Daily Log | Full-day operator activity timeline with notes, linked records, equipment, contractors, and attachments. |
| Dragline Delay Reports | DDR-1 through DDR-3 implemented with Draft entry, explicit completion, Completed read-only detail, reasoned correction history, canonical references, Catalog V1 timeline, production/progress facts, and derived runtime/downtime/Advance. |
| Shift Reports | Structured shift-level records that connect work activity, inspections, and related paperwork. |
| Work Authorizations | Safety and maintenance work records tied to shift reports, including permits and completion checklists. |
| Daily Inspections | Manual equipment and work-area inspection summaries. |
| Operational Safety Checklists | Implemented Dragline and Mobile pre-shift Equipment inspections, one per inspected Equipment, with explicit Hours/Miles readings, canonical responses, permanent history, and NAM-only save confirmation; private photo evidence remains access-gated. |
| Defect Tracking | Equipment issue tracking from report through closure. |
| Knowledge Base | Implemented and accepted text-first Personal Operational Knowledge Records with stable revision history, personal review, lifecycle management, search, and optional Daily Log and Defect provenance links. |
| Work Schedule | Manual weekly schedule entry, edits, assignment history, and schedule context. |
| Timesheet | Personal record of weekly time entries, pay codes, equipment, work codes, and totals. |
| Equipment Fuel Events | Operational fuel delivered to Equipment, including occurrences with multiple tank fills. |
| Supply Requests | Implemented and accepted V1 records for requests already submitted through the corporate system, including reference management, lifecycle, immutable correction history, Daily Log Activity links, and Day View participation without inventory ownership. |
| Payslip Repository | Conceptually planned sensitive financial capability; privacy, access, storage, extraction, redaction, export, and feature-architecture decisions remain unresolved. |

## Documentation

The project documentation is the current source of truth:

- [Documentation Index](docs/README.md)
- [Project Philosophy](docs/philosophy.md)
- [Product Vision](docs/product-vision.md)
- [Product Roadmap](docs/product-roadmap.md)
- [Delivery Architecture](docs/delivery-architecture.md)
- [Dependency Architecture](docs/dependency-architecture.md)
- [Engineering Principles](docs/engineering-principles.md)
- [Engineering Quality Standards](docs/engineering-quality-standards.md)
- [Engineering Workflow](docs/engineering-workflow.md)
- [Feature Architecture](docs/feature-architecture.md)
- [Feature Implementation Architecture Documents](docs/architecture/features/README.md)
- [Application State And Data Flow](docs/application-state-and-data-flow.md)
- [UI Architecture](docs/ui-architecture.md)
- [Testing Strategy](docs/testing-strategy.md)
- [AI Context Guide](docs/ai-context.md)
- [Product Requirements](docs/prd.md)
- [Modules](docs/modules.md)
- [Database Design](docs/database.md)
- [Architecture Overview](docs/architecture.md)
- [Architecture Decisions](docs/decisions/README.md)
- [Documentation Style Guide](docs/documentation-style.md)
- [Development Guide](docs/development.md)
- [Infrastructure Operations](docs/infrastructure.md)
- [Server Environment Identity](docs/infrastructure/server-environment.md)
- [MOTD Infrastructure](docs/infrastructure/motd.md)
- [Bootstrap And Verification](docs/infrastructure/bootstrap-and-verification.md)
- [Server Configuration](docs/infrastructure/server-config.md)
- [Server Identity Disaster Recovery](docs/infrastructure/disaster-recovery.md)
- [Implementation Roadmap](docs/roadmap.md)
- [Ideas Backlog](docs/ideas.md)

Source forms and reference images are stored under:

- [`source-forms/`](source-forms/)
- [`docs/assets/`](docs/assets/)

## Current Status

This project has implemented its accepted operational-record foundations and
remains open to separately authorized future discovery and feature work.

The repository includes a Next.js, TypeScript, Prisma, PostgreSQL, Docker
Compose, host-level Caddy development baseline, and executable Vitest testing
foundation. Operations reference data, Daily Work Logs, STOP Cards, Daily
Inspections, Operational Safety Checklists, Shift Reports, Work Authorizations,
Defect Tracking, Work Schedule, Timesheet, and Supply Requests V1 have been
implemented and accepted.

Current HEAD also includes canonical Employee reference management. Work
Schedule uses Employee relationships and historical snapshots for its primary
employee, Assigned By supervisor, and known crew participants.

Equipment Fuel Events also record completed fueling occurrences with ordered
Tank Fills, Equipment and location snapshots, an optional Fuel Service Person,
and an optional Daily Work Log activity link. Supply Requests preserve records
already submitted through the corporate system; NAM does not submit them.
Their accepted V1 includes Supply Item and supervisor references, current
detail, fulfillment and cancellation, immutable correction history, canonical
history filtering, explicit Submission and Fulfillment Daily Log Activity
links, and Day View participation. No Phase 26.11 is planned.

Selected-date Day View composition now includes eleven feature-owned
contributors, with Supply Requests as the eleventh. Day View remains read-only,
uses explicit parallel server composition, and receives display-ready
selected-date contributions from owning features. Current operational modules
provide feature-owned list filtering; global cross-module search remains future
work.

Knowledge Base V1 is implemented, accepted, and canonically closed through
Phase 28.9. It provides
stable Personal Operational Knowledge Records, restricted Markdown, personal
review and retained revision history, archive/restore/delete lifecycle,
current-content search, and optional outbound Daily Log and Defect provenance
links. Phase 28 is closed; Phase 29 has not started and is not authorized. The
feature does not participate in Day View and does not add media,
authentication, AI, or generic content infrastructure. Payslip Repository is
blocked from implementation by unresolved sensitive-data decisions, while
Fleet and the Equipment Activity Timeline remain deferred. Future work must
continue to follow the documentation-first, vertical-slice approach.

Dragline Delay Reports are an additive structured feature that remains separate
from both the current Daily Log and the existing generic Shift Report. DDR-1
through DDR-3 implement independent Draft persistence, production/progress
entry, explicit completion, Completed read-only detail, and reasoned correction
history with optimistic concurrency. The Level 2 architecture is canonical
in [Dragline Delay Reports Architecture](docs/architecture/features/dragline-delay-reports.md).
The original report front and official Delay Code Legend are preserved under
`source-forms/dragline-delay-report/` and visually verified. Their canonical
66-entry transcription is the
[Dragline Delay Code Catalog V1](docs/reference/dragline-delay-reports/delay-code-catalog-v1.md).
Starting and Ending Hour Meter values use confirmed nonnegative whole numbers;
Ending Hour Meter may remain blank while Draft. This is approved digital product
behavior rather than a precision inferred from the handwritten source example.
Completion requires Ending Hour Meter, at least one Operator, a Supervisor, and
Code 13 — Shift Change as the final normalized timeline event; other DDR-2
end-of-shift facts remain optional.

Phase 23.4 implements Operational Safety Checklist `HOURS`/`MILES` meter units,
editable category suggestions, explicit known-mismatch confirmation, signed
NAM-only save results, and Create Another. Phase 23.4.2 adds monotonic
save-result supersession and safe bare-detail fallback when optional
presentation work is unavailable. Optional checklist-level photo
evidence remains blocked until ADR-018's access, media-processing, and backup
prerequisites are met.

## Version 1 Focus

Version 1 should prioritize:

- Manual data entry
- Daily Log
- Dragline Delay Reports
- Shift Reports
- Work Authorizations
- Operational Safety Checklists
- Work Schedule
- Timesheet
- Equipment Fuel Events
- Supply Requests
- Searchable historical records
- Calendar / Day View navigation
- Clean, modular database design

## Out of Scope for Version 1

The following ideas are intentionally deferred:

- Mobile application
- AI-generated recommendations
- GPS integration
- Weather API integration
- QR code tracking
- Inventory management
- Crew management
- Parts ordering
- Offline mode
- Automatic SMS import or parsing
- Automatic submission to external work systems

## Design Principles

- Documentation first, code second.
- Every important concept should have one canonical documentation home.
- Preserve the documentation graph so future contributors and AI assistants know
  what to read next.
- Keep modules connected, but avoid unnecessary coupling.
- Treat date, equipment, mine, and module relationships as first-class data.
- Preserve original source artifacts where useful.
- Prefer manual reliability over brittle automation in Version 1.
- Keep sensitive financial data, such as payslips, separated from operational records by design.

## Repository Notes

This repository contains planning documents, architecture notes, source form references, and early product design material for NAM Dashboard.

Application source code is organized under `src/`, Prisma schema and migrations
under `prisma/`, infrastructure assets under `infrastructure/`, and public
assets under `public/`. Executable tests live under `tests/`.

The canonical product vision, including users, business objectives, MVP scope,
and long-term product direction, lives in [Product Vision](docs/product-vision.md).
The canonical product roadmap, including product delivery order, priority,
deferred scope, and roadmap governance, lives in
[Product Roadmap](docs/product-roadmap.md).
The canonical delivery architecture, including lifecycle and milestone design,
lives in [Delivery Architecture](docs/delivery-architecture.md).
The proven feature delivery workflow, including architecture review,
implementation audit, capability assessment, and closure, lives in
[Engineering Workflow](docs/engineering-workflow.md).
The canonical dependency architecture, including dependency types and dependency
management principles, lives in
[Dependency Architecture](docs/dependency-architecture.md).
