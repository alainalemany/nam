# Equipment Fuel Events Architecture

Status: Approved

Product Phase: Product Roadmap Phase 3 Personal Administration

Primary Feature: Equipment Fuel Events

Bounded Context: Equipment Fuel Events

Depends On:

- Operations reference data for Equipment, Mine, and City context
- Existing Daily Work Log ownership boundaries
- `docs/architecture/equipment-operations.md`
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Related Documents:

- `docs/product-vision.md`
- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/architecture/features/README.md`
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/day-view.md`
- `docs/decisions/adr-006-fuel-log-structured-operational-module.md`
- `docs/decisions/adr-017-supersede-standalone-work-truck-log.md`

Last Reviewed: 2026-07-15

Implementation Status: V1 Foundation Implemented. Prisma persistence,
feature-owned validation, queries, Server Actions, history/create/detail/
correction routes, Fuel Service Person management, and focused tests are
implemented. Day View participation remains deferred.

## 1. Purpose

Equipment Fuel Events preserve the operational fact that fuel was delivered to
one Equipment subject during one service occurrence.

The feature should help the operator answer:

> When was this Equipment fueled, which approved fuel type was delivered, and
> how many whole US gallons went into each tank?

One service occurrence may fill several tanks. The event remains the parent
operational record, while ordered Tank Fills preserve the separate delivered
quantities.

This feature does not represent Fleet gas-station purchases. Fuel cards,
receipts, prices, vehicle assignments, and car washes belong to a separate
future Fleet domain. Starting meter readings belong to Operational Safety
Checklists, not Equipment Fuel Events.

## 2. Responsibilities

Equipment Fuel Events own:

- One completed fueling record for one operational service occurrence.
- The required Equipment subject and its historical display context.
- Operational work date and actual local event time.
- One approved fuel type per event.
- One or more ordered Tank Fills with whole-US-gallon quantities.
- Server-derived event totals.
- Optional event notes for exceptional operational context.
- An optional feature-owned Fuel Service Person reference and historical name
  snapshot.
- Optional explicit context from one Daily Work Log fueling activity without
  taking ownership of that activity.
- Completed-record correction behavior.
- Feature-owned validation, queries, mutations, history filters, UI, and tests.
- Future display-ready contributions to Day View and a derived Equipment
  Activity Timeline when separately approved.

## 3. Non-Responsibilities

Equipment Fuel Events do not own:

- Fleet fuel purchases, fuel cards, receipts, vendors, prices, mileage, car
  washes, or temporary vehicle assignment.
- Daily Work Log narratives, delays, or activity lifecycle.
- Work Schedule planning.
- Timesheet worked-time or Work Allocation accounting.
- Operational Safety Checklist meter readings or inspection answers.
- Defect lifecycle, corrective work, resolution, or closure.
- Equipment, Mine, or City reference-data management.
- Employee, User, authentication, authorization, or workforce management.
- Tank reference-data management.
- Runtime-editable fuel types or feature configuration.
- Analytics, reports, notifications, exports, global search, or forecasting.
- Day View or Equipment Activity Timeline composition.
- A generic operational-event framework.

## 4. User Workflow

The approved V1 workflow is:

1. The operator starts a new Equipment Fuel Event after one fueling service
   occurrence.
2. The operator selects the actual Equipment that received fuel.
3. The feature derives Mine and City context from Equipment.
4. The operator records the operational work date and actual local event time.
5. The operator selects Diesel, Off-road Diesel, or Gasoline for the entire
   event.
6. The operator records one or more ordered Tank Fills using suggested labels
   where useful or a manual label override.
7. The operator records each delivered quantity as a positive whole number of
   US gallons.
8. The operator may select an existing Fuel Service Person or create one inline
   by display name.
9. The operator may add notes for exceptional operational context and may link
   a matching Daily Work Log fueling activity.
10. The feature derives the event total from Tank Fill quantities and submits
    the complete event atomically.
