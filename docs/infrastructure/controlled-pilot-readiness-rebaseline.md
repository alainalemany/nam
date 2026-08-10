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
may also require focused execution procedures. All later mutation authority
requires separate approval.

## Repository And Application Identity

| Item | Authority |
| --- | --- |
| Branch | `main` |
| Repository revision | Resolve from clean synchronized local `main` at the start of each later readiness review; Gate D execution authority was limited to the separately accepted revision below. |
| Prospective Gate D readiness revision | The exact committed revision inspected by a readiness task; it remains evidence only and may be superseded by later documentation commits. |
| Authorized Gate D execution revision | `977483f985f26d080ad80d59cfc8c6abed3c122a` |
| Gate B closure evidence revision | `efdea5402401437d9e962b3aa8421a49931e6189` |
| Application-bearing revision | `4eba24fb97abac61c6511258ad4e97aebd4ea6a2` |
| Latest accepted completed gate | [Gate D public exposure cutover evidence](gate-d-public-exposure-cutover-evidence.md) |
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
deployment has occurred. Gate C produced and accepted the immutable local
pre-pilot candidate `nam-app:pre-pilot-candidate-git-130a7fe6` at
`sha256:20623c0354b224d641be8e95f20034e9db5ff2c73e01fe12edaf63a6a1597da7`,
with complete repository revision `130a7fe6` and application-bearing revision
`4eba24f` embedded as separate labels. The
[Gate C evidence](gate-c-immutable-deployment-candidate-evidence.md) is image
authority. The accepted image is also preserved in the private registry at
`docker.io/alainalemany/nam-app@sha256:20623c0354b224d641be8e95f20034e9db5ff2c73e01fe12edaf63a6a1597da7`;
this digest-qualified reference is its authoritative registry retrieval
identity. Registry preservation does not make the candidate deployed or
pilot-ready and does not preserve or back up PostgreSQL data or application
uploads.

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
- The public NAM Caddy route has been removed through graceful reload.
- Public UFW TCP `80` and `443` allowances have been removed while public SSH
  on TCP `22` remains allowed.
- Independent Windows-client checks confirmed that public HTTP and HTTPS time
  out without a response.
- The `dev.alemany.me` `A` record for `217.76.49.214` has been removed. The
  unrelated `nam.alemany.me` record was not changed.
- NAM has no application authentication or authorization.
- Tailscale is installed, connected, tagged for pilot use, and configured to
  Serve `127.0.0.1:3000`; Funnel is disabled. Approved Windows and iPad clients
  passed private HTTPS, health, and Day View checks without bypassing TLS. The
  Windows client passed a fresh post-cutover NAM Dashboard and Day View check
  without a certificate warning.
- Prior accepted tailnet-administration evidence records identity-provider MFA,
  Device Approval, the `tag:nam-pilot` assignment, and an explicit owner-to-tag
  TCP `443` access rule.
- Unapproved-device denial, revocation, re-enrollment, and emergency-disablement
  exercises are intentionally deferred rather than failed.

Gate B is accepted for private access and independent administrator recovery;
see the [Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md).
ADR-019 remains incomplete as the complete operational-pilot boundary because
later pilot gates remain open.

## Administrator Recovery State

- Public SSH is available over IPv4 and IPv6.
- Effective configuration is key-only and disables root login.
- Two authorized ED25519 administrator keys are present.
- A dedicated Windows recovery key completed an accepted independent external
  key-authenticated session to the non-root `alain` sudo administrator.
- The Fail2ban SSH jail passed prior accepted verification and the service
  remains active.
- `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` is world-writable. This is a
  separate outbound-client security defect and has interfered with normal
  Git-over-SSH verification; it does not participate in inbound `sshd`
  authentication or invalidate the accepted recovery proof.

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
- The Gate C immutable image is an accepted pre-pilot deployment candidate but
  is not deployed and is not rollback authority for the current live schema.
