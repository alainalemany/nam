# NAM Dashboard - Project Definition

This document is the canonical home for confirmed product requirements and
product scope.

The canonical source for product identity, target users, business objectives,
MVP definition, and long-term product direction is
[Product Vision](product-vision.md).

The canonical source for product delivery order, priority, deferred scope, and
roadmap governance is [Product Roadmap](product-roadmap.md).

## Table Of Contents

- [Background](#background)
- [Technical Stack](#technical-stack)
- [Project Objectives](#project-objectives)
- [Current Planned Modules](#current-planned-modules)
- [Documentation Rules](#documentation-rules)
- [Idea Management Rules](#idea-management-rules)
- [Version 1 Out of Scope](#version-1-out-of-scope)
- [Work Authorization Requirements](#work-authorization-requirements)
- [Work Schedule Requirements](#work-schedule-requirements)
- [Timesheet Requirements](#timesheet-requirements)
- [Operational Safety Checklist Requirements](#operational-safety-checklist-requirements)
- [Historical Record And Search Requirements](#historical-record-and-search-requirements)
- [Daily Log Requirements](#daily-log-requirements)
- [Payslip Repository Requirements](#payslip-repository-requirements)
- [Equipment Fuel Event Requirements](#equipment-fuel-event-requirements)
- [Supply Request Requirements](#supply-request-requirements)

You are a Senior Software Architect, Senior UX Designer, Senior Next.js Developer, and Product Manager.

Your job is to help me design and build a personal mining operations dashboard called NAM Dashboard.

Do NOT generate code unless explicitly requested.

Your first objective is to act as a requirements analyst and help me define the entire system before any coding begins.

## Background

I work as a Dragline Operator for North American Mining (NAM).

I also have over 20 years of IT experience as a Linux Systems Administrator and Cloud Engineer.

I want to build a web-based operational dashboard that centralizes everything I do at work.

This application is initially for personal use, but it should be designed using professional software architecture principles so it can grow in the future.

## Technical Stack

Current preferred stack:

- Next.js
- TypeScript
- TailwindCSS
- PostgreSQL
- Prisma ORM
- React Hook Form
- Zod
- TanStack Table
- ApexCharts
- Metronic UI Template

The architecture should remain modular, scalable, and maintainable.

## Project Objectives

The dashboard should become the central location for:

- Daily operational activities
- Safety reporting
- Equipment inspections
- Defect tracking
- Maintenance observations
- Shift notes
- Operational analytics
- Documentation
- Work schedule tracking
- Fuel delivery and diesel usage tracking
- Shift-start Dragline and Mobile Equipment inspections
- Permanent historical records with search and calendar navigation

The system should be designed to reduce paperwork, improve organization, and create historical records for future analysis.

## Current Planned Modules

### 1. Dashboard Home

Provide a high-level overview of all activity.

Potential widgets:

- Open Defects
- Recent STOP Cards
- Recent Inspections
- Shift Notes
- Safety Statistics
- Maintenance Statistics

### 2. STOP Cards

Track safety observations and corrective actions.

Potential fields:

- Date
- Category
- Location
- Description
- Corrective Action
- Status
- Photos
- Created By

### 3. Daily Inspection

Record manual equipment and work-area inspection summaries.

Potential fields:

- Date
- Shift
- Equipment Hours
- Findings
- Defects Identified
- Notes
- Photos

### 3A. Operational Safety Checklists

Record start-of-shift Dragline and Mobile Equipment checklist responses using
approved item sets. This remains a distinct record type within the Daily
Inspections bounded context.

Potential context:

- Date
- Shift
- Equipment
- Starting meter
- Operator display name
- Supervisor display name
- Approved checklist item responses
- Problem description

One independent checklist belongs to each piece of Equipment inspected at
shift start. The Mobile checklist applies to work trucks, tractors, forklifts,
and other supported mobile Equipment. A shift using a dragline, work truck, and
tractor therefore produces three independent checklist records.

The implemented V1 foundation currently records the approved Hour Meter
context. The next architecture amendment will define an explicit `HOURS` or
`MILES` meter unit, optional checklist-level image evidence with captions, and
clear confirmation that the NAM record was saved. Those enhancements are not
implemented yet.

### 4. Daily Log

Store operational notes.

The Daily Log should become the operator's full-day activity record, capturing everything meaningful that happened during the workday.

Potential fields:

- Date
- Shift
- Operational Notes
- Delays
- Weather Conditions
- Maintenance Observations
- Activity timeline
- Related equipment
- Related work orders
- Related Work Authorizations
- Contractors or visitors escorted
- Attachments or links

### 5. Defect Tracking

Track equipment issues until resolved.

Potential fields:

- Defect Number
- Equipment
- Description
- Priority
- Status
- Reported Date
- Closed Date
- Photos

### 6. Knowledge Base (KB)

Store operational knowledge, field notes, procedures, training material, troubleshooting guides, safety notes, and attachments.

The KB should be organized around the real operating hierarchy:

- City
- Mine
- Equipment
- KB category
- Article or field note

Example hierarchy:

```text
Miami
└── Krome Quarry
    ├── Dragline 119 (Manitowoc 4600)
    ├── Dragline 142 (Manitowoc 6400)
    └── Dragline 102 (P&H 2355 electric dragline)
```

Electric draglines may have related support equipment, such as cable tractors, forklifts, cable poles, cable handling tools, and power cable systems. Support equipment should belong to the same mine and may be linked under the dragline it supports.

Potential KB content types:

- Procedure
- Safety
- Troubleshooting
- Inspection
- Training
- Field Note
- General Article

Potential fields:

- City
- Mine
- Primary equipment
- Related equipment
- Title
- Content
- Step-by-step procedure blocks
- Attachments, including photos, videos, documents, and notes
- Tags
- Status: Field Note, Draft, Reviewed, Official
- Author
- Created date
- Last updated date
- Reviewed by
- Version

### 7. Work Schedule

Track the operator's assigned work schedule by week and day.

The Work Schedule module should allow the operator to manually enter the schedule received from a supervisor, review upcoming assignments, and edit schedules when changes are sent before or during the scheduled week.

Potential fields:

- Week start date
- Week end date
- Schedule source note
- Day of week
- Assignment status: Scheduled, Off, Unknown, Changed
- Assigned equipment or location
- Start time, if known
- End time, if known
- Notes
- Last updated date

### 8. Equipment Fuel Events

Track operational fuel delivered to fuel-consuming Equipment, including service
occurrences that fill more than one tank.

Potential fields:

- Operational work date
- Actual local event time
- Equipment, with Mine and City derived through Equipment
- One fuel type: Diesel, Off-road Diesel, or Gasoline
- One or more ordered Tank Fills
- Required tank label with suggestions and manual override
- Positive integer whole-US-gallon quantity per Tank Fill
- Derived event total gallons
- Optional feature-owned Fuel Service Person reference and name snapshot
- Optional Daily Work Log fueling-activity context
- Optional exceptional notes

### 8A. Supply Requests

Preserve operator-originated requests for supplies without owning warehouse
inventory, purchasing, vendors, or ERP processing. Detailed fields remain in
product discovery.

## Required Output

Do NOT generate code.

Instead:

1. Review the project concept.

2. Identify missing requirements.

3. Suggest additional modules.

4. Suggest database entities.

5. Suggest relationships between modules.

6. Identify future scalability considerations.

7. Create a phased implementation roadmap.

8. Recommend UX improvements.

9. Recommend dashboard KPIs.

10. Ask clarifying questions whenever requirements are incomplete.

Act as a technical consultant helping define a production-quality system before development begins.

## Documentation Rules

Whenever new requirements, modules, database entities, workflows, relationships, architecture decisions, or implementation milestones are identified, the AI must explicitly state whether the information should be added to:

- docs/prd.md
- docs/modules.md
- docs/database.md
- docs/architecture.md
- docs/decisions/
- docs/roadmap.md
- docs/ideas.md

The AI must explain why the information belongs in that document.

The AI should act as the project's Software Architect and Documentation Manager, ensuring important decisions are not lost in chat history.

## Idea Management Rules

Not every idea should immediately become a project requirement.

When a new concept, feature, enhancement, integration, automation, report, dashboard widget, workflow improvement, or future capability is discussed, the AI must determine whether it is:

1. A confirmed project requirement.

2. A module definition.

3. A database design decision.

4. An architecture decision.

5. A future idea that requires evaluation.

If the item is not yet approved for implementation, it should be added to:

docs/ideas.md

The AI should explicitly state:

"Recommendation: Add this to docs/ideas.md for future evaluation."

Ideas should remain in docs/ideas.md until they are reviewed and promoted into:

- docs/prd.md
- docs/modules.md
- docs/database.md
- docs/architecture.md
- docs/decisions/
- docs/roadmap.md

The AI should help prevent premature scope expansion and keep Version 1 focused on the project's current priorities.

## Chat Management Rules

The AI acts as both Software Architect and Project Manager.

The AI should actively monitor the size, complexity, and focus of each conversation.

When a chat becomes too large, covers multiple unrelated topics, contains excessive context, or risks losing project clarity, the AI should recommend starting a new chat.

The AI should explicitly state:

"Recommendation: Start a new chat."

The AI should then generate a concise Context Transfer Prompt containing:

- Current project status
- Relevant decisions already made
- Documents that should be reviewed
- Current objective
- Open questions
- Any important constraints

The Context Transfer Prompt should be optimized for quickly resuming work in a new chat without requiring the entire previous conversation.

The AI should treat project documentation as the primary source of truth and avoid relying on long chat histories.

The AI should encourage short, focused chats dedicated to a single topic whenever possible.

## Context Transfer Rule

When recommending a new chat, the AI must generate a Context Transfer Prompt using this format:

Project: NAM Dashboard

Review these documents first:

- docs/prd.md
- docs/modules.md
- docs/database.md
- docs/architecture.md
- docs/roadmap.md

Current Focus:

\[topic]

Current Status:

\[summary]

Decisions Made:

- item
- item
- item

Open Questions:

- question
- question

Objective For This Chat:

\[single objective]

Continue from this point and ask questions if additional information is required.

## Version 1 Out of Scope

The following features are intentionally excluded from Version 1:

- Mobile application
- AI-generated recommendations
- GPS integration
- Weather API integration
- QR code tracking
- Inventory management
- Crew management
- Parts ordering
- Offline mode

These may be revisited in future phases.

## Work Authorization Requirements

NAM Dashboard must support Work Authorizations as part of the operational safety and maintenance workflow.

A Work Authorization is required when maintenance, electrical, mechanical, PM, breakdown, or other technician work is performed on the dragline during a shift.

Each Work Authorization must be tied to a Shift Report. Standalone Work Authorizations are not allowed.

The operator is responsible for filling out the Work Authorization records in NAM Dashboard. Technician names, last names, and signatures may be captured, but technician-owned paperwork is outside the scope of NAM Dashboard.

The system must capture structured Work Authorization data so historical records can be searched, reviewed, linked to shift activity, and eventually exported into paper-style forms.

Dragline number is the primary equipment identifier for this workflow.

## Work Schedule Requirements

NAM Dashboard must support a Work Schedule module for logging and managing weekly work assignments.

Work Schedule represents employee assignments to equipment. The meaningful
operational record is the assignment connecting date, employee or crew, shift,
equipment, and operational context.

The Weekly Schedule is the planning container for one operational week. Each
scheduled working day is an independent Daily Assignment so one day's equipment,
crew, shift, cancellation, or actual work can change without rewriting the
whole week.

The operator usually receives the next week's schedule by SMS on Friday, sometimes Saturday. The system should allow the schedule to be entered manually in English even if the original message was written in Spanish.

Schedules must be editable because a supervisor may send a later message that changes the remaining days of the current week and also provides the next week's schedule.

The system should preserve what was planned separately from what actually
occurred. This includes changes to equipment, shift, partner, location,
cancellation, or other meaningful assignment details.

The system should preserve who worked together on a given date. Dragline crew
or partner information may be known when the weekly schedule is entered,
unknown until the employee arrives, or different from the original plan.

The schedule should record who communicated or assigned the schedule using the
label "Assigned By" without implying that a supervisor logged into NAM
Dashboard.

Equipment selection should provide the normal mine and city context where that
context is available through reference data. Historical assignments should
remain readable if equipment reference data changes later.

Automatic SMS import or natural-language schedule parsing is not required. The supervisor's messages may contain spelling errors, grammar issues, or accidental character substitutions, so manual schedule entry and manual editing are the preferred workflow.

## Timesheet Requirements

NAM Dashboard must support a Timesheet module for manually creating, editing,
deleting, and reviewing weekly payroll-oriented time records.

One Timesheet represents one employer payroll week. NAM's payroll week is
Monday through Sunday. The payroll week is independent from Work Schedule's
planning week even though both currently use Monday-Sunday boundaries.

Weekly Timesheets should be created automatically through explicit first-use
mutations. Users should not have to manually create empty weekly containers,
but simply viewing a payroll week must not write a database record.

Daily Time Entries are the source of truth for worked time. They should record
work date, clock in, clock out, unpaid break minutes, calculated worked
minutes, regular minutes, overtime minutes, primary equipment, optional Work
Schedule Daily Assignment relationship, and notes.

Worked time and allocation duration should be stored and calculated internally
as integer minutes. V1 weekly overtime is calculated by treating the first
2,400 worked minutes in the Monday-Sunday payroll week as regular and
subsequent worked minutes as overtime.

Each Daily Time Entry should own one or more Work Allocations. Work Allocations
explain where the day's worked hours went using sequence, work code, optional
work order, allocated minutes, optional support personnel, and notes.

The module should maintain Timesheet-owned reusable lists for Work Codes, Work
Orders, and Support Personnel. These are not global workforce-management
records.

Allocation totals must reconcile exactly with calculated worked minutes before a
Timesheet can be completed. Draft Timesheets may remain temporarily
unbalanced.

V1 lifecycle states are Draft and Completed. Submitted and Locked are future
states. Completed Timesheets are read-only until explicitly reopened to Draft.

Timesheet records may optionally reference Work Schedule Daily Assignments, but
Timesheet must work correctly without Work Schedule and payroll correctness must
never depend on Work Schedule. If a linked Work Schedule Daily Assignment is
deleted, the Timesheet link should become null and Timesheet-owned history
should remain readable.

Selected-date Day View participation is implemented through a Timesheet-owned
display-context helper. Copy behavior and global cross-module search remain
deferred. Timesheet records may later link to Daily Log activities, Payslip
records, Shift Reports, or Equipment records when those workflows are approved.

The Timesheet module should fit NAM Dashboard's UI style instead of copying the WFS mobile interface exactly.

## Operational Safety Checklist Requirements

NAM Dashboard should support start-of-shift Operational Safety Checklists for
Dragline and Mobile Equipment.

The checklist capability should preserve common metadata such as date, shift,
Equipment, starting meter, operator display name, supervisor display name, and
problem-description context together with one response for each approved item.
Most condition items use OK, Needs Repair, Previously Noted, and N/A. Verified
template-specific items may instead use a narrower Yes/No or Present, Not
Present, and N/A response set.

Dragline and Mobile checklists have different approved item sets but belong to
one inspection capability within the Daily Inspections bounded context. They
are distinct from the implemented Daily Inspection summary record. V1 should
not introduce a generic user-configurable form engine.

The external Planner Review section is not part of the operator-owned V1
workflow. Needs Repair, Previously Noted, and repeated problem descriptions do
not automatically create or update Defects. Future explicit links may support
operator-controlled traceability while Defect Tracking retains lifecycle
ownership.

Detailed feature architecture is Approved and the V1 foundation is implemented.

The Approved feature architecture is
`docs/architecture/features/operational-safety-checklists.md`. V1 persists one
completed checklist per Equipment, operational date, and shift; it has no Draft
state, supports explicit in-place correction, and does not permit deletion.
Equipment determines the Dragline or Mobile template and server-owned Hours
meter kind. Exact source wording, ordering, markers, and response sets are
canonical in `docs/reference/checklists/`. V1 Hour Meter readings are required
whole integers from `0` through `999999`; the maximum is an implementation
validation guard rather than a business rule.

Implemented V1 surfaces include history filtering, create, detail, and explicit
completed-record correction. Day View participation and Defect traceability
remain deferred.

## Historical Record And Search Requirements

NAM Dashboard must be designed as a permanent personal work history.

The operator should be able to search historical records by date, date range, equipment, mine, activity type, module, notes, linked work order, contractor, or other meaningful metadata.

The system should include calendar-style navigation so the operator can select a date, such as January 16, 2025, and see what happened that day across schedules, daily logs, shift reports, inspections, work authorizations, defects, work orders, and notes.

The selected date view should also show contextual records that belong to a wider period containing that date. For example, if the operator searches January 16, 2025, the system should be able to show the work schedule week that includes January 16, 2025, not only records whose exact date is January 16.

Records should be retained indefinitely unless the operator explicitly chooses to delete or archive them.

## Daily Log Requirements

NAM Dashboard must support a Daily Log module for recording the operator's full workday.

The Daily Log should capture a timeline of activities such as moving the dragline, making a cut, greasing the bucket, scheduled PM, work orders, lockout/tagout activity, hot work, working at heights, escorting contractors or visitors from the mine entrance, and other operational events.

Daily Log entries should support links to related modules. For example, a daily activity may link to a future Work Order record, and that Work Order may link to related paperwork such as lockout/tagout, hot work, or working at heights permits.

The Daily Log should be searchable and visible through the global calendar/history view.

A mid-shift work truck or other Equipment replacement belongs in the Daily Log
as operational narrative or an appropriate existing activity. It does not
alter the original shift-start checklist, automatically create another
checklist, or require a standalone truck log or Fleet assignment history.

## Payslip Repository Requirements

NAM Dashboard should support a dedicated Payslip Repository module for archiving weekly work payment PDFs and turning them into searchable financial records.

The operator will manually upload payslip PDFs. The system should store the original PDF permanently, extract every available field and line item that can be reliably gathered, and preserve both normalized structured values and raw extracted text or OCR output for later review.

The module should support calendar navigation so the operator can select an available pay date, work date, pay period, or check date and view the matching payslip. It should also support date-range analytics such as total gross pay, net pay, hours, overtime, taxes withheld, 401k contributions, medical insurance deductions, other deductions, employer contributions, and annual totals.

Because payslip data is sensitive personal financial information, the module should be treated as a separate bounded context from operational mining records while still participating in global calendar and search views when the operator enables it.

The sample payslip appears to be generated by Workday and may include image-based or compressed PDF content. Extraction should therefore support both text extraction and OCR, with confidence scores and manual correction when a field cannot be parsed reliably.

## Equipment Fuel Event Requirements

NAM Dashboard should support Equipment Fuel Events for operational fuel service
performed on fuel-consuming Equipment such as diesel draglines, cable tractors,
forklifts, generators, and future support equipment.

One event represents one fueling occurrence for one Equipment subject. One
occurrence may contain multiple tank fills. For example, one dragline service
may record separate quantities for its main tank and walking-engine tank while
remaining one operational event.

The fuel-service person reports delivered quantity. The operator should record
the operational work date, actual local event time, Equipment, exactly one fuel
type, and one or more ordered Tank Fills. V1 fuel types are Diesel, Off-road
Diesel, and Gasoline. Each Tank Fill uses a required suggested-or-overridden
label and a positive integer whole-US-gallon quantity. Event total gallons are
derived from the fills. V1 permits `1` through `10` fills, labels from `1`
through `100` characters, quantities from `1` through `999999` gallons per
fill, and a maximum derived total of `9999990`. Duplicate labels after
whitespace and case normalization are invalid within one event.

Fuel Service Person is optional feature-owned reference data with searchable
selection, inline creation, and a historical display-name snapshot. It does not
introduce Employee, User, or authentication behavior. Active records are
available for new selection, inactivation is the retirement workflow, unchanged
inactive historical references may remain during correction, and used records
are protected from hard deletion through Restrict-style relationship behavior.
Notes are optional, limited to `2000` characters, and reserved for exceptional
operational context. Meter and level readings are not recorded; Hour Meter
remains owned by Operational Safety Checklists.

An Equipment Fuel Event may own an optional nullable one-to-one reference to a
matching Daily Work Log fueling activity for narrative context. The structured
fuel event and narrative activity remain independently owned, and activity
deletion clears the link without rewriting Fuel Event history. Equipment Fuel
Events do not belong to Timesheet Work Allocations.

V1 persists completed events only, supports explicit correction in place, and
provides no normal deletion workflow. Equipment changes during correction
refresh the limited Equipment/location snapshots and require an active eligible
replacement plus a complete valid Tank Fill set. Creation also requires active
eligible Equipment; unchanged inactive Equipment may remain during correction.

Fleet vehicle gas-station purchases are excluded. Company fuel cards, receipts,
car washes, and temporary replacement-truck assignment belong to a separate
future Fleet domain. Starting meter readings belong to Operational Safety
Checklists.

Feature-owned structured history filtering is part of the V1 architecture.
Day View participation, analytics, reporting, prices, and global cross-module
search remain deferred. Approved implementation architecture is
`docs/architecture/features/equipment-fuel-events.md`.

## Supply Request Requirements

NAM Dashboard should preserve operator-originated Supply Requests as durable
personal operational records. Supply Requests do not imply warehouse inventory,
stock management, purchasing, vendor management, or ERP order processing.

Warehouse pickup for supplies ordered by someone else remains a Daily Work Log
activity. Its purpose is to preserve time away from the dragline and narrative
context, including one or more destination draglines when relevant.

Supply Requests may later reference Equipment, Defects, Daily Work Logs or
activities, and Work Orders when explicit links provide operational value.
Request lifecycle, requested-item detail, quantities and units, fulfillment,
correction behavior, and Version 1 placement require further product discovery
before feature architecture begins.
