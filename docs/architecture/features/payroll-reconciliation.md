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

Last Reviewed: 2026-10-20

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
The parser preserves every recognized regular-pay row in source order as a
typed, extraction-only observation. It checks exact hours × rate consistency,
current-versus-YTD column shape, row/pay-period date evidence, and multiple-rate
documents. Observations are classified as supported, review-required, or
unsupported; they are not authoritative `EmployeePayRate` records and a payroll
period start alone does not prove a rate's exact effective date.

Manual entry is available when extraction is incomplete. The review surface
keeps conflicting observations visible when editable paycheck totals change.
The server issues a purpose-separated, 15-minute signed PDF-preview envelope
bound to the Payroll principal, byte fingerprint, current parser version,
pay-period bounds, check date, complete observation set, disposition, issue
codes, and extracted rate context. Only unchanged, supported evidence under a
valid envelope may use the existing Paycheck-derived verified-rate path.
Review-required, unsupported, or edited extraction can save reviewed Paycheck
facts, but its base rate is withheld and no authoritative rate evidence is
created. Missing, invalid, expired, cross-principal, wrong-purpose, or stale
envelopes fail closed and require a fresh parse.

Manual entry uses a separate Server Action and domain fingerprint. It can save
a Paycheck but never creates verified Paycheck-derived rate evidence from
client-entered values. A supplied manual or edited rate is retained only as
non-authoritative review evidence and cannot affect expected-gross calculations.
Corrections receive their own short-lived signed envelope
from current server-owned Paycheck state. An unchanged rate context can preserve
the existing correction behavior only when an active linked `VERIFIED` rate
matches the stored amount and effective date; changing the period, regular
hours, rate, or regular earnings supersedes eligible active direct Paycheck
rate evidence without creating a verified replacement. The submitted value is
retained as a review-only correction observation and open boundary candidate,
while the superseded authoritative row receives an immutable system correction
event. Historical `NEEDS_REVIEW`/`UNKNOWN`
rows linked only through candidate provenance remain unchanged; they are not
active Paycheck evidence and the correction system cannot attribute an owner
review transition to them. Explicit owner evidence review remains the only
promotion path
when authenticated support is unavailable. Corrections record `correctedAt`
without changing import provenance.
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
a locked Payroll card outside that session. Preview envelopes derive independent
HMAC keys for PDF-import and correction purposes from the existing server-only
session secret; the root secret is never sent to the client and no additional
configuration secret is required. Envelopes are stateless and replayable only
during their short lifetime. Exact PDF replay remains idempotent through the
employee-scoped byte fingerprint. A regenerated PDF with different bytes has a
different fingerprint even when its visible payroll content is equivalent.

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

Timesheet FTO entries are separate leave evidence and never become Daily Time
Entries. Requested or payment-unverified FTO prevents a scheduled date from
being mislabeled Missing Timesheet, but produces Needs Review and remains
excluded from worked, regular, overtime, and expected-gross totals. Payroll
does not promote approval/payment state or modify Paycheck evidence. Approved
FTO overtime eligibility and the authoritative Workday earning-code mapping
must be decided before paid-leave reconciliation can claim a match.

Timesheet no-work explanations are explicit zero-minute coverage. A valid
canceled-shift or coworker-covered record prevents Missing Timesheet for that
scheduled date but never contributes worked, regular, overtime, paid-leave, or
expected-gross minutes. Aggregate reconciliation may match when official totals
equal recorded payable worked time and all relevant scheduled dates are covered
by worked entries, FTO evidence, or valid no-work explanations. The match remains
period-level evidence only.

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

Confirmed imports persist every safely structured regular-rate row as an
immutable `PayRateObservation` authenticated by the signed preview. A period
start/end pair bounds evidence but never proves an exact rate-change date.
Repeated matching observations reinforce an existing verified boundary without
creating another `EmployeePayRate`; first or changed rates create an open
`PayRateBoundaryCandidate`. Open candidates suppress expected gross from their
earliest potentially affected date while preserving unrelated earlier results.
Only an owner-authorized, versioned exact-date decision inside the supported
window can create a new verified boundary. Manual and corrected values remain
review evidence and cannot impersonate parser-backed Workday observations.

