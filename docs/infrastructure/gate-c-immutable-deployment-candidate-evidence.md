# Gate C Immutable Deployment Candidate Evidence

## Verdict

**PASS** — the immutable pre-pilot candidate was built from the complete
accepted repository state, passed the focused Gate C dependency, migration,
runtime, feature, and isolation checks, and remains available under its
recorded tag and SHA-256 identity.

This is evidence for Gate C of the unnumbered Controlled Pilot Readiness
Security and Deployment Re-baseline. Phase 29 has not been assigned. This
result does not deploy the candidate, authorize confidential operational use,
authorize Gate D or a later gate, or authorize any host, access, or live
database mutation. The current readiness authority remains
[Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).

## Scope and exclusions

Gate C built one fresh image, applied the repository migrations to an isolated
synthetic PostgreSQL database, exercised focused read and write paths, compared
the live application container before and after verification, and removed only
the disposable resources created for this run. It did not use Docker Compose,
connect to `nam_dashboard`, alter the live application, deploy an image, change
public or private access, create a production backup, or start a pilot.

## Source and image identity

| Identity | Accepted value |
| --- | --- |
| Complete repository revision | `130a7fe6bf7c8060a561e8ecb171be35e2724eef` |
| Application-bearing revision | `4eba24fb97abac61c6511258ad4e97aebd4ea6a2` |
| Candidate tag | `nam-app:pre-pilot-candidate-git-130a7fe6` |
| Immutable image ID | `sha256:20623c0354b224d641be8e95f20034e9db5ff2c73e01fe12edaf63a6a1597da7` |
| Local repository digest | `nam-app@sha256:20623c0354b224d641be8e95f20034e9db5ff2c73e01fe12edaf63a6a1597da7` |

The tag is the human-readable name. The SHA-256 image ID/digest is the
immutable deployment authority. At the Gate C acceptance point, the image had
not been pushed to a registry.

### Post-acceptance private registry preservation

After Gate C was accepted, the project owner preserved the same image without
rebuilding it under the private registry tag
`docker.io/alainalemany/nam-app:pre-pilot-candidate-git-130a7fe6`. The
authoritative permanent retrieval identity is:

`docker.io/alainalemany/nam-app@sha256:20623c0354b224d641be8e95f20034e9db5ff2c73e01fe12edaf63a6a1597da7`

Docker reported the matching image ID
`sha256:20623c0354b224d641be8e95f20034e9db5ff2c73e01fe12edaf63a6a1597da7`
for the digest-qualified reference. The push succeeded, and a later
pull-by-digest verification returned the same digest and image ID. The project
owner confirmed that the repository is private, its tags are configured as
immutable, Docker logout was completed, and the temporary Read & Write token
used for publication was revoked after verification. The token had no Delete
permission, and no token value was shared or recorded in the repository.

This preservation event was not part of the original Gate C acceptance
criteria and does not change its verdict. It was not a deployment. The registry
copy preserves only the accepted application image; it does not preserve or
back up PostgreSQL data or uploaded operational data. The digest-qualified
reference above, rather than a convenience tag, is the authoritative registry
retrieval identity.

The exact build was:

```bash
docker build --no-cache \
  --tag nam-app:pre-pilot-candidate-git-130a7fe6 \
  --label org.opencontainers.image.title=nam-app \
  --label org.opencontainers.image.source=https://github.com/alainalemany/nam \
  --label org.opencontainers.image.revision=130a7fe6bf7c8060a561e8ecb171be35e2724eef \
  --label org.opencontainers.image.version=pre-pilot-candidate-git-130a7fe6 \
  --label org.opencontainers.image.created=2026-08-08T02:23:00Z \
  --label io.alemany.nam.application-revision=4eba24fb97abac61c6511258ad4e97aebd4ea6a2 \
  --label io.alemany.nam.readiness-gate=C \
  .
```

The image inspection returned every requested label with the values above.

## Build and dependency evidence

| Check | Result |
| --- | --- |
| Docker host | Docker 29.1.3, Linux `amd64` |
| Dockerfile base reference | `node:24-bookworm-slim` |
| Resolved base identity | `node@sha256:b31e7a42fdf8b8aa5f5ed477c72d694301273f1069c5a2f71d53c6482e99a2fc` |
| Runtime operating system | Debian GNU/Linux 12 (bookworm), glibc 2.36, `amd64` |
| Node.js | `v24.18.0` |
| Next.js | `15.5.22` |
| Next-owned PostCSS | Symlink target `/app/node_modules/.pnpm/postcss@8.5.18/node_modules/postcss`; package version `8.5.18` |
| Sharp | `require.resolve("sharp")` failed as expected; no `sharp` or `@img` package directory existed |
| Frozen dependency resolution | Build step executed `pnpm install --frozen-lockfile`; pnpm reported the lockfile was current and skipped resolution |
| Production build | Passed; the emitted route table included Day View, Supply Requests, and all six Knowledge Base routes |

No Dockerfile change was required. The final runtime image intentionally does
not contain the Prisma CLI. Later live migration work must therefore provide a
separately approved exact-source migration runner rather than assuming the app
container can apply migrations.

