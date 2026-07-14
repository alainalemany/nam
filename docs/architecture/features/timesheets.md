# Timesheet Architecture

Status: Approved

Product Phase: Product Roadmap Phase 3 Personal Work Administration
architecture approved; V1 foundation implemented

Primary Feature: Timesheet

Depends On:

- Operations reference data for equipment context
- Work Schedule for optional assignment context only
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
- `docs/architecture/features/work-schedule.md`

Last Reviewed: 2026-07-13

Implementation Status: The V1 foundation is implemented with weekly
Timesheets, Daily Time Entries, Work Allocations, Timesheet-owned reference
management, Draft/Completed lifecycle, and optional Work Schedule context.
Day View participation and the other capabilities listed under Deferred Scope
remain deferred.

## 1. Purpose

Timesheet records payroll-oriented worked time by employer payroll week.

This feature architecture defines how Timesheets should be implemented as a
manual personal time-accounting feature without becoming Work Schedule, Daily
Work Logs, payroll submission automation, workforce management, or Day
View-owned reporting.

Timesheet should help the operator answer:

> What hours did I work in the payroll week, what equipment and work codes were
> those hours assigned to, what work orders or support personnel were involved,
> and do the daily allocations reconcile with the worked time?

Timesheet is intentionally separate from Work Schedule. Work Schedule records
what was planned and assigned. Timesheet records what time was worked for
payroll and reconciliation.

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Timesheet is responsible for:

- Payroll-oriented weekly worked-time records.
- Employer payroll-week ownership and Monday-through-Sunday payroll-week
  semantics.
- Explicit first-use creation through Timesheet-owned mutations.
- Daily Time Entry records as the source of truth for worked time.
- Clock-in, clock-out, unpaid-break, worked-minutes, regular-minutes, and
  overtime-minutes behavior using integer-minute calculations.
- One primary Equipment reference per Daily Time Entry.
- Optional links from Daily Time Entries to Work Schedule Daily Assignments.
- Work Allocations that explain where a day's worked minutes went.
- Timesheet-owned reusable Work Code records.
- Timesheet-owned reusable Work Order records.
- Timesheet-owned reusable Support Personnel records.
- Historical display snapshots for Timesheet-owned reusable references where
  needed to keep old records readable after reference edits.
- Draft and Completed lifecycle behavior.
- Feature-owned queries, Server Actions, validation, constants, forms, and
  tests.

V1 foundation should include:

- Manual weekly Timesheet access by payroll week.
- Automatic Weekly Timesheet creation when the user explicitly saves the first
  Daily Time Entry or otherwise submits a Timesheet-owned mutation for that
  payroll week.
- Spreadsheet-like weekly view with expandable Daily Time Entries.
- Daily Time Entry create, edit, and delete behavior within the weekly view.
- One or more Work Allocations per Daily Time Entry.
- Reconciliation between calculated worked minutes and allocation totals before
  completion.
- Separate management surfaces for Timesheet Work Codes, Work Orders, and
  Support Personnel.
- Feature-owned list or lookup behavior needed by Timesheet screens.
- Feature-owned validation and Server Actions.

## 3. Non-Responsibilities

Timesheet does not own:

- Work Schedule planning, assigned equipment, planned crew, or planned-versus-
  actual schedule change semantics.
- Daily Work Log operational narratives or activity timelines.
- Shift Report summaries or Work Authorization parent context.
- STOP Cards, Daily Inspections, Defect Tracking, Fuel Log, Work Truck Log, or
  Payslip behavior.
- Payroll provider submission, WFS login, scraping, or automation.
- Payroll approval, supervisor review, lock, or audit history in V1.
- Authentication, authorization, user accounts, or employee identity.
- Enterprise workforce management.
- Day View participation in V1.
- Global cross-module search.
- Payroll calculations beyond daily and weekly hour totals.
- Attachments, exports, analytics, dashboards, notifications, or reports.

Neighboring modules may later reference Timesheet records, but they should not
own Timesheet hours, allocation reconciliation, payroll-week state, Work Codes,
Work Orders, or Support Personnel.

## 4. User Workflow

The V1 workflow is manual and payroll-week centered:

1. The operator opens Timesheet for a payroll week.
2. Viewing a payroll week does not create a database record.
3. If the week does not exist, Timesheet creates the Weekly Timesheet through
   an explicit Timesheet-owned mutation, such as saving the first Daily Time
   Entry for that week.
