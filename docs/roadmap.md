# Roadmap

This document is the canonical phased implementation plan for NAM Dashboard.

Product vision, MVP definition, and long-term product direction live in
[Product Vision](product-vision.md). Product delivery order, priority, deferred
scope, and roadmap governance live in [Product Roadmap](product-roadmap.md).
Delivery lifecycle, milestone design, dependency handling, and completion flow
live in [Delivery Architecture](delivery-architecture.md).

This roadmap sequences module-by-module implementation work for confirmed and
future phases.

## Table Of Contents

- [STOP Cards Roadmap](#stop-cards-roadmap)
- [Daily Inspections Roadmap](#daily-inspections-roadmap)
- [Operational Safety Checklists Roadmap](#operational-safety-checklists-roadmap)
- [Defect Tracking Roadmap](#defect-tracking-roadmap)
- [Work Authorization Roadmap](#work-authorization-roadmap)
- [Work Schedule Roadmap](#work-schedule-roadmap)
- [Timesheet Roadmap](#timesheet-roadmap)
- [Daily Log And Historical Search Roadmap](#daily-log-and-historical-search-roadmap)
- [Dragline Delay Reports Roadmap](#dragline-delay-reports-roadmap)
- [Knowledge Base Roadmap](#knowledge-base-roadmap)
- [Payslip Repository Roadmap](#payslip-repository-roadmap)
- [Equipment Fuel Events Roadmap](#equipment-fuel-events-roadmap)
- [Operational Pilot Readiness Roadmap](#operational-pilot-readiness-roadmap)
- [Supply Requests Roadmap](#supply-requests-roadmap)
- [Equipment Activity Timeline](#equipment-activity-timeline)
- [Infrastructure Roadmap](#infrastructure-roadmap)

## STOP Cards Roadmap

Feature implementation architecture:

`docs/architecture/features/stop-cards.md`

Current status: Requirements, data model, V1 CRUD, feature-owned filtering, and
Day View participation are implemented. Future enhancements remain deferred.

### Phase 1: Requirements Definition

- Confirm V1 STOP Card fields from the product requirements.
- Define category and status options.
- Define Day View result behavior for STOP Card records.
- Confirm whether created-by context is manual text for V1.
- Defer photos until attachment architecture is approved.

### Phase 2: Data Model Design

- Define STOP Card entity.
- Define date, category, location, description, corrective action, and status
  fields.
- Define optional links to Daily Logs and future safety modules.
- Define indexes needed for date and status lookup.

### Phase 3: V1 Implementation

- Create and edit STOP Card records manually.
- List and review STOP Card records.
- Search or filter STOP Cards by date and status where useful.
- Show STOP Cards in Day View for the selected date.
- Keep STOP Cards independent from Daily Work Logs while allowing future links.

### Phase 4: Future Enhancements

- Add photo or attachment support after attachment architecture exists.
- Add safety statistics after enough reliable records exist.
- Add approval or review workflow only if multi-user behavior is approved.
- Add exports or reports after V1 manual records prove useful.

## Daily Inspections Roadmap

Feature implementation architecture:

`docs/architecture/features/daily-inspections.md`

Current status: Requirements, data model, V1 CRUD, current-schema
feature-owned filtering, and Day View participation are implemented. Inspector
filtering is blocked until an inspector field or identity source is approved.

### Phase 1: Requirements Definition

- Confirm V1 Daily Inspection fields from the product requirements.
- Define condition, status, and defect-indicator options.
- Define Day View result behavior for Daily Inspection records.
- Confirm how equipment hours should be captured for V1.
- Defer photos until attachment architecture is approved.

### Phase 2: Data Model Design

- Define Daily Inspection entity.
- Define date, shift, equipment, equipment hours, findings, condition, defect
  indicator, and notes fields.
- Define optional links to Daily Logs, STOP Cards, Defects, and future Shift
  Reports.
- Define indexes needed for date, equipment, condition, and defect lookup.

### Phase 3: V1 Implementation

- Create and edit Daily Inspection records manually.
- List and review Daily Inspection records.
- Search or filter Daily Inspections by date, equipment, status, and text where
  useful.
- Add inspector filtering only after the Daily Inspection record has an approved
  inspector field or relationship.
- Show Daily Inspections in Day View for the selected date.
- Keep Daily Inspections independent from Daily Work Logs and STOP Cards while
  allowing future links.

### Phase 4: Future Enhancements

- Add photo or attachment support after attachment architecture exists.
- Preserve the implemented summary-inspection workflow while Operational Safety
  Checklists remain a distinct implemented record type within the same bounded
  context.
- Extend explicit Defect source links to Operational Safety Checklists only if
  the checklist architecture approves operator-controlled traceability.
- Add inspection statistics after enough reliable records exist.
- Add approval or review workflow only if multi-user behavior is approved.
- Add exports or reports after V1 manual records prove useful.

## Operational Safety Checklists Roadmap

Boundary assessment:

`docs/architecture/equipment-operations.md`

Current status: Operational discovery and boundary assessment are complete.
Phase 21.3.1 resolved workflow, uniqueness, lifecycle, correction, deletion,
identity, template-selection, and problem-context decisions. Feature
architecture is Approved. Phase 21.3.2 completed the canonical Dragline and
Mobile V1 catalogs, and Phase 21.3.3 resolved integer-only Hour Meter
validation. Phase 21.4 implemented the V1 foundation and feature-owned history
filtering, completed correction review, and received independent acceptance.
Phase 21.5 integrated the accepted capability into the repository knowledge
graph and formally closed Phase 21. Phase 24.1 implements selected-date Day
View participation through a feature-owned summary query.

### Phase 1: Product And Boundary Discovery (Complete)

- Confirm separate Dragline Inspection and Mobile Inspection source workflows.
- Confirm shared metadata and response vocabulary.
- Distinguish start-of-shift Equipment checklists from implemented Daily
  Inspection summary records.
- Exclude Planner Review and automatic Defect creation from the operator-owned
  V1 workflow.

### Phase 2: Feature Architecture (Complete)

- Preserve the verified Dragline and Mobile V1 catalogs in
  `docs/reference/checklists/`.
- Preserve integer-only V1 Hour Meter values from `0` through `999999`, with
  the maximum treated as an implementation validation guard.
- Preserve the resolved one-record-per-Equipment/date/shift uniqueness,
  complete-only submission, explicit correction, no-deletion, person snapshot,
  problem-context, template, Defect, history, and future Day View boundaries.

### Phase 3: V1 Foundation (Complete)

- Implement the approved checklist architecture as a feature-owned vertical
  slice.
- Preserve Dragline and Mobile item differences without a generic configurable
  form engine.
- Validate the persistence behavior against PostgreSQL.

### Phase 4: Confirmed Enhancement Architecture (Complete)

- Amend the approved architecture for explicit `HOURS` and `MILES` meter
  units. Work Truck defaults to Miles and Dragline to Hours as editable
  suggestions; Tractor and Forklift receive no default.
- Define optional checklist-level image evidence with captions, including
  storage, privacy, backup, serving, cleanup, and correction behavior.
- Define a clear modern confirmation that means the NAM record was saved and
  does not claim an external corporate submission.
- Preserve complete-only persistence and explicit correction.

Phase 23.3 completed this architecture. ADR-018 approves private local media
storage and requires an explicit access gate before real photo use.

### Phase 5: Meter Units And NAM Save Confirmation (Complete)

- Add `MILES` to the existing checklist meter enum through one additive
  migration; preserve existing `HOURS` rows unchanged.
- Require a visible, explicit whole-number `HOURS` or `MILES` selection.
- Use editable Work Truck and Dragline defaults with confirmed mismatch
  warnings; do not add Equipment preferred-meter metadata.
- Add Post/Redirect/Get NAM-only create/correction confirmation and a safe
  Create Another workflow.
- Keep photo storage, media packages, Docker volume changes, and routes out of
  this slice.

Phase 23.4 completed this slice with one additive enum migration, explicit
meter-unit validation, editable defaults, transient mismatch confirmation,
signed NAM-only save results, Create Another, and focused PostgreSQL-backed
validation.

Phase 23.4.2 completed acceptance corrections with one additive internal
`recordVersion` migration, atomic correction increments, monotonic result-marker
supersession, Compose/build-safe secret interpolation, and bare-detail fallback
after nonessential post-commit presentation failure.

### Phase 6: Optional Photo Evidence (Access-Gated)

Status: Blocked; no implementation milestone is active.

- Add checklist-owned photo metadata, private normalized media storage,
  upload/manage/serve actions, cleanup, backup, and verification only after the
  ADR-018 access and runtime prerequisites close and a separate implementation
  milestone is authorized.
- Keep photo evidence optional and checklist-level; do not create Defects,
  Daily Log records, or a generic attachment platform.

### Phase 7: Day View Participation (Complete)

- Add Operational Safety Checklist Day View participation only through a
  separately approved feature-owned contribution.

Phase 24.1 implements the bounded selected-date query, historical snapshot
summary, response-condition counts, source links, and explicit Day View
section without cross-feature mutation.

### Phase 8: Future Enhancements

- Add explicit operator-controlled Defect links if approved.
- Add Planner Review only if future identity and multi-user workflows require
  it.
- Add analytics, exports, or configurable administration only after separate
  approval.

## Defect Tracking Roadmap

Feature implementation architecture:

`docs/architecture/features/defect-tracking.md`

Current status: Feature architecture, data model, V1 list/create/detail/edit
foundation, lifecycle validation, feature-owned filtering, and Day View
participation are implemented.

### Phase 1: Architecture And Domain Confirmation (Complete)

- Review and approve the Defect Tracking feature architecture.
- Use the approved required severity and priority classifications and controlled
  lifecycle transitions.
- Use the approved resolution, closure, and Resolved-to-In-Progress rules.
- Require Equipment, derive Mine context through Equipment, and allow an
  optional Daily Inspection source relationship.
- Keep attachments, approvals, audit history, analytics, reporting,
  notifications, global search, and automation deferred.

### Phase 2: Data Model Design (Complete)

- Define the Defect entity, indexes, enums, and migration.
- Define the required Equipment relationship, derived Mine context, and
  reported-date semantics without adding `mineId` to Defect.
- Define the optional Daily Inspection source relationship with one inspection
  to zero-or-many defects and zero-or-one source inspection per defect.
- Define mutable corrective-action and resolution fields plus resolution and
  closure timestamps directly on Defect.
- Define delete behavior and lifecycle constraints.
- Do not assume a unique Daily Log exists for a date and shift.

### Phase 3: V1 Implementation (Complete)

- Add feature-owned list, create, detail, and edit workflows.
- Add Server Actions, Zod validation, Prisma persistence, and route states.
- Add practical feature-owned filtering.
- Add selected-date Day View participation through a Defect Tracking-owned
  helper.
- Add proportional validation, filter, date-helper, and persistence coverage.

### Phase 4: Future Enhancements

- Add attachments or photos only after attachment architecture exists.
- Add approvals or audit history only after identity and workflow requirements
  are approved.
- Add analytics, reporting, notifications, global search, or automation only as
  separate milestones.
- Add deeper neighboring-module links only when concrete workflows require
  them.

## Work Authorization Roadmap

Shift Reports feature architecture:

`docs/architecture/features/shift-reports.md`

Work Authorizations feature architecture:

`docs/architecture/features/work-authorizations.md`

Current status: The V1 foundation, required Shift Report relationship,
lifecycle validation, feature-owned filtering, and Day View participation are
implemented. Richer technician/signature structures, deeper permit records, and
broader related-record links remain future work.

### Phase 1: Requirements Definition

- Document Work Authorization source forms
- Identify required and optional permits
- Define relationship between Shift Reports and Work Authorizations
- Define completion checklist requirements
- Define Work Authorizations implementation architecture in
  `docs/architecture/features/work-authorizations.md`
- Confirm V1 scope

### Phase 2: Data Model Design

- Define WorkAuthorization entity
- Define WorkAuthorizationPermit entity
- Define WorkAuthorizationTechnician entity
- Define WorkAuthorizationCompletionChecklist entity
- Define required relationship to ShiftReport

### Phase 3: V1 Implementation

- Create Work Authorization records from inside a Shift Report
- Capture core Work Authorization fields
- Capture technician names and signatures
- Track required and optional permits
- Default Lockout Permit Required to Yes
- Require a reason when Lockout Permit Required is No
- Capture completion checklist before closing the Work Authorization
- Filter Work Authorization history by parent Shift Report date, equipment,
  status, work type, and text.

### Phase 4: Future Enhancements

- Generate paper-style PDF exports matching original forms
- Add audit history
- Add approval workflow
- Add reusable permit templates
- Add automatic permit suggestions based on work type

## Work Schedule Roadmap

Feature implementation architecture:

`docs/architecture/features/work-schedule.md`

Current status: Product discovery, feature architecture, and V1 foundation are
complete. The implementation provides the weekly grid, independent daily
assignments, planned-versus-actual preservation, canonical Employee selection,
crew participants and snapshots, supervisor-eligible Assigned By context,
equipment-derived location context, and feature-owned validation described in
the feature architecture. Day View participation is implemented through a Work
Schedule-owned selected-date context helper.

### Phase 1: Requirements Definition (Complete)

- Confirm Work Schedule represents employee assignments to equipment.
- Confirm a Weekly Schedule is the planning container for independent Daily
  Assignments.
- Confirm planned assignment information and actual assignment information must
  be preserved separately.
- Confirm crew and partner history should preserve planned and actual crew
  without becoming an enterprise workforce-management system.
- Confirm manual entry remains the V1 workflow and SMS or AI-assisted import
  remains deferred.

### Phase 2: Feature Architecture (Complete)

- Define Weekly Schedule and Daily Assignment ownership.
- Define planned and actual assignment data.
- Define planned and actual crew participants.
- Define Assigned By source context.
- Define equipment-derived historical location context.
- Define weekly grid UI, validation, queries, mutations, and Day View
  participation boundaries.

### Phase 3: V1 Foundation Implementation (Complete)

- Add Work Schedule data model and migration.
- Create feature-owned list/archive, weekly grid create, detail, and edit
  workflows.
- Save Weekly Schedule and Daily Assignment records through feature-owned Server
  Actions and Zod validation.
- Preserve planned values when actual assignment values differ.
- Capture planned and actual crew participants.
- Use canonical Employee references for primary employee, planned/actual crew,
  and supervisor-eligible Assigned By selection while retaining historical
  display snapshots.
- Capture Assigned By and optional schedule-level source metadata.
- Preserve equipment-derived historical location display context.
- Add proportional validation, query, and persistence tests.

### Phase 4: Day View Participation (Complete)

- Add Work Schedule-owned selected-date or containing-week read helper.
- Show Work Schedule context in Day View without moving schedule business logic
  into Day View.
- Distinguish no assignment from module errors and unavailable schedule context.

### Phase 5: Future Enhancements

- Add reminders for upcoming assignments
- Add calendar export or sync
- Add schedule change notifications

## Timesheet Roadmap

Feature implementation architecture:

`docs/architecture/features/timesheets.md`

Current status: Product decisions and feature architecture are approved. The
V1 data model, weekly entry workflow, reference management, lifecycle,
proportional tests, selected-date Day View participation, and feature-owned
Timesheet History filtering are implemented. Submitted and locked lifecycle
states, external submission, global search, reporting, and Payslip
reconciliation remain deferred.

### Phase 1: Requirements Definition (Complete)

- Confirm Timesheet represents one employer payroll week independent from Work
  Schedule's Monday-Sunday planning week.
- Confirm Weekly Timesheets are created through explicit first-use mutations,
  not read-only page views.
- Confirm Daily Time Entries are independent worked-time records.
- Confirm optional Work Schedule Daily Assignment relationship.
- Confirm Work Allocations explain where worked hours went.
- Confirm Timesheet-owned reusable Work Codes, Work Orders, and Support
  Personnel.
- Confirm Draft and Completed are the V1 lifecycle states.
- Defer Day View participation and global cross-module search.

### Phase 2: Feature Architecture (Complete)

- Define Weekly Timesheet ownership.
- Define Daily Time Entry ownership and calculated worked-time fields.
- Define Work Allocation ownership, sequencing, and reconciliation rules.
- Define Work Code, Work Order, and Support Personnel reference records.
- Define optional Work Schedule Daily Assignment context.
- Define validation, lifecycle, weekly UI, queries, mutations, and testing
  strategy.
- Confirm Monday-through-Sunday payroll week, centralized weekly overtime
  policy, integer-minute calculations, owner key uniqueness, reference
  snapshots, and lifecycle correction rules.

### Phase 3: Data Model And V1 Foundation Implementation (Complete)

- Add Timesheet data model and migration.
- Add Timesheet-owned Work Codes, Work Orders, and Support Personnel.
- Add feature-owned weekly view, explicit first-use weekly container creation, Daily
  Time Entry editing, and Work Allocation editing.
- Calculate worked minutes from clock in, clock out, and unpaid break duration.
- Reconcile Work Allocation totals with calculated worked minutes before
  completion.
- Derive regular and overtime minutes through the centralized Timesheet weekly
  overtime policy.
- Add feature-owned Server Actions, validation, queries, and proportional
  tests.

### Phase 4: Day View Participation (Complete)

- Add a Timesheet-owned selected-date context query.
- Show compact worked-time, regular/overtime, Equipment, allocation, Work Code,
  optional Work Order, and Support Personnel context after Work Schedule.
- Keep payroll and reconciliation interpretation inside Timesheet.
- Preserve Day View as a read-only composition surface.

### Phase 25.1: Timesheet History Filtering Discovery (Complete)

- Confirm `/timesheets` as the canonical Timesheet History surface with Weekly
  Timesheets as the result unit.
- Approve payroll-week overlap, status, Equipment, Work Code, Work Order,
  Support Personnel, and overtime filters using existing Timesheet relations
  and snapshots.
- Confirm nested same-entry and same-allocation matching, deterministic
  page-number pagination, and no schema or migration requirement.

### Phase 25.2: Timesheet History Filtering Implementation (Complete)

- Implement URL-addressable Timesheet-owned history filtering on `/timesheets`.
- Add compact Daily Time Entry summaries using persisted totals and historical
  snapshots while preserving Weekly Timesheet ownership.
- Enforce coherent same-entry and same-allocation matching with deterministic
  50-row page-number pagination.
- Preserve the existing Timesheet lifecycle, editor, snapshots, and Day View
  behavior without a schema or migration change.

### Phase 5: Future Enhancements

- Add submitted and locked lifecycle states if external workflow requires them.
- Add richer reports comparing Work Schedule, Daily Log, Timesheet, and Payslip records
- Add import/export if a reliable source format becomes available
- Evaluate WFS integration only if the security and maintenance tradeoffs are acceptable

## Daily Log And Historical Search Roadmap

Feature implementation architecture:

`docs/architecture/features/daily-work-logs.md`

Day View feature architecture:

`docs/architecture/features/day-view.md`

Current status: Daily Log CRUD, multiple activities, feature-owned filtering,
date navigation, Work Schedule context, and Day View participation are
implemented. Richer related-record links and global cross-module search remain
planned or deferred as described below.

### Phase 1: Requirements Definition

- Define Daily Log activity categories
- Define required fields for a daily activity entry
- Define feature-specific Daily Log relationships without a generic relation
  model. Knowledge Base V1 later owns an optional outbound source Daily Log
  reference rather than a Daily Log-owned Knowledge Base link.
- Define calendar view requirements
- Define Day View result groups for exact-date records and containing-period records
- Define global search filters and result types

### Phase 2: Data Model Design

- Define DailyLog entity
- Define DailyLogActivity entity
- Define common date, timestamp, equipment, and attachment patterns across modules
- Define cross-module search strategy
- Define future WorkOrder relationship points

### Phase 3: V1 Implementation

- Create and edit Daily Logs
- Add multiple activity entries per Daily Log
- Link Daily Log activities to equipment and available related records
- Search Daily Logs by date, text, equipment, activity type, contractor, or company
- Add calendar navigation for historical daily records
- Show Work Schedule context for the selected date in Day View

### Phase 4: Future Enhancements

- Add richer cross-module global search
- Add full historical timeline view for any selected date
- Add Work Order module integration
- Add advanced analytics from Daily Log activities

## Dragline Delay Reports Roadmap

Approved feature implementation architecture:

`docs/architecture/features/dragline-delay-reports.md`

Current status: DDR-1 is implemented as the independent usable Draft
foundation. The original Dragline Delay Report front and official Delay Code
Legend are preserved and visually verified. The
[Delay Code Catalog V1](reference/dragline-delay-reports/delay-code-catalog-v1.md)
is the canonical source-derived 66-entry transcription and is implemented as a
feature-owned application catalog. DDR-1 through DDR-3 are implemented,
including production/progress Draft entry, explicit completion, Completed
read-only detail, and reasoned correction history.

### DDR-1 — Independent Draft Report Foundation

Status: Implemented

Target:

- Additive Dragline Delay Report persistence and migration.
- Source-verified, versioned official Delay Code catalog from
  `docs/reference/dragline-delay-reports/delay-code-catalog-v1.md`.
- Required active Dragline Equipment/date/Day-or-Night identity with derived
  Mine/City and historical snapshots.
- Canonical Employee operator and supervisor relationships with ordered
  report-owned operator participation and historical snapshots.
- Draft history, create, edit, and detail surfaces.
- Stable timeline child identities, actual-time entry, concurrent equal-time
  rows, and deterministic overnight chronology.
- Explicit per-entry downtime meaning.
- Integer-minute interval-union downtime and server-derived runtime from 720
  minutes.
- Station parser, normalization, absolute-feet, and Advance helpers with
  focused tests; DDR-2 applies absolute-distance semantics in both directions.
- Optimistic stale-version protection for repeated Draft saves.
- Required nonnegative whole-number Starting Hour Meter and optional
  whole-number Ending Hour Meter while Draft.

Exclusions:

- No Daily Log or `DailyLogActivity` change.
- No existing Shift Report change.
- No Day View participation.
- No attachments, photos, or media infrastructure.
- No global shift enum redesign.
- No Work Schedule dependency.
- No decimal hour-meter storage or inferred precision.

### DDR-2 — Production / Progress / End-of-Shift Draft Entry

Status: Implemented

Target:

- Source-verified production and end-of-shift fields.
- Normal Digging Buckets and Benchfill Buckets.
- Canonical Mine-owned Lake reference, Mine-filtered selection, and historical
  display-name snapshot; Direction is intentionally excluded.
- Station Start and End with server-derived absolute Advance.
- Derived Run Time and Down Time.
- Manual Depth in feet.
- Manual Fuel in gallons, independent from Equipment Fuel Events.
- Optional Cable Drag and Hoist in feet.
- Repeatable ordered manual Ground Check times.
- Comments, optional Safety Items Found, and optional Action Taken.
- Failure-state preservation for every header, timeline, DDR-2 field, and
  repeated row, with clear pending/error/success feedback.

Completion-requiredness was closed for DDR-3 without making optional DDR-2
production/progress fields mandatory.

### DDR-3 — Completion / Correction

Status: Implemented

Target:

- Explicit `DRAFT -> COMPLETED` transition.
- Completed read-only detail by default.
- Explicit Correct Report workflow on the same stable identity.
- Required correction reason.
- Optimistic stale-version protection for completion and correction races.
- Durable lightweight correction-event history sufficient to show each
  correction occurred without generic revision infrastructure.
- Completion requires Ending Hour Meter, at least one Operator, Supervisor,
  and final chronological Code 13 — Shift Change; equal-time events use stable
  sequence as the tie-breaker.
- Optional DDR-2 fields remain optional at completion.
- Failed completion and correction preserve all header, timeline, production,
  Ground Check, closing-note, and correction-reason form state with clear
  validation/persistence feedback.

Future Dragline Delay Report Day View participation requires separate
authorization. Future Daily Log redesign remains a separate product and
architecture milestone.

## Knowledge Base Roadmap

Current status: **Knowledge Base V1 — Personal Operational Knowledge Records**
is implemented, formally accepted, and canonically closed through Phase 28.9.
Phase 28 is closed. The canonical Level 2 architecture is in
[Knowledge Base V1 Architecture](architecture/features/knowledge-base.md).
Phase 29 has not started and is not authorized.

### Phase 28.1 — Knowledge Base Product Discovery And V1 Decision Closure

Status: Complete and accepted

Closed the reusable-knowledge problem, single-user boundary, five fixed content
kinds, separate trust and lifecycle states, restricted Markdown, General/Mine/
Equipment context, reviewed-history behavior, search/filter scope, optional
Daily Log and Defect navigation, archive/delete behavior, Day View exclusion,
safety boundary, and deferred scope.

### Phase 28.2 — Knowledge Base V1 Feature Architecture

Status: Complete and accepted

Defines stable-root ownership, explicit current-revision authority, selective
reviewed revision retention, context snapshots, external references, optional
relationships, create/edit/review/revise/archive/restore/delete transactions,
restricted-Markdown safety, search/filter routes, concurrency, migrations,
tests, and a dedicated disposable PostgreSQL evidence plan.

Phase 28.2.1 independently reviewed and corrected the architecture. Phase
28.2.2 records formal architecture acceptance. Product decisions remain
Confirmed, architecture is Approved, and the architecture milestone is closed.

### Implemented Delivery Sequence

Phases 28.3A through 28.8 below were separately authorized, independently
reviewed, formally accepted, committed, and closed. Phase 28.9 completed the
documentation-only canonical closure:

1. Phase 28.3A — Knowledge Base Persistence Foundation
2. Phase 28.3B — Transactional Create And Current Detail
3. Phase 28.4 — Canonical Knowledge Base Search And Filtering
4. Phase 28.5 — Unverified Editing And Personal Review
5. Phase 28.6 — Reviewed Revision History And Content-Kind Change
6. Phase 28.7 — Archive, Restore, And Permanent Delete
7. Phase 28.8 — Daily Log And Defect Relationships
8. Phase 28.9 — Knowledge Base V1 Acceptance And Canonical Closure

Phases 28.3A through 28.8 and Phase 28.9 are complete and accepted. Phase 28 and
Knowledge Base V1 are closed. Phase 29 has not started and is not authorized.
Photos, attachments, documents, authentication, multi-user collaboration, AI,
global search, offline use, Day View participation, Equipment Activity Timeline
integration, analytics, reports, exports, and generic platform infrastructure
remain outside V1. No later Knowledge Base phase or future enhancement is
authorized by this closure.

## Payslip Repository Roadmap

Current status: Conceptually planned under ADR-005, but implementation is
blocked by unresolved privacy, application-access, file-storage, extraction,
redaction, and export decisions. No accepted Level 2 feature architecture or
implementation authorization exists. The phases below are conceptual planning
inputs, not an active delivery sequence.

### Phase 1: Requirements Definition

- Confirm required payslip upload workflow
- Identify payroll provider format from sample PDFs
- Define required payroll header fields
- Define earnings, deductions, taxes, employer contributions, and payment distribution line-item categories
- Define calendar lookup behavior by pay date and pay period
- Define financial privacy requirements

### Phase 2: Data Model Design

- Define PayslipDocument entity
- Define Payslip entity
- Define PayslipEarningLine entity
- Define PayslipDeductionLine entity
- Define PayslipTaxLine entity
- Define PayslipEmployerContributionLine entity
- Define PayslipPaymentDistribution entity
- Define PayslipExtractionField entity
- Define duplicate detection strategy using file hash and payroll identifiers

### Phase 3: V1 Implementation

- Upload and store payslip PDFs
- Extract PDF text when available
- Run OCR fallback for image-based PDFs
- Parse core header fields, totals, and line items
- Show extraction status and confidence
- Allow manual correction of extracted values
- Search payslips by pay date, pay period, amount, and line-item type
- Show basic date-range and annual totals for gross pay, net pay, taxes, deductions, 401k, insurance, and employer contributions

### Phase 4: Future Enhancements

- Add advanced compensation dashboards
- Add CSV or spreadsheet export
- Add tax-year summary reports
- Add payroll-provider specific parser templates
- Add automatic Workday import only if the security and maintenance tradeoffs are acceptable
- Add encryption-at-rest and redacted display modes for sensitive financial fields

## Equipment Fuel Events Roadmap

Boundary assessment:

`docs/architecture/equipment-operations.md`

Approved feature architecture:

`docs/architecture/features/equipment-fuel-events.md`

Current status: V1, Phase 24.1 Day View participation, and Fuel Events V2 Phase
1 are implemented. V2 Phase 2A is approved for implementation by ADR-020.

### Phase 1: Product And Boundary Discovery (Complete)

- Confirm one operational fueling occurrence belongs to one Equipment subject.
- Confirm one occurrence may contain multiple tank-fill quantities.
- Confirm delivered quantity comes from the fuel-service person.
- Keep optional Daily Work Log narrative context independent.
- Exclude Fleet gas-station receipts, fuel cards, mileage, car washes, and
  temporary vehicle assignment.
- Exclude Timesheet Work Allocation ownership.

### Phase 2: Feature Architecture (Complete)

- Approved operational work date plus actual local event time.
- Approved Diesel, Off-road Diesel, and Gasoline as the fixed V1 fuel types.
- Approved one or more ordered Tank Fills using positive integer whole US
  gallons, suggested labels with manual override, and server-derived totals.
- Approved conservative fill-count, label, quantity, total, and notes guards,
  including unique normalized labels within one event.
- Excluded meter and level readings; Hour Meter remains owned by Operational
  Safety Checklists.
- Approved optional feature-owned Fuel Service Person references with inline
  creation, active/inactive retirement, normalized uniqueness, deletion
  protection, and historical name snapshots.
- Approved completed-only persistence, explicit correction, no normal
  deletion, limited Equipment/location snapshots, and structured V1 filters.
- Approved optional explicit Daily Work Log fueling-activity context while
  preserving independent ownership through a unique nullable Fuel Event-owned
  link with SetNull-style deletion behavior.
- Deferred Day View, Fleet purchase evidence, analytics, and reporting.

### Phase 3: V1 Foundation (Complete)

- Implement manual Equipment Fuel Events and tank-fill history.
- Add feature-owned validation, persistence, structured history filtering,
  queries, and tests.
- Validate the schema and event operations against PostgreSQL.

### Phase 4: Day View Participation (Complete)

- Add Day View participation through a feature-owned display-ready date query.

Phase 24.1 implements the bounded chronological query, historical Equipment and
Fuel Service Person context, ordered Tank Fill summaries, persisted total, and
source links without moving fuel interpretation into Day View.

### Phase 5: Fuel Events V2 Phase 1 (Complete)

- Preserve complete raw form state across recoverable failures.
- Remove Fuel Service Person and Daily Work Log controls while preserving
  hidden historical relationships on correction.
- Stabilize transient Tank Fill row identity and give Notes its own section.

### Phase 6: Fuel Events V2 Phase 2A (Approved)

- Add lightweight reusable Gas Stations with active/inactive management.
- Add event-level Decimal price, fractional gallons, exact totals, meter facts,
  and optional receipt reference.
- Revise create, correction, detail, and success-confirmation presentation.
- Preserve legacy rows without fabricated backfills.

### Phase 6.1: Canonical U.S. Geography Reference Data (Implemented; Deployment Pending)

- Add canonical State identity while preserving existing City IDs and consumer
  foreign keys.
- Add idempotent offline import for 50 States, District of Columbia, and broad
  U.S. Census Places.
- Add non-destructive State and City management with search and State filters.
- Reuse canonical searchable Cities in Gas Stations and canonical State labels
  in Mine-derived Equipment context.
- Keep ZIP data, geocoding, maps, territories, and runtime geography services
  deferred.

### Phase 7: Future Enhancements

- Evaluate approved operational totals and reporting only after reliable event
  history exists.
- Evaluate Equipment usage trends only after enough reliable history exists.
- Keep global cross-module search and automated forecasting deferred.
- Keep receipt-image upload deferred.

## Operational Pilot Readiness Roadmap

Canonical procedure:

`docs/infrastructure/operational-pilot-runbook.md`

Current state and gate ordering authority:

`docs/infrastructure/controlled-pilot-readiness-rebaseline.md`

Current status: Phase 24.2 readiness assessment and Phase 24.2.1 runbook
preparation are complete. ADR-019 approves a managed private overlay. Tailscale
is installed, connected, and configured to Serve the loopback application, but
private HTTPS, policy/device evidence, public-route removal, and independent
administrator recovery remain incomplete. The boundary is partially
implemented, not accepted, and the real-data pilot is not authorized.

The dependency-security correction at `4eba24f` is complete as unnumbered
readiness work. The Controlled Pilot Readiness Security and Deployment
Re-baseline is the current approved direction, also unnumbered. Documentation
authority re-baselining is in progress pending independent review;
access/deployment/recovery mutations and pilot execution remain separately
gated. Phase 29 does not exist and is not authorized.

### Phase 1: Close Pilot Gates

- Accept the ADR-019 private HTTPS and policy/device boundary and prove
  independent administrator recovery.
- Remove public NAM exposure over IPv4 and IPv6 only after the private path and
  recovery pass, and before the live database/application transition.
- Build an immutable current candidate with embedded repository identity.
- Create and disposable-restore a current 16-migration backup before applying
  migrations 17 through 20.
- Separately authorize and verify the 20-migration deployment, including Supply
  Requests, Knowledge Base, and eleven Day View contributors.
- Create and disposable-restore a current 20-migration backup after parity.
- Prepare and review minimum operational reference data without fabricating
  unknown facts.
- Confirm the first-shift scope and entry order.

### Phase 2: Controlled Use

- Run the bounded first-shift workflow only after every gate passes.
- Expand to a one-week pilot while preserving daily backups and a manual pilot
  log.
- Keep Phase 23.5 photo evidence blocked and unavailable.

### Phase 3: Evidence-Based Exit Review

- Classify blocking, significant, minor, and future findings.
- Select a next milestone only from observed operational need.
- Keep the parked pilot exit review separate from the explicitly selected
  Supply Requests feature series; it neither gates nor authorizes Phase 26.

## Supply Requests Roadmap

Boundary assessment:

`docs/architecture/equipment-operations.md`

Approved feature architecture:

`docs/architecture/features/supply-requests.md`

Current status: Phase 26.1 product discovery, Phase 26.2 feature architecture,
Phase 26.2.1 independent review, and Phase 26.2.2 formal architecture
acceptance are complete. The architecture is Approved. Phases 26.3A through
26.10 are implemented and accepted. Supply Requests V1 and its approved
delivery sequence are complete and accepted, including reference management,
create and current detail, lifecycle, correction, immutable history, canonical
history/filtering, explicit Submission/Fulfillment Daily Log Activity links,
and Day View participation. Deferred enhancements remain outside V1 and
require new product review, architecture review, and explicit authorization.

### Phase 26.1: Product Discovery And Decision Closure

Status: Complete

- Confirmed that NAM records a request already submitted through the external
  corporate system and does not submit or email it.
- Confirmed one required Equipment, one required supervisor, automatic
  requester snapshots, and one or more ordered catalog-item lines.
- Confirmed active/inactive Supply Item and supervisor references with
  historical snapshots.
- Confirmed permanent annual NAM Reference, operational and actual submission
  dates, Requested/Fulfilled/Cancelled lifecycle, no Draft, no ordinary delete,
  and no partial fulfillment.
- Confirmed explicit correction with a permanent reason and full immutable
  relational history.
- Confirmed bounded optional submission and fulfillment Daily Log Activity
  links, one operational-date Day View contribution, and feature-owned
  structured history filtering.
- Excluded warehouse administration, inventory, procurement, Work Orders,
  Defects, integrations, attachments, and generic audit or event frameworks.

### Phase 26.2: Feature Architecture

Status: Complete

- Synchronize approved decisions into canonical product, module, database, and
  roadmap documentation.
- Define the complete feature-owned persistence, versioning, lifecycle,
  filtering, Daily Log, Day View, validation, transaction, concurrency, and
  deletion architecture.
- Produce the Level 2 architecture, complete independent formal review, and
  record formal acceptance separately.
- Do not implement production code, Prisma schema, migrations, routes, actions,
  queries, components, or tests.

### Phase 26.2.1: Formal Architecture Review

Status: Complete

- Adversarially review canonical authority, immutable version ownership,
  current-pointer integrity, reference allocation, correction concurrency,
  reference snapshots, local-time semantics, Daily Log links, Day View,
  filtering, validation, transactions, PostgreSQL feasibility, testing, and
  delivery slicing.
- Correct architecture defects without changing approved product meaning.
- Recommend the corrected architecture for formal acceptance without
  authorizing implementation.

### Phase 26.2.2: Architecture Acceptance And Repository Synchronization

Status: Complete

- Formally accept the independently reviewed Supply Requests architecture.
- Mark the feature architecture Approved across canonical documentation.
- Preserve Phase 26.3A as the next implementation candidate, limited to
  persistence schema and real-PostgreSQL integrity proof.
- Preserve Phase 26.3B for transactional initial-create persistence.
- Keep both implementation checkpoints subject to separate explicit
  authorization.

### Phase 26.3: Persistence Foundation

Status: Complete and accepted

#### Phase 26.3A: Persistence Schema And PostgreSQL Integrity Proof

Status: Complete and accepted

- Added two enums and six persistence models for feature-owned references, the
  annual counter, stable root, immutable versions, and immutable ordered lines.
- Added one additive migration with ownership-constrained composite
  current-version integrity, approved unique constraints and indexes, and
  Cascade, Restrict, and SetNull referential actions.
- Proved the atomic annual-counter primitive, rollback, same-year concurrency,
  cross-request ownership rejection, migration-chain integrity, and deletion
  behavior in real PostgreSQL.
- Accepted 11 focused and 8 existing PostgreSQL regression tests with zero
  skipped tests; the full 437-test suite passed with zero skips.

#### Phase 26.3B: Transactional Initial-Create Persistence

Status: Complete and accepted

- Added strict create-input validation, immutable feature-owned requester
  configuration, and Item Number, supervisor-name, and supervisor-email
  normalization.
- Added authoritative active-reference reload and server-owned Equipment,
  Mine, City, requester, supervisor, and Supply Item snapshot capture.
- Added atomic annual NAM Reference allocation, stable-root creation, immutable
  version `1`, ordered immutable lines, and compound current-pointer
  establishment in one transaction.
- Added bounded whole-transaction retry and safe feature-owned persistence
  errors; ambiguous connection outcomes do not retry.
- Proved complete rollback, same-year and different-year concurrent creation,
  submitted-year semantics, snapshot stability, and absence of partial
  aggregates in real PostgreSQL.
- Accepted 27 focused unit tests, 11 Phase 26.3B PostgreSQL tests, 11 Phase
  26.3A PostgreSQL tests, and 8 existing PostgreSQL regressions with zero
  skipped tests; the full 475-test suite passed with zero skips and no schema
  drift.
- Routes, forms, reference-management UI, lifecycle actions, corrections,
  filtering, Daily Log links, and Day View remain unimplemented.

### Phase 26.4: Supply Item And Supervisor Reference Management

Status: Complete and accepted

- Added six management routes for Supply Item and Supply Request Supervisor
  list, create, and edit surfaces.
- Added database-owned search, active/inactive filtering, deterministic
  pagination, create and edit workflows, and explicit activate and inactivate
  actions.
- Reused feature-owned normalization and added strict validation and Server
  Action ownership, including rejection of unknown and duplicate submitted
  fields.
- Mapped only exact normalized Item Number and normalized-email uniqueness
  conflicts, including concurrent create and edit-collision behavior.
- Preserved historical Supply Request snapshots while used references remain
  editable and inactivatable and PostgreSQL continues to Restrict hard
  deletion.
- Proved inactive-reference request rejection, reactivation eligibility,
  aggregate isolation, concurrency, snapshot preservation, and cleanup in real
  PostgreSQL.
- Accepted 14 validation and normalization tests, 9 Server Action tests, 6
  query tests, 9 route/component tests, 6 Phase 26.4 PostgreSQL tests, 11 Phase
  26.3B PostgreSQL tests, 11 Phase 26.3A PostgreSQL tests, and 8 existing
  PostgreSQL regressions with zero skips; the full 519-test suite passed with
  zero skips and no schema drift.

### Phase 26.5: Supply Request Create And Initial Detail Surfaces

Status: Complete and accepted

- Added three operator-facing routes for create, current detail, and immutable
  original version `1`.
- Added America/New_York submission defaults and searchable active Equipment,
  supervisor, and Supply Item selection.
- Added explicit item Add behavior, quantity editing, removal, deterministic
  accessible ordering, and strict serialized nested-item validation.
- Required the exact corporate-submission confirmation and reused the accepted
  transactional `createSupplyRequest` boundary through one focused Server
  Action.
- Added safe commit-before-redirect behavior, field and aggregate errors, and
  submitted-state recovery without action-level retry.
- Made the explicit current-version pointer authoritative for current detail
  and rendered current and original detail from immutable snapshots.
- Preserved readability after live Equipment SetNull and provided
  informational Daily Work Log navigation without relationship persistence.
- Proved current-pointer authority, retirement races, rollback, Equipment
  SetNull, snapshot preservation, later-slice absence, and bounded cleanup in
  real PostgreSQL.
- Accepted 18 helper and unit tests, 8 Server Action tests, 7 query tests, 12
  route/component tests, 8 Phase 26.5 PostgreSQL tests, 6 Phase 26.4 PostgreSQL
  tests, 11 Phase 26.3B PostgreSQL tests, 11 Phase 26.3A PostgreSQL tests, and 8
  existing PostgreSQL regressions with zero skips; the full 572-test suite
  passed with zero skips and no schema drift.

### Phase 26.6 — Supply Request Fulfillment And Cancellation

Status: Complete and accepted

- Added explicit Requested-to-Fulfilled and Requested-to-Cancelled lifecycle
  routes and transitions.
- Added automatic America/New_York lifecycle timestamps, required fulfillment
  operational work date, optional Fulfillment Note, and optional Cancellation
  Reason.
- Added parameterized root-row locking with lock-before-read transaction
  ordering, explicit current-pointer authority, expected-current-version stale
  protection, and Requested-only transition validation.
- Added complete parent-snapshot and ordered item-line copying into immutable
  lifecycle versions with atomic same-owner current-pointer advancement.
- Added rollback-only bounded transaction retry with one stable lifecycle
  timestamp, attempt-owned regenerated IDs, and deterministic one-winner
  concurrency.
- Added Requested-state lifecycle controls and read-only Fulfilled and
  Cancelled terminal detail while preserving immutable Requested version `1`.
- Proved lifecycle transitions with inactive references and Equipment SetNull
  without refreshing stored snapshots.
- Made no Daily Log persistence, schema, migration, package, or infrastructure
  change.
- Accepted 11 lifecycle unit tests, 8 lifecycle Server Action tests, 8
  lifecycle query tests, 7 lifecycle route/component tests, 19 accepted surface
  regressions, 12 Phase 26.6 PostgreSQL tests, 8 Phase 26.5 PostgreSQL tests, 6
  Phase 26.4 PostgreSQL tests, 11 Phase 26.3B PostgreSQL tests, 11 Phase 26.3A
  PostgreSQL tests, and 8 existing PostgreSQL regressions with zero skips; the
  full 618-test suite passed with zero skips and no schema drift.

### Phase 26.7 — Correct Request And Full Immutable Version Review

Status: Complete and accepted

- Added `/supply-requests/[id]/correct` with a complete aggregate correction
  form, required Correction Reason, and automatic America/New_York correction
  metadata with corrected-by Alain Alemany snapshot.
- Added parameterized root locking, lock-before-read ordering, explicit
  current-pointer authority, expected-version stale protection, and stale
  comparison before replacement resolution.
- Added complete persisted-state integrity validation, exact preservation of
  unchanged reference snapshots, active authoritative changed-reference
  replacement, and active authoritative snapshots for newly added Supply
  Items.
- Added retained-item quantity and order changes, additions, removals, and
  Equipment SetNull active replacement without mutating older versions.
- Added one complete immutable `CORRECTED` version, complete ordered lines, and
  atomic same-owner current-pointer advancement.
- Added correction to Requested, Fulfilled, and Cancelled, including
  Fulfilled-to-Requested and Cancelled-to-Requested historical repair without
  normal Reopen semantics.
- Added Correction History summaries, general immutable version detail, and
  Original, Current, and Superseded classification.
- Loaded current detail and Correction History through one Repeatable Read
  snapshot.
- Proved correction concurrency, lifecycle races, rollback, retry, Equipment
  SetNull, decoy-pointer authority, historical preservation, and cleanup in
  real PostgreSQL.
- Accepted 9 Phase 26.7 unit tests, 6 Server Action tests, 8 query tests, 7
  route/component tests, 18 surface parser regressions, 10 Phase 26.7
  PostgreSQL tests, 12 Phase 26.6 PostgreSQL tests, 8 Phase 26.5 PostgreSQL
  tests, 6 Phase 26.4 PostgreSQL tests, 11 Phase 26.3B PostgreSQL tests, 11
  Phase 26.3A PostgreSQL tests, and 8 existing PostgreSQL regressions with zero
  skipped tests; the full 658-test suite passed with zero skips and no schema
  drift.
- Made no schema change and added no Daily Log persistence, Day View
  participation, partial fulfillment, normal Reopen, deletion, or generic
  audit infrastructure.

### Phase 26.8 — Canonical Supply Request History And Filtering

Status: Complete and accepted

- Added canonical `/supply-requests` with stable roots represented only by
  their explicit pointer-owned current versions; superseded versions remain in
  immutable request history.
- Added inclusive operational date, exact resulting status, Equipment,
  supervisor, normalized exact NAM Reference, current Item Number or
  Description snapshot, and current Notes filters.
- Added strict URL parsing with first repeated parameter behavior, runtime
  non-string safety, bounded nonfatal invalid notices, and preserved valid
  reversed ranges.
- Added database-owned AND predicates and one line-local relational item
  predicate over current immutable snapshots.
- Added active and currently used inactive Equipment and supervisor options,
  safe unavailable selected-reference state, and Equipment SetNull snapshot
  behavior.
- Added fifty-row pages, matching-count-first flow, server-only BigInt offset
  safety, safe out-of-range and huge pages, and exact deterministic database
  ordering.
- Added filter-preserving Previous and Next URLs using normalized URL encoding.
- Loaded count, current rows, Equipment options, and supervisor options through
  one Repeatable Read snapshot.
- Added explicit null-current-pointer and malformed-current-state integrity
  failure rather than misleading empty results.
- Added snapshot-first result rows and distinct no-request, filtered-empty,
  out-of-range, and query-failure states.
- Proved decoy-pointer authority, current-version filtering, inactive options,
  deterministic pagination, Repeatable Read consistency, Equipment SetNull,
  persisted-integrity rejection, read-only behavior, and bounded cleanup in
  real PostgreSQL.
- Accepted 11 parser/unit tests, 9 query tests, 8 route/component tests, 8 Phase
  26.8 PostgreSQL tests, 10 Phase 26.7 PostgreSQL tests, 12 Phase 26.6
  PostgreSQL tests, 8 Phase 26.5 PostgreSQL tests, 6 Phase 26.4 PostgreSQL
  tests, 11 Phase 26.3B PostgreSQL tests, 11 Phase 26.3A PostgreSQL tests, and
  8 existing PostgreSQL regressions with zero skipped tests; the full 694-test
  suite passed with zero skips and no schema drift.
- Made no schema change and added no Daily Log persistence, Day View
  participation, partial fulfillment, normal Reopen, deletion, generic audit,
  analytics, report, or export infrastructure.

### Phase 26.9 — Supply Request Daily Log Activity Linking

Status: Complete and accepted

- Added the `SUPPLY_REQUEST` Activity classification and Submission and
  Fulfillment link roles through one isolated migration.
- Added a stable-root-owned link model with one role link per Supply Request
  and global Activity uniqueness.
- Added explicit, bounded candidate Daily Log and Activity selection while
  preserving multiple same-date Daily Logs as separate choices.
- Added exact role dates and canonical titles, Fulfilled-status validation,
  corrected-to-Fulfilled eligibility, Activity and Daily Log date validation,
  and Equipment and Equipment SetNull compatibility.
- Added parameterized stable-root locking, target Activity protection,
  expected-link stale protection, idempotent same-target behavior, atomic
  replacement, and link-only removal.
- Added current-detail Submission and Fulfillment summaries and explicit Daily
  Log source presentation through the stable Supply Request identity.
- Added correction, Daily Log Activity edit, Daily Log date, and Equipment Fuel
  Event compatibility validation without silent unlinking or narrative
  rewriting.
- Preserved Activity, Daily Log, and exceptional Supply Request cascade owner
  boundaries.
- Proved link/correction, link/Activity-edit, and link/Activity-deletion
  concurrency, uniqueness, replacement rollback, compatibility, cascades, and
  cleanup in real PostgreSQL.
- Accepted 4 schema/migration tests, 14 validation/persistence unit tests, 7
  Server Action tests, 5 query tests, 10 route/component tests, 12 Phase 26.9
  PostgreSQL tests, 74 earlier PostgreSQL regressions, and 14 existing Daily
  Log tests with zero skips; the full 746-test suite passed with 18 disposable
  migrations and no schema drift.
- Added no automatic Daily Log or Activity creation, no silent unlinking, and
  no Supply Request-owned Activity narrative persistence.

### Phase 26.10 — Supply Request Day View Participation

Status: Complete and accepted

- Added one feature-owned selected-date query owned by stable Supply Request
  roots and their explicit current-version relation.
- Uses exact current operational-work-date equality, returns one structured
  entry per stable root, excludes superseded versions, and moves that entry
  when correction changes the current operational date.
- Returns resulting-status presentation, immutable Equipment and supervisor
  snapshots, Equipment SetNull readability, pointer-owned item count, submitted
  local date/time, NAM Reference, and a stable current-detail link without
  complete item arrays.
- Orders in PostgreSQL by submitted local date, submitted local time, NAM
  Reference, and stable root ID, all ascending, with no application-memory sort,
  deduplication, or silent limit.
- Preserves the existing explicit Day View parallel composition and every
  existing contributor while adding the Supply Requests section, count,
  selected-date empty state, and canonical filtered-history link.
- Keeps fulfillment Daily Log narrative and Supply Request Daily Log link state
  independent from structured Supply Request cardinality.
- Fails safely for invalid dates, malformed selected-current state, unexpected
  query failures, and unrelated null-pointer roots without converting failures
  into empty results.
- Is read-only and adds no schema change, migration, mutation, generic
  contributor registry, event, or audit persistence.
- Real PostgreSQL evidence proves pointer and decoy authority, correction date
  movement, lifecycle cardinality, snapshots, SetNull, current item count,
  deterministic ordering, link-state independence, read-only behavior, and
  cleanup with zero skipped tests and no drift.

### Supply Requests V1 Closure

Status: Complete and accepted

- Supply Requests V1 complete and accepted.
- Approved V1 delivery sequence complete.
- Phases 26.3A through 26.10 are implemented and accepted.
- No additional Supply Requests V1 implementation phase is planned.
- Deferred enhancements remain outside V1 and are not incomplete V1 work.
- Any future Supply Request enhancement requires new product review,
  architecture review, and separate explicit authorization.
- Controlled-pilot readiness is governed separately and is not authorized by
  this closure.

The operational pilot remains outside this feature series. Supply Requests
work does not resume or authorize it.

## Equipment Activity Timeline

Current status: Deferred derived capability. No feature architecture or
implementation is authorized.

Revisit only after several Equipment-centered features are implemented and
users demonstrate a recurring need to review one Equipment record across
modules and dates. The timeline should compose feature-owned queries rather
than store duplicate event records or introduce a generic contribution
registry. Potential contributors now include implemented Daily Inspections,
Operational Safety Checklists, Defect Tracking, Daily Work Logs, Equipment Fuel
Events, and Supply Requests, but technical availability does not satisfy the
demonstrated-demand prerequisite.

## Infrastructure Roadmap

### Phase 1: VPS Foundation

Status: Implemented

- Inspect the current VPS before making system-level changes
- Verify Ubuntu LTS baseline
- Verify Docker Engine installation
- Verify Docker Compose plugin installation
- Verify Docker service startup on boot
- Verify Docker access for the deployment user
- Verify PostgreSQL client installation
- Review firewall, SSH, package, disk, memory, and service state
- Leave SSH hardening, Caddy, firewall changes, and deployment files for later approved phases

### Phase 2A: Docker PostgreSQL Foundation

Status: Implemented

- Use /home/alain/projects/nam as the development project location
- Do not create /opt/nam during Phase 2A
- Create Docker Compose infrastructure for PostgreSQL only
- Use Docker Compose project name nam
- Use postgres as the PostgreSQL service name
- Use nam-network as the private Docker network
- Use postgres-data as the persistent PostgreSQL named volume
- Pin the PostgreSQL image to the PostgreSQL 18 major version
- Define environment variable conventions with .env and .env.example
- Run PostgreSQL on a private Docker network
- Store PostgreSQL data in a persistent named Docker volume
- Keep PostgreSQL unexposed to the host and Internet
- Add health checks for PostgreSQL
- Verify PostgreSQL startup, health, connectivity, and persistence
- Document manual PostgreSQL backup and restore commands in docs/infrastructure.md
- Store development PostgreSQL backups outside the Git repository at /home/alain/backups/nam/postgres/
- Document rollback steps for failed database initialization or Compose configuration errors
- Do not create the app service until Phase 2B

### Phase 2B: Application Container Foundation

Status: Implemented
- Scaffold the Next.js application only after Phase 2A is complete and verified
- Use pnpm for package management
- Configure TypeScript
- Configure Prisma and generate the initial Prisma Client
- Add Dockerfile strategy for the Next.js application
- Add app service to Docker Compose
- Connect the application container to PostgreSQL through the private Docker network
- Expose the application only on localhost during this phase
- Verify application startup, localhost access, database connectivity, and exposed ports
- Do not implement authentication, authorization, user management, feature modules, business logic, production deployment, Caddy, HTTPS, monitoring, or background workers during this phase

### Phase 3: Reverse Proxy And HTTPS

Status: Implemented for external development access through `dev.alemany.me`

- Install Caddy directly on the VPS host only after the Docker application stack is functional
- Configure Caddy as the only public reverse proxy
- Configure HTTPS for `dev.alemany.me`
- Keep `nam.alemany.me` reserved for future production use
- Reverse proxy public requests to the localhost-bound Next.js container
- Verify external access, certificate issuance, and certificate renewal behavior

### Phase 4: Production Operations

Status: Parked; production deployment is not implemented or authorized

- Define the production deployment location, possibly /opt/nam
- Automate PostgreSQL backups
- Test restore procedures
- Add retention policy for backups
- Evaluate off-server backup storage
- Add monitoring and logging only when they solve a real operational need
- Evaluate Redis, background workers, and object storage only when application requirements justify them
