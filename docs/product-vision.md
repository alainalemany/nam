# Product Vision

This document is the canonical home for the NAM Dashboard product vision.

It defines the product itself: who it is for, what problems it solves, what the
MVP means, and which product directions are current, planned, or only candidate
future ideas.

It does not define application architecture, engineering process, database
schema, implementation standards, test strategy, or infrastructure operations.

## Classification

| Classification | Meaning |
| --- | --- |
| Implemented | Product capability exists in the application foundation today. |
| Planned | Confirmed product direction for Version 1 or a documented future phase. |
| Candidate Future | Unapproved future possibility that requires later evaluation. |

## Documentation Graph Fit

Product vision sits in this path:

```text
docs/philosophy.md
-> docs/product-vision.md
-> docs/product-roadmap.md
-> docs/delivery-architecture.md
-> docs/prd.md
-> docs/modules.md
-> implementation planning
```

Related authorities:

- Stable project principles live in `docs/philosophy.md`.
- Product delivery order, priority, deferred scope, and roadmap governance live
  in `docs/product-roadmap.md`.
- Delivery lifecycle, milestone design, dependency handling, and completion flow
  live in `docs/delivery-architecture.md`.
- Confirmed product requirements and Version 1 scope live in `docs/prd.md`.
- Module workflows, boundaries, and capabilities live in `docs/modules.md`.
- Entity and relationship details live in `docs/database.md`.
- Architecture shape lives in `docs/architecture.md`.
- Implementation standards live in `docs/feature-architecture.md`,
  `docs/application-state-and-data-flow.md`, and `docs/ui-architecture.md`.
- Testing and engineering process live in `docs/testing-strategy.md`,
  `docs/engineering-quality-standards.md`, and `docs/development.md`.
- Roadmap sequencing lives in `docs/roadmap.md`.
- Unapproved future ideas live in `docs/ideas.md`.

## Purpose

NAM Dashboard exists to centralize personal mining operations records into a
structured, searchable, durable system.

The product should help the operator answer:

> What happened on a given workday, what equipment was involved, what paperwork
> or related records existed, and what historical context surrounds that date?

This document should guide product decisions before detailed requirements,
architecture, or implementation work begins.

## Product Overview

NAM Dashboard is a personal mining operations dashboard for centralizing daily
work records, safety activity, equipment notes, schedules, timesheets, fuel
tracking, payslip records, and long-term operational history.

The product is initially for personal use by a dragline operator. It should
remain simple enough for reliable manual entry while being structured enough to
grow into a more complete operations system over time.

## Target Users

### Primary User

- A dragline operator who needs a reliable personal system for daily work
  records, equipment context, paperwork history, schedule records, timesheets,
  fuel records, Equipment inspection history, and payslip history.

### Operational Context

- Mines, equipment, contractors, visitors, supervisors, technicians, vendors,
  and companies may appear as record data.
- These entities are part of the operating context, not separate confirmed
  application user roles for the current product scope.

### Candidate Future Users

Additional operational roles may be evaluated later only if the product grows
beyond personal use. They are not part of the current confirmed scope.

## Business Objectives

NAM Dashboard should:

- Replace scattered notes and paperwork with structured, searchable records.
- Preserve a permanent historical timeline by date, equipment, mine, and
  module.
- Connect daily logs, Dragline Delay Reports, shift reports, inspections, work
  authorizations, defects, schedules, fuel records, Equipment inspection
  records, payslip records, and related documents.
- Reduce manual record-finding effort when reviewing past workdays.
- Keep Version 1 focused on manual entry, clean workflows, and reliable
  historical records.
- Build a maintainable foundation that can grow without treating every future
  idea as an immediate requirement.

## Product Principles

### Documentation Is The Product Memory

Confirmed product direction belongs in the repository, not only in chat history.
Product identity belongs here, detailed requirements belong in `docs/prd.md`,
and unapproved ideas belong in `docs/ideas.md`.

### Manual Reliability Comes Before Automation

Version 1 should prefer manual entry, editable records, and clear history over
brittle integrations, scraping, parsing, or automatic submission workflows.

### Operational History Is The Core Value

Date, date range, equipment, mine, module, shift, attachments, and related
records are first-class concepts because the product value is historical lookup.

