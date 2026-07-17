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
filtering requires an approved inspector field before implementation.

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

- Add checklist-owned photo metadata, private normalized media storage,
  upload/manage/serve actions, cleanup, backup, and verification only after the
  ADR-018 access and runtime prerequisites close.
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
assignments, planned-versus-actual preservation, crew participants, Assigned By
source context, equipment-derived location context, and feature-owned
validation described in the feature architecture. Day View participation is
implemented through a Work Schedule-owned selected-date context helper.

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
proportional tests, and selected-date Day View participation are implemented.
Submitted and locked lifecycle states, external submission, global search,
reporting, and Payslip reconciliation remain deferred.

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

### Phase 5: Future Enhancements

- Add feature-owned Timesheet history filtering after foundation acceptance.
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
- Define how Daily Log entries link to equipment, Work Authorizations, future Work Orders, defects, inspections, KB notes, and attachments
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

## Payslip Repository Roadmap

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

Current status: Product decisions, feature architecture, and V1 foundation are
complete. Phase 24.1 selected-date Day View participation is implemented.

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

### Phase 5: Future Enhancements

- Evaluate approved operational totals and reporting only after reliable event
  history exists.
- Evaluate Equipment usage trends only after enough reliable history exists.
- Keep global cross-module search and automated forecasting deferred.

## Operational Pilot Readiness Roadmap

Canonical procedure:

`docs/infrastructure/operational-pilot-runbook.md`

Current status: Phase 24.2 readiness assessment is complete and Phase 24.2.1
runbook preparation is complete. The real-data pilot has not started and is not
authorized. No new feature implementation is required before operational
preparation continues.

### Phase 1: Close Pilot Gates

- Select and approve a private-access boundary; the current public
  unauthenticated endpoint does not qualify.
- Deploy and verify the intended current commit, including ten Day View
  contributors.
- Prepare and review minimum operational reference data without fabricating
  unknown facts.
- Create a current-schema baseline backup and prove it through a guarded
  disposable restore.
- Confirm the first-shift scope and entry order.

### Phase 2: Controlled Use

- Run the bounded first-shift workflow only after every gate passes.
- Expand to a one-week pilot while preserving daily backups and a manual pilot
  log.
- Keep Phase 23.5 photo evidence blocked and unavailable.

### Phase 3: Evidence-Based Exit Review

- Classify blocking, significant, minor, and future findings.
- Select a next milestone only from observed operational need.
- Treat Supply Requests discovery as a likely candidate, not an automatic next
  step.

## Supply Requests Roadmap

Boundary assessment:

`docs/architecture/equipment-operations.md`

Current status: Supply Requests are a confirmed discovery-stage feature.
Feature architecture is blocked by remaining product decisions.

### Phase 1: Product Discovery

- Confirm request lifecycle and retrieval questions.
- Confirm item, quantity, unit, destination, fulfillment, correction, and
  deletion behavior.
- Confirm whether one request may concern multiple Equipment records.
- Confirm which optional links to Defects, Daily Work Logs, or Work Orders have
  real operational value.
- Keep warehouse pickup for someone else's order in Daily Work Logs.

### Phase 2: Feature Architecture

- Begin only after the product workflow is complete.
- Preserve Supply Request ownership without inventory, purchasing, vendor, or
  ERP responsibilities.

### Phase 3: V1 Foundation

- Define only after feature architecture is approved.

## Equipment Activity Timeline

Current status: Deferred derived capability. No feature architecture or
implementation is authorized.

Revisit only after several Equipment-centered features are implemented and
users demonstrate a recurring need to review one Equipment record across
modules and dates. The timeline should compose feature-owned queries rather
than store duplicate event records or introduce a generic contribution
registry.

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

Status: Planned; production deployment is not implemented

- Define the production deployment location, possibly /opt/nam
- Automate PostgreSQL backups
- Test restore procedures
- Add retention policy for backups
- Evaluate off-server backup storage
- Add monitoring and logging only when they solve a real operational need
- Evaluate Redis, background workers, and object storage only when application requirements justify them
