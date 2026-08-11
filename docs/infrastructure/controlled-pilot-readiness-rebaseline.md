# Controlled Pilot Readiness Re-baseline

This document is the current authority for NAM Dashboard repository,
deployment-candidate, deployed-runtime, and readiness-gate identity. It records
only the current verified baseline and governance boundary. Historical
checkpoint and gate evidence remains historical truth in its own documents.

This is an **unnumbered readiness effort**. Phase 29 has not been assigned.
Nothing in this document authorizes deployment, registry publication, database
mutation, public exposure, confidential operational use, or controlled-pilot
execution.

## Current Verdict

**Gate C candidate created — evidence repair awaiting independent re-review.**
The local candidate for revision
`8a6c652b57f0b1b528d8965e8aa720f28f71008c` has retained provenance and
metadata plus executor-recorded isolated results documented in
[Gate C Immutable Deployment Candidate Evidence](gate-c-immutable-deployment-candidate-evidence.md).
It is not deployed and is not yet accepted for deployment.

This `8a6c652` Gate C re-baseline performed no new Gate D execution and did not
revalidate Gate D. The repository's
[historical Gate D evidence](gate-d-public-exposure-cutover-evidence.md)
continues to record its authorized execution and PASS at revision `977483f`.
This Gate C work grants no new Gate D, deployment, public-exposure, or
controlled-pilot authorization. Whether the historical Gate D evidence remains
sufficient for a future deployment decision requires separate determination
and is not decided here.

Gate B private-access and administrator-recovery evidence was not freshly
revalidated, re-performed, or extended by this Gate C work.

## Classification And Authority

| Classification | Meaning |
| --- | --- |
| Independently inspectable | Retained evidence or current read-only state available to a reviewer. |
| Executor-recorded | A result recorded by the executor without a retained primary transcript sufficient for independent reproduction. |
| Historical | Valid evidence for the revision and execution it records, but not current execution authority. |
| Awaiting review | Evidence exists but has not received the separate acceptance required for the next mutation. |
| Open | Required work or authorization has not been completed. |

This document supersedes stale current-state statements elsewhere. It does not
rewrite historical evidence. The
[Operational Pilot Runbook](operational-pilot-runbook.md) remains a durable
requirements reference, not current mutation authority. Every later mutation
requires a separately approved, identity-bound procedure.

## Repository And Revision Identity

| Item | Recorded or currently inspectable value |
| --- | --- |
| Branch | `main` |
| Candidate source revision | `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| Application-bearing revision | `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| `origin/main` at Gate C start | Synchronized to the same full revision by live remote read |
| Initial source tree | Clean |
| Deployed source revision | `0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| Revision relationship | The deployed revision is the direct parent of the candidate revision |
| Committed range purpose | Equipment State and Mine Type correction plus focused tests |

The one-commit range changes seven Equipment implementation/test files. It
does not change Prisma schema or migrations, dependency manifests, Dockerfile,
or production Compose configuration.

## Current Deployed Identity

The executor recorded matching pre-state and post-state values. Current
read-only inspection corroborates the recorded post-state:

| Item | Currently inspectable post-state |
| --- | --- |
| Container ID | `da91da2bb5538875af5abf10db87e2c4b3a847efefcf450ec60132a51e11e859` |
| Image reference | `nam-app:typography-git-0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| Immutable image ID | `sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc` |
| Embedded source/application revision | `0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| State | Running; restart count `0` |
| Start time | `2026-08-10T18:26:54.583013641Z` |
| Mounts | None |
| Network | `nam-network`; ID `e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80` |
| Host binding | `127.0.0.1:3000` to container TCP 3000 |

Current inspection also finds the live PostgreSQL container at container ID
`0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1`,
image ID
`sha256:4aabea78cf39b90e834caf3af7d602a18565f6fe2508705c8d01aa63245c2e20`,
restart count zero, healthy running state, volume `postgres-data`, the same
`nam-network` identity, and no published PostgreSQL port.

The retained start times and zero restart counts strongly support the
executor-recorded result that neither live container was replaced or restarted.
They do not independently prove the absence of every transient network
attachment, database connection, query, inspection, migration, or mutation.
The executor recorded that none occurred. This evidence makes no live
application-health claim and includes no live database-content inspection.

## Current Gate C Candidate

| Item | Independently retained or currently inspectable value |
| --- | --- |
| Local tag | `nam-app:pre-pilot-candidate-git-8a6c652` |
| Docker top-level ID / OCI index digest | `sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70` |
| Local repository-digest / OCI index reference | `nam-app@sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70` |
| `linux/amd64` manifest digest | `sha256:39557fa4c75c2a27993325a3313902d7ccda51eb267e168a21e98c20668126b3` |
| Image config digest | `sha256:b94d1f372db519ca0bdd73b63b3a078b05c8e0a62aae3e3e6e0d3e7be52faa2b` |
| Registry digest | None; the candidate is unpublished |
| OCI creation label | `2026-08-11T14:31:32Z` |
| Image-config creation timestamp | `2026-08-11T14:35:14.242247139Z` |
| Architecture | `linux/amd64` |
| Resolved base | `node:24-bookworm-slim@sha256:b31e7a42fdf8b8aa5f5ed477c72d694301273f1069c5a2f71d53c6482e99a2fc` |
| Runtime | Non-root `nextjs` (`uid=1001`, `gid=1001`) |
| Entrypoint and command | `docker-entrypoint.sh`; `node server.js` |
| Source/application labels | Exact full `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| Classification label | Gate `C`; `gate-c-deployment-candidate` |
| Deployment state | Not deployed |

