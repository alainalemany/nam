# U.S. Geography Seed Artifacts

This directory contains the normalized, offline seed artifacts for NAM's
canonical U.S. State and City reference data.

## Source

The source is the U.S. Census Bureau 2025 Gazetteer Files:

- [2025 Gazetteer overview](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html)
- [2025 State Gazetteer ZIP](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_state_national.zip)
- [2025 Place Gazetteer ZIP](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip)
- [Gazetteer record layouts](https://www.census.gov/programs-surveys/geography/technical-documentation/records-layout/gaz-record-layouts/gaz25-record-layouts.html)
- [Legal/statistical area description codes](https://www.census.gov/library/reference/code-lists/legal-status-codes.html)
- [Census open-government and data-use policy](https://www.census.gov/about/policies/open-gov.html)

The committed manifest records source-text and normalized-artifact SHA-256
checksums, source URLs, row counts, excluded territories, and deduplication
count. Census Places include incorporated places and census-designated places;
NAM presents both through its existing `City` reference concept.

The Census Bureau identifies its data products as U.S. federal-government
works generally not subject to domestic copyright restriction. The manifest
and this README retain attribution and provenance even though the normalized
artifact is intended for unrestricted operational reuse.

## Scope And Normalization

- Includes all 50 States and the District of Columbia.
- Excludes Puerto Rico; no U.S. territories are silently imported.
- Excludes ZIP codes, coordinates, maps, and geocoding.
- Removes the Census legal/statistical suffix such as `city`, `town`, or `CDP`
  from the human-readable name by using the source LSAD code.
- Deduplicates normalized City name plus State abbreviation, retaining the
  lowest Census GEOID deterministically when source place types overlap.
- Keeps readable names and Census GEOIDs in the artifact for traceability;
  GEOIDs are not persisted in the application database.

The normalized State TSV is readable in Git. The larger City TSV is committed
with deterministic gzip compression, so production import does not require
runtime internet access.

## Regeneration

Download and extract the two official ZIPs outside the repository, then run:

```bash
node scripts/geography/normalize-census-gazetteer.mjs \
  /path/to/2025_Gaz_state_national.txt \
  /path/to/2025_Gaz_place_national.txt \
  data/geography
```

Review the manifest, artifact diff, counts, duplicate handling, and spot checks
before accepting a regenerated dataset.

## Database Import

After the matching reviewed Prisma migration has been applied to the target
database, run the explicit import against that target's configured
`DATABASE_URL`:

```bash
corepack pnpm geography:import
```

The import matches States by normalized name or abbreviation and Cities by
normalized name within State. Matching rows keep their IDs and status. New rows
start active. Re-running the import does not duplicate records or reactivate a
record that an operator intentionally made inactive.
