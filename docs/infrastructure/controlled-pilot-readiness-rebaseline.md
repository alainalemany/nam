# Controlled Pilot Readiness Re-baseline

This document is the current authority for NAM Dashboard deployment identity,
controlled-pilot readiness status, and the order in which remaining readiness
gates may later be addressed. It records an accepted read-only observation of
the repository, deployed runtime, live migration state, access boundary, and
recovery posture. It is not an executable runbook and does not authorize any
mutation.

This is an **unnumbered readiness effort**. Phase 29 has not been assigned.
Confidential operational use remains prohibited. No gate below authorizes the
next gate automatically. Host, network, deployment, and database mutations
require separate approval before execution.

## Classification And Authority

| Classification | Meaning |
| --- | --- |
| Confirmed | Observed current state or an approved governance boundary. |
| Approved direction | Ordered future work that may be prepared but not executed without separate authorization. |
| Open gate | Required evidence or work that has not been accepted. |

This document supersedes Checkpoint D documents as the **current-state and
sequencing authority**. The Checkpoint D documents remain immutable historical
evidence for the `76cdba9` application and 16-migration deployment generation.
The [Operational Pilot Runbook](operational-pilot-runbook.md) remains the
authority for durable pilot requirements, scope, support, and exit review, but
its mutation procedures are suspended until they are revalidated against this
baseline. No current executable access, deployment, migration, or recovery
runbook is approved. The Operational Pilot Runbook may become pilot
orchestration and execution authority only after its stale procedure blocks are
replaced or revalidated and independently accepted. Security-sensitive gates
may also require focused execution procedures. All such authority requires
separate approval before Gate B or any later mutation.

## Current Repository Identity

| Item | Current identity |
| --- | --- |
| Branch | `main` |
| Repository revision | `4eba24fb97abac61c6511258ad4e97aebd4ea6a2` |
| Latest change | Dependency-security correction with Next.js `15.5.22`, Next-owned PostCSS `8.5.18`, and Sharp removed from the production graph |
| Production dependency audit | Zero known vulnerabilities at the accepted verification point |
| Repository migrations | 20 |
| Day View contributors | 11 |
| Supply Requests V1 | Implemented and accepted |
| Knowledge Base V1 | Implemented, accepted, and canonically closed |

The root dashboard still presents the historical Phase 3.2 label and does not
link to Supply Requests or Knowledge Base. That is known UI debt, not evidence
that those repository capabilities are absent, and it is not authorized for
correction by this readiness effort.

## Current Deployed Identity

| Item | Observed deployed state |
| --- | --- |
| Application source revision | `76cdba9530e49334e775009a811ae5ae74305c65` |
| Application image | `nam-app:checkpoint-d-git-76cdba9530e49334e775009a811ae5ae74305c65` |
| Immutable image ID | `sha256:c7a00e60735fe8d54e64886226cfeaaec799765efa62028d8b541b3628fa3092` |
| Next.js | `15.5.19` |
| Day View contributors | 10 |
| Supply Requests | Not present |
| Knowledge Base | Not present |
| Health | Healthy at the read-only observation point |

The deployed application is healthy but stale. Its tag and image ID prove the
Checkpoint D generation; they do not prove parity with repository HEAD. No
immutable deployment candidate with embedded revision `4eba24f` currently
exists. A retained local Strategy B image is verification evidence only because
its repository revision is not proven in the image.

## Current Live Migration Identity

The live PostgreSQL `18.4` database is `nam_dashboard`. It records 16 successful
Prisma migrations and no failed migrations. The first 16 live migration
checksums match the repository. Repository HEAD contains 20 migrations, so live
deployment parity is open.

The four repository migrations not applied live are:

1. `20260729000100_add_supply_request_persistence_foundation`
2. `20260731000100_supply_request_daily_log_links`
3. `20260801000100_knowledge_base_foundation`
4. `20260802000100_knowledge_base_daily_log_defect_links`

This observation does not authorize `prisma migrate deploy` or any other live
database mutation.

