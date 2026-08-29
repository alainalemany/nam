# Equipment Fuel Events Architecture

Status: Approved

Product Phase: Fuel Events V2 Phase 2A

Primary Feature: Equipment Fuel Events

Bounded Context: Equipment Fuel Events and feature-owned Gas Station reference data

Depends On:

- Operations reference data for Equipment, Mine, and City context
- `docs/architecture/equipment-operations.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Related Documents:

- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/decisions/adr-006-fuel-log-structured-operational-module.md`
- `docs/decisions/adr-020-equipment-fuel-events-v2-station-pricing-and-meter.md`

Last Reviewed: 2026-08-29

Implementation Status: V1 and V2 Phase 1 are implemented. This document is the
approved implementation architecture for V2 Phase 2A.

## Purpose And Boundary

One Equipment Fuel Event represents one real fueling occurrence for one piece
of Equipment. It records when the occurrence happened, where fuel was obtained,
what fuel was delivered, how the delivery was divided among ordered Tank Fills,
the historical price and cost, and optional meter, receipt-reference, and notes
context.

This is personal operational recordkeeping. It is not personnel management,
vendor accounting, fleet management, payment processing, inventory, or a
document-management system.

## Aggregate

The `EquipmentFuelEvent` aggregate owns:

- Operational work date and local event time.
- One Equipment relation plus existing Equipment and assignment-location
  snapshots for backward compatibility.
- One fuel type.
- One Gas Station relation plus station name, address, City, state, and postal
  snapshots.
- One event-level price per gallon.
- One or more ordered Tank Fills.
- Server-derived total gallons and total event cost.
- Meter type and nullable meter reading.
- Optional receipt reference and notes.

Tank Fills have no independent lifecycle or reusable Tank model. Their visible
order is submitted as contiguous sequence values and persisted as owned child
rows. Client-only row identifiers stabilize React form state and are never
persisted.

## Gas Station Reference Data

`GasStation` is feature-owned reusable reference data with:

- Name.
- Server-derived normalized uniqueness key.
- Optional address/location line.
- Required existing City relation.
- Optional ZIP/postal code.
- Active/inactive status.
- Created and updated timestamps.

The normalized key covers the normalized name, address, City identity, and
postal code so different locations of the same station brand may coexist.
Stations are retired through inactivation, never destructive delete. New Fuel
Events select active stations; an unchanged inactive historical station remains
valid on correction and remains displayable through snapshots.

Gas Stations store no prices, loyalty programs, payment accounts, contacts,
tax information, or billing data.

## Decimal And Monetary Rules

- Tank Fill gallons: `Decimal(12,3)`, positive, at most three fractional digits.
- Event total gallons: `Decimal(12,3)`, the exact sum of submitted fills.
- Price per gallon: `Decimal(10,3)`, positive, at most three fractional digits.
- Total event cost: `Decimal(14,2)`, calculated as total gallons multiplied by
  price per gallon and rounded once to cents using half-up rounding.

Persisted totals are calculated with Prisma Decimal arithmetic on the server.
The client may show previews but never submits or owns authoritative totals.
Per-fill cost is display-only and is not persisted.

## Meter And Receipt Rules

Meter type values are `HOURS`, `ODOMETER`, and `NOT_APPLICABLE`.

- Hours and Odometer require a nonnegative Decimal reading.
- Not Applicable requires a null reading.
- The type is selected explicitly and is not inferred from Equipment category.
- Historical events may have both fields null.

Receipt reference is optional bounded text. Receipt image upload and storage are
deferred and must not be inferred from this phase.

## Workflow And UI

Create and correction use these sections:

1. Fueling context: date, time, Equipment, fuel type.
2. Station and pricing: searchable Gas Station selector and price per gallon.
3. Tank Fills: ordered labels, fractional gallons, and cost preview.
4. Equipment meter: type and conditional reading.
5. Receipt: optional reference.
6. Notes.

The detail page uses Equipment display name and number as the title, presents a
small Completed badge, formats Equipment category labels for humans, and labels
the selected Gas Station as the fueling location. Equipment Mine/City snapshots
must not be presented as the fueling location. Legacy events without V2 fields
render neutral `Not recorded` values.

Create and correction redirect to detail with a bounded result query value. A
client confirmation removes the value from the visible URL after
render so refresh and unrelated navigation do not retain the success message.

## Form State And Validation

The form remains local controlled state and submits one JSON aggregate to a
Server Action. Before any Zod transformation, the action captures all raw
submitted strings and transient Tank Fill row identifiers. Every recoverable
validation, reference, domain, known Prisma, or unexpected persistence failure
returns the full raw aggregate and field-specific errors.

Rehydration preserves date, time, Equipment, fuel type, station, raw price,
every Tank Fill and its order, raw gallons, meter type, raw meter reading,
receipt reference, and notes. Incomplete forms are not persisted as drafts.

Server persistence reloads Equipment and Gas Station, validates active/inactive
correction rules, creates trusted snapshots, calculates totals, and writes the
aggregate transactionally.

## Backward Compatibility

Existing records receive no fabricated station, price, cost, meter, or receipt
values. New V2 columns are nullable for legacy compatibility while new-event
validation requires the V2 context. A correction of a legacy event may remain
legacy unless the operator supplies a complete valid V2 context.

Phase 1 removed Fuel Service Person and Daily Work Log controls. Their schema
relations, snapshots, uniqueness, deletion behavior, and historical values
remain. Create explicitly writes both relations null. Correction persistence
does not accept these relationships from form input and never clears or
rewrites their existing values.

Integer historical gallons convert exactly to Decimal. No Fuel Event,
Equipment relationship, Equipment snapshot, Fuel Service Person relationship,
or Daily Work Log relationship is deleted or rewritten by the migration.

## Queries And Integration

The feature owns list, detail, create, correction, Gas Station management,
Tank-label suggestion, filter, and Day View queries. Day View consumes only a
display-ready feature result; it does not calculate Decimal values or join Fuel
Event storage directly.

Daily Log integration is deferred. Equipment Fuel Events do not mutate Daily
Logs, Equipment, Timesheets, Work Schedule, Operational Safety Checklists, or
Fleet records.

## Testing And Acceptance

Tests cover Gas Station normalization and lifecycle, exact Decimal validation
and arithmetic, meter cross-field rules, full raw form recovery, stable Tank
Fill row identity/order, trusted snapshots, inactive historical station display,
legacy correction preservation, detail formatting, redirect confirmation, Day
View display formatting, and PostgreSQL migration behavior against disposable
test data.

Receipt images, Gas Station accounting, automatic prices, Daily Log integration,
analytics, and reporting remain deferred.