### Modules Should Connect Without Becoming One Large Form

Daily logs, Dragline Delay Reports, shift reports, inspections, work
authorizations, schedules, timesheets, fuel records, Equipment inspections, and
payslip records should remain distinct modules while linking to shared
operational context where useful.

### Sensitive Financial Context Stays Separate

Payslip and compensation records have different privacy and retention concerns
than general operational records and should remain separated by design.

### Future Ideas Stay Candidate Until Confirmed

Ideas such as AI recommendations, GPS integration, weather APIs, QR tracking,
inventory, crew management, parts ordering, offline mode, SMS import, and
external submission workflows remain candidate future concepts unless promoted
into confirmed requirements.

## Core Workflows

### Implemented

- Maintain operations reference data for cities, mines, and equipment.
- Create, edit, list, and view Daily Logs.
- Add multiple Daily Log activity entries.
- Link Daily Logs and activities to existing mine and equipment records.
- View a Daily Log summary and activity timeline.
- Record shift reports that connect work activity, inspections, and related
  paperwork.
- Record Work Authorizations tied to shift reports.
- Record daily inspections and equipment findings.
- Track defects from report through closure.
- Enter and revise work schedules manually.
- Maintain canonical Employee references used by Work Schedule, including
  supervisor eligibility and historical schedule snapshots.
- Track timesheet entries and weekly totals.
- Record operational Equipment fueling history separately from future Fleet
  purchase history.
- Use implemented Operational Safety Checklist `HOURS`/`MILES` meter units,
  mismatch confirmation, NAM save feedback, filtering, correction, and Day View
  participation.
- Preserve already submitted corporate Supply Requests with reference
  management, lifecycle, immutable correction history, canonical filtering,
  explicit Daily Log Activity links, and Day View participation. NAM does not
  submit the corporate request.
- Search and navigate historical records by date, date range, equipment, mine,
  and module.
- Compose eleven feature-owned operational contributors in the read-only Day
  View.
- Preserve text-first Personal Operational Knowledge Records with explicit
  trust and lifecycle, retained reviewed history, safe current-content search,
  and optional outbound Daily Log and Defect provenance links. Knowledge Base
  V1 is implemented, accepted, and canonically closed through Phase 28.9. Phase
  29 is not authorized, and Knowledge Base does not participate in Day View.

### Blocked

- Implement the official Dragline Delay Report Delay Code catalog only after
  the original report front and official legend are committed and verified.
- Resolve Payslip Repository privacy, access, storage, extraction, redaction,
  and export decisions before feature architecture or implementation.
- Keep optional checklist-level photo evidence blocked until ADR-018's access,
  processing, private-storage, cleanup, recovery, and security gates close.

### Candidate Future

- AI-generated recommendations.
- GPS integration.
- Weather API integration.
- QR code tracking.
- Inventory management.
- Crew management.
- Parts ordering.
- Offline mode.
- Automatic SMS import or parsing.
- Automatic submission to external work systems.
- Other ideas recorded in `docs/ideas.md`.

## Product Scope

### Current

The current implemented product capabilities include:

- Operations reference data for cities, mines, and equipment.
- Daily Work Log create, edit, list, and detail workflows.
- Multiple manual Daily Log activity entries.
- Daily Log and activity links to existing mine and equipment records.
- Daily Log summary and activity timeline views.
- Daily Log feature-owned filtering and date navigation.
- STOP Card create, edit, list, detail, filtering, and Day View workflows.
- Daily Inspection, Shift Report, and Work Authorization create, edit, list,
  detail, and Day View workflows.
- Defect Tracking create, edit, list, detail, filtering, lifecycle, and Day View
  workflows.
- Work Schedule and Timesheet weekly workflows with feature-owned Day View
  contributions.
- Canonical Employee reference management and Work Schedule Employee
  relationships for primary employee, Assigned By, and known crew participants.
- Operational Safety Checklist history, create, detail, correction, canonical
  Dragline and Mobile templates, `HOURS`/`MILES` meters, NAM save confirmation,
  Create Another, feature-owned filtering, and Day View participation.
- Equipment Fuel Event history, create, detail, correction, ordered Tank Fills,
  optional Fuel Service Person context, feature-owned filtering, and Day View
  participation.