## Current Access And Security State

- The application remains published on host loopback at port `3000` only.
- PostgreSQL is not published to the host or public network.
- Caddy publicly exposes NAM on TCP `80` and `443` and UDP `443` for HTTP/3.
- Public IPv4 access succeeds. The host also has public IPv6, and a direct IPv6
  request with NAM hostname/SNI reaches Caddy even without a DNS `AAAA` record.
  DNS removal alone therefore cannot close public access.
- NAM has no application authentication or authorization.
- Tailscale is installed, connected, tagged for pilot use, and configured to
  Serve `127.0.0.1:3000`; Funnel is not configured. Overlay connectivity to a
  Windows peer was observed.
- Private HTTPS acceptance has not been proven. Tailnet-hostname resolution on
  the VPS was unavailable during observation, and a direct private-IP/SNI test
  did not establish an accepted HTTPS path.
- MFA, deny-by-default policy, device approval, unapproved-device denial,
  revocation, re-enrollment, and approved mobile access remain unverified.

ADR-019 is therefore **partially implemented, not accepted** as the
operational-pilot boundary. Installed software, overlay connectivity, and Serve
configuration do not by themselves pass the Access Gate.

## Administrator Recovery State

- Public SSH is available over IPv4 and IPv6.
- Effective configuration is key-only and disables root login.
- Two authorized ED25519 administrator keys are present.
- An independent external key-authenticated recovery session has not been
  executed and accepted.
- `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` is world-writable. This is a
  security defect and has interfered with normal Git-over-SSH verification.

Correcting the SSH client-fragment permissions is a separately authorized host
hardening mutation. This document neither authorizes nor supplies that change.

## Current Backup, Restore, And Rollback State

- Two historical Phase 2A PostgreSQL dumps exist. Neither represents the live
  16-migration database or the repository's 20-migration schema.
- No accepted current 16-migration live backup exists.
- No accepted 20-migration current-schema backup exists.
- No accepted disposable restore proof exists for either current generation.
- The historical Checkpoint D runtime and V17 rollback authority remain valid
  only for the unchanged 16-migration deployment generation.
- V17 compatibility after migrations 17 through 20 is unproven.
- `nam-app:latest` is mutable and is not deployment or rollback authority.
- No immutable image for repository revision `4eba24f` is a formal deployment
  or rollback candidate.

A dump file, mutable tag, or retained local image is not recovery proof without
identity, checksum, compatibility, and restore evidence.

## Reference-Data Observation

The read-only investigation recorded aggregate counts only:

| Reference group | Count |
| --- | ---: |
| Cities | 3 |
| Mines | 3 |
| Equipment | 7 |
| Timesheet Work Codes | 0 |
| Timesheet Work Orders | 0 |
| Timesheet Support Personnel | 0 |
| Fuel Service Personnel | 0 |

No record contents were inspected. These counts do not pass the Reference-Data
Gate; correctness and pilot suitability still require review.

## Current Pilot-Gate Status

| Gate | Status | Reason |
| --- | --- | --- |
| Repository identity | PASS | Clean synchronized `main` at `4eba24f` was proven during the accepted read-only investigation. |
| Private network access | PARTIAL | Tailscale is connected and Serve is configured, but private HTTPS and policy/device controls are unaccepted. |
| Public exposure removal | OPEN | Public Caddy paths remain reachable over IPv4 and direct IPv6/SNI. |
| Administrator recovery | PARTIAL | Key-only configuration exists; independent external recovery is unproven and a world-writable SSH client fragment remains. |
| Immutable deployment candidate | OPEN | No formal image with proven embedded revision `4eba24f` exists. |
| Deployment parity | OPEN | The healthy runtime remains at `76cdba9`, Next.js `15.5.19`, and ten contributors. |
| Database migration parity | OPEN | Live has 16 successful migrations; repository has 20. |
| Pre-migration recovery | OPEN | No current 16-migration backup and disposable restore proof exists. |
| Current-schema recovery | NOT YET EXECUTABLE | It follows separately authorized migration and deployment parity. |
| Reference data | OPEN | Aggregate data exists, but required reference sets are incomplete and no suitability review is accepted. |
| Pilot scope and support | OPEN | User, device, data, support, rollback, and exit authorization remain incomplete. |
| Confidential operational use | FAILED | The public unauthenticated route remains active and prerequisite gates are open. |

