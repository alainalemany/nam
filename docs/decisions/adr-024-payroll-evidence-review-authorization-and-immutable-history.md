# ADR-024: Authorize Historical Payroll Evidence Review and Preserve Immutable History

Date: 2026-10-15

Status: Accepted

Category: Security/financial integrity/data architecture

## Decision

Historical evidence review is a distinct owner-only Payroll capability. Every
review loader and mutation requires the existing signed Payroll session and an
exact match between its canonical Employee ID and
`NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID`. Missing, malformed, unknown, or
mismatched configuration fails closed. Reviewer identity and snapshots are
derived server-side and are never accepted from request data. V1 does not add a
general role system or a second reauthentication flow.

Timesheet identity and pay-rate evidence changes use explicit decisions,
mandatory reasons, expected record versions, UUID request tokens, and canonical
payload digests. Candidate Employee and Paycheck IDs remain informational.
Inactive historical Employees may be selected explicitly. Paycheck provenance
requires a Confirmed Paycheck with matching Employee, rate, and period start;
independent provenance requires a bounded, non-sensitive evidence reference.

Each successful decision increments the target version and appends a typed
review event in the same transaction. Events preserve previous/new states and
relationships, reviewer snapshots, reason, optional evidence reference,
request identity, sequence, versions, and timestamp. Restrictive foreign keys,
unique sequence/version/token constraints, and PostgreSQL triggers reject event
updates and deletes. Insert triggers additionally require a contiguous target
sequence and agreement with the target's committed new version, state, and
authoritative relationships. State changes and events therefore commit or roll
back as one unit.

Confirmed Paycheck corrections are a separate, system-attributed event source.
When a correction supersedes linked Paycheck-derived rate evidence or creates
its replacement, each changed rate receives a
`PAYCHECK_CORRECTION_SUPERSEDED` or `PAYCHECK_CORRECTION_CREATED` event in the
same transaction. The event identifies the authenticated Employee who
initiated the correction in dedicated initiator snapshots, but has no reviewer
identity and does not represent owner verification. Creation uses an explicit
lineage convention: previous status and provenance are null, previous version
is zero, and the new version is the replacement's inherited evidence version.

Supported writes use transaction-scoped advisory locks in deterministic order,
then compare-and-swap updates. Paycheck locks precede Employee/effective-date
rate-slot locks; Timesheet review and ordinary Timesheet mutation share the
Timesheet lock. PostgreSQL partial unique indexes remain authoritative for one
trusted Timesheet per Employee/week and one verified rate per Employee/effective
date. Same-token/same-payload requests replay the prior result; token reuse with
a different payload is rejected.

Package 2A implements this authorization, persistence, action, migration, and
test foundation. Package 2B implements protected bounded queues, Timesheet and
rate detail workflows, explicit confirmation controls, immutable timelines,
and structured recovery from stale or conflicting decisions. The interface
does not weaken the independent loader and mutation authorization boundaries.
Production release remains separately authorized.

## Consequences

- Quarantined evidence can become authoritative only through an explicit,
  attributable review decision.
- Names, amounts, dates, notes, and candidate IDs never promote evidence by
  inference.
- Review history is database-append-only even if application code attempts to
  bypass the service layer.
- Database checks reject structurally invalid event attribution, decision/state
  combinations, non-progressing versions, noncontiguous sequences, and events
  whose new state does not match the target. PostgreSQL cannot independently
  prove the truth of a supplied reason or reconstruct every prior application
  state; transition authorization and prior-state validation remain service
  responsibilities inside the locked transaction.
- Historical source snapshots and evidence rows are preserved; conflicting or
  excluded rates are dispositioned, not deleted.
- Reconciliation observes committed verified evidence on its next server read;
  no duplicate totals, queue, or background job is introduced.
- Migration 37 is forward-only. A code-only rollback to an application unaware
  of Package 1/2A is unsafe; recovery requires coordinated application/database
  restoration.

## Alternatives Rejected

- Ordinary Payroll access was rejected as sufficient review authority because
  it would expose globally unresolved evidence across employee boundaries.
- Client-supplied reviewer identity and candidate-ID auto-acceptance were
  rejected because neither proves authority or provenance.
- Mutable audit rows and application-only immutability were rejected because
  they permit silent history rewriting through another database path.
- Silent replacement of competing rates was rejected because it destroys the
  evidence needed to explain the decision.

## Related Documents

- `docs/decisions/adr-022-payroll-reconciliation-structured-evidence.md`
- `docs/decisions/adr-023-payroll-historical-evidence-quarantine.md`
- `docs/architecture/features/payroll-reconciliation.md`
- `docs/architecture/features/timesheets.md`
- `docs/database.md`
- `docs/testing-strategy.md`