11. A later correction updates the completed event in place after full
    server-side revalidation.

Viewing a form does not create an event. V1 has no Draft state and no normal
delete workflow.

## 5. Feature Ownership And Repository Organization

Equipment Fuel Events should be delivered as an independent feature-owned
vertical slice. Equipment Operations remains a planning label, not a shared
application or persistence layer.

The feature should eventually own its:

- Validation and normalization.
- Data loading and display mapping.
- Server Actions and transactional persistence.
- Constants and types, including approved fuel types.
- History, create, detail, and correction UI.
- Feature-specific tests.
- Future Day View and Equipment-history interpretation helpers.

App Router pages should compose routes from feature-owned reads and components.
They should not own fuel validation, total calculation, snapshot derivation, or
relationship rules.

No generic service-event repository, contribution registry, CRUD framework, or
tank subsystem is justified.

## 6. Conceptual Domain Model

The V1 domain contains three concepts.

### Equipment Fuel Event

Represents one completed fueling service occurrence for one Equipment subject.
It owns:

- Operational work date.
- Actual local event time.
- One approved fuel type.
- Optional notes.
- Equipment and historical location context.
- Optional Fuel Service Person context.
- Optional Daily Work Log fueling-activity context.
- One or more ordered Tank Fills.
- Creation and correction timestamps.

An event has its own durable identity. Equipment, work date, and event time are
not a natural uniqueness key because the same Equipment may receive more than
one legitimate service occurrence on one operational date.

### Tank Fill

Represents one ordered tank-level delivered-quantity fact within an event. It
owns:

- Sequence.
- The historical tank label entered or accepted for that occurrence.
- A server-derived normalized tank-label key for within-event duplicate
  prevention.
- A positive integer quantity in US gallons.

Tank Fills have no independent lifecycle. They exist only as children of one
Equipment Fuel Event. Sequence, not tank label, defines order and child
identity within the event. Duplicate normalized tank labels are invalid within
one event because one occurrence should contain one final delivered-total row
for each physical or logical tank.

### Fuel Service Person

Represents a reusable feature-owned display-name reference for the person who
delivered the fuel.

The V1 reference is intentionally narrow:

- Display name.
- Server-derived normalized name key for equivalent-name matching and obvious
  duplicate prevention.
- Active/inactive status, with new records active by default.
- Standard record timestamps.

It is not an Employee, User, contractor, vendor, payroll, or authentication
record. The normalized key is a feature-local lookup aid, not a workforce
identifier.

## 7. Date And Time Semantics

The event stores two distinct operational facts:

- `Operational work date` is a date-only value used for history and future Day
  View lookup.
- `Event time` is the actual local operational wall-clock time when fueling
  occurred.

V1 uses local minute precision. The UI submits date as `YYYY-MM-DD` and time as
`HH:mm`. Neither value should pass through browser UTC conversion.

The operational work date remains explicit and editable. It is not inferred
from the current browser date, a Daily Work Log, Work Schedule, or event time.
If an overnight shift records fueling after midnight against the shift's
operational work date, the selected operational date remains authoritative for
feature history.

No global timezone or multi-timezone framework is required for V1. Future
deployment must consistently apply the employer's local operational timezone.

## 8. Fuel Type

V1 supports exactly three feature-owned fuel types:

| Stable value | Display label |
| --- | --- |
| `DIESEL` | Diesel |
| `OFF_ROAD_DIESEL` | Off-road Diesel |
| `GASOLINE` | Gasoline |

One Equipment Fuel Event uses exactly one fuel type. Tank Fills do not select
or override fuel type independently.

Fuel type is a fixed V1 vocabulary owned by this feature. It is not a runtime
reference-management capability. Additional fuel types require product and
architecture approval.

Equipment category alone must not determine fuel compatibility. V1 uses the
existing Equipment power context conservatively:

