# Pre-DDR `0639e4f` Deployment And Recovery Evidence

This document is the canonical repository record for the PostgreSQL backup,
application rollback image, live migration, deployment, and access-boundary
evidence associated with deploying Dragline Delay Reports at source revision
`0639e4f` (`0639e4ff3eab8de749c4e0ff5672a32cf3b805f9`). The commit message is
`feat: complete dragline delay report lifecycle`.

This is an evidence record, not a deployment or restore procedure. It grants no
authority to mutate or restore the live database, replace a container, or alter
the network boundary.

## Evidence Status

| Concern | Recorded result |
| --- | --- |
| Backup purpose | Pre-DDR live-migration rollback point for deployment of `0639e4f` |
| Deployment result | Successful |
| Backup archive | Created, moved to the canonical PostgreSQL backup directory, checksummed, and structurally listed successfully |
| Disposable restore | Not performed; not proven |
| Combined rollback set | The application image and database archive have not been tested together as an end-to-end rollback set |
| Recovery acceptance | Open; this evidence does not establish full disaster-recovery or rollback readiness |

## PostgreSQL Backup Archive

The archive payload intentionally remains outside Git.

| Item | Recorded value |
| --- | --- |
| Archive `dbname` / source database | `nam_dashboard` |
| Archive path | `/home/alain/backups/nam/postgres/nam_dashboard_pre_ddr_0639e4f.dump` |
| Creation command format | `pg_dump -Fc` |
| Archive format | PostgreSQL custom-format archive (`CUSTOM`) |
| Compression | `gzip` |
| Observed filesystem size | `158K` |
| SHA-256 | `d1ef834614799fe0ae79ca699510aca198abcf7727bc1860935556513ca474d2` |
| Structural verification | `pg_restore -l /home/alain/backups/nam/postgres/nam_dashboard_pre_ddr_0639e4f.dump` succeeded |
| TOC entries | `355` |
| Dump version | `1.16-0` |
| Integer size | `4 bytes` |
| Offset size | `8 bytes` |
| Dumped from PostgreSQL | `18.4 (Debian 18.4-1.pgdg13+1)` |

### Timestamp Evidence

These timestamps come from different evidence surfaces and must remain
distinct:

- Archive creation timestamp reported by `pg_restore`:
  `2026-08-19 18:32:19 EDT`. This is the authoritative archive metadata.
- Filesystem modification timestamp shown by the observed filesystem listing:
  `Aug 19 13:32`. The captured listing did not state a timezone.

No reconciliation between the archive-internal timestamp and filesystem mtime
is asserted.

## Application Rollback Image

The application image running immediately before the DDR deployment was
preserved as:

| Item | Recorded value |
| --- | --- |
| Rollback tag | `nam-app:rollback-pre-ddr-0639e4f` |
| Immutable image ID | `sha256:94e7ab72d9e28078de8bb0d515557b1a23921b458bf2dd74b63c766b43b93b8b` |
| Scope | Pre-DDR application rollback image created immediately before live mutation |

Application-image rollback and database rollback are separate recovery
concerns. The image alone cannot restore the pre-DDR application/database state
after schema migration. The image and archive have not been tested together for
rollback compatibility.

## Live Migration Evidence

`prisma migrate deploy` successfully applied these migrations to
`nam_dashboard` in order:

1. `20260818000100_dragline_delay_reports_ddr1`
2. `20260819000100_dragline_delay_reports_ddr2`
3. `20260819000200_dragline_delay_reports_ddr3`

All three were confirmed in `_prisma_migrations`, and the live database
remained healthy after migration.

## Application Deployment Evidence

A new application image was built from `main` at `0639e4f`, and the `nam-app`
container was replaced successfully.

| Verification | Result |
| --- | --- |
| Local health: `http://127.0.0.1:3000/api/health` | `{"status":"ok","database":"ok"}` |
| Local `/dragline-delay-reports` | HTTP `200` |
| Local `/dragline-delay-reports/lakes` | HTTP `200` |
| Approved Windows/Tailscale client health | `{"status":"ok","database":"ok"}` |
| Approved Windows/Tailscale `/dragline-delay-reports` | HTTP `200` |
| Approved Windows/Tailscale `/dragline-delay-reports/lakes` | HTTP `200` |

## Network And Access Boundary Evidence

Post-deployment verification recorded that:

- The application remained loopback-only at
  `127.0.0.1:3000 -> 3000/tcp`.
- PostgreSQL remained private: `5432/tcp` had no host binding.
- Tailscale Serve remained tailnet-only at
  `https://ops-console.tailf57e61.ts.net`, proxying to
  `http://127.0.0.1:3000`.
- Approved private-client health and both DDR route checks passed.
- No public PostgreSQL exposure was introduced.

## Recovery Boundary

Backup archive structurally verified; disposable restore not yet proven.

The successful `pg_restore -l` listing proves that the archive container was
readable enough to enumerate. The checksum fixes the identity of the observed
payload. Neither result proves that the archive can be restored successfully,
that restored records and migrations match the live source, or that the
rollback image works with the restored pre-DDR database.

Until a separately authorized disposable restore and compatibility exercise
passes, do not describe this evidence as:

- restore success;
- end-to-end rollback proof;
- full disaster-recovery readiness;
- current backup recovery authority; or
- proven application/database rollback compatibility.
