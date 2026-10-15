# ADR-023: Quarantine Unverifiable Historical Payroll Evidence

Date: 2026-10-15

Status: Accepted

Category: Financial integrity/data architecture

## Decision

NAM establishes a forward-only trust boundary for historical Timesheet identity
and pay-rate provenance. Migration 36 quarantines every `WeeklyTimesheet` and
`EmployeePayRate` row that exists when the migration runs. It does not use a
migration timestamp, current Employee name, paycheck amount, effective date, or
source note to reconstruct historical truth.

For a quarantined Timesheet, the former Employee ID is copied to a candidate
field and the authoritative Employee relationship is cleared. The original
name/key snapshots, Daily Time Entries, Work Allocations, minute classifications,
and timestamps remain unchanged. Quarantined Timesheets are readable but cannot
be edited, completed, reopened, deleted, or counted as confirmed Payroll
evidence.

For a quarantined rate, the former source Paycheck ID is copied to a candidate
field and authoritative provenance is cleared. The rate value, effective date,
source note, Employee association, and timestamps remain unchanged. Only a
verified rate with explicit Paycheck or independent provenance may affect an
expected-gross estimate. Missing or conflicting trusted coverage suppresses the
complete estimate rather than showing zero or a partial total as complete.

New Timesheets establish `EXPLICIT_SELECTION` from a server-validated active
Employee ID. New rates derived from a confirmed Paycheck establish explicit
Paycheck provenance. Corrections supersede prior rate evidence and append a
replacement when applicable; they do not delete or overwrite prior evidence.
Trusted-only partial unique indexes constrain verified rates while permitting
quarantined, conflicting, superseded, and excluded evidence to coexist.
Application rate writes serialize each Employee/effective-date slot with a
transaction-scoped PostgreSQL advisory lock. A concurrent supported write sees
the committed winner and appends `CONFLICT` evidence instead of overwriting or
discarding it. The rate-to-Employee foreign key is restrictive so Employee
deletion cannot cascade-delete preserved evidence.

Migration history before migration 36 is immutable. The migration verifies the
successful predecessor names and checksums before changing schema or data and
runs in an explicit transaction.

## Consequences

- Some historically correct relationships intentionally become unresolved
  because the repository has no immutable evidence that distinguishes them
  from incorrect name-derived relationships.
- An unresolved Timesheet whose weekly date range overlaps a Payroll period
  blocks a false reconciliation even when it has no child entry in that period;
  it is not attributed to the Payroll owner and no day evidence is invented.
- Historical rates cannot affect estimates until a separately authorized review
  decision establishes provenance.
- Package 1 is safe without a review interface. Owner review, immutable review
  events, and owner-verification transitions remain Package 2 work.
- Application code predating this ADR is not rollback-compatible after migration
  36 because it ignores evidence states and cannot create constraint-valid
  trusted records. Recovery requires database restore plus the matching older
  application, not a code-only rollback.

## Alternatives Rejected

- A migration-34 timestamp cutover was rejected because name-based ownership
  resolution remained in the application after that migration.
- Current normalized-name matching was rejected because Employee names are
  mutable and non-unique.
- Amount/date/note matching for rates was rejected because resemblance does not
  prove provenance and can misclassify legitimate independent rates.
- Deleting stale-looking records was rejected because it destroys financial
  evidence.

## Related Documents

- `docs/architecture/features/payroll-reconciliation.md`
- `docs/architecture/features/timesheets.md`
- `docs/database.md`
- `docs/modules.md`
- `docs/testing-strategy.md`
- `docs/decisions/adr-022-payroll-reconciliation-structured-evidence.md`
