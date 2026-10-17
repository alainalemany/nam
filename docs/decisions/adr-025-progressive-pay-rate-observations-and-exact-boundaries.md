# ADR-025: Separate Progressive Pay-Rate Observations From Exact Verified Boundaries

Date: 2026-10-17

Status: Accepted

Category: Financial integrity/data architecture

## Decision

NAM preserves each structured regular-rate row from a confirmed Paycheck as an
immutable `PayRateObservation`. An observation records canonical Employee and
source Paycheck identity, the Paycheck evidence revision and row sequence,
normalized rate/hours/earnings, frozen period and optional row-date bounds,
extraction basis, date confidence, parser version, state, digest, and creation
time. It is evidence that a document observed a rate; it is not an
`EmployeePayRate` boundary.

`EmployeePayRate` remains the only authoritative verified change-point timeline.
New period-only observations never use `PayrollPeriod.periodStart` as a proven
effective date. Repeated matching observations attach append-only support to an
existing verified boundary without creating another boundary. A first rate or
changed rate instead creates or reinforces an open `PayRateBoundaryCandidate`.
The candidate stores the earliest and latest dates supported by the evidence.
Stronger authenticated observations may narrow that window. An authenticated
out-of-order observation from an earlier, disjoint period may move the whole
window earlier; it does not union periods into a broader guessed interval.
Every decrease remains review-required.

An explicit row-date range remains an observation window. Even a one-day row
proves only that the rate appeared for that day; it does not independently
prove when an employment-wide change became effective. Classification evaluates
each active observation against verified boundaries, open neighboring
candidates, resolved candidates, contradictory earlier/later observations, and
supersession history under one Employee timeline lock. Resolving a boundary
therefore reclassifies later evidence atomically. A later return to an older
rate remains an open potential decrease after an intervening raise is approved,
independent of upload order.

An owner reviewer may resolve a candidate only by supplying an exact date inside
its authenticated evidence window, the expected candidate version, a mandatory
reason, and a UUID request token. The server reuses Package 2A reviewer
authorization, acquires source-Paycheck locks before the Employee timeline and
effective-date slot locks, creates one verified `EmployeePayRate`, links its
supporting observations, updates the candidate, and appends an immutable
`PayRateBoundaryDecisionEvent` in one transaction. Manual or correction-only
observations cannot satisfy the authenticated Workday-support requirement.
PostgreSQL independently enforces that support comes from a current revision of
a confirmed Paycheck, a non-superseded supported Workday row, the same Employee
and amount, and a valid date context. Deferred checks prevent Paycheck revision,
confirmation, or observation-supersession changes from leaving a verified
boundary without current eligible support.

A reviewer may also reject an erroneous or disproven open candidate. Rejection
requires the same reviewer authorization, expected version, mandatory reason,
UUID request token, locking, and atomic immutable event guarantees as promotion.
It preserves every observation and link; it is distinct from correction-driven
supersession. A deferred database constraint prevents `RESOLVED` or `REJECTED`
candidate state from committing without its matching typed decision event.
Reviewer request tokens are checked across Timesheet, Package 2A rate-evidence,
and rate-boundary domains, so cross-domain reuse is rejected rather than
silently interpreted as a replay.

Open candidates explicitly represent rate uncertainty. Expected-gross reads
fail closed from the candidate's earliest potentially affected date while
leaving unrelated earlier dates available. Resolution requires the owner
decision above or a future authenticated-evidence transition with equivalent
audit guarantees; no background inference silently extends an older rate.

Paycheck corrections increment `Paycheck.evidenceRevision`, append replacement
observations, and link prior observations through append-only supersession rows.
Changed rate context supersedes eligible direct `VERIFIED` or `CONFLICT`
Paycheck-derived rates through migration-37 system audit events. Candidate-only
migration-36 quarantine remains unchanged. Unchanged corrections do not create
a new verified boundary.

Migration 38 is additive and forward-only. It adds observation, classification,
supersession, support, candidate, and decision-event structures plus database
checks, restrictive foreign keys, uniqueness constraints, and append-only
triggers. It does not backfill observations or reinterpret existing rates.
Deploying code that depends on these tables requires a separately authorized,
coordinated application/database release; the current production application
continues to run against migration 37 until that release.

## Consequences

- Multiple Paychecks can reinforce one verified rate without redundant
  authoritative change points.
- Period-only evidence cannot silently invent a raise date.
- Open uncertainty suppresses affected expected-gross calculations instead of
  allowing a stale verified rate to continue through a possible change.
- Valid audited rejection removes only the rejected candidate from the open
  uncertainty projection and can restore calculations when no other unresolved
  evidence affects those dates.
- Original PDFs and full extracted text remain non-persistent; observation
  digests are normalized evidence identities, not document archives.
- Byte-identical reuploads remain idempotent through the Paycheck fingerprint.
  Regenerated PDFs may create distinct observations, but matching semantic
  evidence reinforces a candidate or verified boundary rather than proving a
  different wage rate.
- Phase 5B.3 may add a polished candidate/history interface, but it must call
  the existing owner-only backend decision contract and cannot auto-promote
  review-required evidence.

## Alternatives Rejected

- Continuing to use `periodStart` as `effectiveFrom` was rejected because a pay
  period is a date window, not proof of the first day a rate took effect.
- Overwriting a current rate was rejected because it destroys historical
  financial evidence and makes corrections unexplainable.
- Treating each repeated payslip as a new authoritative boundary was rejected
  because it creates false history and duplicate change points.
- Client-provided observation JSON and manual values were rejected as parser
  provenance because only the signed server preview authenticates extracted
  Workday observations.
- Persisting PDF bytes or raw text was rejected under the existing Payroll
  privacy boundary.

## Related Documents

- `docs/decisions/adr-022-payroll-reconciliation-structured-evidence.md`
- `docs/decisions/adr-023-payroll-historical-evidence-quarantine.md`
- `docs/decisions/adr-024-payroll-evidence-review-authorization-and-immutable-history.md`
- `docs/architecture/features/payroll-reconciliation.md`
- `docs/database.md`
- `docs/modules.md`
- `docs/testing-strategy.md`