4. The operator enters or edits Daily Time Entries for work dates in that
   payroll week.
5. For each Daily Time Entry, the operator records clock-in, clock-out, unpaid
   break duration, primary equipment, optional Work Schedule context, and
   notes.
6. Timesheet calculates worked minutes from clock-in, clock-out, and unpaid
   break duration, then derives regular and overtime minutes for the week.
7. The operator adds one or more Work Allocations to explain where the worked
   hours went.
8. Each Work Allocation records sequence, work code, optional work order,
   allocated minutes, optional support personnel, and optional notes.
9. Draft Timesheets may remain temporarily unbalanced.
10. Before completion, allocation totals must reconcile exactly with calculated
   worked minutes.
11. Completed Timesheets become read-only until explicitly reopened to Draft.

The UI should be optimized for weekly entry and correction, not one standalone
row at a time.

## 5. Module Boundaries

Timesheet should be implemented as a feature-owned vertical slice under:

```text
src/features/timesheets/
```

The App Router should own route composition under:

```text
src/app/timesheets/
```

Expected ownership model:

| Area | Owner |
| --- | --- |
| Weekly Timesheet, Daily Time Entry, worked-time calculation, regular/overtime fields, allocations, Work Codes, Work Orders, and Support Personnel | Timesheet |
| Planned assignments, planned equipment, actual assignment context, crew, and schedule source | Work Schedule |
| Operational narrative for what happened during the day | Daily Work Logs |
| Shift summary and work authorization parent context | Shift Reports |
| Equipment identity, mine, and city reference data | Operations reference data |
| Selected-date composition surface | Day View |
| Pay document archive and pay-period records | Future Payslip Repository |

Timesheet may optionally reference a Work Schedule Daily Assignment, but that
relationship is context only. Payroll correctness must never depend on Work
Schedule existing or being complete.

Work Schedule and Timesheet do not own each other.

## 6. Data Flow

Timesheet uses server-owned persisted state.

### Conceptual Records

V1 should use these conceptual records:

| Concept | Responsibility |
| --- | --- |
| Weekly Timesheet | Payroll-week container for Daily Time Entries. Created automatically on first use. |
| Daily Time Entry | Independent work-date record and source of truth for worked time. |
| Work Allocation | Ordered explanation of where a Daily Time Entry's worked hours went. |
| Timesheet Work Code | Reusable Timesheet-owned work-code reference. |
| Timesheet Work Order | Reusable Timesheet-owned work-order reference. |
| Timesheet Support Person | Reusable Timesheet-owned support-person reference. |
| Work Allocation Support Person | Join between a Work Allocation and zero-or-many Support Personnel. |

The payroll week is the accounting and review unit. The Daily Time Entry is the
worked-time source of truth. The Work Allocation explains the breakdown of a
Daily Time Entry's worked hours.

### Weekly Ownership

One Timesheet represents one employer payroll week.

NAM's employer payroll week is Monday through Sunday. This is confirmed from
employer payslip evidence showing:

- Pay Period Begin: Monday, January 12, 2026.
- Pay Period End: Sunday, January 18, 2026.

Timesheet and Work Schedule both currently use Monday-through-Sunday weeks, but
they remain separate domains:

- Work Schedule week: operational planning.
- Timesheet week: employer payroll accounting.

Do not make Timesheet depend on Work Schedule merely because the current week
boundaries match.

Weekly Timesheet V1 remains personal and snapshot-based. The repository has no
Employee, User, Supervisor, payroll identity, authentication, or workforce
model, and Timesheet V1 must not introduce one.

Conceptual Weekly Timesheet owner fields:

- `primaryEmployeeDisplayName`
- `primaryEmployeeKey`

The display name is preserved for historical display. The normalized key is
derived server-side from the display name using trimming, deterministic
internal whitespace normalization, and lowercase. The key is not entered by the
user and is not an HR or payroll identifier.

V1 uniqueness should be:

```text
payrollWeekStartDate + primaryEmployeeKey
```

### Automatic Creation

Users should not manually create empty weekly containers.

Read operations must not silently write. Opening or viewing a payroll week
should not create an empty Weekly Timesheet.

V1 should provide a feature-owned Server Action that finds the Weekly Timesheet
for a payroll week or creates it as part of an explicit mutation, such as
saving the first Daily Time Entry. The parent creation and initial child writes
should occur in one transaction. Uniqueness should protect equivalent
owner/week combinations, and a failure must not leave a partial empty
Timesheet.