## Approved Ordered Readiness Direction

Each gate requires its own preconditions, evidence, independent review, and
explicit owner authorization. Completion of one does not authorize the next.

### A. Current Documentation And Runbook Authority Re-baseline

Reconcile current-state documentation while preserving Checkpoint D as
historical evidence. This documentation-only task addresses Gate A and remains
pending independent review and acceptance; it does not change deployment or
pilot status.

### B. Private Access And Administrator-Recovery Preparation

Correct and verify Tailscale private HTTPS; obtain policy, MFA, approval,
device-denial, revocation, re-enrollment, and approved-mobile evidence; prove
independent external key-only SSH recovery; and separately correct the
world-writable SSH client fragment. Each security-sensitive host mutation needs
separate approval.

### C. Immutable Deployment Candidate

Build a fresh immutable image from exact revision `4eba24f`, embed and verify
the repository identity, and establish compatible rollback evidence. Do not use
the unlabeled Strategy B image as deployment authority.

### D. Public Exposure Cutover

Only after private access and administrator recovery pass, remove NAM's public
Caddy exposure, remove public DNS where appropriate, close public NAM TCP
`80`/`443` and UDP `443` over IPv4 and IPv6, and prove public NAM paths fail
while the separately approved SSH recovery path remains available.

Public exposure must be removed before the live database/application
transition. The older Checkpoint D ordering is not current authority.

### E. Pre-migration Recovery Gate

Create an identity-bound backup of the current 16-migration live database,
produce a manifest and checksums, prove a disposable restore, and establish
rollback compatibility before changing the live database.

### F. Database And Application Parity

Separately authorize migrations 17 through 20 and deployment of the immutable
current application candidate. Verify 20 migrations, Supply Requests,
Knowledge Base, the eleven-contributor Day View, health, and representative
workflows.

### G. Current-schema Recovery Gate

Create a 20-migration backup, produce a manifest and checksums, prove a
disposable restore, and establish current rollback/recovery authority.

### H. Reference-Data Review

Review the required location, Equipment, Timesheet, fuel, and snapshot-name
data without fabricating facts.

### I. Pilot-Scope Authorization

Approve the users, devices, data classes, entry workflow, support path,
rollback plan, and exit criteria for a bounded pilot.

### J. Controlled Pilot Execution

Enter real operational data only after every preceding gate is accepted and a
separate pilot-execution authorization is recorded.

## Authorization Boundary And Stop Conditions

This document authorizes no command or mutation. Stop and seek a separate
approval before any action that would:

- change Tailscale, Caddy, firewall, DNS, SSH, device policy, or host files;
- build, retag, start, stop, replace, or deploy an application image;
- create or restore a backup;
- apply a migration or otherwise mutate the live database;
- inspect or enter confidential operational record contents;
- authorize a pilot, application authentication, media, or another feature;
- assign Phase 29 or another implementation phase.

If current identity, access, recovery, or rollback evidence differs from this
baseline, stop and perform a new read-only assessment before using a later
execution procedure.

## Historical Evidence Boundary

These documents remain evidence of the old `76cdba9`/16-migration generation;
they are not current execution authority:

- [Checkpoint D Application Deployment Correction](checkpoint-d-application-deployment-correction.md)
- [Checkpoint D Existing-Candidate Recovery](checkpoint-d-existing-candidate-recovery.md)
- [Checkpoint D Private Validator Recovery](checkpoint-d-private-validator-recovery.md)

Do not rewrite their historical SHAs, image identities, migration counts,
panel counts, commands, or results. Future execution procedures must use fresh
immutable identities and the current ordered readiness direction above.