- Electric-only Equipment is ineligible.
- Diesel Equipment permits Diesel or Off-road Diesel.
- Gasoline Equipment permits Gasoline.
- Hybrid, Other, Unknown, or missing power context remains selectable only when
  the operator explicitly chooses one approved fuel type and server validation
  detects no contradiction.
- Inactive Equipment is excluded from new selection.
- Unsupported or contradictory Equipment/fuel combinations fail safely.

These rules avoid treating Equipment category as a fuel system and do not add a
new Equipment classification model.

## 9. Tank Fill Semantics

Every event must contain between `1` and `10` Tank Fills. These bounds and
the text and quantity limits below are conservative implementation validation
guards, not operational business limits.

Tank Fill rules:

- Sequence uses contiguous positive integers starting at `1` and remains unique
  within the event.
- Rendering follows sequence deterministically.
- Tank label is required, trimmed event-owned text from `1` through `100`
  characters.
- Duplicate tank labels are compared after trimming, deterministic internal
  whitespace normalization, and lowercasing. Duplicate normalized labels within
  one event are invalid; the operator-entered display label remains the
  historical snapshot.
- The UI may suggest feature-owned labels previously used for the selected
  Equipment.
- The operator may override a suggestion with the actual tank label.
- Suggestions are normalized and deduplicated for display, remain
  nonauthoritative, and require no preconfiguration.
- Suggestions do not create reusable Tank records, become a managed catalog,
  or modify Equipment.
- Server validation accepts any valid manual label regardless of suggestions.
- Delivered quantity is a positive integer from `1` through `999999` whole US
  gallons per fill.
- Zero, negative, decimal, malformed, or missing quantities are invalid.
- The event total is the integer sum of all Tank Fill quantities.
- The derived total must remain within safe integer arithmetic and may not
  exceed `9999990` gallons.
- The total is derived by feature-owned server logic and is never trusted as a
  client-entered fact.

If delivery to one tank is interrupted and resumed within the same occurrence,
the event records the final delivered total for that tank rather than duplicate
same-label rows. Reusing the same label across different events is normal.

No Tank Management subsystem, tank-capacity model, pre-fill level, post-fill
level, or meter reading belongs to V1.

## 10. Equipment And Historical Snapshot Strategy

Equipment is required when an event is created. Users select Equipment only;
Mine and City are derived server-side through the selected Equipment. Creation
requires an existing active Equipment record that satisfies the approved fuel
compatibility rules. Selection queries expose active eligible Equipment only.

The event should retain a live Equipment reference for current navigation and
snapshot only the established historical display fields:

- Equipment display name.
- Equipment number.
- Equipment category.
- Mine name.
- City name.
- City state.

Snapshots are generated server-side. Client-submitted Equipment or location
display values are never authoritative. Complete Equipment, Mine, or City
records must not be duplicated.

Historical display must survive Equipment rename, transfer, deactivation, or
deletion. The live Equipment relationship may become null after deletion while
snapshots remain readable.

Correction rules:

- Unchanged Equipment preserves its existing historical Equipment/location
  snapshots. An existing inactive Equipment reference may remain unchanged
  during correction.
- Intentionally changed Equipment requires an active eligible replacement and
  refreshes only the Equipment/location snapshot group from that live record.
- An Equipment identity change requires a complete valid Tank Fill set for the
  corrected subject; machine-specific labels and quantities must not be
  inferred from the previous Equipment.
- If the live Equipment relationship is null, detail remains readable from
  snapshots, but correction requires intentional selection of a current active
  eligible Equipment before submission.
- Historical snapshots must never be used to recreate a fake Equipment record
  or restore a deleted live relation.

No meter reading is recorded. Hour Meter remains owned by Operational Safety
Checklists.

## 11. Fuel Service Person Strategy

Fuel Service Person is optional.

The form should provide a feature-owned searchable selector. The operator may:

- Select an existing equivalent display name.
- Create a new display name inline.
- Leave the service person unrecorded.

