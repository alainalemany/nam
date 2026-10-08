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

Last Reviewed: 2026-10-08

## Purpose And Boundary

Payroll answers what was scheduled, what NAM recorded, what Workday confirms in
aggregate, what awaits a payslip, and what needs review. It reconciles evidence;
it does not run payroll, replace Workday, edit Timesheets, or infer missing
historical work from absent NAM records.

## Data And Mutation Flow

`PayrollPeriod`, `Paycheck`, and `EmployeePayRate` store reviewed evidence.
`WeeklyTimesheet.primaryEmployeeId` adds canonical employee scope while keeping
the existing display snapshot and key. Schedule and Timesheet records remain
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

Completed NAM Timesheet totals are compared with regular plus overtime paid
minutes. A match is aggregate only. Daily calendar cells therefore use neutral
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

## Deferred

Permanent PDF storage, OCR, provider sync, exports, exact day-level allocation
without source evidence, multi-employee HR administration, and application-wide
identity/RBAC remain outside V1.
