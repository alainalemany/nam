# ADR-021: Canonical U.S. State And City Reference Data

Date: 2026-08-29

Status: Accepted

Category: Data/application architecture

## Decision

NAM Dashboard uses database-backed `State` and `City` reference records shared
by Mines, Gas Stations, and future modules. The controlled offline import uses
normalized U.S. Census Bureau 2025 Gazetteer State and Place data for all 50
States and the District of Columbia.

City uniqueness is normalized City name within State. State abbreviation and
normalized State name are unique. Both records use active/inactive lifecycle
management instead of destructive delete.

## Context

The existing `City` table contained only a few operationally encountered rows
and stored State as optional text. That was adequate while Cities existed only
to support Mines, but Gas Stations need valid Cities such as Medley, Florida
even when no Mine exists there. A source-code list would duplicate identity and
would not scale to broad searchable U.S. place coverage.

## Options Considered

- Continue creating Cities only when a Mine needs them.
- Embed a large U.S. geography array in application TypeScript.
- Depend on a third-party geography service at runtime.
- Preserve the existing City model, add canonical State identity, and import a
  reviewed offline public dataset idempotently.

## Reason

The additive canonical model preserves every existing City ID and consumer
foreign key while making geography independent and reusable. A committed,
normalized Census artifact makes production import reproducible and removes
runtime network dependence. Active status provides safe retirement without
losing historical readability.

## Consequences

- `State` is a first-class reference entity; `City.stateId` is nullable only
  for migration compatibility and required by new City validation.
- The legacy `City.state` text remains synchronized as a compatibility field
  until a separately approved cleanup proves all consumers and rows migrated.
- Import reuses matching records and preserves IDs and operator-controlled
  status. It never silently reactivates inactive rows.
- Census incorporated places and census-designated places are exposed through
  NAM's existing human-facing City concept.
- Puerto Rico and territories are not imported in this phase.
- ZIP reference tables, ZIP lookup, geocoding, coordinates, and maps remain
  explicitly deferred.
- No runtime internet connection is needed for selectors or import.

## Related Documents

- `docs/architecture/features/geography-reference-data.md`
- `docs/database.md`
- `docs/modules.md`
- `data/geography/README.md`