### Daily Time Entry

Daily Time Entries should include:

- work date
- clock in
- clock out
- unpaid break minutes
- calculated worked minutes
- regular minutes
- overtime minutes
- primary equipment
- primary equipment historical display snapshots
- optional Work Schedule Daily Assignment reference
- notes

Daily Time Entry records are independent work records. They should not be
generated automatically from Work Schedule assignments and should not overwrite
Work Schedule records.

Daily Time Entry belongs to the work date on which the shift begins. For
example, a Monday 5:00 PM to Tuesday 5:00 AM shift has work date Monday.

Time rules:

- `workDate` is date-only.
- Clock-in and clock-out represent local operational wall-clock times.
- Clock-out may occur on the following calendar day.
- Overnight duration is calculated by advancing clock-out into the next day
  when clock-out is otherwise earlier than or equal to clock-in.
- Times must not be shifted through browser timezone conversion.
- V1 uses minute precision only.
- One Daily Time Entry may not exceed 24 gross hours.
- Worked minutes after unpaid break must be greater than zero.
- Unpaid break minutes must be non-negative and less than the gross shift
  duration.
- Employer/local operational timezone must be applied consistently by the
  implementation, but V1 should not introduce a global multi-timezone system.

Worked time and allocation duration must be stored and calculated internally as
integer minutes. Do not use floating-point hours for authoritative
calculations. The UI may display hours and minutes or decimal-hour equivalents,
but persisted and validated calculations should remain integer-based.

Examples:

- 11.5 hours = 690 minutes.
- 2.4 hours = 144 minutes.
- 30-minute break = 30 minutes.

### Regular And Overtime Policy

Timesheet V1 uses weekly overtime.

Confirmed payroll evidence shows:

- 40 regular hours.
- 20 overtime hours.
- 60 total hours.

The V1 policy is:

- The first 2,400 worked minutes in the Monday-through-Sunday payroll week are
  regular.
- Worked minutes beyond 2,400 are overtime.

The weekly threshold should be defined once inside the Timesheet domain, such
as a feature-owned payroll policy constant. Do not scatter a literal 40-hour
rule throughout queries, validation, UI, and actions. Do not introduce a
generic payroll-policy engine in V1.

`workedMinutes` is derived from clock times and break minutes.
`regularMinutes` and `overtimeMinutes` are derived payroll snapshots stored on
Daily Time Entry. Weekly calculation should process Daily Time Entries in
deterministic work-date order. A day may contain both regular and overtime
minutes. Changing an earlier day requires recalculating regular/overtime splits
for that day and all later days in the week. Weekly totals are sums of
persisted daily results.

Allocation minutes explain work accounting and are independent of regular and
overtime classification. Do not classify individual Work Allocations as regular
or overtime in V1.

### Work Allocations

Work Allocations answer:

> Where did today's worked minutes go?

They exist separately from Daily Logs, Defects, and Work Schedule because:

- Daily Logs explain what happened operationally.
- Defects track equipment issues and corrective lifecycle.
- Work Schedule records assigned/planned context.
- Work Allocations account for payroll-facing hours by work code and optional
  work order.

Each Daily Time Entry owns one or more Work Allocations. Each allocation stores:

- sequence/order
- work code
- optional work order
- allocated minutes
- optional notes
- zero or more Support Personnel links

Work Allocation does not store allocation start/end times. Sequence plus
duration is sufficient for V1.

Allocation rules:

- Sequence is preserved and unique within the Daily Time Entry.
- Duplicate Work Codes are allowed because the same code may appear multiple
  times in one day when sequence matters.
- Allocated minutes must be positive integers.
- Draft entries may remain temporarily unbalanced.
- Completed Timesheets require exact equality:

```text
sum(allocationMinutes) = workedMinutes
```

Integer arithmetic eliminates tolerance and floating-point rounding rules.
Work Allocation does not need a separate lifecycle in V1.

Example patterns:

| Scenario | Allocation behavior |
| --- | --- |
| Production day | Work code such as `P-137`; no work order. |
| Maintenance day | Work code such as `OM-137`; Work Order commonly used but still optional in V1. |
| Mixed day | Ordered allocations such as Production -> Maintenance -> Production. Sequence matters because it preserves the day's accounting narrative without requiring start/end times. |

