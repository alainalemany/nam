# ADR-006: Fuel Log Structured Operational Module

Date: 2026-06-24

Status: Accepted

Category: Product/data architecture

## Scope Clarification (2026-07-14)

Later operational discovery separated Equipment Fuel Events from Fleet
gas-station purchases. The durable decision in this ADR still applies to
structured operational fuel records, but its original combined `Fuel Log`
scope must not be read as one feature boundary.

- Equipment Fuel Events record delivered fuel for one operational Equipment
  subject and may contain multiple tank-fill quantities.
- Fleet fuel-card purchases, receipts, mileage, car washes, and time-dependent
  vehicle assignment belong to a separate future Fleet domain.
- Automated historical price enrichment remains deferred and is not a
  prerequisite for Equipment Fuel Events.

The current boundary assessment is
`docs/architecture/equipment-operations.md`. The approved Equipment Fuel Events
feature architecture is
`docs/architecture/features/equipment-fuel-events.md`.

## Decision

Fuel Log will be modeled as a structured operational module, with fuel price
data treated as optional enrichment.

## Reason

Diesel service events and gasoline purchases are repeated operational records
that need reliable search, date-range totals, equipment links, and historical
reporting. Gallons delivered or purchased, equipment serviced, date, time, and
source notes are primary facts. Price per gallon may be known, estimated,
missing, or sourced later, so it should not be required for saving the
operational record.

## Consequences

- A `FuelServiceRecord` should preserve the base fueling facts even when no
  price is available.
- Fuel price data should include a status such as Actual, Estimated, or Unknown.
- Estimated fuel value should be calculated from gallons delivered and selected
  price per gallon, not stored as the only source of truth.
- Fuel records may participate in Day View through their owning feature.
  Global cross-module search remains separately deferred.
- Fuel records should support diesel, off-road diesel, gasoline, and future fuel
  types.
- Automated historical fuel price lookup should be evaluated separately because
  external price data may vary by source, geography, date coverage, and
  reliability.