Inline creation is validated and normalized server-side. Trimming,
deterministic internal whitespace normalization, and lowercase matching produce
the normalized key. The key is never entered by the user. Display name is
required and limited to `200` characters. Newly created records are active by
default, and normalized-key uniqueness must return safe feature-owned duplicate
feedback rather than raw database errors.

When selected, the event stores the live feature-owned reference and a
historical display-name snapshot. The snapshot remains readable if the
reference later changes or becomes unavailable.

Active/inactive rules are:

- Active records appear in new selections.
- Inactive records are excluded from new selections by default.
- Historically used inactive records remain readable through both the live
  reference, where retained, and the event snapshot.
- A correction may preserve an unchanged inactive reference.
- Selecting a different person during correction requires an active record.
- Inactivation is the supported retirement mechanism.
- Historically used records must not be hard-deleted. No user-facing hard-delete
  workflow is approved; the live event relation uses Restrict-style deletion
  behavior, and unused records may remain without a delete workflow.

Correction rules:

- An unchanged reference preserves the event's historical name snapshot.
- An intentionally changed or newly created reference refreshes the snapshot
  from active server-owned data.
- Clearing the optional person removes the live association and person-name
  snapshot without altering other event facts.

Inline create-or-reuse and event creation should be transactional where the
repository persistence pattern supports it. A narrow feature-owned inactivation
capability may retire reference records, but V1 does not create a workforce
directory, Employee/User record, contractor or vendor management, company,
role, signature, or authorization behavior.

## 12. Daily Work Log Relationship

Daily Work Logs may independently record the work delay or narrative using the
existing `FUEL_SERVICE` activity type, corresponding to operational code 7
Fueling.

An Equipment Fuel Event owns an optional nullable reference to one specific
matching `DailyLogActivity` for context. The relationship is not required for
either record's creation and does not transfer ownership.

When a link is supplied, server validation should confirm:

- The activity exists.
- The activity uses the fueling activity type.
- The Daily Work Log operational date matches the Fuel Event work date.
- Any Equipment recorded on the activity does not contradict the Fuel Event
  Equipment.

The Fuel Event owns delivered quantities, Tank Fills, fuel type, service-person
context, and corrections. Daily Work Logs own narrative text, activity timing,
and delay meaning.

Neither feature automatically creates, edits, or deletes the other's record.
Deleting a linked Daily Work Log activity must not delete or rewrite the Fuel
Event; the Fuel Event relation uses SetNull-style behavior. The link is
one-to-one: one `DailyLogActivity` may be referenced by zero or one Fuel Event,
and multiple Fuel Events must not share one activity. Repeated Fuel Events need
separate activities when explicit linking is desired. No automatic matching by
time or cross-feature mutation is permitted, and Fuel Event history remains
readable after the optional link becomes null.

## 13. Lifecycle And Correction Workflow

V1 is completed-only.

- Viewing or beginning a form creates no record.
- A persisted event must satisfy every completion invariant.
- No Draft, Submitted, Approved, Locked, or Reviewed state exists.
- No lifecycle status field is required because every persisted V1 event is
  completed.
- No normal UI or Server Action deletes an event.
- Administrative deletion remains outside the operator workflow.

The explicit correction workflow edits the existing completed event in place.
It does not create a Draft or replacement event.

A correction must:

- Revalidate the complete event and all Tank Fills.
- Preserve unchanged historical snapshots.
- Refresh Equipment snapshots only when Equipment intentionally changes.
- Replace machine-specific Tank Fills when Equipment intentionally changes.
- Preserve the Fuel Service Person snapshot when its reference is unchanged.
- Refresh or remove service-person context only when intentionally changed.
- Fully revalidate the aggregate when fuel type changes.
- Revalidate any Daily Work Log relationship against corrected date and
  Equipment context.
- Replace stale Tank Fills with the submitted ordered set inside one
  transaction.
- Persist Tank Fill order deterministically.
- Keep server-derived total gallons aligned with the corrected fills.

Standard timestamps identify later correction activity. Immutable revision
history is deferred.