Retained BuildKit attestation and provenance independently support the exact
VCS revision, Dockerfile identity, no-cache property, base-image material and
digest, and successful completed image. Current inspection independently
supports the candidate metadata above, current live-container post-state, and
successful cleanup. The Compose overrides and checksums are retained and
currently inspectable.

The executor recorded the exact frozen-lockfile console result, disposable
database migration result, HTTP statuses and bodies, Equipment persistence and
rejection outcomes, candidate log scan, temporary resource cardinality, and
complete before/after inventories. Primary transcripts for those results were
not retained, so they remain executor-recorded results rather than
independently verified evidence. Current inspection corroborates the recorded
post-state and successful cleanup but cannot independently prove every
transient execution-state claim.

## Migration Determination

The deployed-to-candidate range contains no Prisma schema or migration change.
No live migration is included or required for this application correction.
This is a no-migration determination only; it neither recommends nor authorizes
deployment. Any later deployment-readiness question must occur only after the
required immediate sequence below is complete and under its own authorization.

The executor recorded that the Gate C disposable database applied all 20
repository migrations from an empty schema. The retained six-file evidence
does not include a primary migration transcript. This is an executor-recorded
isolated result, not a claim about live migration state. The executor also
recorded that the live database was not inspected or mutated, but retained
evidence cannot independently prove the absence of every transient connection,
query, inspection, or mutation.

## Rollback And Provenance Authority

The exact current rollback image is:

`sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc`

Evidence-only immutable Compose overrides and their checksum manifest are
stored at:

- `infrastructure/server-config/docker/gate-c-8a6c652-candidate.compose.yaml`
- `infrastructure/server-config/docker/gate-c-8a6c652-rollback.compose.yaml`
- `infrastructure/server-config/docker/gate-c-8a6c652-compose.sha256`

The candidate override checksum is
`5e42c3abcb9f7277b785267f67fac51b367d9f3d37d22e3ac9da4e779d205284`.
The rollback override checksum is
`ad36dc5d18cbb061ad89a0797c1fcac2f0329b43e19bd91887831242e5710cd0`.
These artifacts are evidence, not an executable authorization.

The historical `130a7fe6` Gate C candidate and registry record remain
historical truth. They do not represent `8a6c652` and were not retagged,
rewritten, or removed.

## Current Readiness-Gate Status

| Gate | Status | Current authority |
| --- | --- | --- |
| Repository identity | CURRENTLY CONFIRMED | Current `main` and `origin/main` are synchronized at exact `8a6c652`; retained provenance identifies it as candidate source. |
| Gate B private access and administrator recovery | PRIOR EVIDENCE; NOT REVALIDATED | Prior unresolved and deferred findings remain; this task did not refresh Gate B. |
| Gate C immutable candidate | AWAITING INDEPENDENT RE-REVIEW | Candidate and retained metadata exist locally; executor-recorded runtime results require the stated evidence-strength qualification. |
| Gate D public exposure | HISTORICAL PASS; NOT REVALIDATED | Historical execution/PASS evidence remains preserved. This Gate C task performed no new Gate D work and grants no new Gate D authority. |
| Deployment parity | OPEN | Live remains at parent revision `0e57e1e`; candidate `8a6c652` is undeployed. |
| Database migration for this correction | NOT REQUIRED | The one-commit range contains no schema or migration change. |
| Rollback identity | RECORDED | Current live image `sha256:88c435...` is captured in a checksummed override. |
| Controlled-pilot authorization | OPEN | No users, devices, data, support, or execution scope was authorized here. |
| Confidential operational use | PROHIBITED | Gate C candidate evidence does not authorize operational use. |
| Phase 29 | NOT STARTED | No phase assignment or work is authorized. |

## Security And Evidence Boundaries

This Gate C task did not freshly revalidate Gate B. It did not refresh UFW,
Tailscale, Caddy, DNS, SSH, TLS, public-denial, external-client, registry, or
host-hardening checks. The prior Gate B findings remain unresolved or deferred:

- unapproved-device denial, revocation, re-enrollment, and emergency-disablement
  exercises remain deferred; and
- `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` remains documented as a
  world-writable outbound SSH client fragment requiring separate host-hardening
  authorization.

See the
[Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md).
This Gate C task did not inspect or correct either finding and does not claim
that prior Gate B evidence was refreshed or accepted away.

The executor recorded that the candidate's migration-free case-insensitive
reference resolution passed the isolated reuse checks. Existing case-sensitive
database constraints do not eliminate the narrow race between concurrent
case-variant creates; absolute protection would require a separately designed
schema migration or reference-data redesign. That migration was neither
required nor authorized for this correction.

## Required Immediate Sequence

1. Complete this documentation repair without committing.
2. Obtain independent read-only re-review and approval of the complete
   uncommitted six-file Gate C scope.
3. If approved, perform a separately controlled commit and push containing only
   those six Gate C evidence/artifact files.
4. Only afterward consider a separate deployment-readiness or
   deployment-authorization request.

The independent re-review must not deploy, publish, retag, restart, rerun the
candidate, generate replacement runtime evidence, or execute either Compose
override. Any evidence-generating re-execution requires separate authorization.

## Authorization Boundary And Stop Conditions

Stop and obtain separate approval before any action that would:

- commit or push the current evidence changes;
- push, publish, pull, retag, rebuild, remove, or replace the candidate image;
- deploy, restart, or replace the live application;
- inspect, migrate, back up, restore, backfill, or mutate live data;
- change Tailscale, Caddy, UFW, firewall, DNS, TLS, SSH, or authentication;
- execute Gate D or enable public exposure;
- correct existing City State or Mine Type reference values;
- authorize controlled-pilot or confidential operational use;
- assign or begin Phase 29 or unrelated feature work.
