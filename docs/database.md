# Database Design

This document is the canonical home for NAM Dashboard entities, fields,
relationships, enums, and data modeling notes.

## Table Of Contents

- [STOP Card Entities](#stop-card-entities)
- [Daily Inspection Entities](#daily-inspection-entities)
- [Operational Safety Checklist Entities](#operational-safety-checklist-entities)
- [Dragline Delay Report Concepts](#dragline-delay-report-concepts)
- [Defect Tracking Entities](#defect-tracking-entities)
- [Shift Report Entities](#shift-report-entities)
- [Work Authorization Entities](#work-authorization-entities)
- [Knowledge Base Entities](#knowledge-base-entities)
- [Daily Log Entities](#daily-log-entities)
- [Historical Search And Calendar Entities](#historical-search-and-calendar-entities)
- [Employee Reference Entity](#employee-reference-entity)
- [Work Schedule Entities](#work-schedule-entities)
- [Timesheet Entities](#timesheet-entities)
- [Payslip Repository Entities](#payslip-repository-entities)
- [Equipment Fuel Event Concepts](#equipment-fuel-event-concepts)
- [Supply Request Concepts](#supply-request-concepts)

## STOP Card Entities

### StopCard

Represents a manual safety observation and corrective-action record.

Implemented fields:

- id
- observationDate
- category
- severity
- status
- mineId
- equipmentId
- location
- description
- correctiveAction
- createdBy
- createdAt
- updatedAt

Implemented categories:

- Hazard Observation
- Unsafe Condition
- Unsafe Act
- Near Miss
- Positive Observation
- Corrective Action
- General Safety

Implemented severities:

- Low
- Medium
- High
- Critical

Implemented statuses:

- Open
- In Progress
- Closed
- Archived

Relationships:

- May belong to one Mine record
- May belong to one Equipment record

## Daily Inspection Entities

### DailyInspection

Represents a manual equipment inspection record for a selected workday.

Implemented fields:

- id
- inspectionDate
- shift
- mineId
- equipmentId
- equipmentHours
- condition
- status
- findings
- defectsIdentified
- notes
- createdAt
- updatedAt

Implemented conditions:

- Satisfactory
- Needs Attention
- Unsafe
- Not Applicable

Implemented statuses:

- Completed
- Follow-up Needed
- Archived

Relationships:

- May belong to one Mine record
- May belong to one Equipment record
- May originate zero or many Defect records

## Operational Safety Checklist Entities

Operational Safety Checklists are implemented within the Daily Inspections
bounded context as a separate record type from the current `DailyInspection`
summary. The Approved architecture is
`docs/architecture/features/operational-safety-checklists.md`.

The implemented `OperationalSafetyChecklist` parent and owned
`OperationalSafetyChecklistResponse` rows preserve:

- One start-of-shift checklist record for one Equipment subject.
- The approved Dragline or Mobile template identity and version.
- Common date, shift, starting-meter, operator-display-name,
  supervisor-display-name, and problem-description context as confirmed by
  feature architecture.
- One completed record per Equipment, operational date, and shift; incomplete
  form state is not persisted.
- A required explicit `HOURS` or `MILES` meter-kind snapshot and integer
  starting reading from `0` through `999999`.
- Required internal `recordVersion`, defaulting to `1` and incremented
  atomically with every successful aggregate correction.
- One ordered response per approved checklist item.
- Item-specific response sets using the approved three-option Condition,
  four-option Condition, Yes/No, or Presence semantics.
- Relational response facts with stable item identity and historical label,
  ordering, and response snapshots.
- Historical Equipment display context without copying complete Equipment,
  Mine, or City records.

An area or summary `DailyInspection` and an Operational Safety Checklist are
distinct business records even though the Daily Inspections feature owns both.
Template identity is versioned but must not bypass Equipment/date/shift
uniqueness. Completed records are corrected explicitly in place and are not
deleted in V1. Canonical template catalogs are approved in
`docs/reference/checklists/`. The maximum meter value is an implementation
validation guard rather than a business limit. No ending reading, calculated
distance, or cross-record continuity rule exists.

Checklist responses do not automatically create Defect records. Any future
relationship must be explicit and preserve Defect Tracking lifecycle ownership.

The implemented schema stores required `HOURS` or `MILES` meter kind with the
integer reading. Phase 23.4 added `MILES` through one additive enum migration;
existing `HOURS` rows remained unchanged. No Equipment-category backfill or
Equipment preferred-unit field exists.

Phase 23.4.2 added `recordVersion` through a second additive migration. The
field is not user-editable and does not represent revision history. Its
monotonic value supersedes older short-lived save-result markers without using
millisecond `updatedAt` precision. Correction increments it in the same
transaction as parent and owned-response changes; failed transactions leave it
unchanged.

Phase 23.3 also approves a future checklist-owned photo metadata child for
Phase 23.5. Conceptually, it preserves opaque normalized-image and thumbnail
keys, sanitized original filename, detected and normalized MIME types, separate
byte sizes for source, normalized full-image, and thumbnail content,
dimensions, optional caption, contiguous display sequence, SHA-256 checksum,
and upload timestamp. Parent/sequence and parent/checksum are unique, and the
parent owns metadata lifecycle. Image bytes remain outside PostgreSQL in the
private storage approved by ADR-018. This conceptual entity is not yet a Prisma
model, generic attachment model, or implemented schema.

## Dragline Delay Report Concepts

Status: DDR-1 root, ordered Operator, and stable Timeline Entry persistence;
DDR-2 Lake, Ground Check, production/progress, measurement, and closing-note
persistence; and DDR-3 completion/correction persistence are implemented in
`prisma/schema.prisma`. The feature is governed by
`docs/architecture/features/dragline-delay-reports.md`.

### DraglineDelayReport

Stable aggregate root for one Dragline Equipment, operational work date, and
Day/Night shift.

Conceptual fields and rules:

- Durable report identity.
- Lifecycle status: Draft or Completed.
- Required date-only operational work date.
- Required shift restricted by DDR validation to `DAY` or `NIGHT`; the global
  `ShiftType` enum remains unchanged.
- Required live Dragline Equipment reference at creation.
- Limited Equipment display name, number, category, Mine name, City name, and
  City state snapshots.
- Required nonnegative integer Starting Hour Meter and optional nonnegative
  integer Ending Hour Meter while Draft.
- Optional-while-Draft live supervisor Employee reference plus limited
  display-name and employee-code snapshots; Supervisor is required for
  completion and correction.
- Optional live Lake reference plus Lake display-name snapshot.
- Optional nonnegative integer Normal Digging and Benchfill bucket counts.
- Optional paired normalized `stationStartFeet` and `stationEndFeet` values.
- Optional nonnegative integer Depth feet, Fuel gallons, Cable Drag feet, and
  Hoist feet.
- Optional Comments, Safety Items Found, and Action Taken text.
- Server-derived integer downtime and runtime minutes.
- Required positive integer `recordVersion` for optimistic concurrency.
- Nullable `completedAt` while Draft and required completion timestamp when
  status is Completed.
- Created and updated timestamps.

Lifecycle uses `DraglineDelayReportStatus` (`DRAFT`, `COMPLETED`). Ordinary
editing applies only to Draft; explicit completion sets `completedAt`, and
explicit correction retains Completed status and the original completion
timestamp. Delay Code category snapshots use `DraglineDelayCodeCategory`
(`OPERATIONAL`, `MECHANICAL`, `ELECTRICAL`). The global `ShiftType` enum remains
unchanged; feature validation and a database check restrict this aggregate to
`DAY` and `NIGHT`.

The tuple `(equipmentId, operationalWorkDate, shift)` is unique. Mine and City
derive through Equipment and are not independent inputs. The root owns ordered
operator participants, timeline entries, Ground Check entries, and immutable
lightweight correction events.

The source front does not itself establish meter precision, but confirmed
digital product direction now requires nonnegative whole numbers and rejects
decimals. `startingHourMeter` is an `Int`; `endingHourMeter` is a nullable
`Int` during Draft. DDR-2 uses whole-unit nonnegative `Int` values for its
implemented measurements. Completion additionally requires Ending Hour Meter,
at least one Operator, a Supervisor, and final normalized Code 13 — Shift
Change. Other DDR-2 facts remain nullable; Direction is intentionally not
stored.

### Lake

Implemented minimal recurring operational reference owned by one Mine.

Fields and rules:

- Stable identity and required live Mine relation with Restrict deletion.
- Required display name unique within the Mine.
- `ACTIVE`, `INACTIVE`, or `ARCHIVED` reference status.
- Optional bounded notes and standard timestamps.
- New DDR selection exposes only active Lakes for the Equipment's Mine.
- A report keeps a nullable live Lake relation with `SetNull` deletion behavior
  and a Lake display-name snapshot for historical meaning.

Lake is not a generic location hierarchy and owns no coordinates, geometry,
depth history, environmental data, or Direction vocabulary.

### DraglineDelayReportOperator

Implemented ordered report-owned operator participation.

Conceptual fields:

- Durable child identity.
- Required parent report reference with cascade ownership.
- Positive display sequence unique within the report.
- Live canonical Employee reference with `SetNull` behavior when available.
- Employee display-name and employee-code snapshots.

The same Employee may appear at most once per report. New selection uses active
Employees. These rows represent report participation, not Work Schedule crew
ownership.

### DraglineDelayReportTimelineEntry

Implemented stable ordered operational timeline child.

Conceptual fields:

- Durable child identity.
- Parent report reference.
- Stable sequence used to order entries with equal actual start times.
- Integer `startMinuteOffset` from operational-date midnight. Timeline entries
  begin no earlier than the selected shift start and may continue beyond its
  scheduled end within the existing two-calendar-day `0..2879` representation.
  Day `[300, 1020)` and Night `[1020, 1740)` remain the fixed scheduled
  calculation windows; downtime intervals are clipped to those windows rather
  than expanding the 720-minute report total.
- Delay Code catalog version.
- Official code, exact description, and derived category snapshots.
- Description/context.
- Optional integer duration minutes.
- Explicit downtime-causing boolean.
- Created and updated timestamps.

Equal start times are valid. If the entry causes downtime, a positive integer
duration is required. Non-downtime duration never contributes to report
downtime. The official code must resolve from the source-verified catalog; no
free-text code or category is stored as user authority. Catalog V1 is
canonical in the
[Dragline Delay Code Catalog V1](reference/dragline-delay-reports/delay-code-catalog-v1.md).

Report-owned Operator and Timeline Entry rows cascade when the report is
deleted. Live Equipment, supervisor, and operator Employee references use
`SetNull`; their report-owned snapshots retain historical display meaning.

### DraglineDelayReportGroundCheck

Implemented repeatable ordered Ground Check time owned by DDR-2.

Conceptual fields:

- Durable child identity.
- Parent report reference.
- Positive sequence unique within the report.
- Integer `startMinuteOffset` using the same operational-date and overnight
  normalization as the timeline.
- Created and updated timestamps.

The list has no paper-form-derived fixed maximum. It remains manually entered
in DDR-2 even if a source-verified timeline code can also represent Ground
Check activity.

### DraglineDelayReportCorrection

Implemented lightweight immutable evidence that a Completed report was
corrected.

Fields and rules:

- Durable correction-event identity.
- Parent report reference.
- Nonblank correction reason.
- Positive sequence unique within the report.
- Correction timestamp.
- Positive previous and resulting record versions, with resulting version
  exactly one greater than previous.

The correction updates the same stable report and appends this event in one
transaction. This child is not a full aggregate version, approval record, or
generic audit system. It cascades with the owned report and stores no actor
identity because NAM Dashboard has no reliable authenticated-user concept.

### Derived Data Rules

- Timeline intervals use half-open integer-minute ranges.
- Down Time is the union length of all downtime-causing intervals and must be
  within `0..720`.
- Run Time is `720 - Down Time`.
- Client-entered totals are never authoritative.
- Station input preserves normalized station number/offset or deterministic
  absolute feet, not notation-only text.
- Station offset is normally `00..99`.
- Advance is the absolute difference between ending and starting absolute feet
  and is server-derived rather than persisted.
- Depth, Cable Drag, and Hoist use feet; Fuel uses gallons.
- DDR report Fuel remains independent from `EquipmentFuelEvent`.

## Defect Tracking Entities

### Defect

Represents an equipment issue from initial reporting through resolution and
closure.

Implemented fields:

- id
- reportedDate
- equipmentId
- sourceDailyInspectionId
- severity
- priority
- status
- title
- description
- correctiveAction
- resolutionSummary
- resolvedAt
- closedAt
- createdAt
- updatedAt

Implemented severities:

- Low
- Medium
- High
- Critical

Implemented priorities:

- Low
- Medium
- High
- Urgent

Implemented statuses:

- Open
- In Progress
- Resolved
- Closed

Relationships:

- Belongs to one required Equipment record
- May reference one source DailyInspection record
- Derives current Mine context through Equipment; V1 does not persist `mineId`
- Deleting a source DailyInspection clears the optional source reference and
  preserves the Defect

## Shift Report Entities

### ShiftReport

Represents a manual shift-level operational summary and coordination record.

Implemented fields:

- id
- reportDate
- shift
- status
- mineId
- equipmentId
- location
- summary
- operationalNotes
- createdAt
- updatedAt

Implemented statuses:

- Draft
- Completed
- Archived

Relationships:

- May belong to one Mine record
- May belong to one Equipment record
- Provides required parent context for WorkAuthorization records
- May later link to DailyLog, StopCard, DailyInspection, Defect, WorkSchedule,
  Timesheet, or other module-owned records when those relationships are
  explicitly implemented

## Work Authorization Entities

### WorkAuthorization

Represents a work authorization event performed during a shift.

Implemented fields:

- id
- shiftReportId
- status
- workType
- mineId
- equipmentId
- jobLocation
- workDescription
- startTime
- endTime
- crewWorkerCount
- contactName
- equipmentRequired
- personInChargeName
- lockoutRequired
- lockoutNotRequiredReason
- workplaceExamRequired
- confinedSpaceRequired
- lockoutTagoutRequired
- hotWorkRequired
- workingAtHeightsRequired
- stopCardJhaRequired
- jobCompleted
- permitsClosed
- guardsReplaced
- lockoutTagoutRemoved
- toolsRemoved
- housekeepingCompleted
- supervisorNotified
- completionNotes
- createdAt
- updatedAt

Implemented statuses:

- Draft
- Open
- Closed
- Archived

Implemented work types:

- Maintenance
- Electrical
- Mechanical
- Preventive Maintenance
- Breakdown
- Hot Work
- Working At Heights
- Lockout / Tagout
- Other

Relationships:

- Belongs to one ShiftReport
- May belong to one Mine record
- May belong to one Equipment record
- May later link to DailyLog, StopCard, DailyInspection, Defect, or other
  module-owned records when those relationships are explicitly implemented

### WorkAuthorizationPermit

Represents a permit or paperwork item associated with a Work Authorization.

Planned deeper model; not part of the current Prisma schema. The implemented V1
model stores its current permit and work-requirement selections as flat boolean
fields on `WorkAuthorization`.

Potential future fields:

- id
- workAuthorizationId
- permitType
- required
- completed
- completedAt
- notes

Potential permit types:

- Workplace Exam
- Confined Spaces
- Lockout / Tagout
- Hot Work
- Working at Heights
- STOP Card / Job Hazard Analysis

Relationships:

- Belongs to one WorkAuthorization

### WorkAuthorizationTechnician

Represents technician information captured by the operator.

Planned deeper model; not part of the current Prisma schema. Current V1 crew and
contact context remains on `WorkAuthorization`.

Potential future fields:

- id
- workAuthorizationId
- firstName
- lastName
- role
- company
- signature
- signedAt

Relationships:

- Belongs to one WorkAuthorization

### WorkAuthorizationCompletionChecklist

Represents the completion checklist for returning equipment or work area to production.

Planned deeper model; not part of the current Prisma schema. The implemented V1
completion checks are flat boolean fields on `WorkAuthorization`.

Potential future fields:

- id
- workAuthorizationId
- jobCompleted
- permitsClosed
- hotWorkFireWatchCompleted
- guardsReplaced
- lockoutTagoutRemoved
- laddersRemoved
- handrailsReplaced
- flooringReplaced
- debrisRemoved
- barricadesRemoved
- sparePartsReturned
- toolsRemoved
- housekeepingCompleted
- rentalEquipmentHandled
- supervisorNotified
- personInChargeName
- personInChargeSignature
- completedAt

Relationships:

- Belongs to one WorkAuthorization

## Knowledge Base Entities

Current status: Knowledge Base V1 is implemented, formally accepted, and
canonically closed through Phase 28.9. The feature uses the Prisma models and
two additive migrations described below. Phase 29 is not authorized.

### KnowledgeRecord

Implemented stable aggregate root.

Key fields:

- id
- currentRevisionId
- lifecycle: Active or Archived
- stateVersion
- createSubmissionKey
- createSubmissionFingerprint
- archivedAt
- createdAt
- updatedAt

Responsibilities and relationships:

- Owns every KnowledgeRecordRevision.
- Selects exactly one same-owner current revision in valid committed state.
- Owns lifecycle, stable detail identity, optimistic mutation state, and
  aggregate deletion.
- Cascades only to Knowledge Base-owned revisions and external references.

### KnowledgeRecordRevision

Implemented current or retained reviewed content.

Key fields:

- id
- knowledgeRecordId
- revisionNumber
- origin: Initial, Revised, or Restored
- contentKind: Field Note, Troubleshooting, Procedure, Safety Reminder, or
  Reference
- trust: Unverified or Personally Reviewed
- title
- normalizedTitle
- bodyMarkdown
- safetyCaution
- contextKind: General, Mine, or Equipment
- optional live mineId
- optional live equipmentId
- limited Mine, City, and Equipment display snapshots
- optional live sourceDailyLogId with date and shift snapshots
- optional live relatedDefectId with title and reported-date snapshots
- changeSummary
- reviewedAt
- createdAt
- updatedAt

Responsibilities and relationships:

- Belongs to one KnowledgeRecord.
- Has a unique positive revision number within that stable record.
- May be the explicit current revision for its same owning record.
- Owns zero through ten ordered KnowledgeRevisionExternalReference rows.
- Uses live Mine and Equipment references for navigation and approved current
  filtering. Daily Log and Defect live references are navigation-only.
- Retains limited snapshots for display after reference deactivation or
  exceptional deletion.

Unverified current revisions are mutable in place. Personally Reviewed
revisions are retained and read-only for Knowledge Base-owned material fields.
A later material change creates a complete new Unverified revision and advances
the stable root's explicit pointer.

### KnowledgeRevisionExternalReference

Implemented ordered external link owned by one revision.

Key fields:

- id
- knowledgeRecordRevisionId
- sequence
- label
- url
- normalizedUrl
- createdAt

Rules:

- Maximum ten per revision.
- Sequence is contiguous and unique per revision.
- Normalized URL is unique per revision.
- URLs are absolute HTTPS with no embedded credentials.
- Rows cascade only with their owning Knowledge Base revision.

### Implemented Enum Responsibilities

- Knowledge content kind: exactly five fixed V1 values.
- Knowledge trust: Unverified or Personally Reviewed.
- Knowledge lifecycle: Active or Archived.
- Knowledge context: General, Mine, or Equipment.
- Knowledge revision origin: Initial, Revised, or Restored.

Kind, trust, lifecycle, and context remain separate concepts.

### Implemented Integrity Boundary

- Same-owner composite foreign key for the current-revision pointer.
- Unique revision number per stable root.
- Positive aggregate state version and revision number.
- Coherent lifecycle/archivedAt and trust/reviewedAt pairs.
- Database and application validation for title, body, caution, change summary,
  context snapshots, and external-reference ordering. SetNull-compatible
  context checks permit missing live IDs only alongside complete retained
  snapshots; user-selected context still requires a live active owner through
  the feature mutation boundary.
- SetNull live reference behavior with retained snapshots.
- No direct City input, many-to-many Equipment relationship, structured-step
  entity, attachment entity, tag entity, author/reviewer identity, or generic
  revision/relationship entity.

The implemented migrations are
`20260801000100_knowledge_base_foundation` and
`20260802000100_knowledge_base_daily_log_defect_links`. The root cascades only
to its revisions, and revisions cascade only to their external references.
Mine, Equipment, Daily Log, and Defect remain neighboring owners; live owner
deletion uses SetNull while retained snapshots preserve readability. The
explicit same-owner current pointer is authoritative, and `stateVersion`
provides optimistic concurrency for retained-root mutations.

## Daily Log Entities

### DailyLog

Represents the operator's workday or shift narrative.

Potential fields:

- id
- date
- shift
- dailyAssignmentId
- primaryEquipmentId
- mineId
- summary
- weatherConditions
- generalNotes
- createdAt
- updatedAt

Relationships:

- May later reference one Work Schedule DailyAssignment
- May reference one primary Equipment record
- May reference one Mine record
- Has many DailyLogActivity records
- Has many Attachments
- May be referenced by Knowledge Base revisions as optional source context; the
  Knowledge Base owns each outbound reference

### DailyLogActivity

Represents one activity, event, note, or observation within a Daily Log.

Potential fields:

- id
- dailyLogId
- activityDate
- startTime
- endTime
- sequence
- activityType
- title
- description
- equipmentId
- location
- contractorCompany
- personName
- notes
- createdAt
- updatedAt

Potential activity types:

- Dragline Move
- Cut
- Greasing
- Scheduled PM
- Equipment Alarm
- Sensor Observation
- Equipment-Specific Observation
- Work Order
- Work Authorization
- Lockout / Tagout
- Hot Work
- Working at Heights
- Contractor Escort
- Maintenance Observation
- Fuel Service
- Delay
- Production Note
- Safety Observation
- General Note

Relationships:

- Belongs to one DailyLog
- May reference one Equipment record
- May reference one WorkAuthorization record
- May later reference one WorkOrder record
- May reference one Defect record
- May reference one DailyInspection record
- May be referenced by zero or one Equipment Fuel Event for explicit narrative
  context; the Fuel Event owns the optional link
- Has many Attachments

### EquipmentObservationDetail

Represents optional structured details for a Daily Log activity that records equipment-specific information.

This allows electric draglines with digital alarm screens and diesel draglines with more manual/operator-observed conditions to use the same Daily Log foundation without forcing every dragline into the same fields.

Potential fields:

- id
- dailyLogActivityId
- observationSource
- alarmCode
- alarmDescription
- alarmOccurredAt
- sensorName
- sensorValue
- conditionLabel
- operatorInterpretation
- followUpNeeded
- createdAt
- updatedAt

Potential observation sources:

- Digital Alarm Screen
- Sensor Display
- Physical Gauge
- Operator Observation
- Maintenance Feedback

Relationships:

- Belongs to one DailyLogActivity
- May reference one Equipment record through the parent DailyLogActivity

## Historical Search And Calendar Entities

Global search and calendar views should be supported across modules.

Potential design options:

- Query module tables directly by date, equipment, text, and relationships
- Add a searchable activity/index table later if direct queries become too slow
- Use PostgreSQL full-text search for notes, descriptions, and titles
- Support exact-date queries for daily records
- Support date-containment queries for period records, such as WeeklySchedule
  where the selected date falls between weekStartDate and weekEndDate

Operational records should include stable dates, timestamps, and bounded module
relationships so a selected date can show approved date-relevant contributors.
Knowledge Base V1 is reusable reference material and is explicitly excluded
from Day View.

Day View queries should return both records dated on the selected day and contextual records whose date range contains the selected day.

Dragline Delay Reports do not participate in Day View during DDR-1 through
DDR-3. Any later contribution requires separate authorization and a
feature-owned selected-date contract.

## Employee Reference Entity

### Employee

Implemented canonical people reference used by Work Schedule and approved for
future Dragline Delay Report operator/supervisor selection.

Implemented fields:

- id
- optional unique employeeCode
- displayName
- isActive
- isSupervisor
- createdAt
- updatedAt

Implemented relationships:

- May own WeeklySchedule primary-employee relations.
- May own WeeklySchedule Assigned By relations.
- May be referenced by AssignmentCrewMember.
- Will be the canonical reference source for ordered DDR operators and the DDR
  supervisor when DDR persistence is implemented.

New Work Schedule choices use active Employees, and Assigned By choices require
`isSupervisor`. Inactivation removes a person from normal new selection while
existing live relations and historical display snapshots remain readable.
Employee is reference data, not a User, authenticated actor, payroll account,
approval identity, or enterprise workforce-management system.

## Work Schedule Entities

The Work Schedule feature architecture is defined in
`docs/architecture/features/work-schedule.md`.

The entities below are implemented as the Work Schedule V1 foundation in the
Prisma schema.

### WeeklySchedule

Represents one Monday-through-Sunday schedule planning container for the primary
employee whose schedule is being entered.

Implemented fields:

- id
- weekStartDate
- weekEndDate
- status
- primaryEmployeeId
- primaryEmployeeDisplayName
- primaryEmployeeKey
- assignedByEmployeeId
- assignedByDisplayName
- receivedAt
- sourceNote
- scheduleNotes
- createdAt
- updatedAt

Statuses:

- Draft
- Active
- Archived

Relationships:

- References one canonical primary Employee for current implemented creation.
- References one canonical Assigned By Employee eligible as supervisor for
  current implemented creation.
- Has many DailyAssignment records

`primaryEmployeeDisplayName` and `assignedByDisplayName` are historical
snapshots taken from the selected Employees. `primaryEmployeeKey` remains a
server-derived normalized compatibility/history key. Current uniqueness uses
`weekStartDate` plus the canonical `primaryEmployeeId`. Live Employee relations
use SetNull-style deletion behavior so snapshots remain readable.

### DailyAssignment

Represents the assignment for one date within a WeeklySchedule.

The day is the operational and historical unit. Do not model one multi-day
assignment spanning several dates.

Implemented fields:

- id
- weeklyScheduleId
- assignmentDate
- dayOfWeek
- plannedStatus
- plannedShift
- plannedEquipmentId
- plannedEquipmentDisplayName
- plannedEquipmentNumber
- plannedEquipmentCategory
- plannedMineName
- plannedCityName
- plannedCityState
- actualStatus
- actualShift
- actualEquipmentId
- actualEquipmentDisplayName
- actualEquipmentNumber
- actualEquipmentCategory
- actualMineName
- actualCityName
- actualCityState
- changeReason
- plannedNotes
- actualNotes
- createdAt
- updatedAt

Assignment statuses:

- Scheduled
- Non-working
- Unknown
- Cancelled

Relationships:

- Belongs to one WeeklySchedule
- May reference one planned Equipment record
- May reference one actual Equipment record
- Has many AssignmentCrewMember records

Users select Equipment for planned and actual assignments. Mine and City are
derived through the selected Equipment. Historical equipment, mine, and city
display values are snapshots for schedule readability. They do not replace the
Equipment, Mine, or City reference-data records, and they should not duplicate
the full reference-data records.

The approved historical display snapshots are limited to equipment display
name, equipment number, equipment category, mine name, city name, and city
state for planned and actual equipment context.

When an assignment is edited, existing planned snapshots are preserved when the
planned equipment selection is unchanged, and existing actual snapshots are
preserved when the actual equipment selection is unchanged. Only the snapshot
group whose equipment selection intentionally changes is refreshed from current
Equipment reference data. Existing snapshots remain the historical display
source if a live Equipment relation has been set null.

### AssignmentCrewMember

Represents one planned or actual crew participant for a DailyAssignment.

Implemented fields:

- id
- dailyAssignmentId
- phase
- role
- employeeId
- displayName
- isUnknown
- notes
- createdAt
- updatedAt

Phases:

- Planned
- Actual

Roles:

- Primary employee
- Partner

Relationships:

- Belongs to one DailyAssignment
- May reference one canonical Employee with SetNull-style deletion behavior

Current Work Schedule uses canonical Employee references plus assignment-owned
display-name snapshots for known crew participants. Unknown partners remain an
explicit state and do not create fake Employee records.

Actual crew rows may be absent while actual assignment or actual crew
information is unknown. Unknown-partner flags are mutually exclusive with a
populated partner display name for the same planned or actual phase.

### Deferred Work Schedule Entities

Full schedule revision history, supervisor publishing records, imported SMS
messages, and AI parsing artifacts remain deferred. The canonical Employee and
supervisor-eligibility relationships are implemented and do not imply those
broader workflows.

## Timesheet Entities

The Timesheet feature architecture is defined in
`docs/architecture/features/timesheets.md`.

The V1 entities below are implemented in the current Prisma schema. This
section remains the conceptual data authority; `prisma/schema.prisma` is the
executable schema.

### WeeklyTimesheet

Represents one employer payroll week.

The employer payroll week is Monday through Sunday. It is independent from
Work Schedule's Monday-Sunday planning week even though the current boundaries
match. Timesheet owns payroll-week semantics.

Potential fields:

- id
- payrollWeekStartDate
- payrollWeekEndDate
- status
- primaryEmployeeDisplayName
- primaryEmployeeKey
- regularMinutesTotal
- overtimeMinutesTotal
- workedMinutesTotal
- createdAt
- updatedAt

Potential statuses:

- Draft
- Completed

Future statuses:

- Submitted
- Locked

Relationships:

- Has many DailyTimeEntry records

Uniqueness:

- payrollWeekStartDate + primaryEmployeeKey

`primaryEmployeeKey` is a normalized personal identity key derived
server-side from `primaryEmployeeDisplayName`. It is not an Employee, User,
HR, payroll, authentication, or workforce-management identifier.

### DailyTimeEntry

Represents one independent work-date record inside a WeeklyTimesheet.

Daily Time Entry is the source of truth for worked time. It may optionally
reference a Work Schedule DailyAssignment for context, but payroll correctness
does not depend on Work Schedule.

Potential fields:

- id
- weeklyTimesheetId
- workDate
- clockIn
- clockOut
- unpaidBreakMinutes
- workedMinutes
- regularMinutes
- overtimeMinutes
- primaryEquipmentId
- primaryEquipmentDisplayNameSnapshot
- primaryEquipmentNumberSnapshot
- primaryEquipmentCategorySnapshot
- primaryMineNameSnapshot
- primaryCityNameSnapshot
- primaryCityStateSnapshot
- workScheduleDailyAssignmentId
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one WeeklyTimesheet
- References one primary Equipment record
- May reference one Work Schedule DailyAssignment record for context, with
  SetNull-style behavior if the assignment is deleted
- Has many WorkAllocation records

Time and payroll notes:

- Work date is the date the shift begins.
- Clock-in and clock-out are local operational wall-clock times.
- Clock-out may occur on the following calendar day.
- Worked time, break duration, regular time, overtime time, allocation
  duration, and totals use integer minutes.
- One DailyTimeEntry may not exceed 24 gross hours.
- Regular and overtime minutes are derived snapshots calculated by the
  Timesheet weekly overtime policy.

### WorkAllocation

Represents the ordered accounting breakdown for a DailyTimeEntry.

Work Allocations answer: "Where did today's worked minutes go?"

Each Work Allocation stores sequence and duration, not allocation start/end
times.

Potential fields:

- id
- dailyTimeEntryId
- sequence
- workCodeId
- workCodeSnapshot
- workCodeDescriptionSnapshot
- workOrderId
- workOrderSnapshot
- workOrderDescriptionSnapshot
- allocatedMinutes
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one DailyTimeEntry
- References one TimesheetWorkCode record
- May reference one TimesheetWorkOrder record
- May reference zero or many TimesheetSupportPerson records through an
  allocation-support relationship

Validation notes:

- Allocation minutes must be positive integers.
- Allocation sequences should be unique and deterministic within one
  DailyTimeEntry.
- Allocation totals must reconcile with DailyTimeEntry workedMinutes
  before the WeeklyTimesheet can be Completed.
- Draft Timesheets may remain temporarily unbalanced.
- A used TimesheetWorkOrder is protected by Restrict-style deletion behavior
  and is retired through inactivation.

### TimesheetWorkCode

Represents a reusable Timesheet-owned work-code option used by Work
Allocations.

Potential fields:

- id
- code
- normalizedCode
- description
- category
- equipmentId
- active
- lastUsedAt
- createdAt
- updatedAt

Relationships:

- Has many WorkAllocation records

Rules:

- Code is normalized for uniqueness.
- Inactive Work Codes remain visible historically and are excluded from new
  selection by default.
- Work Codes used by historical allocations should not be hard-deleted.
- Work Code management belongs to the Timesheet feature.

### TimesheetWorkOrder

Represents a reusable Timesheet-owned work-order option used by Work
Allocations.

Work Order is optional because production allocations typically do not use one.
Maintenance-oriented allocations commonly use one, but Work Order remains
optional in V1.

Potential fields:

- id
- workOrderNumber
- normalizedWorkOrderNumber
- description
- equipmentId
- active
- lastUsedAt
- createdAt
- updatedAt

Relationships:

- Has many WorkAllocation records

Rules:

- Work order number/code is normalized for uniqueness.
- Work Order-to-Work Code relationship is optional in V1.
- A Work Order may be commonly associated with a Work Code, but it is not
  globally locked to only one Work Code in V1.
- Inactive Work Orders remain visible historically and are excluded from new
  selection by default.
- Work Orders used by historical allocations should not be hard-deleted.
- WorkAllocation-to-WorkOrder deletion behavior is Restrict when the Work Order
  is used historically.

### TimesheetSupportPerson

Represents a reusable Timesheet-owned person or role temporarily supporting a
Work Allocation.

Examples:

- Mechanic
- Electrician
- Welder
- Hydraulic Technician
- Contractor
- Vendor Representative

Support Personnel is not an Employee system and should not create workforce
management scope.

Potential fields:

- id
- displayName
- normalizedIdentity
- tradeOrRole
- company
- active
- notes
- lastUsedAt
- createdAt
- updatedAt

Relationships:

- May belong to many WorkAllocation records through an allocation-support
  relationship

Rules:

- Support Personnel is not Employee, User, HR, payroll, authentication, or
  workforce identity.
- Normalized identity should limit obvious duplicates.
- Inactive personnel remain visible historically and are excluded from new
  selection by default.
- Used Support Personnel records should not be hard-deleted.

### WorkAllocationSupportPerson

Represents the many-to-many relationship between a WorkAllocation and
TimesheetSupportPerson.

Potential fields:

- id
- workAllocationId
- supportPersonId
- supportPersonDisplayNameSnapshot
- supportPersonTradeOrRoleSnapshot
- supportPersonCompanySnapshot
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one WorkAllocation
- Belongs to one TimesheetSupportPerson

### Timesheet Reporting Notes

Daily totals should be calculated from DailyTimeEntry worked minutes and
allocation totals grouped by workDate.

Weekly totals should be calculated from DailyTimeEntry worked minutes, regular
minutes, and overtime minutes within the WeeklyTimesheet payroll-week date
range.

The V1 overtime policy is centralized inside Timesheet:

- first 2,400 worked minutes in the Monday-Sunday payroll week are regular
- subsequent worked minutes are overtime

Changing an earlier day requires recalculating regular and overtime splits for
that day and all later days in the week.

Day View participation uses a Timesheet-owned selected-date helper that returns
stored worked, regular, overtime, Equipment snapshot, allocation, lifecycle,
and detail-link context. Day View does not calculate worked hours, allocation
totals, overtime, or completion state.

Timesheet-owned Work Codes, Work Orders, and Support Personnel should preserve
historical display snapshots on Work Allocations or allocation-support records
so old Timesheets remain readable after reference changes.

DailyTimeEntry should also preserve limited primary Equipment display snapshots:

- equipment display name
- equipment number
- equipment category
- mine name
- city name
- city state

Users select Equipment only. Mine and City are derived server-side through
Equipment and should not be selected independently on Timesheet entries.

## Payslip Repository Entities

Current status: Conceptual only under ADR-005's financial bounded-context
guidance. No Payslip entity below exists in the current Prisma schema.
Implementation remains blocked by unresolved privacy, access, file-storage,
extraction, redaction, and export decisions and by the absence of an accepted
Level 2 feature architecture.

### PayslipDocument

Represents the original uploaded payslip PDF and its extraction status.

Potential fields:

- id
- originalFilename
- storagePath
- fileHash
- fileSizeBytes
- mimeType
- uploadedAt
- extractionStatus
- extractionMethod
- extractionConfidence
- rawExtractedText
- ocrText
- parserVersion
- parseError
- createdAt
- updatedAt

Potential extraction statuses:

- Uploaded
- Extracted
- Needs Review
- Corrected
- Failed

Potential extraction methods:

- PDF Text
- OCR
- Manual Entry
- Hybrid

Relationships:

- Has one Payslip record
- Has many PayslipExtractionField records

### Payslip

Represents the normalized payroll record from one payslip PDF.

Potential fields:

- id
- payslipDocumentId
- employerName
- employeeDisplayName
- employeeIdentifierMasked
- payslipNumber
- checkNumber
- payDate
- payPeriodStartDate
- payPeriodEndDate
- currency
- grossPayCurrent
- grossPayYtd
- netPayCurrent
- netPayYtd
- totalEarningsCurrent
- totalEarningsYtd
- totalTaxesCurrent
- totalTaxesYtd
- totalDeductionsCurrent
- totalDeductionsYtd
- totalEmployerContributionsCurrent
- totalEmployerContributionsYtd
- totalHoursCurrent
- totalHoursYtd
- reviewStatus
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one PayslipDocument
- Has many PayslipEarningLine records
- Has many PayslipDeductionLine records
- Has many PayslipTaxLine records
- Has many PayslipEmployerContributionLine records
- Has many PayslipPaymentDistribution records
- Has many PayslipExtractionField records

### PayslipEarningLine

Represents one earning line from a payslip, such as regular pay, overtime, shift differential, bonus, holiday, PTO, or other paid time.

Potential fields:

- id
- payslipId
- label
- earningType
- hoursCurrent
- hoursYtd
- rate
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Relationships:

- Belongs to one Payslip

### PayslipDeductionLine

Represents one employee deduction line, such as 401k, medical insurance, dental, vision, life insurance, union dues, garnishment, or other benefit deductions.

Potential fields:

- id
- payslipId
- label
- deductionType
- taxTreatment
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Potential deduction types:

- 401k
- Roth 401k
- Medical Insurance
- Dental Insurance
- Vision Insurance
- Life Insurance
- HSA
- FSA
- Union Dues
- Garnishment
- Other

Potential tax treatments:

- Pre Tax
- Post Tax
- Unknown

Relationships:

- Belongs to one Payslip

### PayslipTaxLine

Represents one employee tax or withholding line.

Potential fields:

- id
- payslipId
- label
- taxType
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Potential tax types:

- Federal Income Tax
- Social Security
- Medicare
- State Income Tax
- Local Tax
- Other

Relationships:

- Belongs to one Payslip

### PayslipEmployerContributionLine

Represents one employer-paid contribution or benefit line when shown on the payslip.

Potential fields:

- id
- payslipId
- label
- contributionType
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Potential contribution types:

- 401k Match
- Medical Insurance
- Dental Insurance
- Vision Insurance
- Life Insurance
- HSA
- Other

Relationships:

- Belongs to one Payslip

### PayslipPaymentDistribution

Represents direct deposit, check, or other payment distribution details when present.

Potential fields:

- id
- payslipId
- paymentMethod
- accountLabelMasked
- routingNumberMasked
- amount
- sourceText
- confidence
- createdAt
- updatedAt

Relationships:

- Belongs to one Payslip

### PayslipExtractionField

Represents a raw extracted field, normalized field mapping, confidence, and manual correction history.

Potential fields:

- id
- payslipDocumentId
- payslipId
- fieldName
- rawValue
- normalizedValue
- sourcePage
- sourceRegion
- confidence
- correctedValue
- correctedAt
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one PayslipDocument
- May belong to one Payslip

## Equipment Fuel Event Concepts

Equipment Fuel Events are implemented operational service records governed by
`docs/architecture/features/equipment-fuel-events.md`. The Prisma aggregate is
`EquipmentFuelEvent` with owned `EquipmentFuelEventTankFill` children and the
feature-owned `FuelServicePerson` reference.

### Equipment Fuel Event

Represents one completed fueling service occurrence for one Equipment subject.

Conceptual fields:

- Durable event identity.
- Required operational work date.
- Required actual local event time.
- Required live Equipment reference at creation.
- Required fuel type: Diesel, Off-road Diesel, or Gasoline.
- Optional live Fuel Service Person reference.
- Fuel Service Person display-name snapshot when selected.
- Optional unique Daily Work Log fueling-activity reference owned by the Fuel
  Event.
- Optional exceptional notes.
- Equipment display name snapshot.
- Equipment number snapshot.
- Equipment category snapshot.
- Mine name snapshot.
- City name snapshot.
- City state snapshot.
- Created and updated timestamps.

Relationships:

- Belongs to one Equipment when created; the live relation may later become
  null while historical snapshots remain.
- Owns one or more ordered Tank Fills.
- May reference one feature-owned Fuel Service Person using Restrict-style
  deletion behavior for historically used records.
- May reference one matching Daily Work Log `FUEL_SERVICE` activity without
  owning that activity. The nullable Fuel Event-side reference is unique and
  uses SetNull-style behavior when the activity is deleted.

Equipment, work date, and event time are not a natural unique key because one
Equipment may have multiple legitimate fueling occurrences. V1 is
completed-only, supports explicit correction in place, and provides no normal
delete action.

### Equipment Fuel Event Tank Fill

Represents one ordered delivered-quantity fact owned by one Equipment Fuel
Event.

Conceptual fields:

- Durable child identity.
- Parent Fuel Event reference.
- Sequence unique within the parent event.
- Required trimmed tank-label snapshot from `1` through `100` characters.
- Required normalized tank-label comparison key unique within the parent event.
- Required positive integer whole-US-gallon quantity from `1` through `999999`.

An event owns between `1` and `10` Tank Fills. The parent total is derived from
their integer sum and may not exceed `9999990`. Tank Fills have no independent
lifecycle or reusable Tank reference. Suggested historical labels are
normalized and deduplicated for display; manual override remains valid and does
not create a Tank Management subsystem.

### Fuel Service Person

Represents a reusable, feature-owned optional display-name reference.

Conceptual fields:

- Durable reference identity.
- Required display name, maximum `200` characters.
- Unique server-derived normalized name key for equivalent-name matching.
- Active/inactive status, active by default.
- Created and updated timestamps.

Fuel Service Person is not an Employee, User, vendor, payroll, or
authentication record. Events preserve the historical display-name snapshot so
reference changes do not rewrite prior records. Active records are available
for new selection; an unchanged inactive historical reference may remain during
correction. Inactivation is the retirement mechanism, and historically used
records must not be hard-deleted.

### Historical And Relationship Rules

- Mine and City derive through Equipment and are not independently selected.
- Creation and Equipment replacement require active Equipment. Electric-only
  Equipment is ineligible; Diesel and Gasoline power contexts constrain fuel
  choice, while Hybrid, Other, Unknown, or missing power context requires an
  explicit supported choice with no detected contradiction.
- Equipment/location and service-person snapshots are server-generated.
- Complete Equipment, Mine, City, or person records are not duplicated.
- Unchanged references preserve snapshots during correction.
- Changed Equipment refreshes the Equipment/location snapshot group and
  requires an active eligible replacement and a complete valid Tank Fill set.
- An unchanged inactive Equipment reference may remain during correction; a
  null relation requires intentional active eligible replacement.
- The optional Daily Work Log relationship must match operational date,
  fueling activity type, noncontradictory Equipment context, and one-to-one
  uniqueness.
- Daily Work Log deletion must not delete or rewrite a Fuel Event.
- Duplicate normalized tank labels within one event are invalid.
- Optional notes are limited to `2000` characters.
- Meter and level readings are not part of the model.

Equipment Fuel Event concepts explicitly exclude:

- Fleet gas-station purchases.
- Company fuel cards.
- Receipts and car washes.
- Vehicle mileage and temporary assignment.
- Timesheet Work Allocation ownership.
- A duplicate persisted Equipment timeline event.
- Runtime-configurable fuel types or Tank records.

Fleet purchase pricing and receipt evidence require separate future discovery.
The older conceptual `FuelPriceReference` does not belong to the confirmed
Equipment Fuel Event boundary.

## Supply Request Concepts

Supply Requests preserve the operator's record of requests already submitted
through the external corporate system. The persistence described below is
implemented in the current Prisma schema and the isolated Supply Request
foundation and Daily Log link migrations. Its exact ownership, current-pointer,
versioning, transaction, and compatibility rules are governed by the Approved
architecture in `docs/architecture/features/supply-requests.md`. Phases 26.3A
through 26.10 are implemented and accepted; this section describes current
persistence unless a concept is explicitly labeled future.

### Supply Request

Stable aggregate identity:

- Permanent database identity.
- Permanent generated NAM Reference.
- Submission-calendar reference year and annual sequence.
- Nullable-at-schema-level pointer to the current immutable version; null is
  valid only inside the initial aggregate transaction.
- Technical creation and update timestamps.
- Owned immutable versions and optional role-specific Daily Log Activity links.

NAM Reference and `(reference year, annual sequence)` are independently unique.
One PostgreSQL-safe annual counter row allocates each sequence atomically; the
design prohibits `MAX + 1`. The root's `(current version identity, request
identity)` pair references the version candidate key `(version identity,
version request identity)`, with a compound unique on the root pair for
one-to-one Prisma semantics. This prevents a root from pointing to another
request's version. No successful feature write may commit a null pointer.

### Supply Request Version

Complete immutable accepted state:

- Parent Supply Request and deterministic positive version number.
- Change kind: Created, Fulfilled, Cancelled, or Corrected.
- Status: Requested, Fulfilled, or Cancelled.
- Operational work date.
- Actual submitted local date and `HH:mm` time.
- Optional Notes.
- Equipment reference plus display name, number, category, Mine name, City
  name, and City state snapshots.
- Requester name and employee-number snapshots.
- Supervisor reference plus name and email snapshots.
- Status-appropriate fulfillment or cancellation facts.
- Required correction reason, corrected-by snapshot, and local correction date
  and time for a correction version.
- One or more owned ordered version-item lines.

Version `1` is the original Requested state. Every accepted fulfillment,
cancellation, or correction appends a complete next version and atomically
advances the current pointer. Older versions never change. The pair `(Supply
Request, version number)` is unique, and the current pointer must reference a
version owned by the same request.

### Supply Request Version Item

Version-owned ordered line:

- Parent version.
- Contiguous sequence.
- Supply Item reference.
- Positive whole-number requested quantity.
- Item Number, Description, and Unit snapshots.
- Server-derived normalized Item Number snapshot for historical lookup.

Sequence and Supply Item are each unique within one version. Owned lines may
cascade only with their immutable owning version; no reference deletion may
erase accepted history.

### Supply Item

Feature-owned reusable reference:

- Item Number display value.
- Unique normalized Item Number.
- Required Description.
- Required Unit.
- Active/inactive state.
- Technical timestamps.

Normalization Unicode-trims, collapses internal whitespace to one ASCII space,
and uppercases with locale-independent semantics without removing punctuation.
The display Item Number preserves letter case separately. Inactivation is the
normal retirement mechanism. Used records are deletion-protected, and catalog
edits never rewrite version-line snapshots.

### Supply Request Supervisor

Feature-owned reusable reference:

- Required full name.
- Required email address.
- Unique normalized lowercase email.
- Active/inactive state.
- Technical timestamps.

Names are not globally unique. Inactivation is the normal retirement mechanism,
and used records are deletion-protected. Normalized email is the full validated
and trimmed address lowercased with locale-independent semantics; internal
whitespace is invalid. The concept is not an Employee, User, approver, or
workforce-directory model.

### Supply Request Reference Counter

Narrow allocation state:

- Submission calendar year as unique row identity.
- Last allocated positive annual sequence.

Allocation occurs within the initial aggregate transaction through one
parameterized PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`
statement. Counter state is not user-managed and is not decremented or reused.
Reference year and sequence are permanent after creation even if a correction
changes submitted local date or year.

### Supply Request Daily Log Activity Link

Explicit bounded relationship:

- Supply Request.
- Daily Log Activity.
- Role: Submission or Fulfillment.

`(Supply Request, role)` and Daily Log Activity are unique. One Activity cannot
serve both roles or more than one request. Deleting an Activity removes only
the link; it does not delete or rewrite Supply Request identity or versions.
The link belongs to the stable request rather than a version. Role-specific
date, status, Activity type, and reasonable Equipment context are validated
transactionally.

### Relationships And Deletion

- One Supply Request owns one or more immutable versions and exactly one current
  version pointer.
- One version owns one or more ordered item lines.
- Equipment relations may become null while limited snapshots preserve display.
- Supervisor and Supply Item relations use Restrict-style history protection
  and active/inactive retirement.
- Daily Log links are optional and non-owning.
- No standard Supply Request or immutable-version deletion exists.
- South Warehouse is a feature-owned display constant, not persisted data.
- Requester defaults are one immutable Supply Requests-owned server
  code-configuration constant copied into versions, not environment variables,
  Employee records, or User relations.

Indexes should support permanent reference lookup, current-version joins,
operational date, status, Equipment, supervisor, version ordering, line
ordering, active reference lists, and reference searches. V1 item and Notes
contains lookup uses feature-owned PostgreSQL predicates without requiring
full-text search infrastructure.

Supply Requests must not own warehouse inventory, stock, purchasing, vendors,
prices, procurement, Work Orders, workforce identity, approvals, or ERP orders.
Warehouse pickup performed for an order placed by someone else remains a Daily
Work Log activity and does not create a Supply Request.