## 14. Data Flow And State Architecture

Equipment Fuel Events use server-owned persisted state.

Expected flow:

1. A server-rendered route loads active eligible Equipment, active Fuel Service
   Person options, and approved feature constants. Existing inactive references
   needed for historical correction remain displayable.
2. Local form state manages Tank Fill insertion, removal, ordering, Equipment
   label suggestions, and optional inline person entry.
3. The form submits one complete event payload to a feature-owned Server
   Action.
4. Zod validates primitive, nested, and cross-field invariants.
5. The server reloads referenced Equipment, Daily Work Log activity, and Fuel
   Service Person data and creates trusted snapshots.
6. Inline Fuel Service Person create-or-reuse, the parent event, and owned Tank
   Fills are persisted in one coherent transaction where applicable. Normalized
   uniqueness conflicts return safe feature-owned feedback.
7. Successful mutations revalidate feature list/detail routes and redirect to
   durable server-rendered detail state.

Client-side previews may show derived total gallons, but server calculation is
authoritative. No global state, API layer, client-owned cache, or optimistic
operational persistence is required.

## 15. Feature-Owned Queries, Filtering, And Search

Expected feature-owned reads:

- Historical event list with bounded structured filters.
- Event detail with ordered Tank Fills and historical snapshots.
- Event correction data.
- Active Equipment options with derived Mine and City context.
- Searchable active Fuel Service Person options, while preserving an unchanged
  inactive historical selection during correction.
- Fuel Service Person reference history needed for narrow feature-owned
  inactivation and historical display.
- Suggested tank labels for the selected Equipment from feature-owned history.
- Eligible Daily Work Log fueling activities for optional explicit linking.

Daily Work Log activity lookup is scoped by the selected operational work date
and Equipment before a conservative result bound is applied. Tank-label history
is likewise scoped to the selected Equipment before it is bounded, normalized,
and deduplicated. New-event forms do not preload a global activity or Tank Fill
history set.

The V1 history list should support URL-driven structured filters for:

- Operational date range.
- Equipment.
- Fuel type.
- Fuel Service Person.

Ordering should be deterministic by operational work date, local event time,
and durable event identity.

Search is limited to selectors and feature-owned structured history retrieval.
Global cross-module search, full-text notes search, saved filters, generic query
builders, analytics, and reports remain deferred.

## 16. Feature-Owned Mutations

Expected mutation responsibilities are:

- Create one complete Equipment Fuel Event and its Tank Fills atomically.
- Correct one existing completed event and replace its owned Tank Fill set
  atomically.
- Create or reuse one Fuel Service Person inline as part of the event workflow.
- Inactivate one Fuel Service Person through a narrow feature-owned retirement
  mutation; hard deletion of historically used records is not permitted.

Mutations must:

- Validate all server-owned business invariants before writes where practical.
- Scope child writes to one event.
- Verify every referenced record server-side.
- Generate snapshots server-side.
- Prevent partial parent, person, or Tank Fill persistence on failure.
- Return structured field and Tank Fill errors without exposing Prisma details.
- Revalidate and redirect intentionally after success.

No mutation may update Equipment, Daily Work Logs, Work Schedule, Timesheets,
Operational Safety Checklists, Defects, Fleet records, Day View, or a future
Equipment timeline.

## 17. UI Architecture

Expected V1 surfaces:

- Equipment Fuel Event history list.
- New event workflow.
- Event detail view.
- Explicit completed-record correction workflow.
- Narrow Fuel Service Person reference management limited to search, historical
  visibility, and inactivation; no hard-delete or workforce-management surface.
- Loading, empty, not-found, validation, and persistence-error states.

The form should present:

- Operational work date and local event time.
- Searchable Equipment selection with derived Mine and City context.
- One bounded fuel-type control.
- A stable ordered Tank Fill editor with label suggestions, manual override,
  whole-gallon inputs, add/remove controls, and a derived total preview.
