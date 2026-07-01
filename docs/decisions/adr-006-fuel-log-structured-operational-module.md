# ADR-006: Fuel Log Structured Operational Module

Date: 2026-06-24

Status: Accepted

Category: Product/data architecture

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
- Fuel records should participate in Day View and global historical search.
- Fuel records should support diesel, off-road diesel, gasoline, and future fuel
  types.
- Automated historical fuel price lookup should be evaluated separately because
  external price data may vary by source, geography, date coverage, and
  reliability.