## Disposable database and migrations

The run used these uniquely named disposable resources:

- network: `nam_gate_c_net_130a7fe6_20260808t0234z`
- PostgreSQL container: `nam-gate-c-postgres-130a7fe6-20260808t0234z`
- volume: `nam_gate_c_pgdata_130a7fe6_20260808t0234z`
- database: `nam_gate_c_synthetic_130a7fe6_20260808t0234z`

PostgreSQL used the local `postgres:18` image at
`sha256:4aabea78cf39b90e834caf3af7d602a18565f6fe2508705c8d01aa63245c2e20`,
which reported PostgreSQL 18.4. Port 5432 was not published. Credentials were
generated for this run, were not recorded, and were destroyed with the volume.

An exact-source Prisma runner mounted the accepted repository read-only and was
given an explicit connection to the disposable database. It applied all 20
repository migrations. `prisma migrate status` reported the database schema as
up to date. The migration table contained 20 successful migrations, zero
failed or rolled-back entries, and latest migration
`20260802000100_knowledge_base_daily_log_defect_links`. No other database was a
migration target.

## Focused runtime verification

The candidate container ran only on the Gate C network and published its HTTP
port temporarily at `127.0.0.1:32777`. Its restart count remained zero and its
logs contained no error, fatal, or unhandled-rejection line.

| Surface | Evidence | Result |
| --- | --- | --- |
| `/api/health` | HTTP 200 with `{"status":"ok","database":"ok"}` | PASS |
| `/` | HTTP 200 and the NAM Dashboard application shell | PASS |
| `/day-view` | HTTP 200 and all eleven contributor headings | PASS |
| `/supply-requests` | HTTP 200 and the genuine empty-list state | PASS |
| `/supply-requests/new` | HTTP 200 and the submitted-request form | PASS |
| `/knowledge-base` | HTTP 200 and the genuine empty-list state; the failure shell was absent | PASS |
| `/knowledge-base/new` | HTTP 200 and the create form | PASS |
| Knowledge Base create action | Synthetic POST returned HTTP 303 to a stable `/knowledge-base/[id]` route | PASS |
| Knowledge Base current detail | HTTP 200 with the synthetic title and restricted-Markdown body | PASS |

The eleven Day View contributors observed were Work Schedule, Timesheet, Daily
Logs, STOP Cards, Daily Inspections, Operational Safety Checklists, Shift
Reports, Work Authorizations, Defects, Equipment Fuel Events, and Supply
Requests.

Knowledge Base passed explicitly. Its disposable aggregate changed from
`0|0|0` records/revisions/references to `1|1|0` after the real server action,
and the created stable detail route rendered the saved synthetic content.

## Isolation and live-state protection

The candidate resolved its database target as the isolated host
`gate-c-postgres` and the uniquely named synthetic database. The Gate C network
contained only the candidate app and disposable PostgreSQL containers. The app
was not attached to a live Docker network, PostgreSQL had no host binding, and
only synthetic data was written.

The existing `nam-app` container matched before and after Gate C:

| Property | Pre-state and post-state |
| --- | --- |
| Container ID | `793eed4bd0951b52d6a0efcb053fdfab4278816129b3ff35a3c878c64d78b28a` |
| Image ID | `sha256:c7a00e60735fe8d54e64886226cfeaaec799765efa62028d8b541b3628fa3092` |
| Running | `true` |
| Started | `2026-07-26T03:39:30.117407131Z` |
| Restart count | `0` |
| Port binding | `127.0.0.1:3000` to container TCP 3000 |

No live application restart, replacement, Compose action, live migration,
deployment, public cutover, host reconfiguration, or live database access
occurred.

## Cleanup

Before removal, the Gate C app container, PostgreSQL container, network, and
volume were resolved by exact name and verified with
`io.alemany.nam.readiness-gate=C` and
`io.alemany.nam.disposable=true`. After the app stopped, the disposable
database had zero remaining application sessions. The two containers, network,
volume, temporary HTTP responses, and synthetic record were removed. Final
inspection found zero Gate C containers, networks, or volumes.

The candidate image and its immutable identity were retained. No pre-existing
image or Docker resource was removed.

## Later-gate prerequisites and open boundaries

- Gate C PASS does not authorize deployment or Gate D.
- The accepted private-access and independent administrator-recovery boundary
  must pass before a separately authorized public-exposure cutover.
- The live application and 16-migration database remain unchanged; migrations
  17–20 and application replacement require separate authorization.
- The pre-migration backup, manifest, checksum, disposable-restore, and rollback
  compatibility gate remains open before live database transition.
- A later deployment procedure must supply and verify an exact-source migration
  runner because the runtime image excludes Prisma migration tooling.
- The root dashboard's historical Phase 3.2 label and missing Supply
  Requests/Knowledge Base navigation remain known, out-of-scope UI debt. The
  feature routes themselves passed Gate C, but this debt must be accepted or
  corrected under separate authorization before pilot execution.
- Public exposure, reference-data readiness, pilot scope, and controlled pilot
  execution remain open and separately authorized gates.