- Searchable optional Fuel Service Person selection with inline creation.
- Optional Daily Work Log fueling-activity context.
- Optional notes visually secondary to required operational facts.
- One clear complete-event submit command.

The detail view should show historical Equipment/location identity, event date
and time, fuel type, ordered Tank Fills, derived total, service-person snapshot,
optional Daily Work Log context, notes, and correction action.

The list should remain dense and scannable. Narrow screens should stack event
metadata and Tank Fill rows without obscuring sequence, label, quantity, or
total. No Fleet purchase, price, receipt, meter, or reporting controls belong
on these surfaces.

## 18. Validation And Error Handling

Server validation must enforce:

- Strict valid date-only operational work date.
- Valid local `HH:mm` event time at minute precision.
- Required existing Equipment eligible for operational fuel recording.
- Active Equipment for creation or intentional replacement; an unchanged
  inactive Equipment reference may remain during correction.
- Exactly one approved V1 fuel type.
- Between `1` and `10` Tank Fills.
- Deterministic, unique Tank Fill sequence within the event.
- Required trimmed tank label from `1` through `100` characters for every fill.
- No duplicate normalized tank label within one event.
- Positive integer whole-US-gallon quantity from `1` through `999999` for
  every fill.
- No decimal, zero, negative, missing, or malformed quantity.
- Server-derived total equal to the integer sum of all fills and no greater than
  `9999990`.
- Optional notes normalized to null when blank and limited to `2000` characters.
- Optional Fuel Service Person resolved or created from a valid display name.
- Active Fuel Service Person for new or changed selections; unchanged inactive
  historical references may remain during correction.
- Optional Daily Work Log relationship matching activity type, operational
  date, noncontradictory Equipment context, and one-to-one uniqueness.
- Completed-only creation and full correction validation.

Snapshot validation reloads and trusts server-owned references. Client values
for Equipment/location snapshots, service-person snapshots, total gallons, or
linked-record descriptions are ignored.

Errors should identify the relevant event field or Tank Fill index. Persistence
and uniqueness failures should return safe domain messages without raw database
details.

## 19. Relationships With Existing Features

### Equipment

Equipment is the required subject and shared reference anchor. Mine and City
derive through Equipment. Equipment Fuel Events do not manage Equipment or
persist full reference-data copies.

### Daily Work Logs

Daily Work Logs may independently narrate fueling or delay context. An optional
explicit activity link is contextual only. Neither feature requires or mutates
the other.

### Work Schedule

Work Schedule owns planned assignments. Planned Equipment or shift context does
not prove fueling occurred and creates no direct V1 relationship.

### Timesheets

Timesheets own worked time, payroll classification, and Work Allocations.
Fueling work may consume time, but Equipment Fuel Events do not belong to or
link automatically from Timesheet allocations.

### Operational Safety Checklists

Operational Safety Checklists own pre-shift inspection responses and Hour Meter
readings. Equipment Fuel Events record no meter and do not read or modify
checklist state.

### Defect Tracking

Defect Tracking owns issue lifecycle and corrective work. Fuel Events neither
create nor mutate Defects. No V1 relationship is required.

### Fleet

Fleet remains a separate future domain for company vehicle ownership and
assignment, gas-station purchases, fuel cards, receipts, prices, and car
washes. Starting meter readings remain owned by Operational Safety Checklists.
An operational Equipment Fuel Event must not be reused as a Fleet purchase
record.

### Equipment Activity Timeline

A future timeline may compose a feature-owned display result. The Fuel Event
remains the source record; no duplicate timeline event is persisted.

## 20. Day View And Equipment Timeline Boundaries

Day View implementation is deferred.

A future feature-owned date helper may return display-ready summaries containing:

- Historical Equipment identity.
- Local event time.
- Fuel type.
- Ordered tank labels and quantities where compact display permits.
- Derived total gallons.
- Optional Fuel Service Person display name.
- Detail link.

