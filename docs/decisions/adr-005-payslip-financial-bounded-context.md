# ADR-005: Payslip Repository Financial Bounded Context

Date: 2026-06-23

Status: Accepted

Category: Security/data boundaries

## Decision

Payslip Repository will be modeled as a dedicated financial bounded context with
original PDF storage, structured extraction, OCR fallback, and manual correction.

## Reason

Payslip data is sensitive personal financial data and has different privacy,
retention, extraction, and analytics requirements than operational mining
records. The original PDF must remain the source artifact, while parsed payroll
data should be normalized enough to support calendar lookup, date-range totals,
annual totals, deductions, taxes, 401k, insurance, and other line-item analytics.

## Consequences

- Payslip PDFs should be stored as immutable source documents unless explicitly
  deleted by the operator.
- Parsed values should retain source text, extraction method, confidence, parser
  version, and manual corrections.
- OCR must be supported because some payroll PDFs may be image-based or
  generated with compressed content that is not reliable through basic text
  extraction.
- Payslip data should be hidden from general operational views unless the
  operator enables compensation visibility.
- Future security work should evaluate encryption at rest, redaction, export
  controls, and stricter access permissions for financial data.
