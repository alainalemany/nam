# Payroll Reconciliation Architecture

Status: Approved; implementation authorized 2026-10-08

Product Phase: Payroll Reconciliation V1

Primary Feature: Payroll

Depends On:

- Work Schedule
- Timesheets
- Employees
- ADR-022

Related Documents:

- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`

Last Reviewed: 2026-10-15

## Purpose And Boundary

Payroll answers what was scheduled, what NAM recorded, what Workday confirms in
aggregate, what awaits a payslip, and what needs review. It reconciles evidence;
it does not run payroll, replace Workday, edit Timesheets, or infer missing
historical work from absent NAM records.

## Data And Mutation Flow

`PayrollPeriod`, `Paycheck`, and `EmployeePayRate` store reviewed evidence.
`WeeklyTimesheet.primaryEmployeeId` provides canonical employee scope while
the display name and normalized key remain historical snapshots. New
Timesheets require a selected active `Employee`; legacy null-ID Timesheets are
preserved but are not confirmed Payroll evidence. Schedule and Timesheet records remain
authoritative in their owning modules. Reconciliation is derived at read time
and revalidated after relevant mutations.

PDF import accepts a bounded readable PDF, extracts text in memory, parses known
Workday fields deterministically, presents every value for review, and then
persists structured values plus a fingerprint. Bytes and raw text are discarded.
Manual entry is available when extraction is incomplete. Corrections update the
reviewed record and record `correctedAt` without changing import provenance.

## Security

All Payroll pages, reads, imports, and corrections require a signed HTTP-only
session scoped to `NAM_PAYROLL_OWNER_EMPLOYEE_ID`. The module fails closed if
its access key or signing secret is not configured. The home page displays only
a locked Payroll card outside that session.

## Reconciliation And Evidence

Workday `periodStart` and `periodEnd` are inclusive evidence boundaries.
Reconciliation selects canonical-employee Daily Time Entries whose `workDate`
falls inside those boundaries, across every intersecting NAM Timesheet week.
Overnight entries remain wholly attributed to their start-date `workDate`.
Entry IDs are de-duplicated, and overlapping imported Payroll periods remain
Needs Review rather than claiming the same entry twice.

Completed NAM regular, overtime, and total minutes are compared independently
with Workday regular, overtime, and total paid minutes. A full match requires
all three categories plus a `CONFIRMED` Paycheck and complete, unambiguous
evidence. A Paycheck whose review state is not Confirmed, Draft coverage,
missing week coverage, duplicate dates, legacy unresolved identity, or
overlapping Payroll evidence produces Needs Review. A total match with a
regular/overtime classification difference is a Discrepancy. A match is
aggregate only. Daily calendar cells therefore use neutral
payroll-evidence language rather than claiming a particular date was paid.
Future scheduled shifts are not missing. A past scheduled shift is marked
Missing Timesheet only when the relevant NAM Timesheet exists but lacks the
entry; missing historical NAM data stays Needs Review.

## UI Composition

`/payroll` owns summary cards, Monday-Sunday calendar, day drawer, current
paycheck context, history, import, detail, and controlled correction. The home
widget is a protected summary. The UI selectively adapts licensed Metronic
9.5.0 Next.js Card patterns and theme tokens under ADR-014; business logic stays
in project-owned Payroll modules.

Selected-month reconciliation totals include Workday periods whose
`periodEnd` falls in that month. Pending totals include only uncovered work
dates from completed NAM weeks whose week end falls in that month; partial
Workday overlap does not hide the remaining entries.
Latest Paycheck and Paycheck History are explicitly all-time views. Projected
payday is Wednesday only for a valid Monday-Sunday NAM week; an imported
Workday `checkDate` is always authoritative. Arbitrary Workday boundaries do
not receive an invented Wednesday projection. Existing persisted
`expectedCheckDate` values are not recalculated during Paycheck correction.

Open Issues counts unique actionable records in the selected scope. Each
Paycheck discrepancy or review condition is counted once rather than once per
covered calendar day. Draft Timesheets, unresolved legacy Timesheets, ambiguous
entry dates, and past scheduled dates with missing Timesheet evidence are
included when they are not already represented by the same Paycheck review
condition. Future scheduled work and the neutral absence of day-level allocation
inside aggregate evidence are not counted as issues.

## Deferred

Permanent PDF storage, OCR, provider sync, exports, exact day-level allocation
without source evidence, multi-employee HR administration, and application-wide
identity/RBAC remain outside V1. Immutable Timesheet and Paycheck correction
history is deferred and must pass a separate audit before production reliance
on financial corrections.
