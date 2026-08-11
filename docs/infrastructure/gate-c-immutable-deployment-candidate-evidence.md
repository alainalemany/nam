# Gate C Immutable Deployment Candidate Evidence

> Historical boundary: the original sections of this document record the
> `130a7fe6` Gate C execution and remain historical truth. The successor
> re-baseline for `8a6c652` is recorded in a separate section below and is the
> current local candidate evidence. It does not rewrite or retroactively extend
> the earlier execution.

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

## Successor Candidate Re-baseline — `8a6c652` — 2026-08-11

### Review verdict and authority

**CANDIDATE CREATED — READY FOR INDEPENDENT RE-REVIEW.** The successor image was
built from exact clean, synchronized revision
`8a6c652b57f0b1b528d8965e8aa720f28f71008c`. Retained provenance and current
metadata identify the completed image; isolated runtime outcomes are retained
as executor-recorded results because their primary transcripts were not kept.
The candidate remains local and undeployed. This execution does not accept the
candidate, authorize deployment, publish an image, authorize confidential
operational use, grant new Gate D authority, or start Phase 29.

This `8a6c652` Gate C re-baseline performed no new Gate D execution and did not
revalidate Gate D. The repository's
[historical Gate D execution/PASS evidence](gate-d-public-exposure-cutover-evidence.md)
remains preserved as historical truth. This Gate C evidence grants no new Gate
D, deployment, public-exposure, or controlled-pilot authorization. Whether the
historical Gate D evidence remains sufficient for a future deployment decision
must be determined separately and is not decided here.

Gate B private-access evidence was not freshly revalidated, re-performed, or
re-accepted by this Gate C execution.

### Starting state

| Identity | Recorded or retained value |
| --- | --- |
| Branch | `main` |
| Repository and application-bearing revision | `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| `origin/main` | Synchronized to the same full revision by live remote read |
| Initial working tree | Clean |
| Deployed parent revision | `0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| Commit relationship | Deployed revision is the direct parent of the candidate revision |
| Deployed / rollback image ID | `sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc` |

The deployed-to-candidate range changes only the Equipment State and Mine Type
implementation and its focused tests. It changes no Prisma schema, migration,
Dockerfile, Compose production configuration, or dependency manifest.

### Immutable image provenance

| Property | Independently retained or currently inspectable value |
| --- | --- |
| Local tag | `nam-app:pre-pilot-candidate-git-8a6c652` |
| Docker top-level ID / OCI index digest | `sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70` |
| Local repository-digest / OCI index reference | `nam-app@sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70` |
| `linux/amd64` manifest digest | `sha256:39557fa4c75c2a27993325a3313902d7ccda51eb267e168a21e98c20668126b3` |
| Image config digest | `sha256:b94d1f372db519ca0bdd73b63b3a078b05c8e0a62aae3e3e6e0d3e7be52faa2b` |
| Registry digest | None; the candidate is unpublished |
| Architecture and OS | `linux/amd64` |
| Resolved base | `node:24-bookworm-slim@sha256:b31e7a42fdf8b8aa5f5ed477c72d694301273f1069c5a2f71d53c6482e99a2fc` |
| Runtime user | `nextjs`; runtime identity `uid=1001`, `gid=1001` (`nodejs`) |
| Entrypoint | `docker-entrypoint.sh` |
| Command | `node server.js` |
| Working directory | `/app` |
| OCI creation label | `2026-08-11T14:31:32Z` |
| Image-config creation timestamp | `2026-08-11T14:35:14.242247139Z` |

The required labels were inspected on the retained image:

| Label | Value |
| --- | --- |
| `org.opencontainers.image.title` | `nam-app` |
| `org.opencontainers.image.source` | `https://github.com/alainalemany/nam` |
| `org.opencontainers.image.revision` | `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| `org.opencontainers.image.version` | `pre-pilot-candidate-git-8a6c652` |
| `org.opencontainers.image.created` | `2026-08-11T14:31:32Z` |
| `io.alemany.nam.application-revision` | `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| `io.alemany.nam.readiness-gate` | `C` |
| `io.alemany.nam.readiness-classification` | `gate-c-deployment-candidate` |

The exact source and application-bearing labels both match the retained VCS
provenance. The executor recorded that no `latest` tag was created, changed, or
used and that the image was not pushed, pulled, retagged, or published. Current
metadata shows only the local tag and local repository-digest/OCI index
reference above; there is no registry digest.

### Evidence strength and retention

Independently retained or currently inspectable evidence includes:

- BuildKit attestation and provenance;
- exact VCS revision, Dockerfile identity, no-cache build property, and
  base-image material/digest;
- the successful completed image and its current candidate metadata;
- the current live-container post-state and current cleanup state; and
- the candidate and rollback Compose overrides and their checksums.