Explicit row dates remain observation bounds, not automatic employment-wide
effective dates. Timeline classification considers verified boundaries, open
and resolved candidates, earlier/later contradictions, and supersession under
the Employee timeline lock. Promotion reclassifies later observations in the
same transaction; approving a raise cannot cause a later observation of the old
rate to be silently treated as uninterrupted historical support. That later
evidence remains an unresolved possible decrease and keeps affected expected
gross unavailable. Import order does not change the resulting uncertainty
projection.

PostgreSQL rejects supported provenance unless it is a current-revision,
confirmed, non-superseded Workday observation for the same Employee, amount,
and valid date context. Deferred checks also reject referenced Paycheck or
supersession changes that would leave a verified boundary without eligible
support. A terminal candidate update cannot commit without the matching
immutable typed decision event. Owner rejection is a separate versioned,
reasoned, idempotent decision that preserves the candidate and observations;
only a valid audited rejection removes that candidate from expected-gross
suppression. Reviewer tokens are serialized and checked across Timesheet,
Package 2A rate, and boundary-decision domains.

Corrections increment the Paycheck evidence revision, append observations, and
link prior observations through immutable supersession history. Changed context
supersedes eligible direct Paycheck-derived rates through Package 2A system
events; it does not create a verified replacement. Migration-36 quarantine is
not reinterpreted or automatically promoted.

The signed PDF envelope retains the authenticated document-derived period
bounds separately from editable Paycheck dates. If any signed rate-context fact
changes, parser rows retain their original order, amounts, row bounds, period
bounds, and provenance, but formerly supported rows become non-promotable
review-required observations. An unchanged correction carries every active
parser row forward at its existing supported, review-required, or unsupported
state and preserves its source bounds while linking revisions atomically.

Exact-boundary review accepts only real Gregorian `YYYY-MM-DD` dates with exact
round-trip equivalence. The request validator and persistence service both
reject impossible dates before any rate or decision event can be written.

## UI Composition

`/payroll` owns summary cards, Monday-Sunday calendar, day drawer, current
paycheck context, history, import, detail, and controlled correction. The home
widget is a protected summary. The UI selectively adapts licensed Metronic
9.5.0 Next.js Card patterns and theme tokens under ADR-014; business logic stays
in project-owned Payroll modules.

Calendar cells use low-saturation semantic backgrounds with text labels. Status
priority preserves confirmed numerical discrepancy over informational day
states; valid no-work and FTO states replace Missing Timesheet where applicable.
The selected-day marker is independent from status, and the right drawer uses
brief CSS motion with a reduced-motion path.

The Workday parser extracts current-period pre-tax totals from a trustworthy
aggregate when present or sums supported itemized pre-tax rows while keeping YTD
values, taxes, post-tax deductions, employer benefits, and noncash earnings
separate. Accounting review identifies all implicated fields when responsibility
is ambiguous and removes warning treatment after the values reconcile.

Selected-month reconciliation totals include Workday periods whose
`periodEnd` falls in that month. Pending totals include only uncovered work
dates from completed NAM weeks whose week end falls in that month; partial
Workday overlap does not hide the remaining entries.
Latest Paycheck and Paycheck History are explicitly all-time views. Projected
per-period check metadata remains limited to valid Monday-Sunday NAM weeks; an
imported Workday `checkDate` is always authoritative. Arbitrary Workday
boundaries do not receive an invented projection, and existing persisted
`expectedCheckDate` values are not recalculated during Paycheck correction.

The dashboard's **Next Expected Direct Deposit** is a separate estimate based
only on the configured weekly Wednesday cadence. It resolves the current date
in `America/New_York`, includes the current Wednesday, and otherwise selects
the next Wednesday without consulting the selected Timesheet week, a Paycheck
period, or an official Workday check date. It never reports a confirmed bank
posting. Actual deposit dates require genuine bank evidence or explicit owner
entry, neither of which is implemented by this focused widget.

