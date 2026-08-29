# U.S. Geography Reference Data Architecture

Status: Approved

Product Phase: Shared operations reference data

Primary Feature: U.S. States and Cities

Depends On:

- PostgreSQL and Prisma
- Existing `City`, `Mine`, and `GasStation` relationships
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`

Related Documents:

- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/decisions/adr-021-canonical-us-geography-reference-data.md`
- `data/geography/README.md`

Last Reviewed: 2026-08-29

Implementation Status: Implemented pending migration/import and deployment approval.

## Purpose And Boundary

NAM maintains one small database-backed geography layer shared by Mines, Gas
Stations, and later modules. States and Cities have independent lifecycles: a
State does not require a City, and a City does not require a Mine or Gas
Station.

The feature includes State and City list, search, create, edit, and
activate/inactivate workflows plus searchable City selection. It does not own
ZIP-code reference data, postal lookup, geocoding, coordinates, maps, or inline
City creation inside consuming modules.

## Data Model

`State` owns name, official two-letter abbreviation, normalized name key,
status, and timestamps. Abbreviation and normalized name are unique.

`City` retains its stable existing identity and relationships while adding a
nullable canonical `stateId` and normalized name key. The canonical uniqueness
boundary is normalized City name within State, so Portland, Maine and Portland,
Oregon are independent records. Nullable fields and the existing State text are
temporary backward-compatibility accommodations for rows that predate import.

Both entities use `RecordStatus`. Inactivation preserves foreign keys and
historical readability; no destructive delete workflow is exposed.

## Seed And Import

The repository includes normalized offline artifacts derived from the official
2025 U.S. Census Gazetteer State and Place files. It includes the 50 States and
District of Columbia and excludes Puerto Rico. Source URLs, hashes, counts, and
normalization decisions are recorded in the artifact manifest and
`data/geography/README.md`.

The explicit import is idempotent. It matches existing States by normalized
name or abbreviation and existing Cities by normalized City name plus State.
Matching records keep their IDs, display names, relationships, and active or
inactive status. The import only attaches canonical State identity and
normalized keys where needed. Missing source records are created active. It
does not deactivate, reactivate, delete, or replace user-created places absent
from the Census source.

## Consumption

Gas Stations search active Cities in active States and retain a currently
selected inactive City when editing historical reference data. Gas Stations do
not create Cities inline.

Mines continue referencing the same existing `City` IDs. Equipment's
Mine-derived location display prefers the canonical linked State abbreviation
and falls back to the legacy State text until import is complete. No Mine or
Gas Station foreign key is rewritten by the schema migration.

## Deployment Boundary

Schema migration and geography import are separate, controlled operations. The
additive migration creates `State` and nullable City fields but imports no
records. The import runs only after migration approval and does not depend on a
live third-party service.