### Feature-Owned Reference Data

Timesheet owns these reusable reference records:

- Work Codes
- Work Orders
- Support Personnel

They are Timesheet-owned instead of global platform reference data because they
serve payroll/time-accounting entry. They should not force new global work
management, workforce, or maintenance modules before those modules are
approved.

Shared Equipment remains global operational reference data because Equipment is
already a cross-module operational anchor.

#### Work Codes

Timesheet Work Codes are reusable Timesheet-owned reference records.

V1 rules:

- Code is required and normalized for uniqueness.
- Description is supported.
- Optional category is allowed if useful during implementation.
- Optional Equipment association may support prioritization or filtering.
- Active/inactive status is required.
- Inactive Work Codes remain visible historically.
- Inactive Work Codes are excluded from new selections by default.
- A Work Code used by historical allocations is not hard-deleted.
- No inline ad hoc creation occurs inside the Timesheet V1 form.
- Management routes and actions belong to the Timesheet feature.

#### Work Orders

Timesheet Work Orders are reusable Timesheet-owned reference records.

V1 rules:

- Work order number/code is normalized for uniqueness.
- Description is supported.
- Work Order is optional on a Work Allocation.
- Production allocations commonly have no Work Order.
- Maintenance or repair allocations commonly use a Work Order.
- Optional Equipment association may be supported.
- Work Order-to-Work Code relationship is optional in V1.
- A Work Order may be commonly associated with a Work Code, but it must not be
  globally locked to only one code unless product evidence later requires that.
- Active/inactive status is required.
- Inactive records remain visible historically.
- Inactive records are excluded from new selection by default.
- A Work Order used historically is not hard-deleted.
- The Work Allocation relationship uses Restrict-style deletion behavior so a
  used Work Order is retired through inactivation rather than deletion.
- No inline ad hoc creation occurs inside the Timesheet V1 form.
- Management routes and actions belong to the Timesheet feature.

#### Support Personnel

Support Personnel is a reusable Timesheet-owned directory. It is not Employee,
User, HR, payroll identity, authentication, or workforce management.

V1 fields should include:

- display name
- trade or role
- optional company or employer
- active/inactive status
- optional notes
- normalized identity or uniqueness expectations sufficient to limit obvious
  duplicates

One Work Allocation may reference zero, one, or multiple Support Personnel.
Inactive personnel remain visible historically and are excluded from new
selection by default. Used Support Personnel records are not hard-deleted.

### Historical Snapshots

Where Timesheet uses live references, Timesheet should store historical display
snapshots sufficient to keep old Timesheets readable after reference changes.

Recommended V1 snapshots:

- Primary Equipment display name, equipment number, equipment category, mine
  name, city name, and city state on Daily Time Entry.
- Work Code code and description on Work Allocation.
- Work Order number and description on Work Allocation when a work order is
  used.
- Support Personnel display name, trade/role, and company when present on the
  allocation-support relationship or equivalent owned record.

Primary Equipment should retain a nullable live Equipment relation and limited
historical display snapshots. Users select Equipment only. Mine and City are
derived server-side through Equipment. Client-submitted snapshot values must
not be trusted. Complete Equipment, Mine, and City records must not be
duplicated.

Historical snapshots survive Equipment deletion or later transfer. Snapshots
refresh only when the selected Equipment intentionally changes.

Reference changes or inactivation must not rewrite old Timesheet meaning.

## 7. UI Composition

Timesheet should use a spreadsheet-like weekly view with expandable Daily Time
Entries.

Expected V1 routes:

- `/timesheets` list, archive, or current-week landing surface.
- `/timesheets/[id]` weekly detail/review surface.
- `/timesheets/week/[weekStart]` or equivalent payroll-week lookup route if
  useful for automatic creation.
- Timesheet-owned management routes or sections for Work Codes, Work Orders,
  and Support Personnel.

The exact route names may follow repository conventions during implementation,
but Timesheet screens should remain feature-owned.

Expected weekly UI:

- Payroll week header and navigation.
- Draft or Completed lifecycle status.
- Primary employee display name.
- Daily rows grouped by work date.
- Expandable Daily Time Entry details.
- Clock in, clock out, unpaid break, calculated worked minutes, regular
  minutes, and overtime minutes, with user-friendly display formatting.