Day View may order and render those results. It must not query Fuel Event
tables directly, sum Tank Fills, interpret fuel types, or own relationship
rules.

A future Equipment Activity Timeline should use a separate feature-owned query.
No generic contribution registry or stored timeline table is approved.

## 21. Testing Strategy

Phase 22.3 implemented focused validation, persistence, Server Action, form, and
detail coverage. Phase 22.3.1 adds scoped-query regression tests, history/create/
correction/reference-route rendering tests, field-level Daily Work Log feedback,
and opt-in rollback-only PostgreSQL coverage for the highest-value migration and
aggregate invariants.

### Unit Tests

- Strict operational-date and local-time validation.
- Overnight operational work-date ownership.
- Approved fuel-type vocabulary and one-type-per-event behavior.
- Active Equipment eligibility, inactive Equipment rejection for new events,
  and contradictory Equipment/fuel combinations.
- Positive integer whole-gallon minimum, maximum, malformed, and derived-total
  maximum validation.
- Tank Fill sequence, minimum/maximum count, ordering, label-length, duplicate
  normalized-label, and notes-length rules.
- Derived event total calculation.
- Fuel Service Person display-name normalization.
- Suggested tank-label normalization and deduplication.
- Optional notes normalization.
- Equipment snapshot mapping.
- Daily Work Log activity compatibility.

### Mutation And Persistence Tests

- Complete event creation with one and multiple Tank Fills.
- Repeated same-day events, including identical date/time values distinguished
  by durable event identity.
- Transaction rollback when any child, reference, or snapshot step fails.
- Inline Fuel Service Person create-or-reuse behavior.
- Duplicate Fuel Service Person handling and transactional inline creation.
- Fuel Service Person inactivation, unchanged inactive-reference correction,
  active-only replacement, and destructive-deletion protection.
- Completed-record correction.
- Unchanged Equipment and service-person snapshot preservation.
- Unchanged inactive Equipment correction, changed active eligible Equipment
  snapshot refresh and required fill re-entry, and null-Equipment replacement.
- Tank Fill insertion, removal, reordering, and stale-child cleanup.
- Fuel-type change revalidation.
- Optional Daily Work Log activity type/date/Equipment validation, one-to-one
  uniqueness, clearing, and SetNull behavior after activity deletion.
- Repeated Fuel Events linked to independent Daily Work Log activities.
- No cross-feature writes.
- No event deletion mutation.

### PostgreSQL Integration Priorities

- Parent/child ownership and ordered-fill constraints.
- Equipment and optional-reference foreign keys, uniqueness, indexes, and
  deletion behavior.
- Historical readability after Equipment reference loss.
- Transaction rollback across parent, Tank Fills, optional Daily Work Log link,
  and inline person creation.
- Used Fuel Service Person deletion protection and inactive-reference history.
- Repeated submission and correction safety.
- Migration/schema alignment.

### Route And Component Tests

- History, create, detail, and correction route rendering.
- Equipment-derived Mine and City display.
- Searchable service-person selector and inline creation.
- Fuel Service Person historical listing and inactivation behavior.
- Ordered Tank Fill editor behavior and total preview.
- Field and row validation feedback.
- Completed-only correction presentation.
- Responsive and accessible labels and controls.

Focused future E2E coverage may protect the complete create/correct workflow
after repository test-database and browser infrastructure justify it. Broad E2E
infrastructure is not a prerequisite for the V1 foundation.

The PostgreSQL regression file is intentionally opt-in because the repository
does not expose PostgreSQL to the host test runner. Run it through the existing
Docker network without creating permanent records:

```bash
docker compose run --rm --no-deps \
  -v "$PWD:/workspace" -w /workspace app \
  sh -c 'EQUIPMENT_FUEL_TEST_DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/vitest run tests/integration/equipment-fuel-event-postgres.test.ts'
```

Every successful-path fixture runs inside a transaction that is deliberately
rolled back. Expected constraint failures also roll back their complete
transactions. Broad browser E2E infrastructure remains deferred.