- The retained Gate D rollback backup is
  `/home/alain/backups/nam/gate-d-20260810T002019Z-9oL76K`. It contains the
  prior Caddy and UFW state defined by the Gate D procedure; automatic rollback
  was not required. It is not an application-data or PostgreSQL backup.

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
| Repository identity | REVALIDATE | Gate D was authorized and executed at `977483f985f26d080ad80d59cfc8c6abed3c122a`; every later readiness or execution task must record its own exact clean synchronized revision. |
| Private network access | PASS | Approved Windows and iPad clients passed tailnet-only HTTPS, health, and Day View checks; current Serve/Funnel state remains coherent with the [Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md). |
| Public exposure removal | PASS | The public NAM Caddy route and public UFW TCP `80`/`443` allowances were removed; independent Windows checks confirmed public HTTP and HTTPS denial. See the [Gate D evidence](gate-d-public-exposure-cutover-evidence.md). |
| Administrator recovery | PASS | Independent Windows public-key recovery to non-root sudo administrator `alain` passed; current server-side state does not contradict the accepted evidence. |
| Immutable deployment candidate | PASS | Gate C accepted the labeled immutable image recorded in the [Gate C evidence](gate-c-immutable-deployment-candidate-evidence.md). |
| Deployment parity | OPEN | The healthy runtime remains at `76cdba9`, Next.js `15.5.19`, and ten contributors. |
| Database migration parity | OPEN | Live has 16 successful migrations; repository has 20. |
| Pre-migration recovery | OPEN | No current 16-migration backup and disposable restore proof exists. |
| Current-schema recovery | NOT YET EXECUTABLE | It follows separately authorized migration and deployment parity. |
| Reference data | OPEN | Aggregate data exists, but required reference sets are incomplete and no suitability review is accepted. |
| Pilot scope and support | OPEN | User, device, data, support, rollback, and exit authorization remain incomplete. |
| Confidential operational use | FAILED | Public exposure is closed, but later deployment, recovery, reference-data, and pilot-scope gates remain open. |

## Approved Ordered Readiness Direction

Each gate requires its own preconditions, evidence, independent review, and
explicit owner authorization. Completion of one does not authorize the next.

### A. Current Documentation And Runbook Authority Re-baseline

**Complete.** Current-state authority was reconciled while preserving
Checkpoint D as historical evidence. Gate A changed documentation authority
only; it did not change deployment or pilot status.

### B. Private Access And Administrator-Recovery Preparation

**Complete.** Approved Windows and iPad devices passed private HTTPS checks,
tailnet MFA/approval/tag/grant evidence was accepted, Funnel remains disabled,
and independent external key-only SSH recovery passed. The declined disposable
device exercises are accepted deferrals, not failures. The world-writable
outbound SSH client fragment remains separately authorized hardening and was
not changed. See the
[Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md).

### C. Immutable Deployment Candidate

**Complete.** The labeled immutable pre-pilot candidate was built and passed
focused dependency, migration, runtime, feature, isolation, and live-state
protection checks. It remains undeployed. See the
[Gate C evidence](gate-c-immutable-deployment-candidate-evidence.md).

### D. Public Exposure Cutover

**Complete.** The cutover executed successfully at
`977483f985f26d080ad80d59cfc8c6abed3c122a`. All prechecks passed, the public
NAM Caddy route and public UFW TCP `80`/`443` allowances were removed, public
SSH remained available, and the loopback application remained healthy.
Independent Windows-client checks proved public HTTP and HTTPS denial and
successful private Tailscale access. The `dev.alemany.me` `A` record for
`217.76.49.214` was then deleted without changing `nam.alemany.me`. See the
[Gate D evidence](gate-d-public-exposure-cutover-evidence.md).

The private rollback backup remains retained, and automatic rollback was not
required. Gate D did not change Docker, PostgreSQL, uploads, application code,
SSH configuration, Tailscale configuration, or DNS through the script. Gate D
completion does not authorize Gate E or any later gate.

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

## Post-Gate D Project Direction

Infrastructure work is paused. Near-term priority returns to developing and
perfecting NAM Dashboard. Additional infrastructure work should occur only
when strictly necessary to unblock development or correct a critical
operational or security problem.

Comprehensive production-style infrastructure hardening and senior security
review are intentionally deferred until the application is substantially
complete. Current access is private and intended only for the sole operator
through the approved Tailscale path. This is not a production deployment, does
not establish production readiness, and does not authorize or assign a new
development phase.

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