- Primary equipment selector.
- Optional Work Schedule Daily Assignment context selector or display.
- Work Allocation rows under each Daily Time Entry.
- Work Code autocomplete/selector.
- Optional Work Order autocomplete/selector.
- Support Personnel selector attached to Work Allocations.
- Allocation totals and reconciliation status.
- Display-only daily and weekly previews for gross, worked, allocated,
  remaining or overallocated, regular, and overtime minutes. These previews
  reuse Timesheet-owned integer-minute calculations but never replace
  authoritative Server Action validation and persistence.
- Completion action gated by validation.
- Reopen action for Completed Timesheets.
- Read-only presentation for Completed Timesheets until reopened.

The weekly UI should be dense and work-focused. It should not become a
calendar, payroll report dashboard, or WFS screen clone.

## 8. Validation And Error Handling

Validation belongs at the Timesheet Server Action boundary.

Important V1 validation:

- Work date must belong to the Weekly Timesheet payroll week.
- `primaryEmployeeDisplayName` is required.
- `primaryEmployeeKey` is derived server-side and unique per payroll week.
- Clock-in and clock-out must form a valid worked interval after overnight
  handling.
- Gross shift duration may not exceed 24 hours.
- Unpaid break minutes must be non-negative and less than the gross shift
  duration.
- Worked minutes after break must be greater than zero.
- Calculated worked minutes should be derived server-side from clock-in,
  clock-out, and unpaid break minutes.
- Regular minutes and overtime minutes must be derived by the centralized
  Timesheet weekly overtime policy.
- Each Daily Time Entry must have one primary Equipment record.
- Optional Work Schedule Daily Assignment references must point to valid
  records with the same work date and normalized primary employee owner when
  supplied.
- A Daily Time Entry should have one or more Work Allocations when the
  Timesheet is completed.
- Work Allocation sequence values should be deterministic and unique within a
  Daily Time Entry.
- Work Allocation minutes must be positive integers.
- Work Allocation totals must equal the Daily Time Entry calculated worked
  minutes before completion.
- Draft Timesheets may remain temporarily unbalanced.
- Completed Timesheets must be balanced.
- Work Code is required for each Work Allocation.
- Work Order is optional by default.
- Work Order is optional in V1, including for maintenance-oriented allocations,
  unless later product evidence changes that rule.
- Support Personnel is optional.
- Support Personnel references must point to Timesheet-owned support-person
  records when supplied.
- Inactive reference records are excluded from new selections by default but
  remain visible historically.
- Completed Timesheets are read-only until explicitly reopened.

User-facing errors should be field- or row-specific where practical. Aggregate
errors should be reserved for cross-entry or cross-week reconciliation failures.
The weekly editor should preserve the expanded day while showing day-, field-,
and allocation-specific validation feedback.

Database constraints should protect relationships and uniqueness, but they
should not be the only validation mechanism.

## 9. Server And State Architecture

Timesheet should follow `docs/application-state-and-data-flow.md`.

Expected implementation pattern:

```text
server-rendered route
-> feature-owned data helper
-> Timesheet form/grid component
-> Server Action
-> Zod validation
-> Prisma transaction
-> revalidate affected routes
-> redirect to Timesheet detail or weekly route
```

Timesheet mutations should use Server Actions, not API routes, unless a future
integration explicitly requires an HTTP boundary.

Saving a weekly Timesheet grid should use one atomic Server Action and Prisma
transaction when the workflow writes a Weekly Timesheet, Daily Time Entries,
Work Allocations, and allocation-support links together.

Feature-owned helpers should provide:

- payroll-week lookup
- explicit first-use creation mutation
- weekly detail query
- Daily Time Entry lookup by date
- Work Code selector data
- Work Order selector data
- Support Personnel selector data
- allocation total calculations

Temporary client state is acceptable for expanding rows, adding unsaved
allocations, and editing grid values before submit. Persisted state remains
server-owned.

## 10. Lifecycle

V1 lifecycle statuses:

- Draft
- Completed

Draft:

- Work in progress.
- May contain missing entries.
- May contain unbalanced allocation totals.
- May be edited.

Completed:

- The operator considers the payroll week complete.
- Daily Time Entries and Work Allocations must pass completion validation.
- Allocation totals reconcile with worked minutes.
- Read-only in V1.
- No supervisor approval, external submission, payroll lock, or audit workflow
  is implied.

Corrections:

- Corrections require an explicit Reopen action.
- Reopen changes Completed back to Draft.
- Editing then occurs in Draft.
- The Timesheet may later be completed again.

Delete behavior:

- Draft Timesheets may be deleted.
- Completed Timesheets may not be deleted directly.
- A Completed Timesheet must first be reopened to Draft before deletion.
- Deleting a Weekly Timesheet deletes only its owned Daily Time Entries, Work
  Allocations, and allocation-support links.
- Deleting a Timesheet must not delete reusable Work Codes, Work Orders,
  Support Personnel, Equipment, or Work Schedule records.

Copy behavior is deferred from the V1 foundation. Do not make copy behavior a
schema prerequisite.

Future lifecycle statuses:

- Submitted
- Locked

Submitted and Locked are deferred until external submission, payroll
reconciliation, or access-control requirements are approved.

## 11. Relationships With Existing Modules

### Work Schedule

Daily Time Entry may optionally reference a Work Schedule Daily Assignment.

The relationship is optional because Timesheet must work correctly even when no
Work Schedule exists. Payroll correctness must never depend on Work Schedule.
When a link is selected, both the Daily Assignment work date and its Weekly
Schedule `primaryEmployeeKey` must match the Daily Time Entry and Weekly
Timesheet owner. The UI scopes selectable assignments and the Server Action
revalidates both conditions.

Timesheet may use Work Schedule as context for:

- planned or actual equipment comparison
- planned shift context
- schedule reconciliation views

Timesheet must not:

- derive worked hours from Work Schedule
- change Work Schedule records
- treat Work Schedule actual assignment as payroll proof
- require a Work Schedule assignment before saving time
- depend on Work Schedule lifecycle state

Work Schedule edits must not rewrite Timesheet values. If the linked Daily
Assignment is deleted, the Timesheet link should become null. The expected
conceptual deletion behavior is SetNull, not cascade or restrict.

Timesheet history remains readable because it owns its own work date, primary
equipment snapshots, clock times, worked minutes, regular/overtime snapshots,
allocations, and reference snapshots. Timesheet should not require Work
Schedule snapshots beyond Timesheet-owned facts.

Automatic prefill from Work Schedule is deferred unless explicitly approved as
a V1 convenience. No read operation should automatically copy schedule data.

### Daily Work Logs

Daily Logs remain the operational narrative layer. Timesheet may later link to
Daily Log activities when a concrete reconciliation workflow is approved, but
V1 should not require that relationship.

### Shift Reports And Work Authorizations

Timesheet may later link to Shift Reports or Work Authorizations for context.
Those links are deferred and should use explicit record IDs when approved.

### Defect Tracking, STOP Cards, And Daily Inspections

These modules remain independent. Timesheet should not use them to calculate
hours or allocation totals.

### Payslip Repository

Payslip may later reconcile pay-period documents against Timesheet weeks.
Timesheet should not implement Payslip storage, extraction, or financial
document privacy behavior.

## 12. Day View Participation

Timesheet Day View participation is intentionally deferred.

V1 architecture should not design or implement Day View integration during the
Timesheet foundation milestone.

When approved later, Day View participation should use a Timesheet-owned
selected-date helper that returns display-ready Daily Time Entry summaries.
Day View should remain composition-only and should not calculate worked hours,
allocation totals, payroll-week status, overtime, or reconciliation state.

## 13. Reporting Implications

Timesheet V1 should support simple totals needed by the weekly workflow:

- Daily worked-hours totals.
- Daily allocation totals.
- Weekly worked-hours total.
- Weekly regular-hours total.
- Weekly overtime-hours total.
- Completion reconciliation status.

Broader reporting is deferred:

- payroll reports
- schedule-versus-timesheet dashboards
- payslip reconciliation reports
- annual compensation analytics
- exports
- charts

The V1 data model should not block later reporting, but reporting should not
inflate the first implementation.

## 14. Security And Privacy

Timesheet data is payroll-adjacent and personally sensitive.

V1 does not introduce authentication or authorization, but implementation
should avoid implying multi-user access, supervisor approval, or external
submission.

Future role and privacy decisions are required before:

- supervisor approval
- external WFS submission
- shared organizational timesheets
- payroll locks
- Payslip reconciliation
- exports or reports containing compensation-sensitive context

## 15. Testing Strategy

Timesheet tests should follow `docs/testing-strategy.md`.

Expected V1 tests:

- Payroll-week boundary helpers.
- Primary employee key normalization and uniqueness.
- Explicit first-use Weekly Timesheet creation behavior.
- Daily Time Entry validation.
- Clock-in, clock-out, unpaid-break, and calculated-minutes behavior.
- Overnight shift duration behavior.
- Integer-minute rounding and display behavior.
- Regular and overtime reconciliation.
- Work Allocation total reconciliation.
- Draft versus Completed validation differences.
- Completed read-only behavior and Reopen action.
- Work Code and Work Order validation.
- Work Order optionality on Work Allocations.
- Support Personnel selection and optionality.
- Work Code create, edit, inactivate, list, and search.
- Work Order create, edit, inactivate, list, and search.
- Support Personnel create, edit, inactivate, list, and search.
- Inactive reference records excluded from new choices but visible
  historically.
- Deletion protection for used reference records.
- Autocomplete or lookup query behavior.
- Reference uniqueness normalization.
- Historical snapshot preservation for Equipment, Work Codes, Work Orders, and
  Support Personnel.
- Allocation-support join behavior.
- Optional Work Schedule Daily Assignment relationship validation.
- Server Action transaction behavior.
- Feature-owned query helpers.
- Weekly Timesheet route rendering.
- Expandable Daily Time Entry UI behavior where practical.
- Reference-management route rendering.
- Draft versus Completed read-only presentation.
- First-use creation behavior.
- Allocation reconciliation feedback.

PostgreSQL-backed integration validation should be prioritized for the first
Timesheet implementation because the feature will likely write a weekly parent,
daily entries, allocations, and allocation-support links together.

Broad E2E coverage is a future maturity step, not a prerequisite before the V1
foundation if focused unit, action, route, and PostgreSQL-backed integration
tests cover the core behavior.

## 16. Future Evolution

Future Timesheet evolution may include:

- Day View participation.
- Feature-owned list filtering and history lookup.
- Submitted and Locked lifecycle states.
- External WFS submission support.
- Timesheet-to-Work Schedule reconciliation views.
- Timesheet-to-Daily Log reconciliation views.
- Timesheet-to-Payslip reconciliation.
- Export or print views.
- Reporting dashboards.
- Approval workflow after authentication and authorization exist.
- Payroll-provider-specific import or integration.
- More detailed audit history.

Future growth should remain Timesheet-owned unless a true cross-feature
capability is approved.

## 17. Deferred Scope

Deferred from V1:

- Day View participation.
- Global cross-module search.
- Submitted and Locked lifecycle states.
- Copy-week or copy-entry workflow.
- Supervisor approval.
- Authentication, authorization, or employee identity.
- WFS login, scraping, import, or submission.
- Payslip reconciliation.
- Daily Log, Shift Report, Work Authorization, or Defect links.
- Allocation start/end times.
- Payroll reports, analytics, exports, or dashboards.
- Attachments.
- Notifications.
- Mobile-specific workflow.
- Workforce management.

## 18. Success Criteria

Timesheet V1 architecture is successful when:

- A Weekly Timesheet represents one employer payroll week independent from
  Work Schedule's planning week, even though both currently use
  Monday-through-Sunday boundaries.
- Weekly Timesheets are created through explicit first-use mutations, not
  read-only page views.
- Weekly Timesheets are unique by payroll week and normalized primary employee
  key.
- Daily Time Entries are the source of truth for worked time.
- Daily Time Entries store work date, clock-in, clock-out, unpaid break,
  worked minutes, regular minutes, overtime minutes, primary equipment,
  optional Work Schedule Daily Assignment reference, and notes.
- Daily Time Entries own one or more ordered Work Allocations.
- Work Allocations store work code, optional work order, allocated minutes,
  optional support personnel, and notes.
- Allocation totals must reconcile exactly with calculated worked minutes before
  Timesheet completion.
- Regular and overtime minutes are derived from a centralized V1 weekly
  overtime policy.
- Draft Timesheets can remain temporarily unbalanced.
- Completed Timesheets are read-only until reopened.
- Work Codes, Work Orders, and Support Personnel remain Timesheet-owned
  reusable reference records.
- Historical snapshots preserve readable old Timesheets after reference edits.
- Work Schedule remains optional context and does not determine payroll
  correctness.
- Day View participation remains deferred until separately approved.
- Timesheet implementation can proceed without introducing workforce
  management, authentication, global search, or reporting scope creep.
