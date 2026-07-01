# ADR-003: Permanent Operational History

Date: 2026-06-22

Status: Accepted

Category: Product architecture

## Decision

NAM Dashboard will prioritize permanent operational history with search and
calendar navigation.

## Reason

The system is intended to become a long-term personal work record. The operator
should be able to select a past date or search by relevant details and
understand what happened that day across schedules, daily logs, inspections,
work authorizations, defects, future work orders, and notes.

## Consequences

- Operational records should be retained indefinitely unless explicitly deleted
  or archived by the operator.
- Core records should include reliable dates, timestamps, equipment links, and
  module relationships.
- Calendar and search views should be cross-module product capabilities, not
  isolated features inside one module.
- Day View should include direct records for the selected date and contextual
  records whose date range contains the selected date, such as the Work Schedule
  week.
- Future modules should be designed so their records can appear in the
  historical timeline.