Open Issues counts unique actionable records in the selected scope. Each
Paycheck discrepancy or review condition is counted once rather than once per
covered calendar day. Draft Timesheets, unresolved legacy Timesheets, ambiguous
entry dates, and past scheduled dates with missing Timesheet evidence are
included when they are not already represented by the same Paycheck review
condition. Future scheduled work and the neutral absence of day-level allocation
inside aggregate evidence are not counted as issues.
An unresolved FTO entry is one actionable issue for its date and is not also
counted as Missing Timesheet.

## Historical Evidence Review Foundation

Package 2A implements the owner-only review service described by ADR-024. A
valid signed Payroll session must match the explicitly configured reviewer
Employee ID. Review actions reauthorize independently, validate explicit
versioned decisions and source evidence, serialize competing writes, and commit
the evidence state plus an immutable typed event atomically. Confirmed identity
and verified-rate decisions participate in the next reconciliation read; no
derived totals are persisted. Candidate IDs remain non-authoritative.

Paycheck correction is also an audited evidence-transition source. Superseded
active `VERIFIED`/`CONFLICT` Paycheck rates receive system-attributed immutable
events in the correction transaction. Replacement observations and candidates
remain non-authoritative and do not receive migration-37 rate-review events.
Quarantined candidate-only rows retain their original state and provenance. The
authenticated correcting Employee is
retained as an initiator snapshot, distinct from an owner reviewer, so an
automatic correction transition cannot be presented as owner verification.

Package 2B adds the protected `/payroll/evidence-review` workspace, bounded
Timesheet and rate queues, evidence detail routes, explicit two-step decision
forms, atomic competitor resolution, and immutable-history timelines. Routes
and loaders authorize independently before target queries; client forms reuse
the Package 2A Server Actions, expected versions, and request-token protocol.
This implementation does not authorize production release or deployment.

Phase 5B.3 adds the reviewer-only `/payroll/rate-history` workspace and
`/payroll/rate-history/candidates/[id]` detail route. The overview presents the
verified `EmployeePayRate` timeline separately from open, resolved, rejected,
and superseded candidates. It never promotes the newest observation into the
current-rate summary. Supporting observation counts, retained Paycheck period
bounds, provenance, explicit classification text, and unresolved expected-gross
impact are projected through bounded server queries after reviewer
authorization.

Candidate detail uses retained structured evidence only: row order and values,
document-proven row dates, authenticated pay-period bounds, extraction basis,
date confidence, observation state, revision lineage, overlapping candidates,
affected worked dates, and recorded decision snapshots. It does not expose PDF
bytes, raw document text, deductions, account identifiers, or signed preview
tokens. Document-derived dates remain visually and semantically distinct from
the exact date deliberately selected by the reviewer.

Browser acceptance for this workspace extends the Package 2B fail-closed test
profile. It requires an exact disposable PostgreSQL identity, explicit
synthetic markers and principals, fixed loopback-only origins, and separate
authorized/reviewer-mismatched application processes. The fixture contains only
synthetic structured evidence and never reads PDFs, production credentials, or
an ordinary `DATABASE_URL`. Guard validation occurs before Prisma construction
or browser launch.

Promotion and rejection reuse the Phase 5B.2 actions without duplicating their
authority rules. Neither workflow preselects an exact date. Both require a
reason and explicit confirmation, submit the candidate evidence version and a
stable request token, retain that token for an ambiguous same-request retry,
and show the authoritative server result. Rejection preserves observations;
promotion remains limited to eligible active Workday support and cannot resolve
overlapping contradictory candidates implicitly. Successful decisions
revalidate Payroll, the candidate queue, detail history, and expected-gross
projections while leaving other uncertainty intact.

## Deferred

Permanent PDF storage, OCR, provider sync, exports, exact day-level allocation
without source evidence, multi-employee HR administration, and application-wide
identity/RBAC remain outside V1. Historical evidence review remains a focused
owner-only Payroll capability rather than an ordinary employee Payroll surface.
