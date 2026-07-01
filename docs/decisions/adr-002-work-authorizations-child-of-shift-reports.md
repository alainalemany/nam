# ADR-002: Work Authorizations Are Child Records Of Shift Reports

Date: 2026-06-05

Status: Accepted

Category: Product/domain architecture

## Decision

Work Authorizations will be modeled as structured child records of Shift
Reports.

## Reason

Work Authorizations happen during a specific operating shift and should remain
connected to the shift activity record. Modeling them as child records preserves
operational context, supports historical review, and prevents standalone
compliance records from becoming disconnected from daily work history.

## Consequences

- A `WorkAuthorization` must always reference a `ShiftReport`.
- Work Authorization data will be captured structurally rather than stored only
  as scanned forms or photos.
- Original form photos may still be stored as attachments for reference.
- Optional permits will be modeled as child records of the `WorkAuthorization`.
- Paper-style PDF export can be added later because the structured data will
  already exist.
