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

**Independent deployment-readiness verdict: REMEDIATION OR REVALIDATION
REQUIRED.** This documentation correction is required before deployment
authorization may be requested.

### Post-attempt recovery and evidence closure

Confirmed after the first separately authorized candidate attempt:

- The candidate was not accepted and is not running. Loss of the execution
  shell prevented the required client evidence from being proven within the
  15-minute window.
- A separately authorized recovery restored the exact approved application
  image
  `sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc`.
- Recovery rollback and server/client checks passed. The recovery's combined
  final evidence-sealing operation returned nonzero; a separate authorized
  evidence-closure operation subsequently verified and sealed the retained
  recovery record with verdict `RECOVERY EVIDENCE CLOSURE VERIFIED`.
- Repository closure was clean `main` at
  `cc567ec95ba9a645d79791b7b2e0e8aa3b6a0cd8`, synchronized with
  `origin/main` at divergence `0/0`.

The repository does not contain the recovery execution transcript or its
sealed evidence directory, so it cannot independently reconstruct the precise
low-level cause of the nonzero sealing operation. The earlier application
container ID below is pre-attempt historical evidence, not current runtime
identity. A future deployment authorization must bind freshly reviewed current
application, PostgreSQL, and network identities; this document does not invent
or authorize those values.

Gate C received independent approval. Its exact approved six-file evidence and
artifact set was committed and pushed in
`63c7a1d75821aabd1948564197e9a3d066363308`. The candidate application revision
remains `8a6c652b57f0b1b528d8965e8aa720f28f71008c`. Commit `63c7a1d` contains
documentation and deployment artifacts only; it changes no application source
and requires no new candidate build. Gate C approval and the evidence commit do
not authorize deployment. Gate C evidence is no longer awaiting independent
review.

The readiness assessment found the preserved historical Gate D evidence
sufficient for consideration of this application-only candidate because the
candidate changes no infrastructure, access, authentication, public exposure,
media, ports, DNS, Caddy, Tailscale, or migrations. No new Gate D execution is
currently required. This assessment neither reruns nor rewrites historical
Gate D, and it grants no deployment or public-exposure authority. Immediate
public/private binding checks and approved-client verification would still be
required after any future separately authorized deployment.

Gate B private-access and administrator-recovery evidence was not freshly
revalidated, re-performed, or extended by this Gate C work.

## Classification And Authority

| Classification | Meaning |
| --- | --- |
| Independently inspectable | Retained evidence or current read-only state available to a reviewer. |
| Executor-recorded | A result recorded by the executor without a retained primary transcript sufficient for independent reproduction. |
| Historical | Valid evidence for the revision and execution it records, but not current execution authority. |
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
| Gate C execution baseline | Clean `main` synchronized with `origin/main` at exact `8a6c652b57f0b1b528d8965e8aa720f28f71008c` |
| Approved Gate C evidence commit | `63c7a1d75821aabd1948564197e9a3d066363308` |
| Evidence commit scope | Exactly the approved three documentation files and three digest-pinned Compose/checksum artifacts; no application change |
| Pre-remediation repository baseline | Clean `main` synchronized with `origin/main` at exact `63c7a1d75821aabd1948564197e9a3d066363308` |
| Deployed source revision | `0e57e1e1d5082bb2d2b08528bf0082e2337a80da` |
| Revision relationship | The deployed revision is the direct parent of the candidate revision |
| Committed range purpose | Equipment State and Mine Type correction plus focused tests |

`63c7a1d` is the durable Gate C evidence-commit identity and the clean,
synchronized baseline observed before this remediation. It is not declared to
be the permanent tip of `main`; an approved documentation-only correction
commit will necessarily move the branch beyond it without changing the
candidate application revision or invalidating Gate C evidence.

The one-commit range changes seven Equipment implementation/test files. It
does not change Prisma schema or migrations, dependency manifests, Dockerfile,
or production Compose configuration.

## Pre-attempt Deployed Identity (Historical)

Before the failed candidate attempt and authorized recovery, the executor
recorded matching pre-state and post-state values. The following table is
preserved as historical evidence and must not be used as current execution
identity:

| Item | Historical pre-attempt value |
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

The same pre-attempt inspection found the live PostgreSQL container at
container ID
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

## Gate C Candidate Identity (Not Accepted)

| Item | Independently retained or pre-attempt inspectable value |
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
digest, and successful completed image. Pre-attempt inspection supported the
candidate metadata above, the then-live container post-state, and successful
cleanup. The Compose overrides and checksums remain in the repository. A future
procedure must freshly prove local candidate availability and exact identity;
this record does not claim the candidate still exists in the image store.

The executor recorded the exact frozen-lockfile console result, disposable
database migration result, HTTP statuses and bodies, Equipment persistence and
rejection outcomes, candidate log scan, temporary resource cardinality, and
complete before/after inventories. Primary transcripts for those results were
not retained, so they remain executor-recorded results rather than
independently verified evidence. The pre-attempt inspection corroborated the
recorded post-state and successful cleanup but cannot independently prove every
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

The `8a6c652` candidate remains unpublished and local. It is acceptable only
for a tightly controlled same-host deployment while its exact top-level digest
remains present in the local image store. It is not durable against host loss,
image pruning, or local image-store corruption. This limitation must be
rechecked by any later deployment procedure and does not authorize deployment.