The following are executor-recorded results without retained primary
transcripts:

- exact frozen-lockfile console output;
- disposable-database migration results;
- HTTP status codes and response bodies;
- Equipment persistence and rejection outcomes;
- the candidate log scan;
- temporary network/resource cardinality during execution;
- complete before/after inventories; and
- claims that no transient live-network attachment, database connection,
  inspection, migration, query, or mutation occurred.

These executor-recorded results remain part of the execution record, but this
document does not represent them as independently reproduced or proven by the
six-file evidence. Current inspection corroborates the recorded post-state and
successful cleanup. Live container start times and restart counts strongly
support that the live containers were neither replaced nor restarted. Retained
evidence cannot independently prove the absence of every transient connection,
query, attachment, inspection, or mutation. No live application-health result
or live database-content inspection is claimed.

### Build result

Retained BuildKit provenance records the established multi-stage Dockerfile,
the no-cache build property, the resolved base material, and a successfully
completed image. The executor recorded that `pnpm install --frozen-lockfile`
reported a current lockfile and skipped dependency resolution, Prisma Client
generation passed, and the Next.js `15.5.22` production build completed type
checking, page-data collection, static-page generation, and the expected
Equipment routes. Exact console transcripts for those executor-recorded
results were not retained. The executor recorded that no source modification
was needed to complete the build.

### Isolated topology and schema preparation

The executor recorded these task-specific resources for the candidate test:

- network: `nam_gate_c_net_8a6c652_20260811t143132z`, bridge network ID
  `9e847fd0b858823e29461726039d5a6422c0652c49c65d5d0bf96d5ec98556b5`;
- PostgreSQL container:
  `nam-gate-c-postgres-8a6c652-20260811t143132z`;
- volume: `nam_gate_c_pgdata_8a6c652_20260811t143132z`;
- synthetic database: `nam_gate_c_8a6c652`;
- candidate container: `nam-gate-c-app-8a6c652-20260811t143132z`.

PostgreSQL used `postgres:18` at
`sha256:4aabea78cf39b90e834caf3af7d602a18565f6fe2508705c8d01aa63245c2e20`.
The executor recorded that its port was not published; random credentials and
a random application signing secret existed only for the disposable run and
were neither printed nor recorded; and an exact-source, read-only-mounted
Prisma runner received a disposable connection URL and applied all 20
repository migrations. The executor also recorded that the candidate had no
mounts, joined only the isolated Gate C network, bound
`127.0.0.1:32778` to container TCP 3000, remained at restart count zero, and
shared that temporary network only with disposable PostgreSQL. Primary
transcripts and complete transient inventories were not retained. Current
cleanup inspection cannot independently prove that the live database, volume,
or network was never transiently addressed, mounted, joined, inspected, or
queried.

### Runtime and Equipment workflow results

| Check | Executor-recorded result | Status |
| --- | --- | --- |
| Health | `/api/health` returned HTTP 200 and `{"status":"ok","database":"ok"}` | PASS |
| Root | `/` returned HTTP 200 | PASS |
| Equipment list | `/equipment` returned HTTP 200 | PASS |
| New Equipment form | `/equipment/new` returned HTTP 200 with `FL` and `Quarry` genuinely selected | PASS |
| Default create | Real server-action POST returned HTTP 303 and persisted `FL` / `Quarry` | PASS |
| Alternate controlled create | Real server-action POST returned HTTP 303 and persisted `WY` / `Strip Mine` | PASS |
| Forged values | `Florida` / `Surface Mine` returned HTTP 200 field errors; no City or Equipment row was written | PASS |
| Case-variant reuse | Case-variant City and Mine names reused one City and one Mine and created no duplicate reference | PASS |
| Null edit rendering | Empty edit-only State and Mine Type sentinels and controlled-reference guidance rendered | PASS |
| Null unrelated edit | Returned HTTP 303; Equipment fields changed while the original City and Mine IDs and null values remained | PASS |
| Legacy edit rendering | Exact `Legacy State` and `Legacy Mine Type` values and guidance rendered | PASS |
| Legacy unrelated edit | Returned HTTP 303; Equipment fields changed while the original City and Mine IDs and legacy values remained | PASS |
| Null State conflict | Selecting `FL` alone returned the controlled field error with no reference or assignment change | PASS |
| Null Mine Type conflict | Selecting `Quarry` alone returned the controlled field error with no reference or assignment change | PASS |
| Combined null conflict | Selecting `FL` and `Quarry` returned both controlled field errors with no creation, mutation, or reassignment | PASS |