## 22. Security And Privacy

Fuel Events contain operational Equipment history and optional personal display
names.

V1 has no authentication or authorization system. Feature architecture must not
pretend otherwise. Future access control should consider:

- Who may create or correct operational fuel history.
- Who may view Fuel Service Person names.
- Whether administrative deletion or correction audit history is required.
- Whether future Fleet receipt or financial data requires a separate privacy
  boundary.

Raw database errors, internal identifiers, and unrelated personal information
must not be exposed in user-facing errors.

## 23. Deferred Scope

The following are explicitly deferred:

- Fleet fuel purchases.
- Fuel cards.
- Receipts and attachments.
- Fuel prices, costs, estimates, and enrichment.
- Vendors and gas stations.
- Mileage, odometer, Hour Meter, tank-level, or engine-hour readings.
- Car washes and temporary vehicle assignment.
- Fuel inventory and tank-capacity management.
- Generic Tank Management.
- Generic Equipment Activity Timeline.
- Generic operational-event framework.
- Analytics, reporting, forecasting, and exports.
- Notifications.
- Day View implementation.
- Runtime-editable fuel types, tank-label suggestion catalogs, or feature
  configuration.
- Fuel Service Person management pagination or dedicated management-page search
  until reference volume demonstrates a concrete scale need; event selectors
  remain searchable in V1.
- Authentication, authorization, Employee, User, or workforce management.
- Global cross-module search.

## 24. Product Decisions

The implementation-driving V1 decisions are resolved:

- One event represents one service occurrence for one Equipment.
- One event owns one or more ordered Tank Fills.
- Operational work date and actual local event time are separate facts.
- V1 fuel types are Diesel, Off-road Diesel, and Gasoline.
- One event uses exactly one fuel type.
- Quantities are positive integer whole US gallons.
- Event total is derived from Tank Fills.
- Tank labels use suggestions with manual override and no Tank Management.
- One event permits `1` through `10` uniquely normalized tank labels, with
  bounded whole-gallon quantities and a bounded server-derived total.
- Meter readings are excluded.
- Fuel Service Person is an optional feature-owned reference with inline
  creation, active/inactive retirement, normalized uniqueness, destructive
  deletion protection, and a historical display-name snapshot.
- V1 is completed-only with explicit correction and no normal deletion.
- Daily Work Log context is an optional one-to-one Fuel Event-owned reference
  to a specific fueling activity, with SetNull-style deletion behavior and
  independent ownership.
- Fleet and all listed purchase evidence remain separate.

No unresolved product decision remains for the accepted V1 foundation.

## 25. Implementation And Acceptance Record

The Approved architecture and V1 foundation completed the repository's
established delivery workflow:

1. The conceptual persistence design and migration plan were approved.
2. The feature-owned constants, validation, snapshots, queries, transactional
   mutations, routes, and UI were implemented and accepted in Phase 22.3.
3. Phase 22.3.1 completed contextual Daily Work Log lookup, Equipment-scoped
   suggestion, route/component, and PostgreSQL test-maturity corrections.
4. Phase 22.3.2 completed deterministic suggestion ordering and repository
   status cleanup.
5. Day View participation and the derived Equipment Activity Timeline remain
   deferred. Fleet remains a separate future domain.

## 26. Success Criteria

The accepted V1 foundation satisfies these criteria:

- One completed event records one Equipment, one fuel type, and one or more
  ordered Tank Fills.
- Whole-US-gallon quantities and derived totals are exact integer facts.
- Equipment and service-person history remains readable after reference-data
  changes.
- Equipment changes during correction refresh snapshots and require a complete
  valid fill set.
- Optional Daily Work Log context preserves independent ownership.
- No Fleet purchase, meter, price, receipt, reporting, or Day View behavior is
  introduced.
- Server validation, transactions, migrations, tests, and PostgreSQL evidence
  satisfy repository quality gates.