The historical `130a7fe6` Gate C candidate and registry record remain
historical truth. They do not represent `8a6c652` and were not retagged,
rewritten, or removed.

## Current Readiness-Gate Status

| Gate | Status | Current authority |
| --- | --- | --- |
| Repository identity | BASELINE RECORDED | `63c7a1d` is the approved Gate C evidence commit and pre-remediation clean synchronized baseline, not a permanently current branch tip. |
| Gate B private access and administrator recovery | TEMPORARILY ACCEPTABLE FOR NARROW APPLICATION-ONLY DECISION | Not freshly revalidated; deferred device exercises and incomplete privileged refresh remain prerequisites before confidential use or pilot authorization. |
| Gate C immutable candidate | APPROVED; EVIDENCE COMMITTED AND PUSHED | Independent approval accepted the disclosed executor-recorded limitations; commit `63c7a1d` contains the exact six-file evidence/artifact set. No deployment authority is implied. |
| Gate D public exposure | HISTORICAL PASS; SUFFICIENT FOR THIS APPLICATION-ONLY CANDIDATE | No new Gate D execution is currently required because candidate scope changes none of the access or infrastructure surfaces; immediate post-deployment binding/client checks would still be required. |
| Deployment parity | OPEN | Live remains at parent revision `0e57e1e`; candidate `8a6c652` is undeployed. |
| Database migration for this correction | NOT REQUIRED | The one-commit range contains no schema or migration change. |
| Rollback identity | RECORDED | Current live image `sha256:88c435...` is captured in a checksummed override. |
| Controlled-pilot authorization | OPEN | No users, devices, data, support, or execution scope was authorized here. |
| Broader pilot recovery gate | OPEN | Older pilot and disaster-recovery material is not current deployment authority; recovery prerequisites require separate revalidation before confidential operational use. |
| Confidential operational use | PROHIBITED | Gate C candidate evidence does not authorize operational use. |
| Phase 29 | NOT STARTED | No phase assignment or work is authorized. |

## Security And Evidence Boundaries

This Gate C task did not freshly revalidate Gate B. Current privileged UFW,
Tailscale, effective `sshd`, and Fail2ban outputs were not fully refreshed
during the readiness assessment because non-interactive sudo was unavailable.
The separate deferred Gate B exercises remain open:

- unapproved-device denial testing;
- device revocation and re-enrollment; and
- emergency disablement.

See the
[Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md).
These limitations may be temporarily accepted for a narrowly bounded
application-only deployment decision. They remain prerequisites for separate
revalidation before confidential operational use or controlled-pilot
authorization. The broader pilot recovery gate remains open, and older pilot
or disaster-recovery material must not be treated as current deployment
authority.

### 2026-08-11 SSH symlink interpretation correction

The path `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` was previously
described as a world-writable SSH client fragment. Read-only host inspection
established that the path is a root-owned symbolic link with mode `0777` to
`/usr/lib/systemd/ssh_config.d/20-systemd-ssh-proxy.conf`, a root-owned regular
file with mode `0644`. Relevant parent directories are root-owned with mode
`0755`. On this system, the symlink permission bits do not make its target
world-writable. Inspection found no operational vulnerability requiring host
remediation. The earlier finding is closed as a documentation and
interpretation correction. The successful Git push is not evidence for this
security conclusion; the read-only symlink, target, and parent-directory
inspection is the evidence.

Gate C's missing primary runtime transcripts remain disclosed. Independent
approval accepted the executor-recorded results with their documented
limitations; it did not transform them into independently retained evidence.
That limitation does not independently block consideration of an
application-only deployment. The case-insensitive concurrency limitation also
remains accepted only as a known residual limitation.

The executor recorded that the candidate's migration-free case-insensitive
reference resolution passed the isolated reuse checks. Existing case-sensitive
database constraints do not eliminate the narrow race between concurrent
case-variant creates; absolute protection would require a separately designed
schema migration or reference-data redesign. That migration was neither
required nor authorized for this correction.

## Required Immediate Sequence

1. Complete the procedure-hardening implementation without committing.
2. Complete an independent audit of that implementation.
3. Correct every confirmed audit finding without discarding passing controls.
4. Obtain an independent re-audit of the complete corrected six-file change.
5. Only after that re-audit passes, separately authorize a focused commit and
   push containing exactly:
   `docs/README.md`,
   `docs/infrastructure/controlled-pilot-readiness-rebaseline.md`,
   `docs/infrastructure/gate-c-8a6c652-deployment-rollback-procedure.md`,
   `infrastructure/server-config/README.md`,
   `infrastructure/server-config/scripts/gate-c-evidence.sh`, and
   `tests/infrastructure/gate-c-evidence-synthetic.sh`.
6. Any future deployment requires a separate explicit authorization naming the
   exact independently re-audited commit.

The independent re-review must not deploy, publish, retag, restart, rerun the
candidate, generate replacement runtime evidence, or execute either Compose
override. The hardened deployment procedure now exists for review, but neither
its existence nor a future commit authorizes execution. Any evidence-generating
re-execution requires separate authorization.

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
