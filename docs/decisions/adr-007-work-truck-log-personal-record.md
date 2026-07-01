# ADR-007: Work Truck Log Personal Record

Date: 2026-06-24

Status: Accepted

Category: Product workflow

## Decision

Work truck daily records will be modeled as a structured personal log linked to
Equipment, not as automation of the official work website.

## Reason

The operator uses a work truck to travel inside the mine and submits a daily
website form with radio-button responses, mileage, and other fields. NAM
Dashboard should preserve a personal searchable history of what was entered and
how the truck was used, while avoiding dependence on the official website's
authentication, layout, or submission workflow.

## Consequences

- Work trucks should be represented as Equipment records.
- `WorkTruckLog` should capture daily mileage, submitted status, and notes.
- `WorkTruckLogResponse` should support configurable form fields so exact
  website questions can be added later.
- Work Truck Log records should participate in Day View and global historical
  search.
- Gasoline purchases for the work truck should be stored in `FuelServiceRecord`
  and may link back to `WorkTruckLog`.
- Automatic submission to the official work website is out of scope unless
  explicitly evaluated in a future phase.
