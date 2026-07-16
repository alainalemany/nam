# ADR-017: Supersede Standalone Work Truck Log

Date: 2026-07-16

Status: Accepted

Category: Product/domain architecture

Supersedes: [ADR-007: Work Truck Log Personal Record](adr-007-work-truck-log-personal-record.md)

## Decision

NAM Dashboard will not create a standalone Work Truck Log module, schema,
route set, or lifecycle.

The confirmed corporate shift-start inspection workflow is owned by
Operational Safety Checklists:

- Dragline Equipment uses the Dragline checklist.
- Work trucks, tractors, forklifts, and other supported mobile Equipment use
  the Mobile checklist.
- One independent checklist is completed for each piece of Equipment inspected
  at shift start.
- The checklist owns the starting meter reading. A follow-up architecture
  amendment will define explicit `HOURS` and `MILES` units.

A mid-shift truck or other Equipment replacement is operational context owned
by Daily Work Logs. It does not alter the original shift-start checklist,
create another checklist automatically, or create a truck-use segment.

Equipment continues to own Equipment identity, including the unique Equipment
number, display name, category, make and model, Mine and location
relationships, and active status.

Fleet remains a separate deferred domain for concerns such as purchases,
ownership, assignments, fuel cards, receipts, registration, insurance, and
replacement lifecycle. Fleet is not a prerequisite for Operational Safety
Checklists.

Operational Safety Checklist meter-unit support, optional checklist-level
photo evidence with captions, and a clear NAM save-confirmation experience are
separate follow-up architecture work. This ADR does not approve their technical
design or implementation.

Subsequent status: Phase 23.3 approved that enhancement architecture. ADR-018
governs private photo storage and its access gate. Meter/save implementation
remains separate from access-gated photo implementation; this status note does
not rewrite ADR-017's original Work Truck Log decision.

## Context

ADR-007 assumed that the operator completed a separate corporate Work Truck Log
website form and therefore recommended a personal structured mirror. Direct
operational confirmation established that no separate corporate Work Truck Log
exists. The corporate workflow consists of the Dragline and Mobile inspection
forms already represented by Operational Safety Checklists.

For example, a shift involving Dragline 133, one work truck, and one tractor
produces three independent checklist records: one Dragline checklist and two
Mobile checklists. A later replacement of the truck belongs in the Daily Work
Log and does not produce another corporate inspection.

Implementing the record proposed by ADR-007 would duplicate inspection,
Equipment, and Daily Work Log ownership without representing a real workflow.

## Consequences

- Standalone Work Truck Log implementation is removed from the active roadmap
  and V1 scope.
- No `WorkTruckLog`, configurable truck-response model, Work Truck Log route,
  or Work Truck Log Day View contribution will be created.
- Operational Safety Checklists remain the source of shift-start mobile
  inspection records and starting meter readings.
- Daily Work Logs remain the source of mid-shift replacement narrative and
  activity timing.
- No cross-feature mutation is introduced between those features.
- Fleet remains independently deferred.
- ADR-007 remains in the repository as historical context and is marked
  Superseded rather than deleted or rewritten.

## Related Documentation

- [Operational Safety Checklists Architecture](../architecture/features/operational-safety-checklists.md)
- [Daily Work Logs Architecture](../architecture/features/daily-work-logs.md)
- [Equipment Operations Architecture Assessment](../architecture/equipment-operations.md)
- [Product Roadmap](../product-roadmap.md)
- [Implementation Roadmap](../roadmap.md)
- [ADR-018: Private Operational Safety Checklist Photo Storage](adr-018-private-operational-safety-checklist-photo-storage.md)