The executor recorded that the synthetic null and legacy assertions retained
the exact relationship IDs after unrelated edits and that the three correction
attempts preserved the stated reference and Equipment values. The executor
also recorded normal Next.js startup, non-fatal missing-`Origin` warnings from
the raw curl Server Action harness, no matching fatal/error log entry, and the
non-root `nextjs` runtime. Retained primary HTTP, persistence, log-scan, and
process-inspection transcripts are not part of the six-file evidence.

### Live-state preservation

The executor recorded matching live-application values before and after
candidate work. Current read-only inspection corroborates this post-state:

| Property | Executor-recorded value, corroborated by current post-state |
| --- | --- |
| Container ID | `da91da2bb5538875af5abf10db87e2c4b3a847efefcf450ec60132a51e11e859` |
| Image ID | `sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc` |
| Image reference | `nam-app:typography-git-0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| Embedded source and application revision | `0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| Running and restart count | `true`; `0` |
| Start time | `2026-08-10T18:26:54.583013641Z` |
| Mounts | None |
| Network | `nam-network`; ID `e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80` |
| Port | Host `127.0.0.1:3000` to container TCP 3000 |

Current inspection also finds the live PostgreSQL container at container ID
`0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1`,
image ID
`sha256:4aabea78cf39b90e834caf3af7d602a18565f6fe2508705c8d01aa63245c2e20`,
restart count zero, healthy running state, volume `postgres-data`, the same
`nam-network` identity, and no host port. The retained start times and restart
counts strongly support that neither live container was replaced or restarted.
The executor recorded no live migration, health request, database inspection,
or data mutation, but retained evidence cannot independently exclude every
transient attachment, connection, query, inspection, or mutation. No live
application-health result or live database-content inspection is claimed.

The executor recorded that the before/after named-image inventory changed only
by adding `nam-app:pre-pilot-candidate-git-8a6c652`. A complete retained
before/after inventory is not part of the six-file evidence.

### Cleanup, retention, and rollback artifact

The executor recorded resolving and removing the two disposable containers,
one-shot migration runner, network, and volume by exact names and Gate C task
labels. Current post-cleanup inspection finds no Gate C-labeled disposable
containers, networks, or volumes and therefore corroborates successful cleanup.
The completed candidate image and revision-specific local tag remain retained.

The exact current rollback image remains
`sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc`.
The evidence-only, digest-pinned Compose artifacts are:

- `infrastructure/server-config/docker/gate-c-8a6c652-candidate.compose.yaml`
  — SHA-256
  `5e42c3abcb9f7277b785267f67fac51b367d9f3d37d22e3ac9da4e779d205284`;
- `infrastructure/server-config/docker/gate-c-8a6c652-rollback.compose.yaml`
  — SHA-256
  `ad36dc5d18cbb061ad89a0797c1fcac2f0329b43e19bd91887831242e5710cd0`.

The companion checksum file is
`infrastructure/server-config/docker/gate-c-8a6c652-compose.sha256`. Rendering
both overrides with read-only `docker compose ... config --images` resolves the
candidate override to the local repository-digest/OCI index reference and the
rollback override to the exact rollback image. The overrides were not executed
and do not authorize a deployment or rollback.

### Required immediate sequence

1. Complete this documentation repair without committing.
2. Obtain independent read-only re-review and approval of the complete
   uncommitted six-file Gate C scope.
3. If approved, perform a separately controlled commit and push containing only
   those six Gate C evidence/artifact files.
4. Only afterward consider a separate deployment-readiness or
   deployment-authorization request.

Independent re-review must not rerun the candidate or generate replacement
runtime evidence. Any evidence-generating re-execution requires separate
authorization.

### Migration determination and remaining boundaries

No migration is included in or required by the deployed-to-candidate Git
range. This determination does not recommend or authorize deployment. The
executor recorded that no live migration status or application data was
inspected; retained evidence cannot independently exclude every transient
connection, query, or inspection.

The executor recorded that the migration-free implementation's
case-insensitive reference lookup inside serializable transactions passed the
isolated reuse checks. The existing case-sensitive database constraints cannot
provide absolute protection against two concurrent case-variant creates;
closing that narrow race would require a separately designed schema migration
or reference-data redesign. No migration was required or authorized for this
candidate.

Gate B was not freshly revalidated. UFW, Tailscale, Caddy, DNS, SSH, TLS,
public-denial, external-client, registry, and privileged host-security checks
were not refreshed. The prior
[Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md)
continues to record deferred unapproved-device denial, revocation,
re-enrollment, and emergency-disablement exercises plus the known
world-writable `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` outbound client
fragment. This Gate C task did not inspect, correct, refresh, or accept away
those prior findings.

This re-baseline performed no new Gate D execution and did not revalidate the
historical Gate D PASS. It grants no new Gate D, deployment, public-exposure,
controlled-pilot, confidential-operational-use, or Phase 29 authorization.
