# Equipment Operations Architecture Assessment

Status: Assessment Complete

Product Phase: Product Roadmap Phases 2 and 3

Assessment Scope: Operational Safety Checklists, Equipment Fuel Events, Supply
Requests, Fleet separation, and a future Equipment Activity Timeline

Related Documents:

- `docs/product-roadmap.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`
- `docs/architecture/features/daily-inspections.md`
- `docs/architecture/features/operational-safety-checklists.md`
- `docs/architecture/features/defect-tracking.md`
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/day-view.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/decisions/adr-017-supersede-standalone-work-truck-log.md`

Last Reviewed: 2026-07-16

## 1. Purpose

This assessment defined the recommended boundaries among the newly confirmed
equipment-related workflows before their feature architecture or implementation
began. Operational Safety Checklists have since completed architecture,
implementation, independent review, and repository acceptance.

It does not define final persistence models, routes, forms, Server Actions, or
shared application infrastructure for the remaining candidates. Each remaining
implementation candidate still requires its own approved feature architecture
when its product decisions are complete.

## 2. Classification

| Classification | Meaning in this assessment |
| --- | --- |
| Confirmed | Approved operational discovery that may guide canonical product documentation. |
| Recommended | Proposed architecture boundary that requires review before implementation. |
| Discovery-stage | A likely feature whose product rules are not complete enough for feature architecture. |
| Deferred | A capability intentionally excluded from the next implementation sequence. |

## 3. Repository Evidence

The current platform already provides:

- `City -> Mine -> Equipment` reference context.
- Feature-owned operational records and queries.
- Daily Inspections for manual inspection summaries and findings.
- Defect Tracking for issue lifecycle, corrective work, resolution, and closure.
- Daily Work Logs for workday narrative activities.
- Day View for date-centered composition without business-rule ownership.
- Work Schedule and Timesheet examples of limited Equipment snapshots for
  historical display.

The repository does not provide:

- A generic checklist engine.
- Inventory, purchasing, vendor, or fleet-management infrastructure.
- A shared operational-event table.
- A generic Day View or Equipment timeline contribution registry.
- Employee, User, Supervisor, or authentication identity for V1 workflows.

## 4. Domain Assessment

`Equipment Operations` is a useful planning label, not a new application layer
or shared persistence owner.

The recommended boundary is to keep separate feature-owned records connected by
Equipment and explicit optional relationships. Shared Equipment context does
not make inspection, defect, fueling, supply, schedule, and time records one
domain model.

| Capability | Status | Recommended owner |
| --- | --- | --- |
| Manual Daily Inspection summaries | Implemented | Daily Inspections |
| Operational Safety Checklists | V1 foundation accepted; Phase 23.3 enhancement architecture approved; meter/save slice ready, photo slice access-gated; Day View deferred | Daily Inspections bounded context, as a distinct checklist record type and workflow |
| Equipment Fuel Events | Approved V1 foundation implemented; Day View deferred | Independent Equipment Fuel Events feature |
| Warehouse pickup performed for someone else's order | Confirmed activity | Daily Work Logs only |
| Operator-originated Supply Requests | Confirmed future feature; discovery-stage | Independent Supply Requests feature |
| Fleet purchases, ownership, assignments, cards, receipts, registration, insurance, and replacement lifecycle | Separate deferred domain | Future Fleet capability |
| Equipment Activity Timeline | Deferred derived capability | Future composition surface using feature-owned queries |

No generic Equipment Operations service, repository, CRUD framework, form
engine, or event table is justified by the current evidence.

## 5. Operational Safety Checklists

### Business Boundary

The existing Daily Inspection and the discovered Operational Safety Checklist
are related but distinct business records:

- A Daily Inspection is the implemented summary record for an equipment or
  work-area condition, findings, and notes.
- An Operational Safety Checklist is a start-of-shift, Equipment-specific record
  that applies an approved checklist and preserves one response per item.

They should share the Daily Inspections feature boundary because both own
inspection facts and condition findings. They should not be treated as the same
record shape or forced into one ambiguous form.

### Template Direction

V1 should use one checklist capability with two approved templates:

- Dragline Inspection.
- Mobile Inspection.

The templates may share response vocabulary and common metadata while retaining
different approved item sets. This does not justify two independent features or
a user-configurable checklist engine.

The Mobile template applies to work trucks, tractors, forklifts, and other
supported mobile Equipment. Each actual Equipment inspected at shift start
receives an independent checklist. A later Equipment replacement belongs in
Daily Work Logs and does not create another corporate inspection.

Template identity and version must remain visible in historical records so later
item changes do not rewrite what was inspected. Exact template content and
versioning are now preserved by the approved feature architecture and canonical
Dragline and Mobile catalogs.

### V1 Boundary

The checklist foundation should focus on:

- Start-of-shift Equipment inspection.
- Date, shift, Equipment, starting meter, operator display name, supervisor
  display name, and problem-description context as approved by product review.
- Ordered responses using `OK`, `Needs Repair`, `Previously Noted`, and `N/A`
  for most condition items, with narrower approved Yes/No or Presence response
  sets where the verified template requires them.
- Dragline and Mobile template selection based on the approved workflow and
  applicable Equipment categories.
- Feature-owned validation and historical review.

Planner Review, planner authentication, approvals, configurable template
administration, analytics, and automatic Defect creation remain outside the
initial checklist foundation. Phase 23.3 approves explicit `HOURS`/`MILES`
meter units, optional checklist-level photo evidence with captions, and NAM
save confirmation. The meter/save slice is implementation-ready; photo
implementation and real use remain gated by ADR-018.

## 6. Defect Tracking Boundary

Operational Safety Checklists own checklist answers, problem descriptions, and
inspection completion. Defect Tracking owns issue status, severity, priority,
corrective information, resolution, and closure.

For V1:

- `Needs Repair` does not automatically create a Defect.
- `Previously Noted` does not infer a Defect from matching text or Equipment.
- Repeated problem descriptions remain historical checklist facts.
- A checklist can be completed without creating or updating a Defect.

Future evolution may add explicit, operator-controlled links to an existing or
new Defect. Any link must preserve both owners and must not allow checklist
mutations to change Defect lifecycle state.

## 7. Equipment Fuel Events

Equipment Fuel Events are operational service records for fuel-consuming
Equipment. They are not fleet gas-station purchase records.

One event represents:

- One fueling occurrence.
- One Equipment subject.
- Event date and time context.
- One fuel type for that occurrence unless later discovery proves mixed fuel is
  operationally real.
- One or more ordered tank-fill lines.
- Delivered quantity reported by the fuel-service person.
- Optional service-person or source context.
- Optional explicit Daily Work Log activity context.

A multi-tank occurrence, such as a main tank and walking-engine tank filled
during the same service visit, remains one event with separate tank-fill facts.
Fleet vehicle fuel-card purchases, gas-station receipts, car washes, mileage,
and temporary vehicle assignment do not belong to this feature.

Equipment Fuel Events own structured delivered-quantity facts. Daily Work Logs
may own a narrative `FUEL_SERVICE` activity for the same occurrence. Timesheet
Work Allocations do not own or link to the fuel event merely because fueling
happened during work.

The approved feature architecture is
`docs/architecture/features/equipment-fuel-events.md`. It resolves the V1 fuel
types, whole-US-gallon Tank Fill model, completed-only correction lifecycle,
active/inactive Fuel Service Person reference, historical snapshots, optional
one-to-one Fuel Event-owned Daily Work Log activity context, active Equipment
eligibility, bounded Tank Fill validation, and deferred Day View boundary.
Meter readings are excluded.

## 8. Supply Requests

Supply Requests are a likely standalone feature because an operator-originated
request needs durable identity and retrieval beyond a workday narrative.

The feature would own the operator's record of what was requested and its own
future status or fulfillment meaning. It would not own:

- Warehouse inventory.
- Stock quantities.
- Purchasing or procurement.
- Vendor management.
- ERP order processing.
- Warehouse activity performed for requests made by other people.

Warehouse pickup for supplies ordered by someone else remains a Daily Work Log
activity because its product value is recording time away from the dragline and
the workday narrative. It may mention one or more destination draglines without
creating a Supply Request.

Supply Requests may later use optional, explicit relationships to Equipment,
Defects, Daily Work Logs or activities, and Work Orders. None of these
relationships should be required before the request workflow is defined.

Supply Requests remain discovery-stage. Request lifecycle, item detail,
quantity and unit handling, destination Equipment, fulfillment evidence, and
correction rules must be confirmed before feature architecture begins.

## 9. Fleet Separation

Fleet is a separate deferred domain because its subject is company-vehicle
ownership and administrative history, not a shift-start Equipment inspection,
Daily Work Log narrative, or operational Equipment service event.

Fleet discovery must account for:

- Vehicle ownership and time-dependent assignments.
- Company fuel-card purchases.
- Gas-station receipts.
- Registration and insurance.
- Replacement lifecycle.
- Optional car washes and related evidence.

Future Fleet architecture may reuse Equipment references when appropriate, but
it must not place receipt and vehicle-assignment behavior inside Operational
Safety Checklists, Daily Work Logs, or Equipment Fuel Events. Starting meter
readings remain checklist-owned, and mid-shift replacement narrative remains
Daily Work Log-owned.

## 10. Equipment History

New Equipment-centered records should retain a live Equipment reference for
current navigation and limited historical display snapshots when reference-data
changes would otherwise rewrite operational history.

Where historical location and identity are material, the established limited
snapshot set is appropriate:

- Equipment display name.
- Equipment number.
- Equipment category.
- Mine name.
- City name.
- City state.

These snapshots are historical display facts, not copies of complete Equipment,
Mine, or City records. Exact relationship and deletion behavior belongs to each
feature architecture because the operational need may differ by record type.

Operational Safety Checklists and Equipment Fuel Events require historical
Equipment readability. Supply Requests need snapshots only when an approved
Equipment relationship becomes part of the request's durable meaning.

## 11. Day View

The following confirmed or likely records are date-relevant:

- Operational Safety Checklists.
- Equipment Fuel Events.
- Supply Requests when they have a meaningful request or fulfillment date.
- Fleet records after that domain is defined.

Day View participation is not part of this assessment milestone. When approved,
each feature must own its selected-date query and display interpretation. Day
View may only order and render the returned contribution.

## 12. Equipment Activity Timeline

The future Equipment Activity Timeline should be derived from feature-owned
queries. It must not persist duplicate copies of checklist, defect, Daily Work
Log, fuel, supply, schedule, or time records.

The existing architecture can support this direction because implemented
features already own bounded queries and display-ready Day View contributions.
No generic contribution registry or stored timeline table is justified now.

Revisit timeline architecture only after:

- At least three implemented Equipment-centered features can contribute useful
  history.
- Users demonstrate a recurring need to review one Equipment record across
  modules and dates.
- Feature-owned query contracts are stable enough to compare.
- Actual query volume or presentation maintenance exposes a concrete problem.

Work Schedule and Timesheet context should participate only when it adds clear
Equipment history. Planned assignment and worked-time context must not be
misrepresented as an Equipment service or condition event.

## 13. Recommended Sequence

1. Operational Safety Checklists architecture, V1 foundation, independent
   review, corrections, and repository acceptance. (Completed in Phase 21.)
2. Equipment Fuel Events feature architecture. (Completed in Phase 22.2.)
3. Equipment Fuel Events V1 foundation, independent review, scoped lookup and
   test corrections, deterministic ordering correction, and acceptance.
   (Completed in Phases 22.3 through 22.3.2.)
4. Supersede the invalid standalone Work Truck Log premise and correct roadmap
   ownership. (Completed in Phase 23.2; see ADR-017.)
5. Amend Operational Safety Checklist architecture for explicit meter units,
   optional checklist-level image evidence, and NAM save confirmation.
   (Completed in Phase 23.3.)
6. Implement meter units and NAM save confirmation as Phase 23.4.
7. Implement optional photo evidence only after ADR-018's access, processing,
   storage, and backup gates close.
8. Equipment Fuel Events or Operational Safety Checklist Day View participation
   only when separately approved.
9. Supply Requests product discovery completion and later feature architecture.
10. Fleet product discovery as a separate future domain.
11. Equipment Activity Timeline assessment only after enough contributors exist.

## 14. Remaining Product Decisions

Operational Safety Checklists have no remaining Phase 23.4 product decisions.
Phase 23.3 approves explicit whole-integer `HOURS`/`MILES` storage, editable
known-category defaults, optional checklist-level photo evidence, and NAM save
confirmation. Photo implementation remains technically and security-gated by
ADR-018 rather than blocked by checklist product ambiguity.

Equipment Fuel Events have no remaining V1 product decisions. The approved
architecture defines operational work date plus local event time, Diesel,
Off-road Diesel, and Gasoline, ordered positive-integer whole-US-gallon Tank
Fills with bounded validation and unique normalized labels, historical
suggestions with manual override, no meter readings, active-Equipment
eligibility, an optional active/inactive feature-owned Fuel Service Person
reference, an optional unique Fuel Event-owned Daily Work Log activity link,
completed-only correction, structured history filters, and deferred Day View
implementation.

Supply Requests require confirmation of:

- Request lifecycle and retrieval questions.
- Item, quantity, unit, and free-text requirements.
- Whether one request can target multiple Equipment records.
- Fulfillment, cancellation, correction, and deletion meaning.
- Which optional relationships provide real operational value.

## 15. Assessment Outcome

The repository should not introduce a shared Equipment Operations application
layer. Equipment remains the reference anchor, while each operational workflow
retains its own business record and lifecycle.

Operational Safety Checklists are accepted. Equipment Fuel Events architecture
is Approved, its V1 foundation is implemented and accepted, and the Phase 22.3.1
scoped lookup and test corrections are complete. Day View participation remains
deferred. The implementation introduced no Fleet purchase behavior or shared
Equipment Operations infrastructure. Supply Requests remain a later
discovery-stage feature, Fleet remains a separate future domain, and the
Equipment Activity Timeline remains derived and deferred.

The Phase 23.3 checklist enhancement architecture is Approved. Phase 23.4 may
implement meter units and NAM save confirmation. Phase 23.5 photo evidence
remains blocked until its explicit access and runtime prerequisites are met;
this does not create shared Equipment Operations media infrastructure.

ADR-017 supersedes the standalone Work Truck Log proposal. Shift-start work
truck, tractor, forklift, and other supported mobile inspections remain owned
by Operational Safety Checklists; mid-shift Equipment replacements remain
owned by Daily Work Logs.
