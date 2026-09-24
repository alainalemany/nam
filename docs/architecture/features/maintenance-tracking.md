# Maintenance Tracking Architecture

Status: Approved

Product Phase: DDR-derived maintenance-hour tracking

Primary Feature: Maintenance Tracking

Depends On:

- Canonical Equipment reference data
- Completed Dragline Delay Reports and their canonical runtime calculation
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Last Reviewed: 2026-09-24

## 1. Purpose

Maintenance Tracking interprets authoritative Dragline operating time against
configurable component service rules. Drag Cable, Hoist Cable, and Teeth are
initial database records, not application categories. Every live tracker is
owned by exactly one Equipment/component pair.

## 2. Ownership And Data Flow

The authoritative flow is:

```text
Completed DDR runtime for one Equipment
  -> Equipment/component tracker boundaries
  -> configured service rules
  -> current interval, lifecycle, and status
  -> Maintenance and Home summaries
```

DDR owns operational time. Maintenance owns rules, tracker start boundaries,
exceptional adjustments, and effective service events. Equipment owns Dragline
identity. Home owns no maintenance records and renders feature-owned summaries.

A DDR contributes only when its live `equipmentId` exactly matches the
tracker's `equipmentId`. Draft DDRs do not contribute. Runtime is recalculated
from the current completed DDR timeline using the same interval-union helper as
DDR. The report ID is unique in an evaluation, so the same DDR cannot be
counted twice. A DDR correction updates the authoritative report and the next
maintenance read reflects the corrected runtime; no stale one-time increment
must be reversed.

## 3. Derived-First Hybrid Decision

Current values are derived from completed DDRs plus event boundaries. They are
not persisted as mutable accumulated totals. This was chosen over an
increment-once materialization because it is deterministic under DDR
corrections, backdated PM, and replacement boundaries, while preserving clear
source provenance and Equipment isolation.

`MaintenanceCounterEntry` remains only for exceptional positive administrative
adjustments not represented by DDR. Every adjustment requires an effective
timestamp and reason and remains auditable. It never replaces or edits DDR
data. The normal operator workflow contains no manual accumulated-hours field.

Queries are server-side and bounded by active tracker start dates, relevant
Equipment IDs, completed status, and operational work dates. PostgreSQL's
Equipment/date/shift DDR identity and maintenance boundary indexes support the
growing dataset. A future materialized cache may be added only if measured
load requires it; it must remain rebuildable from DDRs, adjustments, and
service events.

## 4. Reference Data And Rules

`TrackedMaintenanceComponent` stores component name, unit, active state, and
display order. `MaintenanceRule` stores action, counter scope, exact/lower
threshold, optional upper window, warning lead, repeat behavior, optional
maximum, lifecycle effect, priority, and order.

Counter scope is generic:

- `SERVICE_INTERVAL` measures from the current lifecycle start or the most
  recent performance of that rule.
- `COMPONENT_LIFECYCLE` measures from installation/tracking start or the most
  recent replacement boundary.

The initial data is:

- Drag Cable: Resocket every 150 h on a service interval; Replace in the
  1300-1400 h lifecycle window.
- Hoist Cable: Resocket every 500 h, maximum four per lifecycle; Replace at
  1500 h lifecycle time.
- Teeth: Replace at 750 h lifecycle time.

Warning leads remain row configuration. Adding Fairlead Bearing, a pump,
motor, bucket component, or another cable is a component/rule/tracker data
operation, not a schema column or component enum change.

## 5. Interval And Lifecycle Semantics

A resocket is an intermediate service. It closes that rule's service interval
and begins the next interval at its effective timestamp, while total component
lifecycle hours continue. Early and late service are both valid; values are
never capped at the target.

A replacement event closes the prior physical lifecycle and establishes a new
lifecycle boundary at its effective timestamp. The next lifecycle and all its
interval rules derive from zero after that boundary. Prior DDRs and service
events remain unchanged and visible in history.

For Hoist Cable, resocket count is the number of that rule's events in the
current lifecycle. Reaching the configured maximum removes that interval rule
from available current actions. Lifecycle replacement status remains
independent. The application does not invent behavior when configured
resocket and replacement rules overlap.

## 6. Effective Time And Service History

`effectiveAt` is the operational boundary. `createdAt` is the audit time when
the row was entered. Backdated entry therefore uses the actual PM time, not
the Save click time. Service entry is append-only in this slice and must be
chronological within a tracker. Correcting an already recorded service event
requires a future explicit audited correction workflow; casual hard deletion
is not provided.

Each event snapshots component/action/unit, counter scope, thresholds, warning,
repeat settings, maximum, lifecycle effect, target, interval and lifecycle
values at recording, variance, lifecycle number, and sequence. Reference Data
edits can change current calculations but cannot rewrite the historical rule
meaning under which a completed PM was recorded.

Early PM has a negative variance, exact PM has zero variance, and late PM has a
positive overdue variance. A service-window event inside its inclusive lower
and upper bounds is presented as within window.

## 7. Intra-DDR Service Splitting

The DDR timeline supports precise splitting when its downtime reconciles to
the nominal scheduled shift window. Runtime before the effective service time
belongs to the closing interval/lifecycle; runtime after it belongs to the new
interval/lifecycle.

DDR also intentionally allows factual downtime after nominal shift end while
retaining a fixed 720-minute budget. That model does not identify which earlier
running minutes an after-shift deduction replaces. If a service timestamp
would require splitting such a report, Maintenance rejects the ambiguous
operation with an explicit error instead of inventing clock precision. Whole
report contribution remains canonical. This limitation should be revisited
only with an approved DDR timeline semantic change.

## 8. Status

Status is derived per rule and never persisted:

- Healthy: below the configured warning range.
- Due Soon: within the rule's warning lead.
- Due: exactly at an exact threshold.
- Due Window: within an inclusive lower/upper window.
- Overdue: beyond an exact threshold or beyond a window upper bound.

Progress visuals cap at 100 percent, but numeric values do not. For example,
180 / 150 h remains 180 / 150 h and shows +30 h overdue.

## 9. UI Composition

The Maintenance list groups trackers by Dragline. Detail shows every eligible
rule as interval or lifecycle context, total lifecycle, last service, service
history, and exceptional adjustments. Record Service asks for action,
effective date/time, and optional notes/recorder; it never asks the user to
reset a counter.

Home has two bounded views:

- Maintenance Health selects one Dragline, preferring manually requested
  Equipment, then active/next scheduled Equipment, then deterministic order.
  It renders configured components dynamically, ranks important items first,
  caps the card, and links each ring to tracker detail.
- Fleet Attention excludes healthy items and the selected Dragline. It orders
  overdue, due, due-window, and due-soon exceptions deterministically and
  links to full Maintenance.

Semantic colors are green Healthy, amber Due Soon, orange Due/Due Window, red
Overdue, and gray unavailable. Text labels accompany every color.

## 10. Integrity And Testing

Database relationships restrict deletion of trackers with history. Checks
protect positive exceptional adjustments, required reasons, nonnegative rule
targets, coherent ranges, and positive lifecycle/service sequences.
Application validation rejects future boundaries, boundaries before tracker
start, stale record versions, and nonchronological service entry.

Focused tests cover Equipment isolation, multiple and duplicate DDRs, DDR
correction recalculation, intra-report splitting and its explicit limitation,
early/exact/late service, interval reset without lifecycle reset, replacement,
Hoist maximum count, backdated effective time, status/window behavior,
historical snapshots, Home selection and Fleet ordering, and capped progress.