- Supply Request reference management, create, current detail, fulfillment,
  cancellation, immutable correction history, canonical current-version
  filtering, explicit Submission and Fulfillment Daily Log Activity linking,
  and Day View participation. Supply Requests V1 is complete and accepted
  through Phase 26.10; no Phase 26.11 is planned.
- Day View composition for Work Schedule, Timesheet, Daily Work Logs, STOP
  Cards, Daily Inspections, Operational Safety Checklists, Shift Reports, Work
  Authorizations, Defect Tracking, Equipment Fuel Events, and Supply Requests
  on a selected date. These eleven contributors remain feature-owned and the
  Day View remains read-only.

### Future Product Work

- Dragline Delay Reports are confirmed future product work with an Approved
  Level 2 architecture and an additive DDR-1 through DDR-3 sequence. The
  current Daily Log remains unchanged; its later evolution into a richer
  date-centered personal operational timeline is a separate future milestone.
- Payslip Repository remains conceptually planned but blocked from
  implementation by unresolved sensitive-data decisions and the absence of an
  accepted Level 2 feature architecture.
- Optional checklist-level photo evidence remains blocked until ADR-018's
  access, processing, storage, cleanup, backup, restore, and independent
  security-verification gates are satisfied.
- Broader historical lookup may continue through separately authorized
  feature-owned views; global cross-module search remains deferred.
- Fleet and the Equipment Activity Timeline remain separate deferred concepts.
- Future Day View contributors require separate feature authorization.

Detailed requirements live in `docs/prd.md`. Module behavior lives in
`docs/modules.md`.

### Candidate Future

Candidate future scope includes deferred automation, integrations, richer
analytics, exports, templates, and operational expansion after the manual
recordkeeping foundation is reliable.

Candidate items must remain in `docs/ideas.md` or roadmap future phases until
explicitly promoted into confirmed requirements.

## Minimum Viable Product

The MVP is a usable personal operations record system, not a prototype shell.

For Version 1, the MVP should provide:

- Reliable manual entry for the core operational records.
- Structured Dragline Delay Reports that remain separate from the personal
  Daily Log narrative.
- Date-centered historical lookup.
- Connections between records, equipment, mines, and modules.
- Clean create, edit, list, and detail workflows for implemented modules.
- Searchable history for the most important operational records.
- Calendar and Day View navigation for workday context.
- A database structure that supports durable records and future module growth.
- Verification and documentation discipline sufficient to keep future work
  maintainable.

The MVP does not require deferred automation, external integrations, mobile app
support, or multi-user organizational workflows.

## Long-Term Product Vision

NAM Dashboard should become a durable personal operations memory for mining
work: a place where daily activity, structured Dragline shift reports,
equipment context, paperwork, schedules, timesheets, fuel activity, Equipment
inspections, and payslip history can be reviewed across months and years.

Long-term growth should preserve the product's core discipline:

- Start from reliable manual records.
- Connect records around dates, mines, equipment, shifts, and modules.
- Add automation only after the underlying workflow is already useful manually.
- Keep sensitive financial records separated from operational records.
- Promote future ideas only when they solve a confirmed product problem.

## Relationship To Other Documentation

| Document | Relationship |
| --- | --- |
| `docs/philosophy.md` | Stable principles behind the product and repository. |
| `docs/product-roadmap.md` | Product delivery order, priority, deferred scope, and roadmap governance. |
| `docs/delivery-architecture.md` | Delivery lifecycle, milestone design, dependency handling, and completion flow. |
| `docs/prd.md` | Confirmed product requirements and Version 1 scope. |
| `docs/modules.md` | Module workflows, capabilities, and boundaries. |
| `docs/database.md` | Entity, field, relationship, enum, and data-rule details. |
| `docs/architecture.md` | Current application architecture and platform shape. |
| `docs/roadmap.md` | Phased sequencing for implementation work. |
| `docs/ideas.md` | Unapproved future concepts and candidate product ideas. |
| `docs/engineering-principles.md` | Engineering defaults for implementing approved product direction. |
| `docs/engineering-quality-standards.md` | Definition of Done and quality process for product changes. |
| `docs/testing-strategy.md` | Test policy and quality gates for implemented behavior. |
