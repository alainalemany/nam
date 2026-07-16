# ADR-018: Private Operational Safety Checklist Photo Storage

Date: 2026-07-16

Status: Accepted

Category: Infrastructure/security architecture

## Decision

Operational Safety Checklist photo evidence will use feature-owned metadata in
PostgreSQL and normalized image files in a private persistent Docker volume for
the current single-node deployment.

The application will own all upload, normalization, lookup, and serving paths.
Media will not be placed in a public static directory, and original filenames
will never be used as storage paths. Real workplace-photo upload and serving
must remain disabled until either application authentication and authorization
or a separately approved deny-by-default network or reverse-proxy access
boundary protects every photo read and mutation.

## Context

Operational Safety Checklists need optional checklist-level images for
conditions such as damaged lights, doors, mirrors, tires, and leaks. Images may
come from Android or iPhone devices and may arrive as JPEG, PNG, WebP, HEIC, or
HEIF. These files contain operational and potentially location-sensitive
evidence. The application currently has no authentication and can be reached
through a host-level reverse proxy in the development deployment.

PostgreSQL remains authoritative for checklist ownership, ordering, captions,
checksums, and historical metadata, but it cannot transact atomically with a
filesystem. Storage, cleanup, backup, restore, and access rules therefore need
a durable cross-cutting decision before photo implementation begins.

## Options Considered

### Local Persistent Docker Volume

Store normalized images in a private named Docker volume mounted only into the
application container.

This matches the current single-node deployment, has low operating cost, keeps
large binary payloads out of PostgreSQL, and can be isolated behind an
application-owned adapter. It requires explicit backup, compensation, orphan
cleanup, volume-permission, and host-loss recovery procedures.

### Private Object Storage

Store normalized images in an S3-compatible or cloud object store.

This provides stronger portability and independent durability at larger scale,
but adds credentials, network dependency, lifecycle configuration, cost, and
operational complexity that the current personal-use deployment does not yet
justify. The storage adapter must leave this as a future migration path.

### PostgreSQL Binary Storage

Store image bytes directly in PostgreSQL.

This would simplify parent/metadata atomicity, but it would enlarge database
backups, increase restore and query-operating costs, and couple media throughput
to the operational-record database. It is not approved.

## Reason

Private local persistent storage is the smallest architecture that fits the
current deployment without treating media as public assets or bloating the
database. A feature-owned storage adapter and opaque generated keys preserve a
future path to private object storage without creating a generic attachment
platform now.

The access gate is mandatory. Unpredictable URLs, TLS, a public reverse proxy,
or client-side hiding do not authorize access to workplace evidence.

## Consequences

- A future photo implementation will add a private named volume, mounted at
  `/var/lib/nam/media` in the application container, with application-writable
  permissions verified for the runtime user.
- Staging and final files remain on the same volume so final placement can use
  atomic rename semantics. Checklist files use opaque checklist and photo IDs,
  not original filenames.
- PostgreSQL stores checklist-owned photo metadata and checksums; it does not
  store image bytes.
- The application stores normalized WebP evidence and thumbnails and does not
  retain original device files after successful normalization.
- Upload and removal use compensating cleanup because PostgreSQL and the
  filesystem cannot share one transaction. Staging expiry and orphan
  reconciliation are required.
- Database and media backups must be produced as one documented maintenance
  set while photo mutations are paused. Named-volume persistence does not
  protect against volume deletion or host loss.
- Media is served only through application-owned routes with access checks,
  exact content headers, path isolation, and private caching policy. Direct
  public file URLs are prohibited.
- Real photo use remains implementation-blocked until the approved access gate
  exists. Loopback-only development with synthetic, non-sensitive fixtures is
  permitted for implementation verification.
- This decision does not create a generic attachment service, object-storage
  platform, authentication system, Defect linkage, or external corporate-form
  integration.

## Related Documents

- [Operational Safety Checklists Architecture](../architecture/features/operational-safety-checklists.md)
- [Infrastructure Operations](../infrastructure.md)
- [Dependency Architecture](../dependency-architecture.md)
- [Testing Strategy](../testing-strategy.md)
- [Server Identity Disaster Recovery](../infrastructure/disaster-recovery.md)
- [ADR-017: Supersede Standalone Work Truck Log](adr-017-supersede-standalone-work-truck-log.md)
