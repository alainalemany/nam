# Work Schedule Architecture

Status: Approved

Product Phase: Product Roadmap Phase 3 Personal Work Administration
architecture approved; V1 foundation implemented; Day View participation pending

Primary Feature: Work Schedule

Depends On:

- Operations reference data for equipment, mine, and city context
- Manual Work Schedule entry decision in `docs/decisions/adr-004-manual-work-schedule-entry.md`
- Date-aware Day View composition
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Related Documents:

- `docs/product-vision.md`
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`
- `docs/engineering-quality-standards.md`
- `docs/architecture/features/day-view.md`
- `docs/decisions/adr-004-manual-work-schedule-entry.md`

Last Reviewed: 2026-07-13

## 1. Purpose

Work Schedule preserves the operator's planned and actual employee-to-equipment
assignments by operational week and workday.

This feature architecture defines how Work Schedule should be implemented as a
personal planning and assignment-history feature without becoming a supervisor
publishing system, workforce-management platform, Timesheet replacement, or Day
View-owned calendar.

Work Schedule should help the operator answer:

> What was I assigned to work this week, who assigned it, who was expected to
> work together, what actually happened on each day, and what changed?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Work Schedule is responsible for:

- Creating and editing one personal weekly schedule planning container.
- Owning independent daily assignment records for each scheduled workday.
- Recording the employee whose schedule is being entered.
- Recording the supervisor or source who assigned or communicated the schedule.
- Preserving planned assignment details separately from actual assignment
  details.
- Preserving planned crew and actual crew for dragline work, including unknown
  or replacement partners.
- Linking planned and actual assignments to Equipment where known.
- Preserving enough equipment, mine, and city context for historical schedule
  accuracy when reference data changes later.
- Supporting weekly grid entry and review.
- Exposing feature-owned reads for weekly lookup, selected-date lookup, and
  future Day View participation.
- Owning feature-specific validation, mutation flow, query helpers, constants,
  and tests.

V1 foundation should include:

- Manual weekly schedule entry.
- Monday-through-Sunday weekly grid.
- One Weekly Schedule per normalized primary employee display name and week.
- Independent Daily Assignment records under the weekly schedule.
- Planned and actual assignment fields preserved independently.
- Planned and actual crew participants with primary employee and partner
  roles.
- Assigned By supervisor/source capture without requiring supervisor login.
- Equipment-derived context and historical location snapshots.
- Feature-owned list or archive access for prior weeks.
- Feature-owned validation and Server Actions.

Implemented V1 foundation:

- Work Schedule data model and migration.
- Feature-owned list, create, detail, and edit routes.
- Weekly grid entry for Monday-through-Sunday assignments.
- Planned and actual assignment fields, crew snapshots, Assigned By, and
  equipment/location display snapshots.
- Feature-owned Server Actions, validation, query helpers, and proportional
  tests.

Follow-up capability:

- Day View participation for the selected date or containing week after the
  Work Schedule foundation exists.
- More efficient copy/repeat interactions if the first grid implementation
  proves the need.

## 3. Non-Responsibilities

Work Schedule does not own:

- Daily Work Log operational narratives.
- Shift Report summaries, coordination records, or Work Authorization parent
  context.
- STOP Card, Daily Inspection, Work Authorization, or Defect Tracking business
  logic.
- Timesheet hours, payroll codes, pay reconciliation, or payable time.
- Supervisor authentication, publishing, approvals, or role-based access.
- Enterprise workforce scheduling.
- Crew management as a reusable organization-wide module.
- Attendance, leave management, or payroll.
- SMS ingestion, AI parsing, notification delivery, or calendar sync.
- Full revision history or immutable audit events.
- Day View composition.
- Global search, analytics, reports, exports, or dashboards.

Neighboring modules may later reference Work Schedule records, but they should
not own schedule assignment logic, planned-versus-actual changes, crew
membership, or schedule source context.

## 4. User Workflow

The V1 workflow is manual and weekly:

1. The operator receives the official schedule from a supervisor, usually by
   SMS on Friday or Saturday.
2. The operator opens Work Schedule and selects or creates the next operational
   week.
3. The operator records who assigned or communicated the schedule using the
   user-facing label "Assigned By".
4. The operator enters planned daily assignments in a weekly grid.
5. For each day, the operator records whether the day is scheduled,
   non-working, unknown, or cancelled.
6. For scheduled days, the operator records planned shift, planned equipment,
   planned crew, and useful notes when known.
7. Later, the operator confirms or updates actual assignment details without
   overwriting the original plan.
8. If equipment, shift, location, partner, or work status differs from the plan,
   the operator records the actual values and a change reason or note.
9. The operator reviews current, upcoming, and historical weeks from Work
   Schedule and, in a follow-up milestone, from Day View.

The UI should support fast manual entry from a source message, but the source
message remains reference text. ADR-004 keeps SMS import and natural-language
parsing outside V1.

## 5. Module Boundaries

Work Schedule should be implemented as a feature-owned vertical slice under:

```text
src/features/work-schedule/
```

The App Router should own route composition under:

```text
src/app/work-schedule/
```

Expected ownership model:

| Area | Owner |
| --- | --- |
| Weekly schedule, daily assignments, planned/actual assignment fields, crew, and schedule source | Work Schedule |
| Equipment display identity, category, mine, and city reference data | Operations reference data |
| Selected-date composition surface | Day View |
| Operational narrative for the workday | Daily Work Logs |
| Shift summary and work authorization parent context | Shift Reports |
| Pay-facing hours and reconciliation | Future Timesheet |

Day View may later compose Work Schedule context, but Work Schedule owns the
queries and record shape. Day View must not infer schedule business rules or
mutate schedule records.

Timesheet should remain a separate future module. Work Schedule records what
was planned and assigned; Timesheet records what time was worked for pay or
reconciliation; Daily Work Logs record what happened operationally.

## 6. Data Flow

Work Schedule uses server-owned persisted state.

### Conceptual Records

V1 should use these conceptual records:

| Concept | Responsibility |
| --- | --- |
| Weekly Schedule | Planning container for one operational Monday-through-Sunday week for the primary employee. |
| Daily Assignment | One independent date-specific assignment within the Weekly Schedule. |
| Assignment Crew Member | Assignment-owned planned or actual crew participant, such as primary employee or partner. |

The week is the planning and data-entry unit. The day is the operational and
historical unit.

Daily Assignments should not span multiple dates. A multi-day work pattern is
represented by several Daily Assignments because equipment, shift, crew,
cancellation, and actual work can differ on one day without changing the entire
week.

### Planned Versus Actual

Planned and actual assignment details should live on the Daily Assignment
record as separate groups of fields rather than overwriting each other.

Recommended V1 shape:

- Daily Assignment owns planned status, planned shift, planned equipment,
  planned equipment/location snapshot, planned notes, and planned crew.
- Daily Assignment owns actual status, actual shift, actual equipment, actual
  equipment/location snapshot, actual notes, and actual crew.
- A change reason or actual note explains meaningful differences between
  planned and actual values.
- Full revision history is deferred.

This side-by-side model is simpler than separate planned/actual one-to-one
child records and still preserves the business distinction the product needs.

### Crew Modeling

V1 should use assignment-owned crew participant records rather than a single
free-text partner field.

Work Schedule V1 uses name snapshots only for crew identity.

Crew participant records should distinguish:

- Planned or actual crew phase.
- Role, such as primary employee or partner.
- Stored display name for historical readability.
- Explicit unknown-partner state when the partner is not yet known.

V1 does not introduce an Employee Prisma model, Supervisor Prisma model, User
model, operator model, owner model, or workforce identity model. V1 also does
not introduce Employee or Supervisor relations on Work Schedule records.

The personal schedule owner is persisted as a required display-name snapshot,
such as `primaryEmployeeDisplayName`. V1 also derives a normalized owner key
server-side from that display name for weekly uniqueness. The key is an
implementation identity key, not an Employee, User, operator, or owner
reference.

Planned and actual crew participants are persisted as assignment-owned display
name snapshots. Actual crew participants may be absent until actual assignment
or actual crew information is explicitly known. Unknown partners must be
represented without creating fake Employee records, and an unknown-partner flag
must not be stored with a populated partner display name for the same phase.

The current repository has no Employee or Supervisor Prisma model, and the
product is still personal-entry oriented. Requiring workforce reference data
would turn Work Schedule into a broader crew-management system before the need
is proven.

The primary employee is the person whose schedule is being recorded. Other crew
members are assignment participants, not separate schedule owners. A future
Employee or Supervisor relation may be considered later, but it is not a V1
field or requirement. A future supervisor-published multi-employee schedule can
revisit that boundary.

### Assigned By

The Weekly Schedule records who communicated or assigned the schedule using the
user-facing label "Assigned By".

V1 should not imply that a supervisor logged into NAM Dashboard. It should
record the source supervisor or communicator as entered by the operator.

Work Schedule V1 persists Assigned By as a display-name snapshot, such as
`assignedByDisplayName`. It does not introduce supervisor authentication, a
Supervisor Prisma model, or a Supervisor relation. A future Supervisor relation
may be considered later, but it is not a V1 field or requirement.

V1 should include:

- Assigned By display value.
- Optional received date/time.
- Optional schedule-level notes.

Deferred:

- Required supervisor account.
- Supervisor publishing workflow.
- Automated source-channel ingestion.
- Full original SMS storage as a default field.

Original message text may be useful later, but it can contain personnel or
operationally sensitive content. If implementation includes source text in V1,
it should be optional, clearly labeled, and treated as reference text only.

### Equipment And Location Context

The current repository models:

```text
City -> Mine -> Equipment
```

Equipment belongs to one Mine, and Mine belongs to one City. Selecting
equipment can therefore provide normal reference context such as equipment
identity, category, equipment number, display name, mine, and city.

Work Schedule should link assignments to Equipment where known and snapshot the
display context needed for historical schedule accuracy.

Recommended V1 strategy:

- Store planned and actual Equipment references when equipment is known.
- Users select Equipment, not Mine or City separately.
- Derive Mine and City from the selected Equipment.
- Store only the approved planned and actual display snapshots derived from the
  selected equipment at entry or confirmation time:
  - equipment display name
  - equipment number
  - equipment category
  - mine name
  - city name
  - city state
- Snapshot enough context to keep historical assignments readable if equipment
  is later transferred to another mine.
- Preserve existing planned snapshots on edit when planned equipment selection
  is unchanged.
- Preserve existing actual snapshots on edit when actual equipment selection is
  unchanged.
- Refresh only the planned or actual snapshot group whose equipment selection
  intentionally changed.
- Preserve existing snapshots when a live Equipment relation has been set null
  after reference-data deletion.
- Do not require users to separately choose mine or city when equipment already
  provides that context.

The snapshot should not become a duplicate reference-data system. It is a
historical display record for the assignment at the time the schedule was
entered or confirmed. Do not duplicate the full Equipment, Mine, or City record
on Daily Assignment.

### Dates And Shifts

V1 date conventions:

- Week starts on Monday.
- Week ends on Sunday.
- Daily Assignment dates are date-only operational dates.
- Night shifts belong to the operational date on which the shift starts.
- Date handling should follow the repository's existing date-only conventions
  used by operational modules and Day View.

Shift values should use the existing `ShiftType` concept unless implementation
discovers a Work Schedule-specific reason to differ.

### Lifecycle

V1 should keep lifecycle state practical.

Weekly Schedule should have a small status that supports data entry and history:

- `DRAFT`: the weekly grid is still being entered or corrected.
- `ACTIVE`: the schedule is the current saved schedule for the week.
- `ARCHIVED`: the schedule remains historical and should not be treated as the
  current plan.

Daily Assignment should have assignment status rather than a broad workflow:

- `SCHEDULED`: work is planned or occurred.
- `NON_WORKING`: no work is scheduled for that date.
- `UNKNOWN`: the assignment is not yet known.
- `CANCELLED`: work was planned but did not occur.

Completed work does not need a separate V1 status if actual fields capture what
happened. Timesheet or Daily Work Log can later provide additional completion
context without changing Work Schedule ownership.

### Queries

Feature-owned V1 reads should include:

- Weekly Schedule lookup by week start date and primary employee context.
- Previous-week, current-week, and next-week navigation.
- Historical weekly schedule list or archive.
- Daily Assignment lookup by exact operational date.
- Current employee assignment lookup by date.
- Equipment-scoped lookup when useful for Work Schedule screens.
- Future Day View contribution lookup for selected date or containing week.

Do not introduce global search in Work Schedule V1. Feature-owned list
filtering may be added later if historical schedule volume proves it useful.

### Mutations

V1 mutation responsibilities should include:

- Create a Weekly Schedule.
- Save the weekly grid as one coherent user action.
- Create, update, or clear Daily Assignments for dates inside the week.
- Mark a day non-working, unknown, scheduled, or cancelled.
- Edit planned assignment values.
- Confirm or update actual assignment values.
- Preserve planned values when actual values differ.
- Preserve historical equipment and location snapshots on edit unless the
  corresponding planned or actual equipment selection intentionally changes.

The safest V1 save behavior is one atomic Server Action for the weekly grid.
The action should validate the full week, then use a Prisma transaction to write
the Weekly Schedule, Daily Assignments, crew participants, and snapshots
together. This prevents partial weekly saves where some days persist and others
fail.

Destructive deletion should be conservative. Archive or clear behavior is
preferred until delete semantics are approved.

## 7. UI Composition

Work Schedule should use a Weekly Grid as the primary UI.

Expected V1 surfaces:

- Weekly Schedule list or archive.
- New weekly schedule page.
- Weekly Schedule detail/edit grid.
- Route-level loading and error states.

Weekly Grid expectations:

- Header with week range, previous week, current week, and next week controls.
- Assigned By field in the schedule header.
- Optional received date/time and schedule-level notes when included in V1.
- Monday through Sunday rows or cards.
- Planned section for each day.
- Actual section for each day.
- Equipment selector for planned and actual equipment where applicable.
- Shift selector using the approved shift options.
- Crew entry that distinguishes primary employee and partner.
- Non-working, unknown, scheduled, and cancelled day handling.
- Validation feedback near the affected day and field.
- Save action for the full weekly grid.

The desktop layout may use a table-like grid when it remains readable. Narrow
screens should stack the seven days as compact cards rather than forcing an
unusable wide table.

The UI should distinguish create/edit mode from historical review mode. Older
weeks should remain readable even if editing is still allowed.

The grid should support efficient manual entry, including repeating or copying
common planned values, but V1 should avoid a generic drag-and-drop calendar.

## 8. Validation And Error Handling

Validation belongs at the Work Schedule Server Action boundary.

V1 validation should cover:

- Week start must be Monday.
- Week end must be the corresponding Sunday.
- Daily Assignment date must belong to the Weekly Schedule week.
- Duplicate Daily Assignments for the same primary employee, date, and shift
  should be prevented.
- A scheduled day must have enough planned assignment information to be useful.
- Non-working days should not require equipment or crew.
- Actual fields may remain empty until known.
- If actual equipment, shift, crew, or cancellation differs materially from the
  plan, an actual note or change reason should be required.
- Employee cannot appear twice in the same planned crew or actual crew.
- Unknown partners must be representable without forcing a fake Employee
  record.
- Unknown partner flags and populated partner display names are mutually
  exclusive for each planned or actual crew phase.
- The normalized owner key must be derived server-side from the primary
  employee display name and must not be user-entered.
- Assigned By must be present when the Weekly Schedule is active.
- Equipment IDs must refer to valid Equipment records when provided.
- Night shifts are stored against the date they start.

User-facing errors should identify the affected day and field. Database or
transaction errors should be summarized without exposing raw database details.

## 9. Testing Strategy

Work Schedule tests should follow `docs/testing-strategy.md` and grow with the
feature.

V1 test priorities:

- Week-boundary helpers, including Monday start and Sunday end.
- Date-only assignment behavior.
- Weekly-grid validation.
- Planned and actual preservation.
- Equipment/location snapshot preservation when equipment selection is
  unchanged or the live Equipment relation is unavailable.
- Duplicate Daily Assignment prevention.
- Crew validation, including no duplicate person in the same crew.
- Unknown partner handling.
- Actual crew remaining absent until actual assignment or actual crew
  information is explicitly known.
- Normalized owner key uniqueness for equivalent display names.
- Assigned By validation.
- Equipment ID validation.
- Transaction behavior for weekly grid saves.
- Feature-owned query helpers for week and date lookup.
- Day View contribution helper when participation is implemented.

PostgreSQL integration validation should be prioritized after schema work
because Work Schedule writes a parent Weekly Schedule plus multiple child Daily
Assignments and crew records in one user action.

Avoid brittle snapshot tests of the full Weekly Grid. Route or component tests
may be added after the UI stabilizes.

## 10. Future Evolution

Follow-up capabilities:

- Day View participation showing planned shift, planned equipment, actual
  equipment, crew, and change reason for the selected date.
- Feature-owned historical filtering if schedule history grows.
- Improved copy/repeat controls for common weekly patterns.
- Optional source message text if privacy and usefulness justify it.
- Explicit links from Daily Logs, Shift Reports, or Timesheets only when a
  concrete workflow requires them.

Candidate future possibilities:

- Supervisor login and publishing.
- Multi-employee organization-wide schedules.
- Notifications and reminders.
- SMS ingestion.
- AI-assisted parsing with preview before save.
- Recurring schedule templates.
- Drag-and-drop calendar.
- Full revision history or immutable audit history.
- Timesheet reconciliation views.
- Payroll integration.
- Attendance and leave management.
- Calendar export or sync.
- Mobile app.
- Analytics, reports, exports, or global search.

Future work should not promote automation into V1 unless the manual workflow is
already reliable and the product owner explicitly approves the tradeoff.

## 11. Day View Participation

Day View participation should be a follow-up slice after Work Schedule
persistence and weekly grid workflows exist.

The Work Schedule feature should expose a read-only helper that returns
schedule context for a selected operational date. Day View may then render that
context without querying schedule tables directly or interpreting schedule
business rules.

Expected Day View context:

- Week containing the selected date.
- Daily Assignment for the selected date when one exists.
- Planned shift and equipment.
- Actual shift and equipment when recorded.
- Planned and actual crew summary.
- Non-working, unknown, scheduled, or cancelled status.
- Change reason or actual note when the actual assignment differs.

Day View should not create, edit, validate, confirm, cancel, or archive Work
Schedule records.

## 12. Security And Privacy Boundaries

Work Schedule data is operational and personnel-sensitive.

V1 does not introduce authentication, authorization, or supervisor accounts, but
the architecture should preserve future access boundaries:

- The person entering the schedule is not necessarily the person who assigned
  it.
- Assigned By records a source supervisor or communicator, not an application
  actor.
- Crew and partner names should be treated as personnel data.
- Original SMS text may contain sensitive content and should remain optional if
  stored.
- Supervisor publishing, approvals, and multi-user visibility remain deferred
  until authentication and authorization requirements are approved.

## 13. Success Criteria

Work Schedule V1 architecture is successful when:

- A Weekly Schedule represents one Monday-through-Sunday operational week for
  the primary employee.
- Each scheduled workday is an independent Daily Assignment.
- Planned assignment data and actual assignment data are preserved separately.
- Planned crew and actual crew preserve who was expected to work together and
  who actually worked together.
- Unknown or replacement partners can be recorded without creating false
  reference data.
- Actual crew can remain absent until actual assignment or actual crew
  information is known.
- Assigned By captures who communicated the schedule without implying
  supervisor login.
- Equipment-derived mine and city context is available without repeated user
  entry.
- Historical assignment display does not silently change when equipment
  reference data changes later.
- Weekly grid entry can save the week coherently.
- Day View can later compose Work Schedule context through a feature-owned read
  helper.
- Timesheet, Daily Work Logs, Shift Reports, and other modules remain
  independent.
- SMS import, AI parsing, supervisor publishing, notifications, and payroll
  integration remain deferred.
- The feature continues to follow repository-wide delivery, dependency,
  feature, state, UI, testing, and quality standards.
