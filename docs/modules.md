# Module Definitions

This document is the canonical home for NAM Dashboard module definitions,
workflows, capabilities, and module boundaries.

Product identity, users, business objectives, MVP, and long-term direction live
in [Product Vision](product-vision.md).

Product delivery order, priority, deferred scope, and roadmap governance live in
[Product Roadmap](product-roadmap.md).

Implementation standards for turning these modules into feature slices live in
[Feature Architecture](feature-architecture.md).

## Table Of Contents

- [Source Documents](#source-documents)
- [Equipment Reference Data](#equipment-reference-data)
- [Shift Reports](#shift-reports)
- [Work Authorizations](#work-authorizations)
- [STOP Cards](#stop-cards)
- [Daily Inspections](#daily-inspections)
- [Operational Safety Checklists](#operational-safety-checklists)
- [Daily Log](#daily-log)
- [Dragline Delay Reports](#dragline-delay-reports)
- [Knowledge Base](#knowledge-base-kb)
- [Work Schedule](#work-schedule)
- [Timesheet](#timesheet)
- [Payslip Repository](#payslip-repository)
- [Equipment Fuel Events](#equipment-fuel-events)
- [Supply Requests](#supply-requests)
- [Equipment Activity Timeline](#equipment-activity-timeline)

## Source Documents

### Preserved Authoritative Sources

- [Dragline Delay Report front](../source-forms/dragline-delay-report/01-dragline-delay-report-front.jpg)
- [Official Delay Code Legend](../source-forms/dragline-delay-report/02-delay-code-legend.jpg)

The Dragline Delay Report sources were visually verified on 2026-08-18. The
exact source-derived transcription is canonical in the
[Delay Code Catalog V1](reference/dragline-delay-reports/delay-code-catalog-v1.md).

### Pending Collection

- STOP Card
- Final approved Dragline and Mobile checklist item sets
- Greasing Form
- PM Form
- Shift Handover Form
- Production Form

Pending source-form collection does not mean the corresponding software module
is unimplemented. STOP Cards and Daily Inspections currently use the approved V1
fields documented in `docs/database.md` and their feature architecture documents.

## Equipment Reference Data

Equipment records use the canonical `City -> Mine -> Equipment` reference
hierarchy. New and edited Equipment select an existing Mine by stable identity;
the selected Mine supplies City and Mine Type context. The Equipment workflow
does not create or reconcile Mine or City records from typed names. A currently
assigned inactive Mine may be retained during an unrelated edit, while new
Equipment and Mine reassignment require an active Mine.

The Equipment history view supports combined feature-owned filtering by
Equipment category, canonical Mine, Active/Inactive status, and a
case-insensitive partial search across display name and Equipment number. The
table remains the canonical Equipment record list and retains its Edit action.

## Shift Reports

Shift Reports are manual operational coordination and shift-summary records.
They own their date, shift, status, summary, mine, equipment, location, and
operational-note workflow. They also provide the required parent context for
Work Authorizations without owning Work Authorization validation or lifecycle
logic.

The implemented V1 module provides list, create, edit, and detail workflows,
Prisma persistence, feature-owned list filtering, and selected-date Day View
participation. Broader related-record links remain future work.

Implementation architecture:

`docs/architecture/features/shift-reports.md`

## Work Authorizations

The Work Authorizations module tracks safety and compliance paperwork required when work is performed on the dragline.

The implemented V1 module provides list, create, edit, and detail workflows,
structured permit/work-requirement fields, lifecycle validation, Prisma
persistence, required Shift Report parent context, and selected-date Day View
participation. Feature-owned list filtering is implemented; deeper child-record
structures remain future work.

### Purpose

Capture the work authorization process for PMs, breakdowns, electrician callouts, mechanic callouts, hot work, work at heights, and other technician work performed during a shift.

### Parent Relationship

Every Work Authorization must belong to a Shift Report.

A Work Authorization should not exist independently from a Shift Report because the work occurred during a specific operating shift.

### Operator Responsibility

The operator fills out the Work Authorization records in NAM Dashboard.

Technician information captured by the operator may include:

- First name
- Last name
- Signature
- Role or company, if applicable

Technician-owned paperwork is not managed by NAM Dashboard.

### Required Information

Potential fields:

- Shift Report
- Dragline number
- Job location
- Work description
- Start date
- Start time
- End date
- End time
- Number of workers in crew
- Contact name, if applicable
- Equipment required for work
- Person in charge
- Person in charge signature
- Date signed
- Delegated authority names, if applicable

### Permit / Paperwork Selection

The Work Authorization should identify which permits or paperwork are required.

Potential permit types:

- Workplace Exam
- Confined Spaces
- Lockout / Tagout
- Hot Work
- Working at Heights
- STOP Card / Job Hazard Analysis

### Lockout Permit Rule

A Lockout Permit is not always required, but is required in most work authorization scenarios.

The system should default Lockout Permit Required to Yes.

If the operator marks Lockout Permit Required as No, the system should require a reason.

### Completion Checklist

Each Work Authorization should include a completion checklist confirming the job is complete and the equipment or work area can be safely returned to production.

Potential checklist items:

- Job completed to satisfaction
- Required permits closed
- Hot work fire watch completed, when applicable
- Guards replaced on equipment
- Lockout/tagout completed and locks removed from electrical disconnects
- Ladders removed from area
- Handrails put back in place, when applicable
- Flooring put back in place, when applicable
- Trash, scrap metal, wire rope, and debris removed
- Barricade tape, tags, and warning signage removed
- Excess spare parts and consumables returned
- Tools and equipment removed from area
- General housekeeping completed
- Rental equipment removed or scheduled for pickup
- Supervisor notified that equipment can return to production

### Future Capability

The module should eventually support exporting captured data into a paper-style form matching the original Work Authorization documents.

### Source Forms Reviewed

- Work Authorization
- Lockout Permit
- Hot Work Permit
- Working at Heights Permit
- Work Authorization Completion Checklist

Source image folder:

`source-forms/Work authorizations`

## STOP Cards

STOP Cards are manual safety observation and corrective-action records. The
module owns observation details, category, severity, status, validation,
persistence, and its feature-owned list filters.

The implemented V1 module provides list, create, edit, detail, filtering, mine
and equipment context, and selected-date Day View participation. Attachments,
approvals, analytics, and global cross-module search remain deferred.

Implementation architecture:

`docs/architecture/features/stop-cards.md`

## Daily Inspections

Daily Inspections are manual equipment and work-area inspection records. The
module owns inspection findings, condition and status logic, validation, and
persistence while remaining independent from Daily Logs and STOP Cards.

The implemented V1 module provides list, create, edit, detail, mine and
equipment context, current-schema feature-owned filtering, and selected-date
Day View participation. Attachments, approvals, analytics, and global
cross-module search remain future or deferred work.

Implementation architecture:

`docs/architecture/features/daily-inspections.md`

## Operational Safety Checklists

Operational Safety Checklists are start-of-shift, Equipment-specific inspection
records using the approved Dragline Inspection or Mobile Inspection item set.
They preserve repeated responses such as OK, Needs Repair, Previously Noted,
and N/A together with common shift and Equipment context.

These checklists are distinct from the implemented Daily Inspection summary
record, but they belong to the same Daily Inspections bounded context. The
Approved feature architecture preserves the distinction instead of forcing
both workflows into one ambiguous record or creating a generic configurable
form platform.

The operator-owned V1 workflow does not include the external form's Planner
Review section. Checklist results do not automatically create or update
Defects. Future explicit links may connect a checklist finding to Defect
Tracking while each feature retains ownership.

Boundary assessment:

`docs/architecture/equipment-operations.md`

Approved feature architecture:

`docs/architecture/features/operational-safety-checklists.md`

Canonical V1 source catalogs:

- [Dragline Inspection V1](reference/checklists/dragline-checklist-v1.md)
- [Mobile Inspection V1](reference/checklists/mobile-checklist-v1.md)

The feature is implemented with complete-only submission, explicit
in-place correction, no deletion, Equipment-derived templates, required
person-name snapshots, feature-owned history filtering, and exact source
catalogs. Starting meter readings use an explicit `HOURS` or `MILES` snapshot
and integers from `0` through `999999`; the maximum is an implementation
validation guard. Phase 24.1 implements selected-date Day View participation
through a checklist-owned display summary; explicit Defect traceability remains
deferred.

One independent checklist is recorded for each Equipment inspected at shift
start. Work trucks, tractors, forklifts, and other supported mobile Equipment
use the Mobile checklist; Dragline Equipment uses the Dragline checklist. A
mid-shift replacement does not change the original checklist and belongs in
the Daily Log as operational context.

Phase 23.4 implements the required explicit unit, editable Dragline/Work Truck
suggestions, no-default Tractor/Forklift behavior, known-mismatch confirmation,
signed NAM-only save feedback, and Create Another. Photo evidence remains
checklist-owned, optional, unavailable, and access-gated under ADR-018 for Phase
23.5. ADR-019 approves the managed private-overlay design, but its implementation
is only partially configured and is not accepted; the remaining access and
media prerequisites are still blocked. Photos do not create Defects or Daily
Log records.

## Daily Log

The Daily Log module records the operator's full workday as a searchable timeline of activities, events, observations, and linked records.

The implemented module provides list, create, edit, and detail workflows,
multiple activity entries, feature-owned filtering, date navigation, and
selected-date Day View participation. Global cross-module search remains a
separate future capability.

### Purpose

Create a permanent operational memory for each workday.

The operator should be able to look up any date in the future and understand what happened that day, what equipment was involved, what work was performed, who was present, and which related records were created.

### Activity Examples

Potential Daily Log activities:

- Move the dragline
- Make a cut
- Grease the bucket
- Fuel service / diesel delivery
- Scheduled PM
- Equipment alarm, code, or sensor observation
- Equipment-specific observation
- Work order activity
- Lockout/tagout activity
- Hot work
- Working at heights
- Work Authorization opened or completed
- Escort a contractor or visitor from the mine entrance to a work area
- Maintenance observation
- Delay or downtime event
- Production note
- Safety observation
- General shift note

### Required Capabilities

- Create one Daily Log for a workday or shift
- Add multiple activity entries to the Daily Log
- Record activity time or approximate sequence
- Link activities only through explicitly approved feature relationships.
  Knowledge Base V1 owns its optional outbound source Daily Log reference;
  Daily Log activities do not create or own Knowledge Records.
- Record equipment-specific details when an activity comes from a dragline screen, alarm list, sensor display, physical gauge, or operator observation
- Record contractors, visitors, companies, or people involved when relevant
- Search Daily Logs by date, date range, equipment, activity type, text, linked records, contractor, or company
- View Daily Log history from a calendar
- Retain Daily Log records indefinitely unless explicitly deleted or archived

### Relationship To Other Modules

The Daily Log should act as the operator's narrative layer across the system.

A mid-shift work truck or other Equipment replacement is part of that narrative
and timing context. Recording it does not create or mutate an Operational
Safety Checklist, a standalone truck record, or future Fleet assignment data.

Structured modules such as Work Authorizations, future Work Orders, Defects,
and Inspections should use explicitly approved relationships rather than
duplicating owner records as plain text.

Equipment-specific observations should usually start in the Daily Log because
they happened on a specific date during a specific shift. If an observation
becomes reusable knowledge, Knowledge Base V1 may later store one manually
selected outbound source link to the Daily Log. Daily Logs do not create or
mutate Knowledge Records.

### Day View / Calendar Behavior

When the operator selects a date, the system should show both direct records for that date and contextual records that contain that date.

Examples:

- Daily Log for the selected date
- Work Schedule day assignment for the selected date
- Work Schedule week that contains the selected date
- Shift Report for the selected date
- Inspections, defects, Work Authorizations, future Work Orders, notes, and attachments connected to that date

This should answer the question: "What was I doing on this day, and what schedule or related context surrounded it?"

### V1 Boundary

Version 1 should support manual Daily Log entries, activity categories, notes, dates, equipment links, and basic related-record links.

Future phases may add richer timelines, templates, analytics, or work order integration after those modules are defined.

The current Daily Log remains the implemented personal/narrative workday layer
and must not be renamed, repurposed, or rewritten as a Dragline Delay Report.
Its later evolution toward a richer date-centered timeline answering "What did
I do today?" is separate future product work, not part of DDR delivery.

## Dragline Delay Reports

Dragline Delay Reports are structured operational shift records. One report
belongs to one canonical Dragline Equipment, one operational work date, and one
Day or Night shift. The operator creates it near shift start, saves it
throughout the shift as Draft, and completes it near shift end.

Approved implementation architecture:

`docs/architecture/features/dragline-delay-reports.md`

### Owned Workflow

The feature owns:

- Stable report identity and `DRAFT -> COMPLETED` lifecycle.
- Explicit Correct Report behavior with reason, stale-version protection, and
  durable lightweight correction metadata.
- Canonical Dragline Equipment context with derived Mine/City and historical
  snapshots.
- Multiple ordered operator participants and one supervisor selected from the
  canonical Employee model with historical snapshots.
- Nonnegative whole-number Starting and Ending Hour Meter report facts; Starting
  is required in Draft and Ending may remain blank while Draft.
- A stable concurrent timeline using one source-verified official code per
  entry.
- Explicit per-entry downtime meaning, integer-minute interval-union downtime,
  and runtime derived from a 720-minute shift.
- Production/progress fields, normalized stations and derived Advance, manual
  Depth/Fuel/Cable facts, repeatable Ground Check times, comments, and optional
  safety/action fields.
- Canonical Mine-owned Lake reference management and report selection limited
  to active Lakes belonging to the selected Equipment's Mine.
- Explicit Complete Report behavior requiring Ending Hour Meter, at least one
  Operator, a Supervisor, and final chronological Code 13 — Shift Change.
- Completed read-only detail and an explicit correction form that revalidates
  the complete aggregate while keeping status and stable report identity.

### Boundaries

Daily Log retains personal workday narrative and all current behavior.
Existing Shift Reports retain generic shift coordination and Work Authorization
parent context. Work Schedule may later supply convenience context but is not a
DDR dependency. Equipment Fuel Events retain structured fueling occurrence
ownership; DDR Fuel is a separate manual report fact.

DDR does not own Daily Log links, Day View participation, attachments, photos,
Operational Safety Checklist media, approval workflow, corporate submission,
or a global shift redesign in DDR-1 through DDR-3.

### Source Closure

The official Delay Code catalog is a controlled, versioned application catalog
with exactly Operational, Mechanical, and Electrical categories. The UI will
use one searchable code/description dropdown and derive category. The catalog
was verified directly from the preserved official legend and is canonical in
[Delay Code Catalog V1](reference/dragline-delay-reports/delay-code-catalog-v1.md).
Its 66 entries retain source wording, ordering, category, and numeric gaps;
official codes and descriptions must not be invented or rewritten.

### Implementation Status And Open Questions

DDR-1 through DDR-3 are implemented as an independent workflow with Draft
history/create/edit/detail, explicit completion, Completed read-only detail,
explicit reasoned correction, stable ordered children, Catalog V1 validation,
Mine-filtered Lake selection, production/progress facts, absolute Advance,
derived runtime/downtime, optimistic concurrency, and complete failure-state
preservation. It does not participate in Daily Log, Day View, Work Schedule,
attachments, or photos.

Completion does not require optional DDR-2 production/progress facts. Open
questions are future Ground Check derivation and any precision finer than
integer minutes. Direction is not a digital DDR field.

## Knowledge Base (KB)

The Knowledge Base module preserves reusable personal operational knowledge
that should outlive one workday, Defect, inspection, Supply Request, or dated
event.

Current status: Knowledge Base V1 is implemented, formally accepted, and
canonically closed through Phase 28.9. Phase 28 is closed. Phase 29 and future
Knowledge Base enhancements are not authorized.

### Purpose

Capture, personally review, revise, archive, and retrieve text-first operational
knowledge without taking ownership of the operational records that prompted it.

Knowledge Base is not an official procedure system. Personally Reviewed means
only that the single operator reread the content; it never means corporate,
manufacturer, engineering, MSHA, site, or another person's approval.

### Content Kinds

V1 has exactly:

- Field Note
- Troubleshooting
- Procedure
- Safety Reminder
- Reference

### Trust And Lifecycle

Trust and lifecycle are independent:

- Trust: Unverified or Personally Reviewed
- Lifecycle: Active or Archived

New records are Active and Unverified. Unverified content edits in place.
Personal review freezes that revision. A later material change creates a new
current Unverified revision and retains the prior reviewed revision.

Archive is the normal read-only removal workflow. Restore returns the current
state to Unverified. Explicit permanent deletion removes only Knowledge
Base-owned data.

### Content And Context

Title and restricted-Markdown body are required. Safety caution, up to ten
ordered labeled HTTPS external references, and context are optional.

Context is exactly:

- General
- One Mine
- One Equipment, with Mine and City derived from Equipment

City is display-only derived context. Multi-Equipment, model/category
applicability, user-managed categories, and tags are outside V1.

### Relationships

Knowledge Base may own:

- Zero or one outbound source Daily Work Log reference
- Zero or one outbound related Defect reference

Both are manually selected, navigation-only relationships. Daily Logs and
Defects retain their lifecycle and mutation ownership. Deletion of a target
must preserve limited Knowledge Base display snapshots without blocking or
cascading into the owner record.

### Required Capabilities

- Create and view stable Knowledge Records
- Edit Unverified current content in place
- Personally review current content
- Revise reviewed content while retaining reviewed history
- Change content kind on the same stable record
- Archive, restore, and permanently delete
- Search current title and body
- Filter by kind, trust, lifecycle, Equipment, and Mine
- Order by most recently updated or title
- Render restricted Markdown safely
- Support responsive, accessible mobile and desktop use

Day View participation, photos, attachments, PDFs, structured steps, rich text,
authentication, multi-user review, AI, global search, offline use, analytics,
reports, exports, automation, and generic relationship infrastructure are
outside V1.

### Implemented Surfaces And Ownership

The module owns exactly these routes:

- `/knowledge-base`
- `/knowledge-base/new`
- `/knowledge-base/[id]`
- `/knowledge-base/[id]/edit`
- `/knowledge-base/[id]/history`
- `/knowledge-base/[id]/history/[revisionNumber]`

Feature-owned Server Actions handle create, edit, review, revision, archive,
restore, and permanent delete. The explicit root pointer alone selects current
content.

Daily Logs and Defects are optional outbound provenance targets owned by their
existing modules. Knowledge Base stores revision-owned live navigation IDs and
display snapshots, never mutates those owners, and retains snapshots after
owner deletion clears a live ID. Knowledge Base does not contribute to Day
View.

## Work Schedule

The Work Schedule module tracks the operator's weekly employee-to-equipment
assignments and schedule changes.

Current implementation status: V1 foundation implemented with manual weekly
schedule list, canonical Employee reference management and schedule
relationships, create, detail, edit workflows, and Day View participation.
Timesheet reconciliation, SMS import, and automation remain deferred.

### Purpose

Capture the schedule received from a supervisor and turn it into a clean, editable weekly calendar inside NAM Dashboard.

The module should help the operator know where they are expected to work each
day, who they were expected to work with, what equipment was assigned, and what
actually happened if the plan changed.

### Source Workflow

The schedule is usually received from the supervisor on Friday, sometimes Saturday, for the following week.

Example source message:

```text
Next week's schedule: Monday at 137, Tuesday to Friday at 102, Saturday at 142, and Sunday off.
```

The supervisor may later send an updated message before the current week is over.

Example update:

```text
Schedule for the rest of the week: Saturday at 137 and Sunday remains off. Next week: Monday to Sunday at 119.
```

### Required Capabilities

- Create a Weekly Schedule as the planning container for one operational week.
- Enter independent Daily Assignments for Monday through Sunday.
- Preserve planned assignment details separately from actual assignment details.
- Record the primary employee whose schedule is being entered.
- Select known primary and planned/actual crew participants from active
  canonical Employee references while preserving Work Schedule snapshots.
- Record the supervisor or source who communicated the schedule using the
  user-facing label "Assigned By" and existing supervisor eligibility.
- Mark days as scheduled, non-working, unknown, or cancelled.
- Assign planned and actual equipment when known.
- Derive normal mine and city context from Equipment while preserving
  historical display context for the assignment.
- Preserve planned and actual crew or partner information, including unknown or
  replacement partners.
- Edit an existing schedule when a newer supervisor message changes the plan.
- Record notes from the original message or update message.
- View the current week and next week quickly.
- Support manual entry as the primary and preferred workflow.

### Relationship To Other Modules

The Work Schedule should inform shift creation, but it should not replace the Daily Log or Shift Report.

A scheduled day may later result in a Shift Report, Daily Inspection, Daily Log, Work Authorization, defect report, or KB field note.

Work Schedule records planned and assigned work context. Timesheet records
pay-facing time worked. Daily Log records what happened operationally.

### V1 Boundary

Version 1 should support manual schedule entry and manual edits.

Automatic SMS reading and natural-language schedule parsing are intentionally out of scope because supervisor messages may contain spelling errors, grammar issues, or accidental character substitutions.

Reminders and calendar export or sync may be evaluated later, but they should not depend on SMS import.

Implementation architecture:

`docs/architecture/features/work-schedule.md`

## Timesheet

The Timesheet module tracks payroll-oriented weekly worked time.

Current implementation status: V1 weekly entry, reference management,
Draft/Completed lifecycle, selected-date Day View participation, and the
canonical `/timesheets` read-only history surface are implemented. Timesheet
History provides URL-filtered Weekly Timesheet lookup, compact snapshot-based
Daily Time Entry summaries, and deterministic page-number pagination.

### Purpose

Create a personal, editable record of worked time by employer payroll week,
while fitting the NAM Dashboard interface.

The module should help the operator review weekly hours, reconcile daily worked
time, and explain where those hours went through reusable work codes, optional
work orders, and support-personnel context.

### Source Workflow

The operator opens a payroll week. Viewing the week does not create a database
record. If the Weekly Timesheet does not exist, the system creates it through
an explicit Timesheet-owned mutation, such as saving the first Daily Time Entry
for that payroll week.

The operator manually creates, edits, and deletes Daily Time Entries inside the
weekly view. Each Daily Time Entry owns one or more Work Allocations that
explain where the day's worked minutes went. Copy behavior is deferred from the
V1 foundation.

### Required Capabilities

- Represent one employer payroll week as one Weekly Timesheet.
- Use Monday-through-Sunday payroll weeks while keeping payroll-week semantics
  independent from Work Schedule's planning week.
- Automatically create Weekly Timesheets only through explicit first-use
  mutations.
- Create, edit, and delete Daily Time Entries inside the week.
- Record work date, clock in, clock out, unpaid break duration, calculated
  worked minutes, regular minutes, overtime minutes, primary equipment,
  optional Work Schedule Daily Assignment reference, and notes.
- Record one primary equipment per Daily Time Entry.
- Store one or more ordered Work Allocations per Daily Time Entry.
- Require each Work Allocation to have a work code, allocated minutes, sequence,
  and optional notes.
- Allow optional work orders when the work code and workflow support them.
- Allow zero, one, or many support personnel on a Work Allocation.
- Require allocation totals to reconcile with calculated worked minutes before
  Timesheet completion.
- Allow Draft Timesheets to remain temporarily unbalanced.
- Support Draft and Completed lifecycle states in V1.
- Keep Completed Timesheets read-only until explicitly reopened to Draft.
- Provide canonical read-only Weekly Timesheet history at `/timesheets`.
- Filter history by payroll-week overlap, lifecycle status, Equipment, Work
  Code, Work Order, Support Personnel, and overtime through URL parameters.
- Preserve Weekly Timesheet result ownership while showing compact Daily Time
  Entry summaries from persisted totals and historical snapshots.
- Use deterministic page-number pagination for history results.

### Reusable Lists

Timesheet owns reusable Work Codes, Work Orders, and Support Personnel because
they serve payroll/time-accounting entry rather than global operational
reference data.

Work codes should store both a code and a description, such as `P-102` /
Production 2355 Krome or `P-137` / Production Manitowoc 4600.

Work orders should be searchable and reusable, but remain optional because
production allocations typically do not use one.

Support Personnel represents people temporarily supporting work allocations,
such as mechanic, electrician, welder, hydraulic technician, contractor, or
vendor representative. Support Personnel is not an Employee system.

Inactive Work Codes, Work Orders, and Support Personnel remain historically
visible but are excluded from new selection by default. Records used
historically should not be hard-deleted. New reusable reference records are
managed through Timesheet-owned management surfaces rather than inline ad hoc
creation in the weekly form.
Used Work Orders are protected by restrictive relationship behavior and are
retired through inactivation.

### Relationship To Other Modules

Daily Time Entries may optionally reference the corresponding Work Schedule
Daily Assignment.

The relationship is optional. Timesheet must work correctly when no Work
Schedule exists, and payroll correctness must never depend on Work Schedule.
If a linked Work Schedule Daily Assignment is deleted, the Timesheet link should
become null and Timesheet-owned history should remain readable.
When selected, the assignment must match both the Daily Time Entry work date
and the Weekly Timesheet normalized primary employee owner. Timesheet validates
those conditions server-side.

Timesheet entries may later link to Daily Log activities, Payslip records,
Shift Reports, or other records when those modules support the relationship.

The Timesheet module should not replace the Work Schedule or Daily Log. Work
Schedule records expected and actual assignment context, Daily Log records what
happened during the day, and Timesheet records payroll-facing worked time and
work accounting.

Feature implementation architecture:

`docs/architecture/features/timesheets.md`

### V1 Boundary

Version 1 should support manual weekly Timesheets, Daily Time Entries, Work
Allocations, Timesheet-owned reference lists, calculated integer-minute
durations, allocation reconciliation, edit/delete behavior, explicit Reopen,
Draft/Completed lifecycle, and selected-date Day View participation through a
Timesheet-owned display-context helper. Timesheet also owns read-only,
URL-filtered Weekly Timesheet history with compact snapshot-based Daily Time
Entry summaries and deterministic pagination.

Copy behavior, global cross-module search, Submitted and Locked lifecycle
states, automatic WFS login, scraping, submission, imports, exports, reports,
approvals, authentication, and workforce management remain deferred unless
explicitly evaluated later.

## Payslip Repository

The Payslip Repository module stores weekly work payment PDFs and extracts payroll data for search, calendar lookup, and financial analysis.

Current status: Conceptually planned under ADR-005's financial bounded-context
guidance. Implementation remains blocked by unresolved privacy, application
access, storage, extraction, redaction, and export decisions and by the absence
of an accepted Level 2 feature architecture.

### Purpose

Create a permanent personal archive of payslips and make compensation data usable beyond the PDF itself.

The operator should be able to answer questions such as:

- How much did I make on a specific pay date?
- Which payslips are available for a selected calendar date?
- How much have I made so far this year?
- How much did I contribute to 401k over a date range?
- How much was deducted for medical insurance, taxes, or other benefits?
- What were my gross pay, net pay, hours, overtime, deductions, taxes, and employer contributions annually or over any selected range?

### Source Workflow

The operator manually uploads payslip PDFs, usually weekly.

The system should not depend on payroll-provider integration for V1. Uploading a PDF is the source of truth.

### Required Capabilities

- Upload one or more payslip PDFs manually
- Store the original PDF file permanently
- Detect duplicates by file hash, pay date, employer, and payslip identifier when available
- Extract available text from the PDF
- Use OCR when the PDF is image-based or text extraction is incomplete
- Store extraction confidence and parser status
- Allow manual correction of extracted fields
- Preserve raw extracted text or OCR output for troubleshooting
- Parse payroll header fields such as employer, employee identifier if present, pay date, pay period start, pay period end, and check or payslip number
- Parse earnings line items, including hours, rate, current amount, and year-to-date amount when present
- Parse deductions such as 401k, medical insurance, dental, vision, life insurance, union dues, garnishments, or other benefits when present
- Parse employee taxes and withholdings
- Parse employer contributions when present
- Parse direct deposit or payment distribution details when present
- Support calendar navigation by pay date and pay period
- Support search and filters by date range, pay type, deduction type, tax type, amount, and source PDF
- Provide analytics for gross pay, net pay, hours, overtime, taxes, deductions, 401k, insurance, employer contributions, and annual totals

### Relationship To Other Modules

Payslip records should appear in global calendar/history views, but they should remain financially scoped and should not be mixed into operational shift records by default.

If a payslip pay period overlaps Daily Logs or Work Schedule records, the Day View may show a contextual link to the pay period when compensation visibility is enabled.

### Privacy And Security

Payslip PDFs and extracted payroll data contain sensitive personal financial information.

The module should support stricter access rules than general operational records, including future options for encryption at rest, export controls, redaction, and hiding compensation data from shared or presentation views.

### V1 Boundary

Version 1 should support manual PDF upload, original PDF storage, core field extraction, line-item storage, manual correction, calendar lookup by pay date, and basic date-range totals.

Payroll-provider login integration, automatic Workday sync, tax advice, retirement advice, and automated financial recommendations are out of scope.

## Equipment Fuel Events

Equipment Fuel Events record operational fuel service for fuel-consuming
Equipment such as diesel draglines, cable tractors, forklifts, generators, and
future support equipment.

### Purpose

Create a permanent history of delivered fuel by date and Equipment while
preserving separate quantities when one service occurrence fills more than one
tank.

### Source Workflow

A fuel-service person fills one or more tanks on one Equipment record and
reports the delivered quantity. For example, one dragline service occurrence
may fill a main tank and a walking-engine tank with separate gallon amounts.

The operator records the occurrence as structured Equipment history. The same
work may also appear narratively as a Daily Work Log `FUEL_SERVICE` activity.

### Confirmed Boundary

- One occurrence concerns one Equipment subject.
- One occurrence may contain one or more tank-fill facts.
- Equipment Fuel Events own structured delivered-quantity facts.
- A Daily Work Log may own optional narrative context for the same occurrence.
- Timesheet Work Allocations do not own Equipment Fuel Events.
- Fleet gas-station purchases, company fuel cards, receipts, car washes, and
  temporary vehicle assignment belong to a separate future Fleet domain.
- Starting meter readings belong to Operational Safety Checklists.

### Approved V1 Workflow

- Record operational work date and actual local event time.
- Select one fuel-consuming Equipment record; derive Mine and City through
  Equipment.
- Select exactly one V1 fuel type: Diesel, Off-road Diesel, or Gasoline.
- Record one or more ordered Tank Fills as positive integer whole US gallons.
- Apply conservative V1 guards of `1` through `10` fills, `1` through `100`
  characters per unique normalized tank label, `1` through `999999` gallons per
  fill, and a maximum derived total of `9999990`.
- Use suggested Equipment tank labels with manual override and no Tank
  Management subsystem. Suggestions come from feature-owned history and are
  normalized and deduplicated for display.
- Derive event total gallons from the ordered Tank Fills.
- Optionally select or create a feature-owned Fuel Service Person and preserve
  the historical display-name snapshot.
- Retire Fuel Service Person records through inactivation; inactive records are
  excluded from new selection while unchanged historical references remain
  readable and used records are protected from hard deletion through
  Restrict-style relationship behavior.
- Optionally own a nullable one-to-one link to a matching Daily Work Log
  `FUEL_SERVICE` activity without changing either feature's ownership.
  Activity deletion clears the link rather than rewriting the event.
- Allow optional notes only for exceptional operational context.
- Persist completed records only, allow explicit in-place correction, and
  provide no normal deletion workflow.

Meter readings are excluded. Hour Meter remains owned by Operational Safety
Checklists. Equipment Fuel Events preserve limited Equipment, Mine, and City
display snapshots for historical readability. Structured feature-owned history
filters and selected-date Day View participation are implemented; analytics,
reports, and global search remain deferred.

New events and Equipment replacements require active eligible Equipment.
Unchanged inactive Equipment may remain during correction, while a missing live
relation requires intentional active eligible replacement.

Current implementation status: V1 foundation implemented with feature-owned
history filtering, completed-record creation and correction, ordered Tank Fill
persistence, Fuel Service Person management and inline creation, optional
Daily Work Log activity linking, historical snapshots, and a feature-owned Day
View display summary added in Phase 24.1.

Boundary assessment:

`docs/architecture/equipment-operations.md`

Approved feature architecture:

`docs/architecture/features/equipment-fuel-events.md`

## Supply Requests

Supply Requests preserve the operator's personal record of requests already
submitted through the external corporate Supplies Request system. NAM records
the successful external submission fact but does not submit, email, approve,
purchase, stock, or fulfill the request.

The V1 workflow is:

1. Start `Record Submitted Request`.
2. Review the fixed South Warehouse context and automatic requester identity.
3. Select one active Equipment and one active feature-owned supervisor.
4. Search the active Supply Item Catalog by Item Number or Description.
5. Add one or more unique ordered items, enter positive whole-number
   quantities, and optionally add Notes.
6. Record operational work date and actual submission local date and time.
7. Confirm that corporate submission succeeded.
8. Save one atomic Requested record with a permanent generated NAM Reference
   and immutable original version.
9. Later mark the request Fulfilled or Cancelled, or use `Correct Request` with
   a permanent reason to repair NAM history.

Supply Requests own the structured request identity, ordered lines and
snapshots, Equipment context, requester and supervisor snapshots, submission
facts, lifecycle, immutable versions, Notes, structured history, and optional
role-specific Daily Log Activity links.

The Supply Item Catalog and Supply Request Supervisors are narrow feature-owned
active/inactive references. Explicit management supports list, search, create,
edit, activate, and inactivate. Reads do not auto-create references. New request
choices must be active; unchanged inactive references remain historically
valid. Item, supervisor, requester, and Equipment snapshots prevent later
reference edits from rewriting accepted request versions.

Every request begins Requested. Fulfillment records actual local fulfillment
date and time, a same-or-later fulfillment operational work date, and optional
note. Cancellation records actual local cancellation date and time and an
optional reason. Partial receipt remains Requested. There is no Draft,
ordinary Reopen, partial-fulfillment tracking, or normal deletion.

`Correct Request` keeps the same request identity and NAM Reference. Every
accepted creation, lifecycle action, or correction appends a complete immutable
relational version with ordered lines. A correction requires a permanent reason
and records the operator and local correction time. Fulfilled and Cancelled
requests are otherwise read-only.

After submission or fulfillment, the feature may offer an explicit Daily Log
Activity workflow. The operator chooses the intended Daily Log; neither feature
auto-creates, infers, edits, or deletes the other's record. Submission and
fulfillment use distinct bounded link roles and may belong to different
operational work dates.

Supply Requests contribute one compact current-state summary to Day View on the
request operational work date. The canonical `/supply-requests` history route
owns URL filtering by operational date range, status, Equipment, supervisor,
NAM Reference, Supply Item text, and Notes, with deterministic pagination.

Warehouse pickup for supplies ordered by someone else remains a Daily Work Log
activity because its purpose is to explain time away from the dragline and may
mention one or more destination draglines.

The module does not own Warehouse records, inventory, stock, purchasing,
procurement, vendors, prices, ERP orders, corporate identifiers, Work Orders,
Work Authorizations, Defects, approvals, email, authentication, attachments,
partial fulfillment, global search, or analytics.

Boundary assessment:

`docs/architecture/equipment-operations.md`

Approved feature architecture:

`docs/architecture/features/supply-requests.md`

Current status: The architecture is Approved, Phases 26.3A through 26.10 are
implemented and accepted, and Supply Requests V1 is complete and accepted.
The accepted workflow includes reference management, recording an already
submitted corporate request, current detail, fulfillment and cancellation,
immutable correction history, canonical current-version filtering, explicit
Submission and Fulfillment Daily Log Activity links, and one current Day View
entry per stable request. NAM does not perform corporate submission. No Phase
26.11 is planned. Deferred enhancements remain outside V1 and require new
product review, architecture review, and explicit authorization.

## Equipment Activity Timeline

The Equipment Activity Timeline is a deferred derived capability. It should
compose feature-owned Equipment history from checklists, Defects, Daily Work
Logs, Equipment Fuel Events, implemented Supply Requests, and other accepted
contributors.

It should not store duplicate event records or become a shared business-logic
owner. Timeline architecture should begin only after several Equipment-centered
features are implemented and users demonstrate a recurring cross-feature
history need.
