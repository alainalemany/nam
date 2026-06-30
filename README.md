# NAM Dashboard

A personal mining operations dashboard for centralizing daily work records, safety activity, equipment notes, schedules, timesheets, fuel tracking, work truck logs, and long-term operational history.

NAM Dashboard is being designed as a professional, modular web application for personal use by a dragline operator. The project is currently in the product definition and architecture phase, with documentation acting as the source of truth before implementation begins.

## Project Goals

- Replace scattered notes and paperwork with structured, searchable records.
- Preserve a permanent historical timeline of work activity by date, equipment, mine, and module.
- Connect daily logs, shift reports, inspections, work authorizations, defects, schedules, fuel records, and related documents.
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
- TanStack Table
- ApexCharts
- Metronic UI Template

## Core Modules

| Module | Purpose |
| --- | --- |
| Dashboard Home | High-level view of open items, recent activity, safety, maintenance, and operational stats. |
| Daily Log | Full-day operator activity timeline with notes, linked records, equipment, contractors, and attachments. |
| Shift Reports | Structured shift-level records that connect work activity, inspections, and related paperwork. |
| Work Authorizations | Safety and maintenance work records tied to shift reports, including permits and completion checklists. |
| Daily Inspections | Pre-shift and operational inspection records with findings, defects, notes, and photos. |
| Defect Tracking | Equipment issue tracking from report through closure. |
| Knowledge Base | Field notes, procedures, safety notes, troubleshooting guides, and equipment-specific knowledge. |
| Work Schedule | Manual weekly schedule entry, edits, assignment history, and schedule context. |
| Timesheet | Personal record of weekly time entries, pay codes, equipment, work codes, and totals. |
| Fuel Log | Diesel deliveries, gasoline purchases, gallons, vendors, pricing, receipts, and equipment links. |
| Work Truck Log | Daily work truck mileage, website log responses, submitted status, and related fuel activity. |
| Payslip Repository | Secure archive of payslip PDFs with extracted payroll fields and date-range analytics. |

## Documentation

The project documentation is the current source of truth:

- [Product Requirements](docs/prd.md)
- [Modules](docs/modules.md)
- [Database Design](docs/database.md)
- [Architecture Decisions](docs/architecture.md)
- [Development Guide](docs/development.md)
- [Infrastructure Operations](docs/infrastructure.md)
- [Roadmap](docs/roadmap.md)
- [Ideas Backlog](docs/ideas.md)

Source forms and reference images are stored under:

- [`source-forms/`](source-forms/)
- [`docs/assets/`](docs/assets/)

## Current Status

This project is in the planning, requirements, and platform foundation phase.

The Phase 2B application foundation has started. The repository now includes a minimal Next.js, TypeScript, Prisma, and Docker Compose platform baseline. Feature modules and business workflows are still intentionally deferred until their requirements and data models are confirmed.

## Version 1 Focus

Version 1 should prioritize:

- Manual data entry
- Daily Log
- Shift Reports
- Work Authorizations
- Work Schedule
- Timesheet
- Fuel Log
- Work Truck Log
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
- Keep modules connected, but avoid unnecessary coupling.
- Treat date, equipment, mine, and module relationships as first-class data.
- Preserve original source artifacts where useful.
- Prefer manual reliability over brittle automation in Version 1.
- Keep sensitive financial data, such as payslips, separated from operational records by design.

## Repository Notes

This repository contains planning documents, architecture notes, source form references, and early product design material for NAM Dashboard.

As implementation begins, application source code will be organized under `src/` and public assets under `public/`.
