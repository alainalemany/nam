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

## Implementation Status Clarification

Added: 2026-07-10

The required `WorkAuthorization` to `ShiftReport` parent relationship is
implemented and remains the durable decision recorded by this ADR.

This ADR also anticipated optional permit child records. The approved V1
implementation uses flat boolean fields on `WorkAuthorization` for the current
permit, work-requirement, and completion-checklist selections. This is a
proportional V1 representation, not a reversal of the structured-data decision.
Deeper permit or checklist child-record modeling remains deferred until field
lifecycle, repetition, metadata, or independent querying requirements justify
the additional structure.
