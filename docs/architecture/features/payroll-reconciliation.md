# Payroll Reconciliation Architecture

Status: Approved; implementation authorized 2026-10-08

Product Phase: Payroll Reconciliation V1

Primary Feature: Payroll

Depends On:

- Work Schedule
- Timesheets
- Employees
- ADR-022
- ADR-023

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
`WeeklyTimesheet.primaryEmployeeId` provides canonical employee scope only when
its identity state is `EXPLICIT_SELECTION` or `OWNER_VERIFIED`; the display name
and normalized key remain historical snapshots. New Timesheets require a
selected active `Employee`. Migration 36 quarantines all older Timesheets,
preserves any former ID as candidate evidence, and clears the authoritative
relationship without name matching. Schedule and Timesheet records remain
authoritative in their owning modules. Reconciliation is derived at read time
and revalidated after relevant mutations.

PDF import accepts a bounded readable PDF, extracts text in memory, parses known
Workday fields deterministically, presents every value for review, and then
persists structured values plus a fingerprint. Bytes and raw text are discarded.
Manual entry is available when extraction is incomplete. Corrections update the
reviewed record and record `correctedAt` without changing import provenance.
New Paycheck-derived rates retain a direct source relation and verified
provenance. Corrections mark prior evidence `SUPERSEDED` and append replacement
evidence when applicable. Clearing a base rate does not delete the prior row.
Conflicting evidence is preserved as `CONFLICT` and cannot affect estimates.
Supported rate writes acquire transaction-scoped locks for both their source
Paycheck and Employee/effective-date slot before classifying evidence. This
serializes same-slot imports and corrections: the first verified record remains
authoritative, while the competing record is appended as `CONFLICT`. The
database partial unique index remains the final fail-closed boundary for writes
that do not follow this path.

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
missing week coverage, duplicate dates, unresolved historical identity, or
overlapping Payroll evidence produces Needs Review. A total match with a
regular/overtime classification difference is a Discrepancy. A match is
aggregate only. Daily calendar cells therefore use neutral
payroll-evidence language rather than claiming a particular date was paid.
Future scheduled shifts are not missing. A past scheduled shift is marked
Missing Timesheet only when the relevant NAM Timesheet exists but lacks the
entry; missing historical NAM data stays Needs Review.
Archived schedules remain historical planned-work context for Payroll, while
Draft schedules do not. This is intentionally separate from new Timesheet-link
eligibility, which continues to require an Active schedule and an effective
Scheduled assignment.

Unresolved historical Timesheets are discovered by Payroll-period/date overlap,
not by a current Employee name. They are never attributed to the Payroll owner,
but potentially relevant unresolved evidence prevents a false confirmed
reconciliation until it is explicitly dispositioned by the deferred Package 2
review workflow. The weekly parent range is sufficient to block reconciliation;
a Daily Time Entry inside the Workday period is not required. Entryless parents
can therefore block aggregate confirmation without creating fictional day-level
evidence.

Expected gross uses only `VERIFIED` rates with `PAYCHECK` or `INDEPENDENT`
provenance. There is no fallback to a Paycheck's current `baseRate`. If any
pending entry lacks verified coverage, or the latest applicable evidence is in
conflict, the complete estimate is unavailable; NAM does not present zero or a
partial amount as the total.

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
The current-week projection first resolves the calendar date in
`America/New_York`, preventing a Sunday-evening UTC rollover from selecting the
following NAM week.

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
identity/RBAC remain outside V1. The owner-only historical evidence review
interface and append-only review-event history are deferred Package 2 work.
Package 1 exposes no mutation that promotes quarantined evidence.
