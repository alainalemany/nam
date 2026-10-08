# ADR-022: Payroll Reconciliation Uses Reviewed Structured Evidence

Date: 2026-10-08

Status: Accepted

Category: Security/data boundaries

Supersedes: ADR-005

## Decision

Payroll V1 reconciles employee-scoped Work Schedule, completed NAM Timesheets,
and reviewed structured values extracted from readable Workday PDFs. Uploaded
PDF bytes and raw extracted text are processed temporarily and are not retained
by default. OCR, payroll-provider login integration, and generalized payroll
administration are outside V1.

The application stores exact integer minutes, Decimal monetary values, payroll
period/check-date evidence, import fingerprint and parser version, review
state, and correction timestamps. Workday's Overtime 1X and 0.5X premium lines
are separate earnings components for the same overtime hours and must never be
added as two sets of worked hours. Noncash imputed earnings remain separate
from gross cash pay.

Payroll routes and mutations require an employee-scoped, signed, short-lived
HTTP-only session established with server-only configuration. Tailscale is the
network perimeter, not employee authorization. The feature fails closed when
the owner employee ID or secrets are absent.

## Consequences

- The original source values remain distinguishable from derived reconciliation.
- Reimport is idempotent through a content or canonical evidence fingerprint.
- Corrections are explicit and retain import provenance.
- Aggregate hour matches do not claim that individual dates were paid.
- Historical paychecks without NAM Timesheets are reviewable evidence, not
  proof of missed work or underpayment.
- A future permanent document archive, OCR path, exports, or broader identity
  system requires a separate approved design.

## Related Documents

- `docs/architecture/features/payroll-reconciliation.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/decisions/adr-014-metronic-integration-strategy.md`
