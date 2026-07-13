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
- [Shift Reports](#shift-reports)
- [Work Authorizations](#work-authorizations)
- [STOP Cards](#stop-cards)
- [Daily Inspections](#daily-inspections)
- [Daily Log](#daily-log)
- [Knowledge Base](#knowledge-base-kb)
- [Work Schedule](#work-schedule)
- [Timesheet](#timesheet)
- [Payslip Repository](#payslip-repository)
- [Fuel Log](#fuel-log)
- [Work Truck Log](#work-truck-log)

## Source Documents

## Collected Forms

- Dragline Delay Report
- Delay Code Legend

## Pending Collection

- STOP Card
- Daily Inspection Form
- Greasing Form
- PM Form
- Shift Handover Form
- Production Form

Pending source-form collection does not mean the corresponding software module
is unimplemented. STOP Cards and Daily Inspections currently use the approved V1
fields documented in `docs/database.md` and their feature architecture documents.

## Shift Reports

Shift Reports are manual operational coordination and shift-summary records.
They own their date, shift, status, summary, mine, equipment, location, and
operational-note workflow. They also provide the required parent context for
Work Authorizations without owning Work Authorization validation or lifecycle
logic.

The implemented V1 module provides list, create, edit, and detail workflows,
Prisma persistence, and selected-date Day View participation. Feature-owned
list filtering and broader related-record links remain future work.

Implementation architecture:

`docs/architecture/features/shift-reports.md`

## Work Authorizations

The Work Authorizations module tracks safety and compliance paperwork required when work is performed on the dragline.

The implemented V1 module provides list, create, edit, and detail workflows,
structured permit/work-requirement fields, lifecycle validation, Prisma
persistence, required Shift Report parent context, and selected-date Day View
participation. Feature-owned list filtering and deeper child-record structures
remain future work.

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
equipment context, and selected-date Day View participation. Feature-owned list
filtering, attachments, templates, approvals, analytics, and global
cross-module search remain future or deferred work.

Implementation architecture:

`docs/architecture/features/daily-inspections.md`

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
- Link activities to equipment, work authorizations, future work orders, defects, inspections, KB notes, and attachments
- Record equipment-specific details when an activity comes from a dragline screen, alarm list, sensor display, physical gauge, or operator observation
- Record contractors, visitors, companies, or people involved when relevant
- Search Daily Logs by date, date range, equipment, activity type, text, linked records, contractor, or company
- View Daily Log history from a calendar
- Retain Daily Log records indefinitely unless explicitly deleted or archived

### Relationship To Other Modules

The Daily Log should act as the operator's narrative layer across the system.

Structured modules such as Work Authorizations, future Work Orders, Defects, Inspections, and Knowledge Base records should be linkable from Daily Log activities instead of being duplicated as plain text only.

Equipment-specific observations should usually start in the Daily Log because they happened on a specific date during a specific shift. If the observation becomes reusable knowledge, such as what a code means or how a dragline reports problems, it should also be linked to a Knowledge Base article or equipment profile.

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

## Knowledge Base (KB)

The Knowledge Base module stores operational knowledge by location, mine, equipment, and topic.

### Purpose

Capture and organize field knowledge that would otherwise live in personal notes, photos, videos, verbal training, or operator memory.

The KB should support both raw field notes and reviewed official articles.

### Navigation Hierarchy

The primary navigation hierarchy should be:

```text
City -> Mine -> Equipment -> KB Category -> Article / Field Note
```

Example:

```text
Miami
└── Krome Quarry
    ├── Dragline 119
    │   ├── Equipment Info
    │   │   ├── Make: Manitowoc
    │   │   └── Model: 4600
    │   └── KB
    │       ├── Procedures
    │       ├── Safety
    │       ├── Troubleshooting
    │       ├── Inspections
    │       ├── Training
    │       └── Field Notes
    ├── Dragline 142
    │   ├── Equipment Info
    │   │   ├── Make: Manitowoc
    │   │   └── Model: 6400
    │   └── KB
    └── Dragline 102
        ├── Equipment Info
        │   ├── Make: P&H
        │   ├── Model: 2355
        │   └── Power: Electric
        ├── Support Equipment
        │   ├── Cable Tractor
        │   ├── Forklift
        │   ├── Cable Poles
        │   ├── Cable Handling Tools
        │   └── Power Cable System
        └── KB
            ├── Procedures
            ├── Safety
            ├── Troubleshooting
            ├── Inspections
            ├── Training
            └── Field Notes
```

### Parent Relationship

Every KB article should belong to a City and Mine.

Most KB articles should also belong to a primary Equipment record. Articles may also reference related equipment, especially support equipment used with electric draglines.

### Equipment Profile Rule

Each dragline should have an equipment profile describing what kind of operational information it can provide.

Example:

```text
Dragline 102
- Electric dragline
- Has digital screen with sensor data and alarm history
- Alarm records may include code, description, date, and time

Draglines 119, 137, and 142
- Diesel draglines
- Do not have the same digital sensor/alarm screen
- May require different operator-observed condition notes
```

The equipment profile should guide which Daily Log activity fields or templates are most useful for that dragline.

### Support Equipment Rule

Support equipment, such as forklifts, cable tractors, cable poles, and power cable systems, should be modeled as equipment records.

Support equipment can belong to the same mine and optionally have a parent equipment relationship to the dragline it supports.

Example:

```text
Equipment: Forklift 102 Support
Mine: Krome Quarry
City: Miami
Category: Forklift
Parent Equipment: Dragline 102
```

### Article Types

Potential article types:

- Procedure
- Safety
- Troubleshooting
- Inspection
- Training
- Field Note
- General Article

### Article Status

Potential statuses:

- Field Note
- Draft
- Reviewed
- Official

### Required Capabilities

- Create articles and field notes under a specific city, mine, and equipment item
- Attach photos, videos, documents, and notes
- Support step-by-step procedure content
- Tag articles for search and filtering
- Link one article to primary equipment and related equipment
- Search across city, mine, equipment, article type, status, and tags

### Future Capability

Field Notes may eventually be promoted into official KB Articles through a review workflow.

The module may eventually support QR codes on equipment, offline/mobile field capture, article version history, comments, and cross-equipment article reuse.

## Work Schedule

The Work Schedule module tracks the operator's weekly employee-to-equipment
assignments and schedule changes.

Current implementation status: V1 foundation implemented with manual weekly
schedule list, create, detail, and edit workflows. Day View participation,
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
- Record the supervisor or source who communicated the schedule using the
  user-facing label "Assigned By".
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

The Timesheet module tracks the operator's weekly work time entries.

### Purpose

Create a personal, editable record of the same timesheet information entered in the WFS timesheet system, while fitting the NAM Dashboard interface.

The module should help the operator review weekly hours, recreate past entries, and reuse common equipment, work codes, and work orders without repeatedly typing the same information.

### Source Workflow

The operator manually creates, edits, copies, and deletes timesheet rows.

The reference WFS workflow shows a weekly timesheet grouped by work date, with each day showing total hours and one or more time entries. An entry detail screen includes work date, pay code, hours, equipment, work code, work order, worked pay grade, worked company code, worked business unit, injury, and comments.

### Required Capabilities

- Create a new timesheet entry manually
- Edit an existing timesheet entry
- Delete an existing timesheet entry
- Copy an existing entry to speed up repeated work
- Group entries by work week and work date
- Show daily totals and weekly total hours
- Use fixed pay code options: Regular Time, FTO, On Call Pay, and Unpaid Leave
- Require work date, pay code, and hours before saving
- Default new rows to Regular Time, worked company code 00067, worked business unit 141, and injury false
- Keep worked company code, worked business unit, injury, and other row fields editable
- Store reusable lists for equipment, work codes, and work orders
- Provide searchable/autocomplete entry for equipment, work codes, work orders, worked pay grade, company code, and business unit
- Allow adding new reusable equipment, work code, or work order values from the form
- Support optional comments

### Reusable Lists

Equipment should store both a code and a description, such as 101102 / Dragline PH 2355 or 101137 / Dragline Manitowoc 4600.

Work codes should store both a code and a description, such as P-102 / PRODUCTION 2355 KROME or P-137 / PRODUCTION SDIGAB4600 137.

Work orders may be blank, but previously used values should be searchable and reusable.

### Relationship To Other Modules

Timesheet entries should participate in Day View and global historical search.

Timesheet entries may link to Equipment records when the equipment exists in the shared equipment list. They may later link to Daily Log activities, Work Schedule days, Work Orders, Payslip records, or Shift Reports when those modules support the relationship.

The Timesheet module should not replace the Work Schedule or Daily Log. The schedule records expected assignments, the Daily Log records what happened during the day, and the Timesheet records payroll-facing hours and codes.

### V1 Boundary

Version 1 should support manual timesheet rows, weekly grouping, daily and weekly totals, reusable autocomplete lists, copy/edit/delete, and basic Day View/search participation.

Automatic WFS login, scraping, or submission is out of scope unless explicitly evaluated later.

## Payslip Repository

The Payslip Repository module stores weekly work payment PDFs and extracts payroll data for search, calendar lookup, and financial analysis.

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

## Fuel Log

The Fuel Log module records diesel deliveries, gasoline purchases, and fuel service events for draglines, work trucks, and related equipment.

### Purpose

Create a permanent searchable history of fuel added to equipment and work vehicles.

The operator should be able to answer questions such as:

- How many gallons were added to a dragline on a specific date?
- How many gallons were delivered during a month, year, or custom date range?
- How much diesel or gasoline has been delivered or purchased from the first recorded fueling event to the present?
- What is the estimated or actual value of fuel using a known or estimated price per gallon?
- Which fueling events have attachments, receipts, vendor notes, or missing information?

### Source Workflow

A diesel tank truck services the dragline several times per week.

The operator may also take the work truck to a nearby gas station and purchase gasoline.

The operator manually records the fueling event in NAM Dashboard. If exact pricing is known from a receipt, invoice, gas station purchase, vendor note, or reliable manual source, the operator may enter price per gallon, total USD, and source details. If pricing is not known, the record should still be saved with gallons and operational context.

### Required Capabilities

- Create a fuel service record manually
- Record date and time of fueling
- Link the record to equipment, such as a dragline or work truck
- Link the record to mine or location
- Record fuel type, such as diesel, off-road diesel, or gasoline
- Record gallons delivered
- Record vendor, service provider, gas station, or delivery truck identifier when known
- Record gas station name and address for gasoline purchases
- Record optional hour-meter, engine-hour, odometer, or tank readings when relevant
- Record price per gallon when known or estimated
- Record total USD when known
- Record price source and whether the price is actual, estimated, or unknown
- Calculate estimated total value as gallons delivered multiplied by price per gallon
- Attach receipts, photos, notes, or other evidence
- Search and filter by date, date range, equipment, mine, fuel type, vendor, gallons, price status, and notes
- Show totals by day, month, year, custom date range, equipment, and all-time history
- Show Fuel Log records in Day View and global search

### Relationship To Other Modules

Fuel Log records should be operational records linked to Equipment and Mine. Work trucks should be represented as Equipment records so fuel, mileage, and daily usage can be searched consistently.

A fueling event may optionally link to a Daily Log activity when the operator wants the fuel service to appear in the workday timeline. The Fuel Log should store the structured gallons, pricing, and vendor data; the Daily Log should provide the narrative context if needed.

Fuel Log records may also link to Work Truck Log records when the fuel purchase happened during a work truck day. Fuel Log records may later connect to Shift Reports, attachments, maintenance notes, or vendor records if those modules are defined.

### V1 Boundary

Version 1 should support manual fuel records, equipment links, gallons, date and time, optional vendor, gas station, address, work truck, odometer, manual price per gallon, total USD, attachments, search, and basic totals.

Automatic historical fuel price lookup, gas station price scraping, vendor invoice import, and fuel forecasting are future capabilities and should not block the first useful version.

## Work Truck Log

The Work Truck Log module records daily usage of the work truck used to travel inside the mine.

### Purpose

Create a permanent searchable record of work truck mileage, daily website log data, and related vehicle activity.

The operator should be able to answer questions such as:

- Which work truck was used on a specific date?
- What mileage was entered for the truck on that day?
- How many miles were driven during a week, month, year, or custom date range?
- What daily website form responses were submitted?
- Which days are missing truck mileage or required form data?
- Which fuel purchases belong to the work truck?

### Source Workflow

The operator parks a personal vehicle at the parking place, gets into the assigned work truck, and uses that truck to move inside the mine.

On a daily basis, the operator fills out a work website daily log. The website includes radio-button selections and input fields such as mileage. The exact fields will be documented after the operator provides the form details.

### Required Capabilities

- Create one Work Truck Log record per workday or shift
- Link the record to a work truck Equipment record
- Record date, shift, mine, parking area, work area, or route notes when useful
- Record starting mileage, ending mileage, and calculated miles driven
- Store configurable daily form responses matching the work website fields
- Support radio-button, checkbox, numeric, text, and notes-style field types
- Record whether the website daily log was submitted
- Attach screenshots, photos, receipts, or notes
- Link to related Fuel Log records for gasoline purchases
- Link to Daily Log activities when the truck activity belongs in the operator's workday timeline
- Search and filter by date, date range, work truck, mileage, submitted status, missing fields, mine, and notes
- Show Work Truck Log records in Day View and global search

### Relationship To Other Modules

Work Truck Log records should link to Equipment because the work truck is an asset used during the shift.

Work Truck Log records may link to Fuel Log records for gas station purchases. They may also link to Daily Log activities when the work truck usage is part of the broader workday narrative.

### V1 Boundary

Version 1 should support manual Work Truck Log records, mileage fields, configurable form responses, submitted status, notes, attachments, search, and Day View participation.

Automatic submission to the work website is out of scope. NAM Dashboard should preserve the operator's personal record of what was entered, not replace the official work website workflow.
