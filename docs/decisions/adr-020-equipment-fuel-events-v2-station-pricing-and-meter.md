# ADR-020: Equipment Fuel Events V2 Station, Pricing, And Meter Facts

Date: 2026-08-29

Status: Accepted

Category: Product/data architecture

## Decision

Equipment Fuel Events V2 records one reusable Gas Station, one event-level
price per gallon, precise fractional Tank Fill gallons, a server-derived event
cost, optional Equipment meter facts, and an optional receipt reference for one
fueling occurrence.

Gas Stations are lightweight reference data. Historical events preserve the
selected station's display fields as snapshots. Existing Fuel Service Person
and Daily Work Log relationships remain in storage for backward compatibility,
but are not part of the V2 create, correction, or detail workflow.

## Context

The original V1 architecture assumed operational service delivered by a fuel
service person, whole gallons, no station or price, and optional Daily Work Log
context. The actual personal recordkeeping workflow needs to identify the
fueling station, preserve the price paid at that occurrence, accept pump-scale
fractional gallons, and optionally record the Equipment meter and receipt
reference.

Gasoline prices change over time, so current prices must not live on Gas
Station reference records. Existing Fuel Events must remain readable without
invented historical station, price, meter, or receipt values.

## Options Considered

- Store a station name as free text on each event.
- Add a broad vendor, payment, or fleet-management subsystem.
- Add a small reusable Gas Station reference and event-owned historical facts.

## Reason

The small reference model prevents repeated station typing while allowing one
brand to have multiple locations. Event-level pricing matches the approved
one-station, one-fuel-type, one-price occurrence. Decimal storage and
server-authoritative arithmetic preserve exact operational and monetary facts
without introducing accounting complexity.

## Consequences

- `GasStation` stores identity, address, City, optional postal code, and active
  status only; it stores no prices, accounts, cards, contacts, or tax data.
- New Fuel Events require an active Gas Station, price per gallon, and valid
  meter type; historical events may retain null V2 fields.
- Gas Station snapshots keep history readable after reference edits or
  inactivation.
- Gallons use `Decimal(12,3)`, price uses `Decimal(10,3)`, and total cost uses
  `Decimal(14,2)` with server-side half-up rounding to cents.
- Meter type is `HOURS`, `ODOMETER`, or `NOT_APPLICABLE`; readings are required
  and nonnegative only for the first two types.
- Receipt reference is optional text. Receipt images remain deferred.
- Fuel Service Person and Daily Work Log schema relationships and historical
  data remain untouched; corrections preserve them without hidden form input.
- The migration is backward-compatible: no fabricated backfill and exact
  integer-to-decimal conversion for existing gallons.

## Related Documents

- `docs/architecture/features/equipment-fuel-events.md`
- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/decisions/adr-006-fuel-log-structured-operational-module.md`
- `docs/decisions/adr-021-canonical-us-geography-reference-data.md`
