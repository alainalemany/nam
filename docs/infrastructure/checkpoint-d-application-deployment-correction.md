# Checkpoint D Application Deployment Correction

> **Historical Checkpoint D evidence:** This document is bound to application
> revision `76cdba9530e49334e775009a811ae5ae74305c65` and the unchanged
> 16-migration deployment generation. It is not executable authority for
> repository HEAD `4eba24fb97abac61c6511258ad4e97aebd4ea6a2` or for migrations
> 17 through 20. Preserve the identities, commands, and results below as
> historical evidence. Current readiness status and sequencing are governed by
> the [Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).

Within its historical Checkpoint D generation, this runbook was the
authoritative execution procedure. It
replaces only the stale NAM application container with an application image
built from the immutable application-source commit while the repository remains
at the runbook/control commit. It must not migrate, seed, reset, restore, or
otherwise change PostgreSQL, and it must not change any public or private access
control.

The durable pilot requirements remain canonical in the
[Operational Pilot Runbook](operational-pilot-runbook.md). General operations
remain in [Infrastructure Operations](../infrastructure.md), recovery policy
remains in [Server Identity Disaster Recovery](disaster-recovery.md), and the
approved deployment and access architectures remain in
[ADR-008](../decisions/adr-008-docker-compose-deployment-baseline.md) and
[ADR-019](../decisions/adr-019-managed-private-overlay-operational-pilot.md).
The one-time path for the already validated candidate built before the identity
correction is in
[Checkpoint D Existing-Candidate Recovery](checkpoint-d-existing-candidate-recovery.md).
The incident-specific completion path for the sealed D6.4 private Day View
response is in
[Checkpoint D Private Validator Recovery](checkpoint-d-private-validator-recovery.md).

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | Checkpoint D is an application-image-only correction controlled by the operator-supplied exact approved commit containing this final runbook and built from immutable application-source commit `76cdba9530e49334e775009a811ae5ae74305c65`. |
| Confirmed | `MIGRATION_ACTION=NONE`; application-only rollback is safe only while the database remains unchanged. |
| Confirmed | The independently verified V17 Docker tag is the only Checkpoint D application rollback authority. |
| Recommended | Create a PostgreSQL backup immediately before Checkpoint D, but do not make backup execution part of this runbook. |
| Confirmed | A current-schema backup and successful disposable restore remain mandatory under the later Recovery Gate before real pilot authorization. |

## Authority And Stop Rule

Execute D1 through D8 in order. A missing value, unexpected value, failed
command, incomplete external result, or reviewer concern is a failed gate.
Stop immediately. Do not improvise, overwrite an existing tag, rerun a failed
build automatically, change the database, or continue to replacement.

The successful D1-through-D8 path has only these two Docker mutations:

1. D3 builds one new candidate image after explicit operator authorization.
2. D5 replaces only `nam-app` after a second explicit operator authorization.

D7 adds one conditional container mutation when rollback is required. It must
be separately authorized or explicitly pre-authorized and is not database
rollback. No command in this runbook authorizes `sudo`, `docker compose down`,
a PostgreSQL restart, a migration, a standalone image pull, a Compose pull,
image pruning, or cleanup.

The documented procedure uses operator-triggered rollback: a failed D5 or D6
check stops, then the operator invokes D7 under its approval. There is no
hidden automatic rollback in these commands. A future automation layer may not
invoke D7 unless that exact behavior is separately reviewed and
pre-authorized. Database rollback is prohibited in every case.

Run server commands as the unprivileged Docker-authorized operator from:

```text
/home/alain/projects/nam
```

Run the Darnassus commands only on the external approved tailnet client. The
VPS cannot substitute for that gate.

## Fixed Identities

| Item | Required identity |
| --- | --- |
| Branch | `main` |
| Runbook/control commit, local `main`, local `origin/main`, remote `main` | Operator-supplied full SHA of the exact approved commit containing this final runbook; all four repository identities must match it. |
| Immutable application-source commit | `76cdba9530e49334e775009a811ae5ae74305c65` |
| Candidate tag | `nam-app:checkpoint-d-git-76cdba9530e49334e775009a811ae5ae74305c65` |
| Candidate image index | `sha256:c7a00e60735fe8d54e64886226cfeaaec799765efa62028d8b541b3628fa3092` |
| Candidate `linux/amd64` manifest | `sha256:bd1beb1b164945c74a75c2fe289fb150b2a183d26d92b6e1e46a0df9d1a6a780` |
| Candidate image config | `sha256:270cea507f6d073cb8ca3e5ee9b252c7545709e77c9ca80e0cbc914314f5a312` |
| Checkpoint label | `io.nam.checkpoint=checkpoint-d-application-deployment-correction` |
| Old application container | `f500902546bdad63adb180118dab379b630be9618a11f5fe58f0ee63f42495f2` |
| Old application runtime config | `sha256:03d0301ad1ca9bc2060fcb41676e08faa721ea6ef6108a5edc4db742fba211b4` |
| PostgreSQL container | `0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1` |
| PostgreSQL start time | `2026-06-30T18:17:12.705151191Z` |
| PostgreSQL restart count | `0` |
| PostgreSQL volume and destination | `postgres-data` at `/var/lib/postgresql` |
| Docker network and ID | `nam-network`, `e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80` |
| Rollback tag | `nam-app:rollback-runtime-8cba9cb2122f-d3734e4ceddd4809ce573b5d92f64631628f387a60856409447331d8977d4ac1` |
| Rollback image index | `sha256:8cba9cb2122f9010ff815d56056866b7fe910d958f70d3a3bb6ca74d3a82ef95` |
| Rollback `linux/amd64` manifest | `sha256:9245ca496b592eec9fe39011d704e39db76d95e32d95838e685e98de8ae4420b` |
| Rollback image config | `sha256:d3408873dabab192f3b4e8fcedf6834953b0028f68c385d92e7a539bc5789633` |
| V17 artifact directory | `/root/nam-app-rollback/runtime-v17-20260723T182836Z-8cba9cb2122f` |
| V17 archive SHA-256 | `d9fdfce5fc8c9cd3869fb9a75bc91446de9b2102300752c4efa9339426e552f2` |
| V17 independent result | `INDEPENDENT_V17_VERIFICATION=PASS` |

The V17 result is accepted evidence. Do not rerun the verifier during
Checkpoint D. Do not inspect the protected directory if the unprivileged
operator cannot read it; verify the Docker rollback tag and cite the accepted
V17 evidence instead.

## Correction Basis

The approved discovery found application image drift only. Application-source
commit `76cdba9530e49334e775009a811ae5ae74305c65` contains the immutable build
inputs, including commit `3753168`, which added Operational Safety Checklists
and Equipment Fuel Events to Day View without adding a migration.
The final runbook/control commit containing this procedure is documentation-only
and follows the application-source commit. The application build inputs are
unchanged across that range, and documentation is excluded from the Docker
build context by `.dockerignore`. All 16 committed migrations already match
the live database. There is no database migration drift, database-data drift,
reference-data drift, or Compose configuration drift to correct.

## Image Identity Model

Docker exposes several different identities. Record all of them, but compare
only identities from the same layer.

| Layer | Meaning | Checkpoint D use |
| --- | --- | --- |
| Configured image reference | The running container's `.Config.Image`. | Must equal the exact immutable candidate or rollback tag. |
| Image index | The exact-reference Docker image `.Id`; on the accepted Docker Engine 29 containerd-backed store, the running container's `.Image` is this same top-level OCI index digest. | Proves the immutable tag target and running container index. |
| Platform manifest | The running container's `.ImageManifestDescriptor.digest`, with descriptor platform `linux/amd64`. | Proves the runnable host-platform manifest selected from the index. |
| Image config | The selected platform manifest's `.config.digest`. | Proves the accepted candidate or rollback configuration without comparing it to container `.Image`. |
| Container ID | The identity of one container instance. | Proves `nam-app` was replaced and PostgreSQL was not. |

An image reference, image index, platform manifest, image config, and container
ID are distinct identity domains. Never compare container `.Image` directly
with an image config digest. The complete runtime chain is `.Config.Image` to
the immutable tag, `.Image` to the OCI index,
`.ImageManifestDescriptor.digest` to the selected platform manifest, and that
manifest's `.config.digest` to the image config.

The application-source commit and candidate tag are immutable inputs to this
procedure, but the current Dockerfile uses mutable base-image and APT inputs. A
later rebuild from the same application-source commit is therefore not
guaranteed to be byte-for-byte identical. D3 gives the actual candidate an
immutable post-build identity and records every relevant identity layer.
Base-image digest pinning is deferred.

## Gate Summary

| Gate | Result required before continuing |
| --- | --- |
| D1 | Repository at the runbook/control commit, runtime, PostgreSQL, network, volume, rollback, and tag identities match exactly. |
| D2 | All 16 repository and live migrations match; no problem rows exist; `MIGRATION_ACTION=NONE`. |
| D3 | One isolated candidate from the exact application-source commit is built under the fixed tag with required labels. |
| D4 | Candidate identity, runtime properties, Compose rendering, and rollback readiness pass. |
| D5 | Only `nam-app` is recreated and local health passes within 120 seconds. |
| D6 | Local, public, and external private validation pass; PostgreSQL and repository remain unchanged. |
| D7 | Conditional application-only rollback restores the known old application baseline if any trigger occurs. |
| D8 | Complete evidence receives operator and independent reviewer acceptance. |

## Operator Preparation Before D1

Commit and push the approved final runbook before starting Checkpoint D. Obtain
the full resulting commit SHA, then set `RUNBOOK_CONTROL_COMMIT` to that exact
40-character lowercase SHA in the shell that will execute D1 through D8:

```bash
RUNBOOK_CONTROL_COMMIT='<full resulting commit SHA containing this final runbook>'
```

Do not reuse a parent commit, the pre-commit SHA, a short SHA, or a value copied
from an earlier runbook revision. Do not derive or default the value from
`HEAD`. Stop if the supplied value differs from `HEAD`, local `main`, local
`origin/main`, or the freshly read remote `main`.

## D1 — Repository And Runtime Identity

### D1.1 Server Session And Evidence Root

Continue in the shell prepared above and use it for D1 through D8. The
operator-supplied control commit and the immutable assignments below contain
every critical identity; do not substitute shorter SHAs or mutable tags.

```bash
cd /home/alain/projects/nam
```

```bash
set -o pipefail
```

```bash
umask 077
```

Require the operator-supplied control commit without deriving or defaulting it:

```bash
: "${RUNBOOK_CONTROL_COMMIT:?Set RUNBOOK_CONTROL_COMMIT to the exact approved committed runbook SHA before D1}"
```

Validate the full lowercase SHA before exporting and freezing it:

```bash
nam_d_validate_and_freeze_runbook_control_commit() {
  if [[ ! "$RUNBOOK_CONTROL_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
    printf '%s\n' \
      'D1 FAIL: RUNBOOK_CONTROL_COMMIT must be exactly 40 lowercase hexadecimal characters' \
      >&2
    return 1
  fi
  export RUNBOOK_CONTROL_COMMIT
  readonly RUNBOOK_CONTROL_COMMIT
}
nam_d_validate_and_freeze_runbook_control_commit
```

```bash
export APPLICATION_SOURCE_COMMIT='76cdba9530e49334e775009a811ae5ae74305c65'
```

```bash
export NAM_D_CANDIDATE='nam-app:checkpoint-d-git-76cdba9530e49334e775009a811ae5ae74305c65'
```

```bash
export NAM_D_CHECKPOINT='checkpoint-d-application-deployment-correction'
```

```bash
export NAM_D_ROLLBACK='nam-app:rollback-runtime-8cba9cb2122f-d3734e4ceddd4809ce573b5d92f64631628f387a60856409447331d8977d4ac1'
```

```bash
export NAM_D_ROLLBACK_INDEX='sha256:8cba9cb2122f9010ff815d56056866b7fe910d958f70d3a3bb6ca74d3a82ef95'
```

Create a private, identity-bearing execution directory outside the repository.
It contains the later isolated build context and evidence. Never delete it as
part of Checkpoint D, including after a failed build or rollback.

```bash
readonly NAM_D_EXECUTION_PARENT='/home/alain/nam-deployment-evidence'
mkdir -p "$NAM_D_EXECUTION_PARENT"
```

```bash
nam_d_validate_execution_parent() {
  [[ -d "$NAM_D_EXECUTION_PARENT" ]] || return 1
  [[ ! -L "$NAM_D_EXECUTION_PARENT" ]] || return 1
  [[ "$(realpath -e -- "$NAM_D_EXECUTION_PARENT")" == \
    "$NAM_D_EXECUTION_PARENT" ]] || return 1
  [[ "$(stat -Lc '%u' "$NAM_D_EXECUTION_PARENT")" == "$(id -u)" ]] \
    || return 1
  [[ "$(stat -Lc '%a' "$NAM_D_EXECUTION_PARENT")" == '700' ]] \
    || return 1
}
nam_d_validate_execution_parent
```

```bash
NAM_D_EXECUTION_ROOT="$(mktemp -d -- "$NAM_D_EXECUTION_PARENT/checkpoint-d-76cdba9530e4-XXXXXXXX")"
NAM_D_MKTEMP_STATUS=$?
test "$NAM_D_MKTEMP_STATUS" -eq 0
```

```bash
nam_d_validate_execution_root() {
  [[ -n "$NAM_D_EXECUTION_ROOT" ]] || return 1
  [[ "$NAM_D_EXECUTION_ROOT" == /* ]] || return 1
  [[ "$(dirname -- "$NAM_D_EXECUTION_ROOT")" == \
    "$NAM_D_EXECUTION_PARENT" ]] || return 1
  [[ "$(basename -- "$NAM_D_EXECUTION_ROOT")" =~ \
    ^checkpoint-d-76cdba9530e4-[A-Za-z0-9]{8}$ ]] || return 1
  [[ -d "$NAM_D_EXECUTION_ROOT" ]] || return 1
  [[ ! -L "$NAM_D_EXECUTION_ROOT" ]] || return 1
  [[ "$(realpath -e -- "$NAM_D_EXECUTION_ROOT")" == \
    "$NAM_D_EXECUTION_ROOT" ]] || return 1
  [[ "$(stat -Lc '%u' "$NAM_D_EXECUTION_ROOT")" == "$(id -u)" ]] \
    || return 1
  [[ "$(stat -Lc '%a' "$NAM_D_EXECUTION_ROOT")" == '700' ]] \
    || return 1
}
nam_d_validate_execution_root
```

```bash
NAM_D_EXECUTION_ROOT_IDENTITY="$(stat -Lc '%d:%i' "$NAM_D_EXECUTION_ROOT")"
[[ "$NAM_D_EXECUTION_ROOT_IDENTITY" =~ ^[0-9]+:[0-9]+$ ]] \
  && export NAM_D_EXECUTION_ROOT NAM_D_EXECUTION_ROOT_IDENTITY
```

Only after all root checks pass, create derivative paths and evidence:

```bash
mkdir -m 0700 "$NAM_D_EXECUTION_ROOT/evidence"
nam_d_validate_evidence_directory() {
  [[ -d "$NAM_D_EXECUTION_ROOT/evidence" ]] || return 1
  [[ ! -L "$NAM_D_EXECUTION_ROOT/evidence" ]] || return 1
  [[ "$(stat -Lc '%u' "$NAM_D_EXECUTION_ROOT/evidence")" == "$(id -u)" ]] \
    || return 1
  [[ "$(stat -Lc '%a' "$NAM_D_EXECUTION_ROOT/evidence")" == '700' ]] \
    || return 1
}
nam_d_validate_evidence_directory
```

```bash
printf 'execution_root=%s\ndevice_inode=%s\n' \
  "$NAM_D_EXECUTION_ROOT" "$NAM_D_EXECUTION_ROOT_IDENTITY" \
  | tee "$NAM_D_EXECUTION_ROOT/evidence/execution-root.txt"
```

```bash
date -u +%Y-%m-%dT%H:%M:%SZ \
  | tee "$NAM_D_EXECUTION_ROOT/evidence/d1-started-at-utc.txt"
```

Record the operator-supplied control commit, immutable application-source
commit, and immutable candidate tag together:

```bash
printf 'RUNBOOK_CONTROL_COMMIT=%s\nAPPLICATION_SOURCE_COMMIT=%s\nNAM_D_CANDIDATE=%s\n' \
  "$RUNBOOK_CONTROL_COMMIT" "$APPLICATION_SOURCE_COMMIT" "$NAM_D_CANDIDATE" \
  | tee "$NAM_D_EXECUTION_ROOT/evidence/d1-fixed-identities.txt"
```

Expected: one newly created path beginning with
`/home/alain/nam-deployment-evidence/checkpoint-d-76cdba9530e4-`. If creation
fails, its status is nonzero, its path is empty or non-absolute, its exact
parent or prefix differs, it is a symlink, its canonical path differs, it is
not a real current-user-owned `0700` directory, or its device/inode identity
cannot be recorded, stop. Do not export the root or create any derivative path
before these checks pass. Do not clean a failed execution root automatically.

Require the read-only inspection and build interfaces used later:

```bash
command -v git docker curl jq sha256sum tar awk sed python3 \
  realpath stat id dirname basename >/dev/null
```

```bash
docker compose -p nam -f compose.yaml version
```

```bash
docker buildx version
```

If any interface is unavailable, stop before D2. Do not install a package or
change Docker configuration inside Checkpoint D.

### D1.2 Repository Identity

Each command must return the stated exact result.

```bash
git symbolic-ref --quiet --short HEAD
```

Expected: `main`.

```bash
test "$(git rev-parse --verify HEAD)" = "$RUNBOOK_CONTROL_COMMIT"
```

```bash
test "$(git rev-parse --verify refs/heads/main)" = "$RUNBOOK_CONTROL_COMMIT"
```

```bash
test "$(git rev-parse --verify refs/remotes/origin/main)" = "$RUNBOOK_CONTROL_COMMIT"
```

Each command must equal the validated and frozen operator-supplied full
runbook/control SHA.

Read remote `main` without fetching or modifying Git state:

```bash
export NAM_D_REMOTE_MAIN="$(git ls-remote --exit-code origin refs/heads/main | awk '{print $1}')"
```

```bash
test "$NAM_D_REMOTE_MAIN" = "$RUNBOOK_CONTROL_COMMIT"
```

This reads remote `main` without fetching or changing local Git state.

Verify every clean-state dimension:

```bash
git diff --quiet HEAD --
```

```bash
git diff --cached --quiet --
```

```bash
git diff --quiet --
```

```bash
git ls-files --others --exclude-standard
```

The first three commands must exit zero. The last command must print nothing.
Record a human-readable summary:

```bash
git status -sb | tee "$NAM_D_EXECUTION_ROOT/evidence/d1-git-status.txt"
```

Expected: `## main...origin/main`, with no other line. Any tracked, staged,
unstaged, or untracked path is a stop condition.

### D1.3 Application Baseline

These commands are read-only Docker inspection. They do not authorize a
container change.

```bash
test "$(docker inspect nam-app --format '{{.Id}}')" = 'f500902546bdad63adb180118dab379b630be9618a11f5fe58f0ee63f42495f2'
```

The accepted historical D1 evidence records original application config
`sha256:03d0301ad1ca9bc2060fcb41676e08faa721ea6ef6108a5edc4db742fba211b4`.
Do not attempt to reconfirm that config by comparing it with container
`.Image`; that field is the OCI index domain on the deployed Docker Engine.

```bash
test "$(docker inspect nam-app --format '{{.State.StartedAt}}')" = '2026-07-17T00:18:15.904984177Z'
```

```bash
test "$(docker inspect nam-app --format '{{.RestartCount}}')" = '0'
```

```bash
test "$(docker inspect nam-app --format '{{.State.Status}}')" = 'running'
```

```bash
test "$(docker inspect nam-app --format '{{json .Config.Healthcheck}}')" = 'null'
```

```bash
test "$(docker inspect nam-app --format '{{len .Mounts}}')" = '0'
```

```bash
test "$(docker port nam-app 3000/tcp)" = '127.0.0.1:3000'
```

```bash
test "$(docker inspect nam-app --format '{{json .NetworkSettings.Ports}}')" = '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3000"}]}'
```

Any nonzero result is a stop condition. The application has no Docker
healthcheck; `/api/health` is the bounded local readiness signal used later.

### D1.4 PostgreSQL, Volume, And Network Baseline

Every test below must exit zero.

```bash
test "$(docker inspect nam-postgres --format '{{.Id}}')" = '0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1'
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.StartedAt}}')" = '2026-06-30T18:17:12.705151191Z'
```

```bash
test "$(docker inspect nam-postgres --format '{{.RestartCount}}')" = '0'
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.Status}}|{{.State.Health.Status}}')" = 'running|healthy'
```

```bash
test "$(docker inspect nam-postgres --format '{{len .Mounts}}')" = '1'
```

```bash
test "$(docker inspect nam-postgres --format '{{(index .Mounts 0).Name}}|{{(index .Mounts 0).Destination}}')" = 'postgres-data|/var/lib/postgresql'
```

```bash
test "$(docker volume inspect postgres-data --format '{{.Name}}')" = 'postgres-data'
```

```bash
test "$(docker network inspect nam-network --format '{{.Id}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker inspect nam-postgres --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker inspect nam-app --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}')" = '{"5432/tcp":null}'
```

PostgreSQL must be healthy, attached to the exact named volume and network, and
unpublished. Do not continue if any identity differs even when the database
appears reachable.

### D1.5 Compose Project, Rollback, And Candidate State

```bash
test "$(docker ps -a --filter label=com.docker.compose.project=nam --format '{{.Names}}' | sort)" = $'nam-app\nnam-postgres'
```

```bash
test "$(docker compose -p nam -f compose.yaml ps -a --services | sort)" = $'app\npostgres'
```

```bash
docker compose -p nam -f compose.yaml config --no-interpolate --format json \
  > "$NAM_D_EXECUTION_ROOT/evidence/d1-compose-model.json"
```

```bash
jq -e '.name == "nam" and (.services | keys | sort) == ["app","postgres"]' \
  "$NAM_D_EXECUTION_ROOT/evidence/d1-compose-model.json" >/dev/null
```

```bash
test "$(docker image inspect "$NAM_D_ROLLBACK" --format '{{.Id}}')" = "$NAM_D_ROLLBACK_INDEX"
```

The candidate tag must not exist. Query the exact repository/tag reference and
check the Docker command status separately from its output:

```bash
nam_d_require_candidate_absent() {
  local gate=$1
  local evidence_file=$2
  local query_output=''
  local query_status=0
  local total_count
  local exact_count

  query_output="$(docker image ls \
    --filter "reference=$NAM_D_CANDIDATE" \
    --format '{{.Repository}}:{{.Tag}}')" \
    || query_status=$?
  if [[ "$query_status" -ne 0 ]]; then
    printf '%s FAIL: exact candidate query failed with status %s\n' \
      "$gate" "$query_status" >&2
    return 1
  fi
  printf '%s' "$query_output" > "$evidence_file" || return 1
  total_count="$(awk 'NF { count++ } END { print count + 0 }' \
    "$evidence_file")" || return 1
  exact_count="$(awk -v candidate="$NAM_D_CANDIDATE" \
    '$0 == candidate { count++ } END { print count + 0 }' \
    "$evidence_file")" || return 1
  if [[ "$total_count" != "$exact_count" ]]; then
    printf '%s FAIL: exact-reference query returned an unexpected reference\n' \
      "$gate" >&2
    return 1
  fi
  if [[ "$exact_count" != '0' ]]; then
    printf '%s FAIL: candidate collision: %s exact match(es) for %s\n' \
      "$gate" "$exact_count" "$NAM_D_CANDIDATE" >&2
    return 1
  fi
  printf '%s candidate tag absence: PASS - exact_matches=0\n' "$gate"
}
nam_d_require_candidate_absent D1 \
  "$NAM_D_EXECUTION_ROOT/evidence/d1-candidate-query.txt"
```

Expected Compose containers are exactly `nam-app` and `nam-postgres`. Do not
create a new rollback tag. Do not retag, overwrite, load, import, or otherwise
alter the verified rollback tag. Do not load the offline archive while that tag
is available. A Docker query failure is a failed gate, never evidence of
absence. One or more exact candidate matches is a collision and a failed gate;
image removal is not a Checkpoint D remedy.

Record the accepted V17 authority without accessing or modifying its protected
files:

```bash
printf '%s\n' 'rollback_tag=nam-app:rollback-runtime-8cba9cb2122f-d3734e4ceddd4809ce573b5d92f64631628f387a60856409447331d8977d4ac1' 'rollback_index=sha256:8cba9cb2122f9010ff815d56056866b7fe910d958f70d3a3bb6ca74d3a82ef95' 'artifact_directory=/root/nam-app-rollback/runtime-v17-20260723T182836Z-8cba9cb2122f' 'archive_sha256=d9fdfce5fc8c9cd3869fb9a75bc91446de9b2102300752c4efa9339426e552f2' 'independent_result=INDEPENDENT_V17_VERIFICATION=PASS' | tee "$NAM_D_EXECUTION_ROOT/evidence/d1-v17-authority.txt"
```

D1 passes only after a reviewer confirms every exact result.

## D2 — Migration Compatibility And Database Boundary

D2 is a read-only parity inspection performed before any candidate build or
replacement. It uses the PostgreSQL container's existing environment
internally and prints no credential or environment value.

Confirm health again:

```bash
test "$(docker inspect nam-postgres --format '{{.State.Status}}|{{.State.Health.Status}}')" = 'running|healthy'
```

Create the exact repository inventory:

```bash
find prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -print | sort | while IFS= read -r migration_file; do migration_name="${migration_file%/migration.sql}"; migration_name="${migration_name##*/}"; migration_checksum="$(sha256sum "$migration_file" | awk '{print $1}')"; printf '%s|%s\n' "$migration_name" "$migration_checksum"; done | tee "$NAM_D_EXECUTION_ROOT/evidence/d2-repository-migrations.txt"
```

```bash
test "$(wc -l < "$NAM_D_EXECUTION_ROOT/evidence/d2-repository-migrations.txt")" = '16'
```

Read the completed live migration names and checksums in a read-only
transaction:

```bash
docker compose -p nam -f compose.yaml exec -T postgres \
  sh -c 'exec psql -X -Atq -F "|" -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL' | tr -d '\r' | tee "$NAM_D_EXECUTION_ROOT/evidence/d2-live-migrations.txt"
BEGIN TRANSACTION READ ONLY;
SELECT migration_name, checksum
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY migration_name;
COMMIT;
SQL
```

```bash
test "$(wc -l < "$NAM_D_EXECUTION_ROOT/evidence/d2-live-migrations.txt")" = '16'
```

```bash
diff -u "$NAM_D_EXECUTION_ROOT/evidence/d2-repository-migrations.txt" "$NAM_D_EXECUTION_ROOT/evidence/d2-live-migrations.txt"
```

Expected: no diff.

Require zero failed, unfinished, or rolled-back rows:

```bash
docker compose -p nam -f compose.yaml exec -T postgres \
  sh -c 'exec psql -X -Atq -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL' | tr -d '\r' | tee "$NAM_D_EXECUTION_ROOT/evidence/d2-problem-migration-count.txt"
BEGIN TRANSACTION READ ONLY;
SELECT count(*)
FROM "_prisma_migrations"
WHERE finished_at IS NULL
   OR rolled_back_at IS NOT NULL;
COMMIT;
SQL
```

```bash
test "$(cat "$NAM_D_EXECUTION_ROOT/evidence/d2-problem-migration-count.txt")" = '0'
```

Make and record the only permitted migration decision:

```bash
readonly NAM_D_MIGRATION_ACTION='NONE'
```

```bash
printf 'MIGRATION_ACTION=%s\n' "$NAM_D_MIGRATION_ACTION" | tee "$NAM_D_EXECUTION_ROOT/evidence/d2-migration-action.txt"
```

Expected: `MIGRATION_ACTION=NONE`.

Checkpoint D must not run Prisma migration commands, `db push`, reset, seed,
manual SQL mutation, or any other database write. Do not infer parity merely
from repository files: the two exact 16-row inventories and zero problem rows
are required evidence.

### Backup And Rollback Boundary

A new PostgreSQL backup immediately before Checkpoint D is **RECOMMENDED**, not
mandatory, because the approved correction has no schema or data change and
application-only rollback remains compatible with the current schema. Backup
execution is outside this runbook.

A current-schema archive and successful disposable restore are **REQUIRED**
later under the Operational Pilot Runbook Recovery Gate before real pilot
authorization. Database rollback is not part of Checkpoint D. If
`MIGRATION_ACTION` cannot remain `NONE`, stop Checkpoint D and perform a new
migration-compatibility and database-backup design review.

## D3 — Candidate Image Build

D3 is the first Docker mutation. `docker buildx build` changes Docker image
state and requires explicit operator authorization after D1 and D2 receive
reviewer approval. It does not authorize D5.

### D3.1 Exact Isolated Build Context

Define paths inside the identity-tracked execution root:

```bash
export NAM_D_BUILD_CONTEXT="$NAM_D_EXECUTION_ROOT/build-context"
```

```bash
export NAM_D_SOURCE_ARCHIVE="$NAM_D_EXECUTION_ROOT/source-$APPLICATION_SOURCE_COMMIT.tar"
```

```bash
mkdir -m 0700 "$NAM_D_BUILD_CONTEXT"
```

Export the exact Git object, not the changing working directory:

```bash
git archive --format=tar --output="$NAM_D_SOURCE_ARCHIVE" "$APPLICATION_SOURCE_COMMIT"
```

```bash
sha256sum "$NAM_D_SOURCE_ARCHIVE" | tee "$NAM_D_EXECUTION_ROOT/evidence/d3-source-archive.sha256"
```

```bash
tar -xf "$NAM_D_SOURCE_ARCHIVE" -C "$NAM_D_BUILD_CONTEXT"
```

Require the build-critical files:

```bash
nam_d_require_build_files() {
  local required_file
  local required_path
  for required_file in \
    Dockerfile .dockerignore package.json pnpm-lock.yaml pnpm-workspace.yaml \
    next.config.ts tsconfig.json next-env.d.ts prisma/schema.prisma \
    src/app/day-view/page.tsx
  do
    required_path="$NAM_D_BUILD_CONTEXT/$required_file"
    if [[ ! -f "$required_path" || -L "$required_path" ]]; then
      printf 'D3 FAIL: critical build file is missing, not regular, or a symlink: %s\n' \
        "$required_file" >&2
      return 1
    fi
  done
}
nam_d_require_build_files
```

```bash
test "$(find "$NAM_D_BUILD_CONTEXT/prisma/migrations" \
  -mindepth 2 -maxdepth 2 -type f ! -type l -name migration.sql \
  | wc -l)" = '16'
```

Require the two correction contributors in the exported source:

```bash
test "$(grep -Fc '<h2 id="safety-checklists-heading">Operational Safety Checklists</h2>' "$NAM_D_BUILD_CONTEXT/src/app/day-view/page.tsx")" = '1'
```

```bash
test "$(grep -Fc '<h2 id="equipment-fuel-events-heading">Equipment Fuel Events</h2>' "$NAM_D_BUILD_CONTEXT/src/app/day-view/page.tsx")" = '1'
```

Reject tracked environment or private-key inputs other than the placeholder-only
`.env.example`. Also reject database exports, backup payloads, rollback
material, Git metadata, and archive payloads. Committed Prisma migration SQL
and the placeholder-only backup `.gitkeep` are the only relevant exceptions.
Capture the Git command result before filtering so a Git failure cannot become
a false zero-match result:

```bash
nam_d_capture_git_tree() {
  local tree_output=''
  local tree_status=0
  tree_output="$(git ls-tree -r --name-only "$APPLICATION_SOURCE_COMMIT")" \
    || tree_status=$?
  if [[ "$tree_status" -ne 0 ]]; then
    printf 'D3 FAIL: git ls-tree failed with status %s\n' \
      "$tree_status" >&2
    return 1
  fi
  printf '%s\n' "$tree_output" \
    > "$NAM_D_EXECUTION_ROOT/evidence/d3-git-tree-paths.txt"
}
nam_d_capture_git_tree
```

```bash
awk '
  {
    path = $0
    lower = tolower(path)
    prohibited = 0

    if (path != ".env.example" \
        && lower ~ /(^|\/)\.env($|\.)/) prohibited = 1
    if (lower ~ /(^|\/)\.git($|\/)/) prohibited = 1
    if (lower ~ /(^|\/)(rollback|rollback-evidence|deployment-evidence)($|\/)/) prohibited = 1
    if (lower ~ /(^|\/)backups?($|\/)/ \
        && lower !~ /\/backups\/\.gitkeep$/) prohibited = 1
    if (lower ~ /\.(pem|key|p12|pfx|dump|backup|bak|pgdump|tar|tgz|zip|gz)$/) prohibited = 1
    if (lower ~ /\.sql$/ \
        && lower !~ /^prisma\/migrations\/[^/]+\/migration\.sql$/) prohibited = 1

    if (prohibited) print path
  }
' "$NAM_D_EXECUTION_ROOT/evidence/d3-git-tree-paths.txt" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d3-prohibited-build-paths.txt"
NAM_D_PROHIBITED_SCAN_STATUS=$?
test "$NAM_D_PROHIBITED_SCAN_STATUS" -eq 0 \
  && test ! -s "$NAM_D_EXECUTION_ROOT/evidence/d3-prohibited-build-paths.txt"
```

The build context comes only from the pinned application-source commit. Do not
copy the live `.env`, rollback files, backup payloads, or evidence into it.

### D3.2 Authorization And Build

Immediately repeat the candidate-absence guard:

```bash
nam_d_require_candidate_absent D3 \
  "$NAM_D_EXECUTION_ROOT/evidence/d3-candidate-query.txt"
```

Record one UTC creation time:

```bash
nam_d_capture_created() {
  local created_value=''
  local created_status=0
  created_value="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    || created_status=$?
  if [[ "$created_status" -ne 0 ]]; then
    printf 'D3 FAIL: UTC creation timestamp command failed with status %s\n' \
      "$created_status" >&2
    return 1
  fi
  if [[ -z "$created_value" \
      || ! "$created_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]
  then
    printf 'D3 FAIL: UTC creation timestamp is empty or malformed\n' >&2
    return 1
  fi
  NAM_D_CREATED=$created_value
  export NAM_D_CREATED
}
nam_d_capture_created
```

```bash
printf '%s\n' "$NAM_D_CREATED" | tee "$NAM_D_EXECUTION_ROOT/evidence/d3-created.txt"
```

Any exact-reference query failure is a failed gate. One or more exact matches
is a collision. Do not remove an image, overwrite the tag, or use a different
candidate reference as a remedy. The creation value must be the single
nonempty UTC timestamp produced successfully above; the exact revision,
creation, and Checkpoint D labels below all use these validated values.

**Approval point:** the operator and reviewer must now authorize exactly the
following one image-build command. It must not be run before authorization.

```bash
docker buildx build --platform linux/amd64 --provenance=mode=min --load --progress=plain --metadata-file "$NAM_D_EXECUTION_ROOT/evidence/d3-build-metadata.json" --label "org.opencontainers.image.revision=$APPLICATION_SOURCE_COMMIT" --label "org.opencontainers.image.created=$NAM_D_CREATED" --label "io.nam.checkpoint=$NAM_D_CHECKPOINT" --tag "$NAM_D_CANDIDATE" "$NAM_D_BUILD_CONTEXT" 2>&1 | tee "$NAM_D_EXECUTION_ROOT/evidence/d3-build.log"
```

This command does not use `latest`, the implicit `nam-app` tag, or the rollback
tag. It does not contact PostgreSQL and does not change a running container.
It may resolve mutable base-image or APT inputs as part of the build, which is
why D4 records the resulting identities rather than claiming reproducible
bytes. No standalone image pull or Compose pull is authorized.

If the command fails, stop. Preserve the execution root, source archive, build
context, build log, metadata, and any candidate image state. Do not clean,
overwrite, retag, or automatically rerun the build.

## D4 — Candidate Inspection And Rollback Readiness

D4 is read-only inspection of the built candidate and existing Compose model.
No application replacement is authorized yet.

### D4.1 Candidate Identity Layers

Capture the top-level image/index identity and resolved platform-manifest
identity:

```bash
export NAM_D_INDEX_ID="$(docker image inspect "$NAM_D_CANDIDATE" --format '{{.Id}}')"
```

```bash
export NAM_D_INDEX_MEDIA_TYPE="$(docker image inspect "$NAM_D_CANDIDATE" --format '{{.Descriptor.MediaType}}')"
```

```bash
export NAM_D_PLATFORM_MANIFEST_ID="$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{.Id}}')"
```

Export the image without changing Docker state, then read the selected
manifest's configuration descriptor. This is a narrow descriptor read, not a
second OCI graph verifier:

```bash
export NAM_D_CANDIDATE_OCI_ARCHIVE="$NAM_D_EXECUTION_ROOT/evidence/d4-candidate-oci.tar"
test ! -e "$NAM_D_CANDIDATE_OCI_ARCHIVE"
docker image save "$NAM_D_CANDIDATE" | tee "$NAM_D_CANDIDATE_OCI_ARCHIVE" >/dev/null
chmod 0600 "$NAM_D_CANDIDATE_OCI_ARCHIVE"
```

```bash
export NAM_D_CONFIG_ID="$(
  tar -xOf "$NAM_D_CANDIDATE_OCI_ARCHIVE" \
    "blobs/sha256/${NAM_D_PLATFORM_MANIFEST_ID#sha256:}" \
    | jq -er '.config.digest'
)"
```

Require valid immutable digests:

```bash
[[ "$NAM_D_INDEX_ID" =~ ^sha256:[0-9a-f]{64}$ ]]
```

```bash
[[ "$NAM_D_PLATFORM_MANIFEST_ID" =~ ^sha256:[0-9a-f]{64}$ ]]
```

```bash
[[ "$NAM_D_CONFIG_ID" =~ ^sha256:[0-9a-f]{64}$ ]]
```

For this incident-specific candidate, require every observed digest to equal
its independently accepted fixed value. The exact-reference `.Id` is the OCI
index, the platform-selected `.Id` is the `linux/amd64` manifest, and the
selected manifest's `.config.digest` is the runtime configuration:

```bash
test "$NAM_D_INDEX_ID" = \
  'sha256:c7a00e60735fe8d54e64886226cfeaaec799765efa62028d8b541b3628fa3092'
```

```bash
test "$NAM_D_PLATFORM_MANIFEST_ID" = \
  'sha256:bd1beb1b164945c74a75c2fe289fb150b2a183d26d92b6e1e46a0df9d1a6a780'
```

```bash
test "$NAM_D_CONFIG_ID" = \
  'sha256:270cea507f6d073cb8ca3e5ee9b252c7545709e77c9ca80e0cbc914314f5a312'
```

Require a multi-platform index media type:

```bash
case "$NAM_D_INDEX_MEDIA_TYPE" in application/vnd.oci.image.index.v1+json|application/vnd.docker.distribution.manifest.list.v2+json) true ;; *) printf 'D4 FAIL: candidate tag does not resolve to an image index: %s\n' "$NAM_D_INDEX_MEDIA_TYPE" >&2; false ;; esac
```

Require the BuildKit result digest and cross-check it against the index:

```bash
test "$(jq -er '."containerimage.digest"' "$NAM_D_EXECUTION_ROOT/evidence/d3-build-metadata.json")" = "$NAM_D_INDEX_ID"
```

```bash
export NAM_D_BUILDX_CONFIG_ID="$(jq -r '."containerimage.config.digest" // empty' "$NAM_D_EXECUTION_ROOT/evidence/d3-build-metadata.json")"
if [[ -n "$NAM_D_BUILDX_CONFIG_ID" ]]; then
  [[ "$NAM_D_BUILDX_CONFIG_ID" =~ ^sha256:[0-9a-f]{64}$ ]]
  test "$NAM_D_BUILDX_CONFIG_ID" = "$NAM_D_CONFIG_ID"
fi
```

`containerimage.config.digest` is optional. When present, it must match the
manifest-derived configuration digest; its absence does not invalidate a valid
OCI index result. Do not compare the index, platform manifest, and config to
each other. Record them with explicit layer names:

```bash
printf 'candidate_tag=%s\nimage_index=%s\nindex_media_type=%s\nlinux_amd64_platform_manifest=%s\nlinux_amd64_runtime_config=%s\n' "$NAM_D_CANDIDATE" "$NAM_D_INDEX_ID" "$NAM_D_INDEX_MEDIA_TYPE" "$NAM_D_PLATFORM_MANIFEST_ID" "$NAM_D_CONFIG_ID" | tee "$NAM_D_EXECUTION_ROOT/evidence/d4-candidate-identities.txt"
```

### D4.2 Candidate Labels And Runtime Model

Each command must exit zero:

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$APPLICATION_SOURCE_COMMIT"
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{index .Config.Labels "org.opencontainers.image.created"}}')" = "$NAM_D_CREATED"
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{index .Config.Labels "io.nam.checkpoint"}}')" = "$NAM_D_CHECKPOINT"
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{.Os}}/{{.Architecture}}')" = 'linux/amd64'
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{.Config.User}}')" = 'nextjs'
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{.Config.WorkingDir}}')" = '/app'
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{json .Config.Cmd}}')" = '["node","server.js"]'
```

```bash
test "$(docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{json .Config.ExposedPorts}}')" = '{"3000/tcp":{}}'
```

`EXPOSE 3000` is image metadata, not host publication. Host publication is
controlled by Compose and must remain `127.0.0.1:3000:3000`.

Inspect environment **names only** and compare them to the exact expected
allowlist:

```bash
printf '%s\n' HOSTNAME NEXT_TELEMETRY_DISABLED NODE_ENV NODE_VERSION PATH PNPM_HOME PORT YARN_VERSION | sort > "$NAM_D_EXECUTION_ROOT/evidence/d4-expected-image-env-names.txt"
```

```bash
docker image inspect --platform linux/amd64 "$NAM_D_CANDIDATE" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed 's/=.*//' | sort | tee "$NAM_D_EXECUTION_ROOT/evidence/d4-actual-image-env-names.txt"
```

```bash
diff -u "$NAM_D_EXECUTION_ROOT/evidence/d4-expected-image-env-names.txt" "$NAM_D_EXECUTION_ROOT/evidence/d4-actual-image-env-names.txt"
```

Expected: no diff. Do not print environment values. The exact
application-source context, placeholder-only `.env.example`, absence of build
secret arguments, and exact environment-name allowlist are the embedded-secret
boundary. Any unexpected credential, database URL, password, token, private
key, or secret name is a stop condition.

### D4.3 Candidate Compose Override

Create a private temporary override containing only the candidate image
selection:

```bash
export NAM_D_CANDIDATE_OVERRIDE="$NAM_D_EXECUTION_ROOT/checkpoint-d-candidate.compose.yaml"
```

```bash
printf '%s\n' 'services:' '  app:' "    image: $NAM_D_CANDIDATE" > "$NAM_D_CANDIDATE_OVERRIDE"
```

```bash
chmod 0600 "$NAM_D_CANDIDATE_OVERRIDE"
```

```bash
sha256sum "$NAM_D_CANDIDATE_OVERRIDE" | tee "$NAM_D_EXECUTION_ROOT/evidence/d4-candidate-override.sha256"
```

Render the approved base and candidate models using the explicit project and
base file. Keep the models in the private evidence directory so environment
values are not printed:

```bash
docker compose -p nam -f compose.yaml \
  config --no-interpolate --format json \
  > "$NAM_D_EXECUTION_ROOT/evidence/d4-base-compose-model.json"
```

```bash
docker compose -p nam -f compose.yaml -f "$NAM_D_CANDIDATE_OVERRIDE" \
  config --no-interpolate --format json \
  > "$NAM_D_EXECUTION_ROOT/evidence/d4-candidate-compose-model.json"
```

Validate the exact project name, exact service inventory, immutable candidate
selection, loopback-only application publishing, unchanged PostgreSQL service,
and unpublished PostgreSQL port:

```bash
jq -e -s --arg candidate "$NAM_D_CANDIDATE" '
  .[0].name == "nam"
  and .[1].name == "nam"
  and (.[0].services | keys | sort) == ["app","postgres"]
  and (.[1].services | keys | sort) == ["app","postgres"]
  and .[1].services.app.image == $candidate
  and (.[1].services.app.ports | length) == 1
  and .[1].services.app.ports[0].host_ip == "127.0.0.1"
  and (.[1].services.app.ports[0].published | tostring) == "3000"
  and .[1].services.app.ports[0].target == 3000
  and (.[1].services.app.ports[0].protocol // "tcp") == "tcp"
  and .[0].services.postgres == .[1].services.postgres
  and ((.[1].services.postgres.ports // []) | length) == 0
' "$NAM_D_EXECUTION_ROOT/evidence/d4-base-compose-model.json" \
  "$NAM_D_EXECUTION_ROOT/evidence/d4-candidate-compose-model.json" >/dev/null
```

The base `build:` entry remains rendered, but D5 uses `--no-build` and
`--pull never`; only the explicit immutable `image:` selection is deployment
authority.

### D4.4 Rollback Readiness

Recheck the accepted rollback index:

```bash
test "$(docker image inspect "$NAM_D_ROLLBACK" --format '{{.Id}}')" = "$NAM_D_ROLLBACK_INDEX"
```

Capture the rollback platform manifest and config without requiring them to
equal the rollback index:

```bash
export NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID="$(docker image inspect --platform linux/amd64 "$NAM_D_ROLLBACK" --format '{{.Descriptor.Digest}}')"
```

```bash
export NAM_D_ROLLBACK_OCI_ARCHIVE="$NAM_D_EXECUTION_ROOT/evidence/d4-rollback-oci.tar"
test ! -e "$NAM_D_ROLLBACK_OCI_ARCHIVE"
docker image save "$NAM_D_ROLLBACK" | tee "$NAM_D_ROLLBACK_OCI_ARCHIVE" >/dev/null
chmod 0600 "$NAM_D_ROLLBACK_OCI_ARCHIVE"
```

```bash
export NAM_D_ROLLBACK_CONFIG_ID="$(
  tar -xOf "$NAM_D_ROLLBACK_OCI_ARCHIVE" \
    "blobs/sha256/${NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID#sha256:}" \
    | jq -er '.config.digest'
)"
```

```bash
[[ "$NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID" =~ ^sha256:[0-9a-f]{64}$ && "$NAM_D_ROLLBACK_CONFIG_ID" =~ ^sha256:[0-9a-f]{64}$ ]]
```

Prepare the rollback override before D5:

```bash
export NAM_D_ROLLBACK_OVERRIDE="$NAM_D_EXECUTION_ROOT/checkpoint-d-rollback.compose.yaml"
```

```bash
printf '%s\n' 'services:' '  app:' "    image: $NAM_D_ROLLBACK" > "$NAM_D_ROLLBACK_OVERRIDE"
```

```bash
chmod 0600 "$NAM_D_ROLLBACK_OVERRIDE"
```

```bash
sha256sum "$NAM_D_ROLLBACK_OVERRIDE" | tee "$NAM_D_EXECUTION_ROOT/evidence/d4-rollback-override.sha256"
```

```bash
docker compose -p nam -f compose.yaml -f "$NAM_D_ROLLBACK_OVERRIDE" \
  config --no-interpolate --format json \
  > "$NAM_D_EXECUTION_ROOT/evidence/d4-rollback-compose-model.json"
```

```bash
jq -e -s --arg rollback "$NAM_D_ROLLBACK" '
  .[0].name == "nam"
  and .[1].name == "nam"
  and (.[0].services | keys | sort) == ["app","postgres"]
  and (.[1].services | keys | sort) == ["app","postgres"]
  and .[1].services.app.image == $rollback
  and (.[1].services.app.ports | length) == 1
  and .[1].services.app.ports[0].host_ip == "127.0.0.1"
  and (.[1].services.app.ports[0].published | tostring) == "3000"
  and .[1].services.app.ports[0].target == 3000
  and (.[1].services.app.ports[0].protocol // "tcp") == "tcp"
  and .[0].services.postgres == .[1].services.postgres
  and ((.[1].services.postgres.ports // []) | length) == 0
' "$NAM_D_EXECUTION_ROOT/evidence/d4-base-compose-model.json" \
  "$NAM_D_EXECUTION_ROOT/evidence/d4-rollback-compose-model.json" >/dev/null
```

```bash
printf 'rollback_tag=%s\nrollback_index=%s\nlinux_amd64_platform_manifest=%s\nlinux_amd64_runtime_config=%s\n' "$NAM_D_ROLLBACK" "$NAM_D_ROLLBACK_INDEX" "$NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID" "$NAM_D_ROLLBACK_CONFIG_ID" | tee "$NAM_D_EXECUTION_ROOT/evidence/d4-rollback-identities.txt"
```

### D4.5 Isolated Day View Structure Validator

Create one non-executable, standard-library-only parser in the private evidence
directory before D5. D6 and D7 use this exact parser; regular expressions and
global substring counts are not HTML structure authority.

```bash
export NAM_D_DAY_VIEW_VALIDATOR="$NAM_D_EXECUTION_ROOT/evidence/validate-day-view.py"
tee "$NAM_D_DAY_VIEW_VALIDATOR" >/dev/null <<'PY'
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit

SPECS = [
    ("work-schedule-heading", "Work Schedule", "/work-schedule", None),
    ("timesheet-heading", "Timesheet", "/timesheets", None),
    ("daily-logs-heading", "Daily Logs", "/daily-logs", None),
    ("stop-cards-heading", "STOP Cards", "/stop-cards", None),
    ("daily-inspections-heading", "Daily Inspections", "/daily-inspections", None),
    (
        "safety-checklists-heading",
        "Operational Safety Checklists",
        "/operational-safety-checklists",
        "No operational safety checklists for this day",
    ),
    ("shift-reports-heading", "Shift Reports", "/shift-reports", None),
    (
        "work-authorizations-heading",
        "Work Authorizations",
        "/work-authorizations",
        None,
    ),
    ("defects-heading", "Defects", "/defect-tracking", None),
    (
        "equipment-fuel-events-heading",
        "Equipment Fuel Events",
        "/equipment-fuel-events",
        "No equipment fuel events for this day",
    ),
]
ROLLBACK_SPECS = [spec for spec in SPECS if spec[0] not in {
    "safety-checklists-heading",
    "equipment-fuel-events-heading",
}]
KNOWN_IDS = {spec[0] for spec in SPECS}
FORBIDDEN_ROLLBACK_IDS = {
    "safety-checklists-heading",
    "equipment-fuel-events-heading",
}
HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}
SUPPRESSED = {
    "script", "style", "template", "noscript",
    "head", "title", "base", "link", "meta", "metadata",
}


def normalized(parts: list[str]) -> str:
    return " ".join("".join(parts).split())


def hidden_by_attributes(attrs: dict[str, str | None]) -> bool:
    classes = (attrs.get("class") or "").split()
    style = re.sub(r"[\t\n\r\f ]+", "", (attrs.get("style") or "").lower())
    return (
        "hidden" in attrs
        or (attrs.get("aria-hidden") or "").lower() == "true"
        or bool({"hidden", "sr-only", "visually-hidden"}.intersection(classes))
        or "display:none" in style
        or "visibility:hidden" in style
        or "opacity:0" in style
    )


class DayViewParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[dict[str, object]] = []
        self.panels: list[dict[str, object]] = []
        self.element_ids: list[str] = []
        self.heading_ids: list[str] = []
        self.errors: list[str] = []

    def active_panel(self) -> dict[str, object] | None:
        for frame in reversed(self.stack):
            panel = frame.get("panel")
            if panel is not None:
                return panel  # type: ignore[return-value]
        return None

    def active_heading(self) -> dict[str, object] | None:
        for frame in reversed(self.stack):
            heading = frame.get("heading")
            if heading is not None:
                return heading  # type: ignore[return-value]
        return None

    def add_start(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = dict(attrs_list)
        if len(attrs) != len(attrs_list):
            self.errors.append(f"duplicate attribute on <{tag}>")
        element_id = attrs.get("id")
        if element_id:
            self.element_ids.append(element_id)
            if tag in HEADINGS:
                self.heading_ids.append(element_id)

        parent_hidden = bool(self.stack and self.stack[-1]["hidden"])
        hidden = parent_hidden or hidden_by_attributes(attrs)
        parent_suppressed = bool(self.stack and self.stack[-1]["suppressed"])
        suppressed = parent_suppressed or tag in SUPPRESSED
        classes = (attrs.get("class") or "").split()
        aria = attrs.get("aria-labelledby")
        panel_signal = "table-panel" in classes or aria in KNOWN_IDS
        panel: dict[str, object] | None = None

        if panel_signal:
            if self.active_panel() is not None:
                self.errors.append("nested contributor panel")
            panel = {
                "tag": tag,
                "attrs": attrs,
                "classes": classes,
                "hidden": hidden,
                "headings": [],
                "links": [],
                "text": [],
            }
            self.panels.append(panel)

        current_panel = panel if panel is not None else self.active_panel()
        heading: dict[str, object] | None = None
        if current_panel is not None and tag in HEADINGS:
            heading = {
                "tag": tag,
                "id": attrs.get("id"),
                "hidden": hidden,
                "collect_visible_text": (
                    tag == "h3"
                    or (
                        tag == "h2"
                        and attrs.get("id") in KNOWN_IDS
                        and attrs.get("id")
                        == current_panel["attrs"].get("aria-labelledby")
                    )
                ),
                "visible_text": [],
            }
            current_panel["headings"].append(heading)  # type: ignore[union-attr]

        if current_panel is not None and tag == "a":
            current_panel["links"].append({  # type: ignore[union-attr]
                "href": attrs.get("href"),
                "hidden": hidden,
            })

        if tag not in VOID:
            self.stack.append({
                "tag": tag,
                "hidden": hidden,
                "suppressed": suppressed,
                "panel": panel,
                "heading": heading,
            })

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.add_start(tag, attrs)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.add_start(tag, attrs)
        if tag.lower() not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if not self.stack or self.stack[-1]["tag"] != tag:
            self.errors.append(f"unbalanced closing tag </{tag}>")
            return
        self.stack.pop()

    def handle_data(self, data: str) -> None:
        if (
            not self.stack
            or bool(self.stack[-1]["hidden"])
            or bool(self.stack[-1]["suppressed"])
        ):
            return
        panel = self.active_panel()
        if panel is not None:
            panel["text"].append(data)  # type: ignore[union-attr]
        heading = self.active_heading()
        if (
            heading is not None
            and not bool(heading["hidden"])
            and bool(heading["collect_visible_text"])
        ):
            heading["visible_text"].append(data)  # type: ignore[union-attr]


def visible_route_exists(links: list[dict[str, object]], route: str) -> bool:
    for link in links:
        if link["hidden"] or not isinstance(link["href"], str):
            continue
        parsed = urlsplit(link["href"])
        if not parsed.scheme and not parsed.netloc and parsed.path == route:
            return True
    return False


def validate(mode: str, body_path: str) -> None:
    expected = SPECS if mode == "candidate" else ROLLBACK_SPECS
    with open(body_path, "r", encoding="utf-8", errors="strict") as body_file:
        body = body_file.read()
    if not body:
        raise ValueError("response body is empty")

    parser = DayViewParser()
    parser.feed(body)
    parser.close()
    errors = list(parser.errors)
    if parser.stack:
        errors.append("unclosed HTML elements remain")
    duplicate_heading_ids = sorted({
        heading_id
        for heading_id in parser.heading_ids
        if parser.heading_ids.count(heading_id) > 1
    })
    if duplicate_heading_ids:
        errors.append(
            "duplicate heading IDs: " + ",".join(duplicate_heading_ids)
        )
    if len(parser.panels) != len(expected):
        errors.append(
            f"contributor panel count is {len(parser.panels)}, expected {len(expected)}"
        )

    for position, spec in enumerate(expected):
        heading_id, label, route, empty_state = spec
        if position >= len(parser.panels):
            errors.append(f"missing panel at position {position + 1}: {label}")
            continue
        panel = parser.panels[position]
        attrs = panel["attrs"]
        headings = panel["headings"]
        if panel["tag"] != "section":
            errors.append(f"{label}: contributor is not a section element")
        if panel["classes"] != ["panel", "table-panel"]:
            errors.append(f"{label}: structural class is not exactly panel table-panel")
        if panel["hidden"]:
            errors.append(f"{label}: contributor panel is hidden")
        if attrs.get("aria-labelledby") != heading_id:
            errors.append(f"{label}: aria-labelledby is not {heading_id}")

        visible_h2s = [
            item for item in headings
            if item["tag"] == "h2" and not item["hidden"]
        ]
        if len(visible_h2s) != 1:
            errors.append(
                f"{label}: visible h2 count is {len(visible_h2s)}, expected 1"
            )
        else:
            visible_h2 = visible_h2s[0]
            if visible_h2["id"] != attrs.get("aria-labelledby"):
                errors.append(
                    f"{label}: sole visible h2 is not the aria-labelledby element"
                )
            if visible_h2["id"] != heading_id:
                errors.append(
                    f"{label}: sole visible h2 ID is not {heading_id}"
                )
            if normalized(visible_h2["visible_text"]) != label:
                errors.append(
                    f"{label}: sole visible h2 visible text is not exact"
                )
            if parser.element_ids.count(heading_id) != 1:
                errors.append(
                    f"{label}: expected heading ID occurs "
                    f"{parser.element_ids.count(heading_id)} times in the document"
                )
        if not visible_route_exists(panel["links"], route):
            errors.append(f"{label}: visible durable source link {route} is missing")

        if empty_state is not None:
            empty_headings = [
                item for item in headings
                if item["tag"] == "h3"
                and not item["hidden"]
                and normalized(item["visible_text"]) == empty_state
            ]
            if len(empty_headings) != 1:
                errors.append(
                    f"{label}: exact in-panel empty state count is {len(empty_headings)}"
                )
            for other_position, other_panel in enumerate(parser.panels):
                if other_position == position:
                    continue
                if empty_state in normalized(other_panel["text"]):
                    errors.append(f"{label}: empty state appears in another panel")

    if mode == "rollback":
        found_forbidden = sorted(
            FORBIDDEN_ROLLBACK_IDS.intersection(parser.element_ids)
        )
        if found_forbidden:
            errors.append(
                "rollback contains forbidden new contributor heading IDs: "
                + ",".join(found_forbidden)
            )

    if errors:
        for error in errors:
            print(f"DAY VIEW STRUCTURE FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
    print(f"DAY_VIEW_STRUCTURE=PASS mode={mode} panels={len(expected)}")


if len(sys.argv) != 3 or sys.argv[1] not in {"candidate", "rollback"}:
    print("usage: validate-day-view.py candidate|rollback BODY", file=sys.stderr)
    raise SystemExit(64)
validate(sys.argv[1], sys.argv[2])
PY
NAM_D_DAY_VIEW_VALIDATOR_WRITE_STATUS=$?
test "$NAM_D_DAY_VIEW_VALIDATOR_WRITE_STATUS" -eq 0 \
  && chmod 0600 "$NAM_D_DAY_VIEW_VALIDATOR" \
  && test -f "$NAM_D_DAY_VIEW_VALIDATOR" \
  && test ! -L "$NAM_D_DAY_VIEW_VALIDATOR" \
  && test "$(stat -Lc '%a' "$NAM_D_DAY_VIEW_VALIDATOR")" = '600' \
  && python3 -c 'import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))' \
    "$NAM_D_DAY_VIEW_VALIDATOR"
```

The parser recognizes contributor candidates structurally, including malformed
elements that carry a known contributor `aria-labelledby` or the
`table-panel` class. It then requires the exact panel element, exact class,
exactly one visible descendant `h2`, identity between that `h2` and the
`aria-labelledby` target, the exact expected heading ID, unique heading IDs,
exact normalized visible heading text, a visible in-panel durable link, exact
order, and the exact candidate or rollback panel set. Heading text is
accumulated for an `h2` only when it is the panel's known
`aria-labelledby` target and the current text node's complete active ancestry
is visible and unsuppressed. The separate `h3` empty-state accumulator follows
the same ancestry rule. Hidden descendants and script, style, template,
noscript, and metadata content therefore cannot contribute expected text.
Navigation, content in another panel, or an expected heading outside the panel
cannot satisfy a check. In candidate mode, each known zero-count empty state
must be the exact visible `h3` in its own panel and nowhere else. In rollback
mode, the eight known panels are required and both new contributor heading IDs
are forbidden.

D4 passes only if the candidate and rollback checks all pass and the exact D7
command has been reviewed before D5.

## D5 — Controlled Application-Only Replacement

D5 is the second Docker mutation. It is expected to cause a short application
interruption while Compose replaces `nam-app`; PostgreSQL must remain
continuously running. Zero downtime is not claimed. The normal interruption is
expected to be seconds, and the readiness decision is bounded at 120 seconds.

### D5.1 Immediate Preservation Snapshot

Capture the PostgreSQL values that must remain identical:

```bash
export NAM_D_PG_BEFORE_ID="$(docker inspect nam-postgres --format '{{.Id}}')"
```

```bash
export NAM_D_PG_BEFORE_STARTED="$(docker inspect nam-postgres --format '{{.State.StartedAt}}')"
```

```bash
export NAM_D_PG_BEFORE_RESTARTS="$(docker inspect nam-postgres --format '{{.RestartCount}}')"
```

```bash
export NAM_D_PG_BEFORE_VOLUME="$(docker inspect nam-postgres --format '{{len .Mounts}}|{{(index .Mounts 0).Name}}|{{(index .Mounts 0).Destination}}')"
```

```bash
export NAM_D_PG_BEFORE_NETWORK="$(docker inspect nam-postgres --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')"
```

```bash
export NAM_D_PG_BEFORE_PORTS="$(docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}')"
```

```bash
test "$NAM_D_PG_BEFORE_ID" = '0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1'
```

```bash
test "$NAM_D_PG_BEFORE_STARTED" = '2026-06-30T18:17:12.705151191Z'
```

```bash
test "$NAM_D_PG_BEFORE_RESTARTS" = '0'
```

```bash
test "$NAM_D_PG_BEFORE_VOLUME" = '1|postgres-data|/var/lib/postgresql'
```

```bash
test "$NAM_D_PG_BEFORE_NETWORK" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$NAM_D_PG_BEFORE_PORTS" = '{"5432/tcp":null}'
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.Status}}|{{.State.Health.Status}}')" = 'running|healthy'
```

Recheck the candidate and repository at the last fail-closed point:

```bash
test "$(docker image inspect "$NAM_D_CANDIDATE" --format '{{.Id}}')" = "$NAM_D_INDEX_ID"
```

```bash
test "$(git rev-parse HEAD)" = "$RUNBOOK_CONTROL_COMMIT" && test -z "$(git status --porcelain=v1 --untracked-files=all)"
```

### D5.2 Authorization And Replacement

**Approval point:** the operator and reviewer must authorize exactly the next
command. It force-recreates only the `app` service, disables dependency
recreation, disables builds, and forbids pulls.

```bash
docker compose -p nam -f compose.yaml -f "$NAM_D_CANDIDATE_OVERRIDE" \
  up -d --no-deps --no-build --pull never --force-recreate app
```

Do not use `docker compose down`, `down -v`, an unscoped `up`, `restart`, `rm`,
or any command naming `postgres`.

Capture the new application instance and verify the complete candidate identity
chain without crossing identity domains:

```bash
export NAM_D_NEW_APP_ID="$(docker inspect nam-app --format '{{.Id}}')"
```

```bash
export NAM_D_NEW_APP_STARTED="$(docker inspect nam-app --format '{{.State.StartedAt}}')"
```

```bash
export NAM_D_NEW_APP_CONFIGURED_IMAGE="$(
  docker inspect nam-app --format '{{.Config.Image}}'
)"
export NAM_D_NEW_APP_INDEX_ID="$(
  docker inspect nam-app --format '{{.Image}}'
)"
export NAM_D_NEW_APP_MANIFEST_MEDIA_TYPE="$(
  docker inspect nam-app --format '{{.ImageManifestDescriptor.MediaType}}'
)"
export NAM_D_NEW_APP_MANIFEST_ID="$(
  docker inspect nam-app --format '{{.ImageManifestDescriptor.Digest}}'
)"
export NAM_D_NEW_APP_MANIFEST_OS="$(
  docker inspect nam-app --format '{{.ImageManifestDescriptor.Platform.OS}}'
)"
export NAM_D_NEW_APP_MANIFEST_ARCH="$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Platform.Architecture}}'
)"
export NAM_D_NEW_APP_CONFIG_ID="$(
  tar -xOf "$NAM_D_CANDIDATE_OCI_ARCHIVE" \
    "blobs/sha256/${NAM_D_PLATFORM_MANIFEST_ID#sha256:}" \
    | jq -er '.config.digest'
)"
```

```bash
printf '%s\n' \
  "old_container_id=f500902546bdad63adb180118dab379b630be9618a11f5fe58f0ee63f42495f2" \
  "old_runtime_config=sha256:03d0301ad1ca9bc2060fcb41676e08faa721ea6ef6108a5edc4db742fba211b4" \
  "old_started_at=2026-07-17T00:18:15.904984177Z" \
  "new_container_id=$NAM_D_NEW_APP_ID" \
  "new_started_at=$NAM_D_NEW_APP_STARTED" \
  "new_configured_image=$NAM_D_NEW_APP_CONFIGURED_IMAGE" \
  "new_image_index=$NAM_D_NEW_APP_INDEX_ID" \
  "new_platform_manifest=$NAM_D_NEW_APP_MANIFEST_ID" \
  "new_image_config=$NAM_D_NEW_APP_CONFIG_ID" \
  | tee "$NAM_D_EXECUTION_ROOT/evidence/d5-application-containers.txt"
```

```bash
test "$NAM_D_NEW_APP_ID" != 'f500902546bdad63adb180118dab379b630be9618a11f5fe58f0ee63f42495f2'
```

```bash
test "$NAM_D_NEW_APP_CONFIGURED_IMAGE" = "$NAM_D_CANDIDATE" \
  && test "$NAM_D_NEW_APP_INDEX_ID" = "$NAM_D_INDEX_ID" \
  && test "$NAM_D_NEW_APP_MANIFEST_MEDIA_TYPE" = \
    'application/vnd.oci.image.manifest.v1+json' \
  && test "$NAM_D_NEW_APP_MANIFEST_ID" = "$NAM_D_PLATFORM_MANIFEST_ID" \
  && test "$NAM_D_NEW_APP_MANIFEST_OS" = 'linux' \
  && test "$NAM_D_NEW_APP_MANIFEST_ARCH" = 'amd64' \
  && test "$NAM_D_NEW_APP_CONFIG_ID" = "$NAM_D_CONFIG_ID"
```

The container's `.Config.Image`, `.Image`, and
`.ImageManifestDescriptor.digest` prove the immutable tag, OCI index, and
selected `linux/amd64` manifest respectively. The selected manifest in the
existing D4 OCI archive independently links that manifest to the recorded image
config.

### D5.3 Bounded Local Readiness

Poll only the local health route for no more than 120 seconds:

```bash
NAM_D_HEALTH_STARTED=$SECONDS
NAM_D_HEALTH_DEADLINE=$((NAM_D_HEALTH_STARTED + 120))
NAM_D_HEALTH_ATTEMPT=0
NAM_D_LOCAL_READY='no'
while :; do
  NAM_D_HEALTH_REMAINING=$((NAM_D_HEALTH_DEADLINE - SECONDS))
  (( NAM_D_HEALTH_REMAINING > 0 )) || break
  NAM_D_HEALTH_ATTEMPT=$((NAM_D_HEALTH_ATTEMPT + 1))
  printf -v NAM_D_HEALTH_ATTEMPT_ID '%03d' "$NAM_D_HEALTH_ATTEMPT"
  NAM_D_HEALTH_BODY="$NAM_D_EXECUTION_ROOT/evidence/d5-local-health-attempt-$NAM_D_HEALTH_ATTEMPT_ID.json"
  NAM_D_HEALTH_META="$NAM_D_EXECUTION_ROOT/evidence/d5-local-health-attempt-$NAM_D_HEALTH_ATTEMPT_ID.meta.txt"
  NAM_D_HEALTH_STDERR="$NAM_D_EXECUTION_ROOT/evidence/d5-local-health-attempt-$NAM_D_HEALTH_ATTEMPT_ID.stderr.txt"
  if ! { : > "$NAM_D_HEALTH_BODY" && : > "$NAM_D_HEALTH_STDERR"; }; then
    printf 'D5 readiness FAIL: cannot create attempt evidence\n' >&2
    break
  fi
  NAM_D_HEALTH_CONNECT_TIMEOUT=$NAM_D_HEALTH_REMAINING
  (( NAM_D_HEALTH_CONNECT_TIMEOUT <= 5 )) \
    || NAM_D_HEALTH_CONNECT_TIMEOUT=5
  NAM_D_HEALTH_RESULT=''
  NAM_D_HEALTH_CURL_STATUS=0
  NAM_D_HEALTH_RESULT="$(curl --silent --show-error \
    --connect-timeout "$NAM_D_HEALTH_CONNECT_TIMEOUT" \
    --max-time "$NAM_D_HEALTH_REMAINING" \
    --header 'Cache-Control: no-cache' \
    --header 'Pragma: no-cache' \
    --output "$NAM_D_HEALTH_BODY" \
    --write-out '%{http_code}|%{url_effective}|%{time_total}' \
    http://127.0.0.1:3000/api/health \
    2>"$NAM_D_HEALTH_STDERR")" \
    || NAM_D_HEALTH_CURL_STATUS=$?
  if ! printf 'requested_url=%s\nattempt=%s\nremaining_before_request_seconds=%s\nconnect_timeout_seconds=%s\ntotal_timeout_seconds=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\nstderr_file=%s\n' \
      'http://127.0.0.1:3000/api/health' \
      "$NAM_D_HEALTH_ATTEMPT_ID" "$NAM_D_HEALTH_REMAINING" \
      "$NAM_D_HEALTH_CONNECT_TIMEOUT" "$NAM_D_HEALTH_REMAINING" \
      "$NAM_D_HEALTH_CURL_STATUS" "$NAM_D_HEALTH_RESULT" \
      "$NAM_D_HEALTH_BODY" "$NAM_D_HEALTH_STDERR" \
      > "$NAM_D_HEALTH_META"
  then
    printf 'D5 readiness FAIL: cannot write attempt metadata\n' >&2
    break
  fi
  IFS='|' read -r NAM_D_HTTP_CODE NAM_D_EFFECTIVE_URL NAM_D_TIME_TOTAL \
    <<< "$NAM_D_HEALTH_RESULT"
  if [[ "$NAM_D_HEALTH_CURL_STATUS" -eq 0 \
      && "$NAM_D_HTTP_CODE" == '200' \
      && "$NAM_D_EFFECTIVE_URL" == 'http://127.0.0.1:3000/api/health' ]] \
    && jq -e '
      type == "object"
      and (keys == ["database","status"])
      and .status == "ok"
      and .database == "ok"
    ' "$NAM_D_HEALTH_BODY" >/dev/null 2>&1
  then
    NAM_D_LOCAL_READY='yes'
    break
  fi
  NAM_D_HEALTH_REMAINING=$((NAM_D_HEALTH_DEADLINE - SECONDS))
  (( NAM_D_HEALTH_REMAINING > 0 )) || break
  NAM_D_HEALTH_SLEEP=2
  (( NAM_D_HEALTH_SLEEP <= NAM_D_HEALTH_REMAINING )) \
    || NAM_D_HEALTH_SLEEP=$NAM_D_HEALTH_REMAINING
  sleep "$NAM_D_HEALTH_SLEEP"
done
NAM_D_HEALTH_ELAPSED=$((SECONDS - NAM_D_HEALTH_STARTED))
test "$NAM_D_HEALTH_ELAPSED" -le 120 \
  && test "$NAM_D_LOCAL_READY" = 'yes'
```

If the command exits nonzero, prints no successful result, or the container
fails to start, stop validation and make the D7 rollback decision. Each attempt
has a fresh body, metadata, and stderr file. Before every request, the loop
recomputes its remaining monotonic Bash `SECONDS` budget; it starts no request
at zero, caps both connection and total time at that remaining budget, and
never sleeps beyond the deadline. A connected but stalled request therefore
cannot extend the readiness decision indefinitely. A timeout, malformed or
partial JSON body, non-200 result, wrong effective URL, extra or missing JSON
field, or final timeout exits nonzero and goes to the D7 decision. Preserve
every attempt. Do not automatically rerun replacement.

Immediately require PostgreSQL preservation:

```bash
test "$(docker inspect nam-postgres --format '{{.Id}}')" = "$NAM_D_PG_BEFORE_ID"
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.StartedAt}}')" = "$NAM_D_PG_BEFORE_STARTED"
```

```bash
test "$(docker inspect nam-postgres --format '{{.RestartCount}}')" = "$NAM_D_PG_BEFORE_RESTARTS"
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.Status}}|{{.State.Health.Status}}')" = 'running|healthy'
```

```bash
test "$(docker inspect nam-postgres --format '{{len .Mounts}}|{{(index .Mounts 0).Name}}|{{(index .Mounts 0).Destination}}')" = "$NAM_D_PG_BEFORE_VOLUME"
```

```bash
test "$(docker inspect nam-postgres --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = "$NAM_D_PG_BEFORE_NETWORK"
```

```bash
test "$(docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}')" = "$NAM_D_PG_BEFORE_PORTS"
```

Any mismatch is a rollback trigger and an infrastructure incident. Application
rollback does not undo or conceal an unexpected PostgreSQL change.

## D6 — Validation Matrix

D6 has two execution locations. Complete the server matrix first, then obtain
the external Darnassus result. A private check run from the VPS is not accepted.

### D6.1 Server — Local Health And Day View

Capture local health with an exact HTTP result:

```bash
NAM_D_LOCAL_HEALTH_RESULT=''
NAM_D_LOCAL_HEALTH_CURL_STATUS=0
NAM_D_LOCAL_HEALTH_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d6-local-health.json" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}' \
  http://127.0.0.1:3000/api/health)" \
  || NAM_D_LOCAL_HEALTH_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'http://127.0.0.1:3000/api/health' "$NAM_D_LOCAL_HEALTH_CURL_STATUS" \
  "$NAM_D_LOCAL_HEALTH_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d6-local-health.json" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d6-local-health.meta.txt" \
  && test "$NAM_D_LOCAL_HEALTH_CURL_STATUS" -eq 0
```

```bash
IFS='|' read -r NAM_D_LOCAL_HEALTH_HTTP NAM_D_LOCAL_HEALTH_EFFECTIVE \
  NAM_D_LOCAL_HEALTH_REDIRECTS NAM_D_LOCAL_HEALTH_REDIRECT_URL \
  <<< "$NAM_D_LOCAL_HEALTH_RESULT"
test "$NAM_D_LOCAL_HEALTH_HTTP" = '200' \
  && test "$NAM_D_LOCAL_HEALTH_EFFECTIVE" = 'http://127.0.0.1:3000/api/health' \
  && test "$NAM_D_LOCAL_HEALTH_REDIRECTS" = '0' \
  && test -z "$NAM_D_LOCAL_HEALTH_REDIRECT_URL"
```

```bash
jq -e '
  type == "object"
  and (keys == ["database","status"])
  and .status == "ok"
  and .database == "ok"
' "$NAM_D_EXECUTION_ROOT/evidence/d6-local-health.json" >/dev/null
```

Capture Day View:

```bash
NAM_D_LOCAL_DAY_RESULT=''
NAM_D_LOCAL_DAY_CURL_STATUS=0
NAM_D_LOCAL_DAY_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d6-local-day-view.html" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}' \
  http://127.0.0.1:3000/day-view)" \
  || NAM_D_LOCAL_DAY_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'http://127.0.0.1:3000/day-view' "$NAM_D_LOCAL_DAY_CURL_STATUS" \
  "$NAM_D_LOCAL_DAY_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d6-local-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d6-local-day-view.meta.txt" \
  && test "$NAM_D_LOCAL_DAY_CURL_STATUS" -eq 0
```

```bash
IFS='|' read -r NAM_D_LOCAL_DAY_HTTP NAM_D_LOCAL_DAY_EFFECTIVE \
  NAM_D_LOCAL_DAY_REDIRECTS NAM_D_LOCAL_DAY_REDIRECT_URL \
  <<< "$NAM_D_LOCAL_DAY_RESULT"
test "$NAM_D_LOCAL_DAY_HTTP" = '200' \
  && test "$NAM_D_LOCAL_DAY_EFFECTIVE" = 'http://127.0.0.1:3000/day-view' \
  && test "$NAM_D_LOCAL_DAY_REDIRECTS" = '0' \
  && test -z "$NAM_D_LOCAL_DAY_REDIRECT_URL"
```

Validate the actual contributor sections with the isolated parser:

```bash
python3 "$NAM_D_DAY_VIEW_VALIDATOR" candidate \
  "$NAM_D_EXECUTION_ROOT/evidence/d6-local-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d6-local-day-view-structure.txt"
```

The parser must print
`DAY_VIEW_STRUCTURE=PASS mode=candidate panels=10`. It proves the exact ten
ordered sections, their exact in-panel headings and `aria-labelledby`
relationships, visible in-panel source links, and the two correct in-panel
empty states. Global text, navigation, scripts, metadata, hidden content,
another panel, or duplicate rendered content cannot satisfy it.

### D6.2 Server — Candidate, Exposure, And PostgreSQL

Every command must exit zero:

```bash
test "$(docker image inspect "$NAM_D_CANDIDATE" --format '{{.Id}}')" = "$NAM_D_INDEX_ID"
```

```bash
test "$(docker image inspect "$NAM_D_ROLLBACK" --format '{{.Id}}')" = "$NAM_D_ROLLBACK_INDEX"
```

```bash
test "$(docker inspect nam-app --format '{{.Id}}')" = "$NAM_D_NEW_APP_ID"
```

```bash
test "$(docker inspect nam-app --format '{{.Config.Image}}')" = \
  "$NAM_D_CANDIDATE"
```

```bash
test "$(docker inspect nam-app --format '{{.Image}}')" = "$NAM_D_INDEX_ID"
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.MediaType}}'
)" = 'application/vnd.oci.image.manifest.v1+json'
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Digest}}'
)" = "$NAM_D_PLATFORM_MANIFEST_ID"
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Platform.OS}}'
)" = 'linux'
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Platform.Architecture}}'
)" = 'amd64'
```

```bash
test "$(
  tar -xOf "$NAM_D_CANDIDATE_OCI_ARCHIVE" \
    "blobs/sha256/${NAM_D_PLATFORM_MANIFEST_ID#sha256:}" \
    | jq -er '.config.digest'
)" = "$NAM_D_CONFIG_ID"
```

```bash
test "$(docker inspect nam-app --format '{{.State.Status}}')" = 'running'
```

```bash
test "$(docker inspect nam-app --format '{{len .Mounts}}')" = '0'
```

```bash
test "$(docker port nam-app 3000/tcp)" = '127.0.0.1:3000'
```

```bash
test "$(docker inspect nam-app --format '{{json .NetworkSettings.Ports}}')" = '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3000"}]}'
```

```bash
test "$(docker inspect nam-postgres --format '{{.Id}}')" = '0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1'
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.StartedAt}}')" = '2026-06-30T18:17:12.705151191Z'
```

```bash
test "$(docker inspect nam-postgres --format '{{.RestartCount}}')" = '0'
```

```bash
test "$(docker inspect nam-postgres --format '{{.State.Status}}|{{.State.Health.Status}}')" = 'running|healthy'
```

```bash
test "$(docker inspect nam-postgres --format '{{len .Mounts}}|{{(index .Mounts 0).Name}}|{{(index .Mounts 0).Destination}}')" = '1|postgres-data|/var/lib/postgresql'
```

```bash
test "$(docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}')" = '{"5432/tcp":null}'
```

```bash
test "$(docker network inspect nam-network --format '{{.Id}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker inspect nam-postgres --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker inspect nam-app --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker ps -a --filter label=com.docker.compose.project=nam --format '{{.Names}}' | sort)" = $'nam-app\nnam-postgres'
```

```bash
test "$(docker compose -p nam -f compose.yaml ps -a --services | sort)" = $'app\npostgres'
```

### D6.3 Server — Existing Public HTTPS

Checkpoint E, not Checkpoint D, removes the public route. Do not change Caddy,
UFW, DNS, Tailscale, Funnel, or access policy during this validation.

```bash
NAM_D_PUBLIC_HEALTH_RESULT=''
NAM_D_PUBLIC_HEALTH_CURL_STATUS=0
NAM_D_PUBLIC_HEALTH_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d6-public-health.json" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' \
  https://dev.alemany.me/api/health)" \
  || NAM_D_PUBLIC_HEALTH_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'https://dev.alemany.me/api/health' "$NAM_D_PUBLIC_HEALTH_CURL_STATUS" \
  "$NAM_D_PUBLIC_HEALTH_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d6-public-health.json" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d6-public-health.meta.txt" \
  && test "$NAM_D_PUBLIC_HEALTH_CURL_STATUS" -eq 0
```

```bash
IFS='|' read -r NAM_D_PUBLIC_HEALTH_HTTP NAM_D_PUBLIC_HEALTH_EFFECTIVE \
  NAM_D_PUBLIC_HEALTH_REDIRECTS NAM_D_PUBLIC_HEALTH_REDIRECT_URL \
  NAM_D_PUBLIC_HEALTH_TLS <<< "$NAM_D_PUBLIC_HEALTH_RESULT"
test "$NAM_D_PUBLIC_HEALTH_HTTP" = '200' \
  && test "$NAM_D_PUBLIC_HEALTH_EFFECTIVE" = 'https://dev.alemany.me/api/health' \
  && test "$NAM_D_PUBLIC_HEALTH_REDIRECTS" = '0' \
  && test -z "$NAM_D_PUBLIC_HEALTH_REDIRECT_URL" \
  && test "$NAM_D_PUBLIC_HEALTH_TLS" = '0'
```

```bash
jq -e '
  type == "object"
  and (keys == ["database","status"])
  and .status == "ok"
  and .database == "ok"
' "$NAM_D_EXECUTION_ROOT/evidence/d6-public-health.json" >/dev/null
```

```bash
NAM_D_PUBLIC_DAY_RESULT=''
NAM_D_PUBLIC_DAY_CURL_STATUS=0
NAM_D_PUBLIC_DAY_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d6-public-day-view.html" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' \
  https://dev.alemany.me/day-view)" \
  || NAM_D_PUBLIC_DAY_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'https://dev.alemany.me/day-view' "$NAM_D_PUBLIC_DAY_CURL_STATUS" \
  "$NAM_D_PUBLIC_DAY_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d6-public-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d6-public-day-view.meta.txt" \
  && test "$NAM_D_PUBLIC_DAY_CURL_STATUS" -eq 0
```

```bash
IFS='|' read -r NAM_D_PUBLIC_DAY_HTTP NAM_D_PUBLIC_DAY_EFFECTIVE \
  NAM_D_PUBLIC_DAY_REDIRECTS NAM_D_PUBLIC_DAY_REDIRECT_URL \
  NAM_D_PUBLIC_DAY_TLS <<< "$NAM_D_PUBLIC_DAY_RESULT"
test "$NAM_D_PUBLIC_DAY_HTTP" = '200' \
  && test "$NAM_D_PUBLIC_DAY_EFFECTIVE" = 'https://dev.alemany.me/day-view' \
  && test "$NAM_D_PUBLIC_DAY_REDIRECTS" = '0' \
  && test -z "$NAM_D_PUBLIC_DAY_REDIRECT_URL" \
  && test "$NAM_D_PUBLIC_DAY_TLS" = '0'
```

```bash
python3 "$NAM_D_DAY_VIEW_VALIDATOR" candidate \
  "$NAM_D_EXECUTION_ROOT/evidence/d6-public-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d6-public-day-view-structure.txt"
```

Public validation must produce the same structural ten-panel PASS as local
validation; an HTTP result or global panel count alone is insufficient.

### D6.4 Darnassus — External Private HTTPS Gate

For the current sealed Darnassus evidence root
`C:\Users\alain\nam-deployment-evidence\checkpoint-d-76cdba9530e4-20260728T015759Z`,
the health and Day View HTTPS requests already passed and must not be repeated.
Do not execute the generic request sequence in this section for that root.
Complete its pending structural gate only through
[Checkpoint D Private Validator Recovery](checkpoint-d-private-validator-recovery.md).
That recovery binds the sealed transport evidence to a new collision-checked
WSL structural-validation continuation root and is the only path that may
authorize D6.5 for this incident.

The remaining generic sequence is retained for a fresh, separately authorized
private evidence root and for the D7 helper definitions. It is not the current
incident procedure. When it is authorized, run it in PowerShell on Darnassus,
not on the VPS, and create the identity-bearing evidence directory and
transcript before validation.

```powershell
$privateEvidenceParent = Join-Path $env:USERPROFILE 'nam-deployment-evidence'; New-Item -ItemType Directory -Path $privateEvidenceParent -Force | Out-Null
```

```powershell
$privateExecutionId = "checkpoint-d-76cdba9530e4-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))"; $privateEvidenceRoot = Join-Path $privateEvidenceParent $privateExecutionId; New-Item -ItemType Directory -Path $privateEvidenceRoot -ErrorAction Stop | Out-Null
```

```powershell
Start-Transcript -Path (Join-Path $privateEvidenceRoot 'd6-private-transcript.txt') -NoClobber
```

```powershell
$privateHostName = 'ops-console.tailf57e61.ts.net'
```

```powershell
$tailscale = tailscale status --json | ConvertFrom-Json
```

```powershell
if ($tailscale.BackendState -ne 'Running') { throw "D6 private FAIL: BackendState is $($tailscale.BackendState)" }
```

```powershell
if (@($tailscale.Self.TailscaleIPs) -notcontains '100.121.217.67') { throw 'D6 private FAIL: Darnassus does not include 100.121.217.67' }
```

```powershell
$privateDns = @(Resolve-DnsName -Name $privateHostName -Type A -DnsOnly | Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress)
```

```powershell
$privateDns = @($privateDns | Sort-Object -Unique); if ($privateDns.Count -ne 1 -or $privateDns[0] -ne '100.98.215.31') { throw "D6 private FAIL: unexpected DNS result: $($privateDns -join ',')" }
```

Define and validate the fixed request-evidence namespace. The `d6` and `d7`
prefixes make all body, metadata, stderr, and request-summary leaf names
distinct across the four private requests even if the two execution roots were
ever the same. Each actual path must also be unique and beneath its approved
Darnassus evidence root.

```powershell
$privateRequestEvidenceLeafNames = @(
  'd6-private-health.json',
  'd6-private-health.meta.txt',
  'd6-private-health.stderr.txt',
  'd6-private-health.request-summary.txt',
  'd6-private-day-view.html',
  'd6-private-day-view.meta.txt',
  'd6-private-day-view.stderr.txt',
  'd6-private-day-view.request-summary.txt',
  'd7-private-health.json',
  'd7-private-health.meta.txt',
  'd7-private-health.stderr.txt',
  'd7-private-health.request-summary.txt',
  'd7-private-day-view.html',
  'd7-private-day-view.meta.txt',
  'd7-private-day-view.stderr.txt',
  'd7-private-day-view.request-summary.txt'
)
if (
  @($privateRequestEvidenceLeafNames | Sort-Object -Unique).Count -ne
  $privateRequestEvidenceLeafNames.Count
) {
  throw 'private request evidence leaf-name collision'
}

function Assert-PrivateEvidencePaths {
  param(
    [Parameter(Mandatory = $true)][string]$ApprovedParent,
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string[]]$Paths
  )

  $parentFull = [System.IO.Path]::GetFullPath($ApprovedParent)
  $rootFull = [System.IO.Path]::GetFullPath($Root)
  $pathTrimCharacters = [char[]]@('\', '/')
  $parentPrefix = $parentFull.TrimEnd($pathTrimCharacters) + '\'
  $rootPrefix = $rootFull.TrimEnd($pathTrimCharacters) + '\'
  if (
    -not $rootFull.StartsWith(
      $parentPrefix,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "private evidence root is outside approved parent: $rootFull"
  }
  $fullPaths = @($Paths | ForEach-Object {
    [System.IO.Path]::GetFullPath($_)
  })
  if (@($fullPaths | Sort-Object -Unique).Count -ne $fullPaths.Count) {
    throw 'private request evidence path collision'
  }
  foreach ($fullPath in $fullPaths) {
    if (
      -not $fullPath.StartsWith(
        $rootPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
      )
    ) {
      throw "request evidence path is outside approved root: $fullPath"
    }
  }
}

function Initialize-PrivateRequestStderr {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (Test-Path -LiteralPath $Path) {
    throw "refusing to replace request stderr evidence: $Path"
  }
  try {
    [System.IO.File]::WriteAllBytes(
      [System.IO.Path]::GetFullPath($Path),
      [byte[]]@()
    )
  } catch {
    throw "cannot create or write request stderr evidence ${Path}: $($_.Exception.Message)"
  }
}

function Confirm-PrivateRequestStderr {
  param([Parameter(Mandatory = $true)][string]$Path)
  try {
    $stream = [System.IO.File]::Open(
      [System.IO.Path]::GetFullPath($Path),
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::Read
    )
    $stream.Dispose()
  } catch {
    throw "request stderr evidence is missing or unwritable ${Path}: $($_.Exception.Message)"
  }
}
```

The Windows COM parser is not structural authority for HTML5 Day View markup.
Use the exact standard-library-only D4.5 validator through the known
`AlmaLinux-9` WSL Python runtime. Regular expressions and substring counts are
not accepted as structural HTML validation.

For the sealed incident identified in
[Checkpoint D Private Validator Recovery](checkpoint-d-private-validator-recovery.md),
do not execute the D6.4 requests again and do not use the generic commands
below. Follow that recovery runbook against the original downloaded HTML.

For a separately authorized future private validation, or for the sealed
incident's D6.5 handoff, the validator must be derived from the accepted final
completion record. An arbitrary Python path is not accepted. The following
PowerShell block is **a script containing one top-level function definition**.
It strictly parses the final record and continuation manifest, requires the
exact continuation inventory, rejects reparse points, verifies every manifest
hash, fully revalidates the sealed original manifest and exact root inventory,
and binds the validator to both recorded hashes:

```powershell
function Assert-AcceptedPrivateValidatorBinding {
  param(
    [Parameter(Mandatory = $true)][string]$CompletionRecordPath
  )

  $expectedParent = 'C:\Users\alain\nam-deployment-evidence'
  $fixedOriginalRoot = Join-Path $expectedParent `
    'checkpoint-d-76cdba9530e4-20260728T015759Z'
  $fixedOriginalManifest = Join-Path $fixedOriginalRoot 'SHA256SUMS.txt'
  $fixedOriginalHtml = Join-Path $fixedOriginalRoot `
    'd6-private-day-view.html'
  $fixedOriginalManifestHash = `
    '15DF1ED5DC0964E472F41B7D7EE28FA3ADE213DD03254FA255AE448E78FCBBC1'
  $fixedOriginalHtmlHash = `
    'D2C27440483C8B6A676009034F95BCDCE52616EC1B96A1EC34FF34C8C7C5ED8C'
  $fixedValidatorHash = `
    '4F784C56A4D9F1AB01B04FFB2BA017D0C9EE58A17DF3B1BE712CA30C0F4D4173'
  $expectedParentFull = [System.IO.Path]::GetFullPath($expectedParent)
  $fixedOriginalRootFull = [System.IO.Path]::GetFullPath($fixedOriginalRoot)
  $fixedOriginalManifestFull = [System.IO.Path]::GetFullPath(
    $fixedOriginalManifest
  )
  $fixedOriginalHtmlFull = [System.IO.Path]::GetFullPath($fixedOriginalHtml)
  $completionFull = [System.IO.Path]::GetFullPath($CompletionRecordPath)
  $rootFull = [System.IO.Path]::GetDirectoryName($completionFull)
  $parentFull = [System.IO.Path]::GetDirectoryName($rootFull)
  if (
    $CompletionRecordPath -ine $completionFull -or
    [System.IO.Path]::GetFileName($completionFull) -cne
      'd6-private-validator-completion-summary.txt' -or
    $parentFull -ine $expectedParentFull -or
    [System.IO.Path]::GetDirectoryName($fixedOriginalRootFull) -ine
      $expectedParentFull -or
    $fixedOriginalManifestFull -ine
      (Join-Path $fixedOriginalRootFull 'SHA256SUMS.txt') -or
    $fixedOriginalHtmlFull -ine
      (Join-Path $fixedOriginalRootFull 'd6-private-day-view.html')
  ) {
    throw 'accepted validator FAIL: completion record is outside the exact evidence parent'
  }

  foreach ($directoryPath in @(
    $parentFull,
    $rootFull,
    $fixedOriginalRootFull
  )) {
    if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
      throw "accepted validator FAIL: directory is absent: $directoryPath"
    }
    $directoryItem = Get-Item -Force -LiteralPath $directoryPath `
      -ErrorAction Stop
    if (
      $directoryItem.FullName -ine $directoryPath -or
      ($directoryItem.Attributes -band
        [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($directoryItem.Attributes -band
        [System.IO.FileAttributes]::Directory) -eq 0
    ) {
      throw "accepted validator FAIL: directory is not canonical and regular: $directoryPath"
    }
  }

  $recordItem = Get-Item -Force -LiteralPath $completionFull `
    -ErrorAction Stop
  if (
    -not (Test-Path -LiteralPath $completionFull -PathType Leaf) -or
    ($recordItem.Attributes -band
      [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
    ($recordItem.Attributes -band
      [System.IO.FileAttributes]::Directory) -ne 0
  ) {
    throw 'accepted validator FAIL: completion record is not a regular file'
  }

  $record = [System.Collections.Generic.Dictionary[string,string]]::new(
    [System.StringComparer]::Ordinal
  )
  foreach ($line in @(
    Get-Content -LiteralPath $completionFull -ErrorAction Stop
  )) {
    $lineMatch = [regex]::Match($line, '^([A-Z0-9_]+)=(.*)$')
    if (
      -not $lineMatch.Success -or
      $record.ContainsKey($lineMatch.Groups[1].Value)
    ) {
      throw "accepted validator FAIL: malformed or duplicate record line: $line"
    }
    $record.Add(
      $lineMatch.Groups[1].Value,
      $lineMatch.Groups[2].Value
    )
  }
  $requiredRecordKeys = @(
    'D6_4_PRIVATE_VALIDATOR_RECOVERY',
    'RUNBOOK_CONTROL_COMMIT',
    'SEALED_REQUEST_EVIDENCE_ROOT',
    'SEALED_REQUEST_CHECKSUM_MANIFEST',
    'SEALED_REQUEST_CHECKSUM_MANIFEST_SHA256',
    'SEALED_REQUEST_EVIDENCE_FILES_VERIFIED',
    'ORIGINAL_DAY_VIEW_HTML',
    'ORIGINAL_DAY_VIEW_SHA256',
    'ORIGINAL_DAY_VIEW_SIZE',
    'STRUCTURAL_VALIDATION_CONTINUATION_ROOT',
    'STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST',
    'STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST_SHA256',
    'ACCEPTED_VALIDATOR_PATH',
    'ACCEPTED_VALIDATOR_SHA256',
    'VALIDATOR_RESULT',
    'HTTPS_REQUESTS_REPEATED',
    'ROLLBACK_REQUIRED',
    'D6_4',
    'D6_5'
  )
  if ($record.Count -ne $requiredRecordKeys.Count) {
    throw 'accepted validator FAIL: completion record key set is not exact'
  }
  foreach ($requiredRecordKey in $requiredRecordKeys) {
    if (-not $record.ContainsKey($requiredRecordKey)) {
      throw "accepted validator FAIL: completion key is absent: $requiredRecordKey"
    }
  }

  $manifestFull = [System.IO.Path]::GetFullPath(
    $record['STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST']
  )
  $validatorFull = [System.IO.Path]::GetFullPath(
    $record['ACCEPTED_VALIDATOR_PATH']
  )
  if (
    $record['D6_4_PRIVATE_VALIDATOR_RECOVERY'] -cne 'PASS' -or
    $record['D6_4'] -cne 'PASS' -or
    $record['D6_5'] -cne 'MAY_BEGIN' -or
    $record['HTTPS_REQUESTS_REPEATED'] -cne 'NO' -or
    $record['ROLLBACK_REQUIRED'] -cne 'NO' -or
    $record['RUNBOOK_CONTROL_COMMIT'] -cnotmatch '^[0-9a-f]{40}$' -or
    $record['RUNBOOK_CONTROL_COMMIT'] -ceq
      '58f374a018792f16ab30cfd548000d5b20a6b3da' -or
    $record['SEALED_REQUEST_EVIDENCE_ROOT'] -ine $fixedOriginalRoot -or
    $record['SEALED_REQUEST_CHECKSUM_MANIFEST'] -ine
      $fixedOriginalManifest -or
    $record['SEALED_REQUEST_CHECKSUM_MANIFEST_SHA256'] -cne
      $fixedOriginalManifestHash -or
    $record['SEALED_REQUEST_EVIDENCE_FILES_VERIFIED'] -cne '13' -or
    $record['ORIGINAL_DAY_VIEW_HTML'] -ine $fixedOriginalHtml -or
    $record['ORIGINAL_DAY_VIEW_SHA256'] -cne $fixedOriginalHtmlHash -or
    $record['ORIGINAL_DAY_VIEW_SIZE'] -cne '26805' -or
    $record['STRUCTURAL_VALIDATION_CONTINUATION_ROOT'] -ine $rootFull -or
    $record['STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST'] -ine
      $manifestFull -or
    $record['ACCEPTED_VALIDATOR_PATH'] -ine $validatorFull -or
    $manifestFull -ine (Join-Path $rootFull 'SHA256SUMS.txt') -or
    $validatorFull -ine (Join-Path $rootFull 'validate-day-view.py') -or
    $record['STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST_SHA256'] -cnotmatch
      '^[0-9A-F]{64}$' -or
    $record['ACCEPTED_VALIDATOR_SHA256'] -cne $fixedValidatorHash -or
    $record['VALIDATOR_RESULT'] -cne
      'DAY_VIEW_STRUCTURE=PASS mode=candidate panels=10'
  ) {
    throw 'accepted validator FAIL: completion record values are not exact'
  }

  $preManifestLeafNames = @(
    'd6-private-validator-recovery-transcript.txt',
    'runbook-control-identity.txt',
    'original-evidence-integrity.txt',
    'original-private-request-validation.txt',
    'wsl-python-runtime.txt',
    'wsl-html-integrity.txt',
    'validate-day-view.py',
    'validator-syntax-stdout.txt',
    'validator-syntax-stderr.txt',
    'validator-syntax-native-exit-status.txt',
    'validator-stdout.txt',
    'validator-stderr.txt',
    'validator-native-exit-status.txt',
    'recovery-gates-complete.txt'
  )
  $expectedRootLeaves = @(
    $preManifestLeafNames +
    'SHA256SUMS.txt' +
    'd6-private-validator-completion-summary.txt'
  )
  $rootEntries = @(
    Get-ChildItem -Force -LiteralPath $rootFull -ErrorAction Stop
  )
  if ($rootEntries.Count -ne $expectedRootLeaves.Count) {
    throw 'accepted validator FAIL: continuation root inventory count differs'
  }
  $observedLeaves = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  foreach ($rootEntry in $rootEntries) {
    if (
      -not $observedLeaves.Add($rootEntry.Name) -or
      $expectedRootLeaves -inotcontains $rootEntry.Name -or
      ($rootEntry.Attributes -band
        [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($rootEntry.Attributes -band
        [System.IO.FileAttributes]::Directory) -ne 0
    ) {
      throw "accepted validator FAIL: unexpected root entry: $($rootEntry.FullName)"
    }
  }
  foreach ($expectedRootLeaf in $expectedRootLeaves) {
    if (-not $observedLeaves.Contains($expectedRootLeaf)) {
      throw "accepted validator FAIL: root entry is absent: $expectedRootLeaf"
    }
  }

  foreach ($reliedPath in @(
    $manifestFull,
    $validatorFull
  )) {
    if (-not (Test-Path -LiteralPath $reliedPath -PathType Leaf)) {
      throw "accepted validator FAIL: relied-upon file is absent: $reliedPath"
    }
    $reliedItem = Get-Item -Force -LiteralPath $reliedPath `
      -ErrorAction Stop
    if (
      ($reliedItem.Attributes -band
        [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($reliedItem.Attributes -band
        [System.IO.FileAttributes]::Directory) -ne 0
    ) {
      throw "accepted validator FAIL: relied-upon file is not regular: $reliedPath"
    }
  }
  $originalManifestItem = Get-Item -Force `
    -LiteralPath $fixedOriginalManifestFull -ErrorAction Stop
  if (
    -not (Test-Path -LiteralPath $fixedOriginalManifestFull -PathType Leaf) -or
    ($originalManifestItem.Attributes -band
      [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
    ($originalManifestItem.Attributes -band
      [System.IO.FileAttributes]::Directory) -ne 0 -or
    $originalManifestItem.FullName -ine $fixedOriginalManifestFull -or
    [System.IO.Path]::GetDirectoryName($originalManifestItem.FullName) -ine
      $fixedOriginalRootFull
  ) {
    throw 'accepted validator FAIL: original manifest is not the exact regular child'
  }
  $originalManifestHash = (
    Get-FileHash -LiteralPath $fixedOriginalManifestFull -Algorithm SHA256
  ).Hash
  if ($originalManifestHash -cne $fixedOriginalManifestHash) {
    throw 'accepted validator FAIL: fixed original manifest hash differs'
  }

  $originalManifestLines = @(
    Get-Content -LiteralPath $fixedOriginalManifestFull -ErrorAction Stop
  )
  if ($originalManifestLines.Count -ne 13) {
    throw 'accepted validator FAIL: original manifest entry count is not 13'
  }
  $originalEntries = `
    [System.Collections.Generic.Dictionary[string,string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
  foreach ($originalManifestLine in $originalManifestLines) {
    $originalMatch = [regex]::Match(
      $originalManifestLine,
      '^([0-9A-Fa-f]{64})  (.+)$'
    )
    if (-not $originalMatch.Success) {
      throw "accepted validator FAIL: malformed original manifest line: $originalManifestLine"
    }
    $originalPathText = $originalMatch.Groups[2].Value
    $originalPath = [System.IO.Path]::GetFullPath($originalPathText)
    $originalHash = $originalMatch.Groups[1].Value.ToUpperInvariant()
    if (
      $originalPathText -ine $originalPath -or
      [System.IO.Path]::GetDirectoryName($originalPath) -ine
        $fixedOriginalRootFull -or
      $originalPath -ieq $fixedOriginalManifestFull -or
      $originalEntries.ContainsKey($originalPath)
    ) {
      throw "accepted validator FAIL: duplicate or non-immediate original path: $originalPath"
    }
    $originalItem = Get-Item -Force -LiteralPath $originalPath `
      -ErrorAction Stop
    if (
      -not (Test-Path -LiteralPath $originalPath -PathType Leaf) -or
      ($originalItem.Attributes -band
        [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($originalItem.Attributes -band
        [System.IO.FileAttributes]::Directory) -ne 0 -or
      $originalItem.FullName -ine $originalPath -or
      (Get-FileHash -LiteralPath $originalPath -Algorithm SHA256).Hash -cne
        $originalHash
    ) {
      throw "accepted validator FAIL: original manifest member does not verify: $originalPath"
    }
    $originalEntries.Add($originalPath, $originalHash)
  }
  if ($originalEntries.Count -ne 13) {
    throw 'accepted validator FAIL: original manifest membership is not exact'
  }

  $expectedOriginalLeaves = @(
    $originalEntries.Keys |
      ForEach-Object { [System.IO.Path]::GetFileName($_) }
  ) + 'SHA256SUMS.txt'
  $originalRootEntries = @(
    Get-ChildItem -Force -LiteralPath $fixedOriginalRootFull `
      -ErrorAction Stop
  )
  if ($originalRootEntries.Count -ne 14) {
    throw 'accepted validator FAIL: original root inventory count is not 14'
  }
  $observedOriginalLeaves = `
    [System.Collections.Generic.HashSet[string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
  foreach ($originalRootEntry in $originalRootEntries) {
    if (
      [System.IO.Path]::GetDirectoryName(
        [System.IO.Path]::GetFullPath($originalRootEntry.FullName)
      ) -ine $fixedOriginalRootFull -or
      -not $observedOriginalLeaves.Add($originalRootEntry.Name) -or
      $expectedOriginalLeaves -inotcontains $originalRootEntry.Name -or
      ($originalRootEntry.Attributes -band
        [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($originalRootEntry.Attributes -band
        [System.IO.FileAttributes]::Directory) -ne 0
    ) {
      throw "accepted validator FAIL: unexpected original root entry: $($originalRootEntry.FullName)"
    }
  }
  foreach ($expectedOriginalLeaf in $expectedOriginalLeaves) {
    if (-not $observedOriginalLeaves.Contains($expectedOriginalLeaf)) {
      throw "accepted validator FAIL: original root entry is absent: $expectedOriginalLeaf"
    }
  }

  if (-not $originalEntries.ContainsKey($fixedOriginalHtmlFull)) {
    throw 'accepted validator FAIL: original HTML is absent from original manifest'
  }
  $originalHtmlItem = Get-Item -Force -LiteralPath $fixedOriginalHtmlFull `
    -ErrorAction Stop
  $originalHtmlHash = (
    Get-FileHash -LiteralPath $fixedOriginalHtmlFull -Algorithm SHA256
  ).Hash
  if (
    $originalHtmlItem.FullName -ine $fixedOriginalHtmlFull -or
    $originalHtmlHash -cne $fixedOriginalHtmlHash -or
    $originalEntries[$fixedOriginalHtmlFull] -cne $originalHtmlHash -or
    $originalHtmlItem.Length -ne 26805
  ) {
    throw 'accepted validator FAIL: original Day View HTML identity differs'
  }

  $manifestHash = (
    Get-FileHash -LiteralPath $manifestFull -Algorithm SHA256
  ).Hash
  if ($manifestHash -cne
    $record['STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST_SHA256']) {
    throw 'accepted validator FAIL: continuation manifest hash differs'
  }
  $expectedManifestPaths = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  foreach ($leafName in $preManifestLeafNames) {
    $expectedPath = [System.IO.Path]::GetFullPath(
      (Join-Path $rootFull $leafName)
    )
    if (-not $expectedManifestPaths.Add($expectedPath)) {
      throw 'accepted validator FAIL: duplicate expected manifest path'
    }
  }
  $manifestEntries = [System.Collections.Generic.Dictionary[string,string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  foreach ($manifestLine in @(
    Get-Content -LiteralPath $manifestFull -ErrorAction Stop
  )) {
    $manifestMatch = [regex]::Match(
      $manifestLine,
      '^([0-9A-F]{64})  (.+)$'
    )
    if (-not $manifestMatch.Success) {
      throw "accepted validator FAIL: malformed manifest line: $manifestLine"
    }
    $entryPath = [System.IO.Path]::GetFullPath(
      $manifestMatch.Groups[2].Value
    )
    $entryHash = $manifestMatch.Groups[1].Value
    if (
      $manifestMatch.Groups[2].Value -ine $entryPath -or
      [System.IO.Path]::GetDirectoryName($entryPath) -ine $rootFull -or
      -not $expectedManifestPaths.Contains($entryPath) -or
      $manifestEntries.ContainsKey($entryPath)
    ) {
      throw "accepted validator FAIL: duplicate or unexpected manifest path: $entryPath"
    }
    $manifestEntries.Add($entryPath, $entryHash)
    $entryItem = Get-Item -Force -LiteralPath $entryPath -ErrorAction Stop
    if (
      -not (Test-Path -LiteralPath $entryPath -PathType Leaf) -or
      ($entryItem.Attributes -band
        [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($entryItem.Attributes -band
        [System.IO.FileAttributes]::Directory) -ne 0 -or
      (Get-FileHash -LiteralPath $entryPath -Algorithm SHA256).Hash -cne
        $entryHash
    ) {
      throw "accepted validator FAIL: manifest entry does not verify: $entryPath"
    }
  }
  if ($manifestEntries.Count -ne $expectedManifestPaths.Count) {
    throw 'accepted validator FAIL: continuation manifest set is incomplete'
  }
  foreach ($expectedManifestPath in $expectedManifestPaths) {
    if (-not $manifestEntries.ContainsKey($expectedManifestPath)) {
      throw "accepted validator FAIL: manifest entry is absent: $expectedManifestPath"
    }
  }

  $validatorHash = (
    Get-FileHash -LiteralPath $validatorFull -Algorithm SHA256
  ).Hash
  if (
    -not $manifestEntries.ContainsKey($validatorFull) -or
    $manifestEntries[$validatorFull] -cne $validatorHash -or
    $record['ACCEPTED_VALIDATOR_SHA256'] -cne $validatorHash
  ) {
    throw 'accepted validator FAIL: validator hash binding differs'
  }
  return [pscustomobject]@{
    CompletionRecord = $completionFull
    ContinuationRoot = $rootFull
    ManifestPath = $manifestFull
    ManifestHash = $manifestHash
    ValidatorPath = $validatorFull
    ValidatorHash = $validatorHash
    RunbookControlCommit = $record['RUNBOOK_CONTROL_COMMIT']
  }
}
```

The following PowerShell block is **one command**:

```powershell
$privateValidatorCompletionRecordPath = (Read-Host 'Accepted D6.4 final completion-record path').Trim()
```

The following PowerShell block is **one command**. It performs the first
binding check and retains only the checked result:

```powershell
$acceptedPrivateValidator = Assert-AcceptedPrivateValidatorBinding -CompletionRecordPath $privateValidatorCompletionRecordPath
```

The next PowerShell block is **a script containing one top-level function
definition**.
The function invokes `wsl.exe -d AlmaLinux-9`, captures fixed
collision-checked stdout, stderr, and native-exit evidence beside the response,
rechecks the accepted validator binding immediately before use, and returns the
accepted panel count.

```powershell
function Assert-DayViewStructure {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]
    [ValidateSet('candidate', 'rollback')][string]$Mode
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Mode Day View response is absent"
  }
  $acceptedBinding = Assert-AcceptedPrivateValidatorBinding `
    -CompletionRecordPath $privateValidatorCompletionRecordPath
  $validatorWindowsPath = $acceptedBinding.ValidatorPath

  $evidenceDirectory = Split-Path -Parent (
    [System.IO.Path]::GetFullPath($Path)
  )
  $prefix = if ($Mode -eq 'candidate') {
    'd6-private-day-view-structure'
  } else {
    'd7-private-day-view-structure'
  }
  $stdoutPath = Join-Path $evidenceDirectory "$prefix.stdout.txt"
  $stderrPath = Join-Path $evidenceDirectory "$prefix.stderr.txt"
  $exitPath = Join-Path $evidenceDirectory "$prefix.native-exit-status.txt"
  foreach ($evidencePath in @($stdoutPath, $stderrPath, $exitPath)) {
    if (Test-Path -LiteralPath $evidencePath) {
      throw "refusing to replace structural evidence: $evidencePath"
    }
  }

  $wslValidator = @(
    & wsl.exe -d AlmaLinux-9 -- /usr/bin/wslpath -a -u `
      $validatorWindowsPath
  )
  $validatorPathExit = $LASTEXITCODE
  $wslBody = @(
    & wsl.exe -d AlmaLinux-9 -- /usr/bin/wslpath -a -u `
      ([System.IO.Path]::GetFullPath($Path))
  )
  $bodyPathExit = $LASTEXITCODE
  if (
    $validatorPathExit -ne 0 -or
    $bodyPathExit -ne 0 -or
    $wslValidator.Count -ne 1 -or
    $wslBody.Count -ne 1 -or
    [string]::IsNullOrWhiteSpace($wslValidator[0]) -or
    [string]::IsNullOrWhiteSpace($wslBody[0])
  ) {
    throw "$Mode Day View WSL path conversion failed"
  }

  $immediateBinding = Assert-AcceptedPrivateValidatorBinding `
    -CompletionRecordPath $privateValidatorCompletionRecordPath
  if (
    $immediateBinding.ContinuationRoot -ine
      $acceptedBinding.ContinuationRoot -or
    $immediateBinding.ValidatorPath -ine $validatorWindowsPath -or
    $immediateBinding.ValidatorHash -cne $acceptedBinding.ValidatorHash
  ) {
    throw "$Mode Day View validator binding changed before execution"
  }
  $nativeArguments = @(
    '-d',
    'AlmaLinux-9',
    '--',
    '/usr/bin/python3',
    '-B',
    $wslValidator[0].Trim(),
    $Mode,
    $wslBody[0].Trim()
  )
  $quotedNativeArguments = @()
  foreach ($nativeArgument in $nativeArguments) {
    if ($nativeArgument -match '["\x00\r\n]') {
      throw "$Mode Day View native argument cannot be quoted safely"
    }
    $quotedNativeArguments += '"' + $nativeArgument + '"'
  }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'wsl.exe'
  $startInfo.Arguments = $quotedNativeArguments -join ' '
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    $started = $process.Start()
    if (-not $started) {
      throw "$Mode Day View validator process did not start"
    }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $nativeExit = $process.ExitCode
    $stdoutText = $stdoutTask.Result
    $stderrText = $stderrTask.Result
  }
  finally {
    $process.Dispose()
  }

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $evidencePublications = @(
    [pscustomobject]@{
      Path = $stdoutPath
      Bytes = $utf8NoBom.GetBytes($stdoutText)
    },
    [pscustomobject]@{
      Path = $stderrPath
      Bytes = $utf8NoBom.GetBytes($stderrText)
    },
    [pscustomobject]@{
      Path = $exitPath
      Bytes = [System.Text.Encoding]::ASCII.GetBytes(
        "$nativeExit$([Environment]::NewLine)"
      )
    }
  )
  foreach ($evidencePublication in $evidencePublications) {
    $evidenceStream = [System.IO.FileStream]::new(
      [System.IO.Path]::GetFullPath($evidencePublication.Path),
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    try {
      $evidenceStream.Write(
        $evidencePublication.Bytes,
        0,
        $evidencePublication.Bytes.Length
      )
      $evidenceStream.Flush($true)
    }
    finally {
      $evidenceStream.Dispose()
    }
  }

  $expectedPanels = if ($Mode -eq 'candidate') { 10 } else { 8 }
  $expectedOutput = `
    "DAY_VIEW_STRUCTURE=PASS mode=$Mode panels=$expectedPanels"
  $normalizedStdout = $stdoutText.Replace("`r`n", "`n")
  if (
    $nativeExit -ne 0 -or
    $stderrText.Length -ne 0 -or
    $normalizedStdout -cne "$expectedOutput`n" -or
    $normalizedStdout.Contains("`r")
  ) {
    throw "$Mode Day View structural validation failed"
  }
  return $expectedPanels
}
```

The binding recheck immediately before validator process construction narrows
but does not eliminate concurrent-local-writer TOCTOU risk under Windows
filesystem semantics. Private validation assumes one trusted operator and
controlled local access to the evidence parent throughout the check.

The validator is the same structure authority used for local and public
validation. It proves the ordered panels, exact in-panel headings,
`aria-labelledby` relationships, visible durable source links, empty states,
and rollback-only exclusions from parsed element structure.

Use `curl.exe` so TLS verification, redirect behavior, and HTTP status are
explicit. Do not add `--insecure` or `--location`.

```powershell
$privateHealthUrl = 'https://ops-console.tailf57e61.ts.net/api/health'
$privateHealthFile = Join-Path $privateEvidenceRoot 'd6-private-health.json'
$privateHealthMetaFile = Join-Path $privateEvidenceRoot 'd6-private-health.meta.txt'
$privateHealthStderrFile = Join-Path $privateEvidenceRoot 'd6-private-health.stderr.txt'
$privateHealthSummaryFile = Join-Path $privateEvidenceRoot 'd6-private-health.request-summary.txt'
$privateDayUrl = 'https://ops-console.tailf57e61.ts.net/day-view'
$privateDayFile = Join-Path $privateEvidenceRoot 'd6-private-day-view.html'
$privateDayMetaFile = Join-Path $privateEvidenceRoot 'd6-private-day-view.meta.txt'
$privateDayStderrFile = Join-Path $privateEvidenceRoot 'd6-private-day-view.stderr.txt'
$privateDaySummaryFile = Join-Path $privateEvidenceRoot 'd6-private-day-view.request-summary.txt'
$privateRequestEvidencePaths = @(
  $privateHealthFile,
  $privateHealthMetaFile,
  $privateHealthStderrFile,
  $privateHealthSummaryFile,
  $privateDayFile,
  $privateDayMetaFile,
  $privateDayStderrFile,
  $privateDaySummaryFile
)
Assert-PrivateEvidencePaths -ApprovedParent $privateEvidenceParent `
  -Root $privateEvidenceRoot -Paths $privateRequestEvidencePaths
```

```powershell
Initialize-PrivateRequestStderr -Path $privateHealthStderrFile
$privateHealthOutput = @(
  curl.exe --silent --show-error --connect-timeout 5 --max-time 30 --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' --output $privateHealthFile --write-out '%{http_code}|%{url_effective}|%{remote_ip}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' $privateHealthUrl 2> $privateHealthStderrFile
)
$privateHealthExit = $LASTEXITCODE
$privateHealthResult = (($privateHealthOutput -join [Environment]::NewLine).Trim())
Confirm-PrivateRequestStderr -Path $privateHealthStderrFile
@(
  "requested_url=$privateHealthUrl",
  "body_file=$privateHealthFile",
  "metadata_file=$privateHealthMetaFile",
  "stderr_file=$privateHealthStderrFile",
  "request_summary_file=$privateHealthSummaryFile",
  "curl_exit_status=$privateHealthExit",
  "write_out=$privateHealthResult"
) | Set-Content -LiteralPath $privateHealthMetaFile -ErrorAction Stop
```

```powershell
$privateHealthFields = @($privateHealthResult -split '\|', 6)
@(
  "requested_url=$privateHealthUrl",
  "body_file=$privateHealthFile",
  "metadata_file=$privateHealthMetaFile",
  "stderr_file=$privateHealthStderrFile",
  "request_summary_file=$privateHealthSummaryFile",
  "curl_native_exit_status=$privateHealthExit",
  "http_code=$($privateHealthFields[0])",
  "effective_url=$($privateHealthFields[1])",
  "remote_ip=$($privateHealthFields[2])",
  "redirect_count=$($privateHealthFields[3])",
  "redirect_url=$($privateHealthFields[4])",
  "tls_verification_result=$($privateHealthFields[5])"
) | Set-Content -LiteralPath $privateHealthSummaryFile -ErrorAction Stop
if ($privateHealthExit -ne 0) { throw "D6 private FAIL: health curl.exe exit status $privateHealthExit" }
if (
  $privateHealthFields.Count -ne 6 -or
  $privateHealthFields[0] -ne '200' -or
  $privateHealthFields[1] -ne $privateHealthUrl -or
  $privateHealthFields[2] -ne '100.98.215.31' -or
  $privateHealthFields[3] -ne '0' -or
  $privateHealthFields[4] -ne '' -or
  $privateHealthFields[5] -ne '0'
) { throw "D6 private FAIL: health destination result $privateHealthResult" }
```

```powershell
$privateHealth = Get-Content -Raw -LiteralPath $privateHealthFile -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$privateHealthProperties = @($privateHealth.PSObject.Properties.Name | Sort-Object)
if (
  $privateHealthProperties.Count -ne 2 -or
  $privateHealthProperties[0] -ne 'database' -or
  $privateHealthProperties[1] -ne 'status' -or
  $privateHealth.status -ne 'ok' -or
  $privateHealth.database -ne 'ok'
) { throw 'D6 private FAIL: invalid exact health body' }
```

```powershell
Initialize-PrivateRequestStderr -Path $privateDayStderrFile
$privateDayOutput = @(
  curl.exe --silent --show-error --connect-timeout 5 --max-time 30 --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' --output $privateDayFile --write-out '%{http_code}|%{url_effective}|%{remote_ip}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' $privateDayUrl 2> $privateDayStderrFile
)
$privateDayExit = $LASTEXITCODE
$privateDayResult = (($privateDayOutput -join [Environment]::NewLine).Trim())
Confirm-PrivateRequestStderr -Path $privateDayStderrFile
@(
  "requested_url=$privateDayUrl",
  "body_file=$privateDayFile",
  "metadata_file=$privateDayMetaFile",
  "stderr_file=$privateDayStderrFile",
  "request_summary_file=$privateDaySummaryFile",
  "curl_exit_status=$privateDayExit",
  "write_out=$privateDayResult"
) | Set-Content -LiteralPath $privateDayMetaFile -ErrorAction Stop
```

```powershell
$privateDayFields = @($privateDayResult -split '\|', 6)
@(
  "requested_url=$privateDayUrl",
  "body_file=$privateDayFile",
  "metadata_file=$privateDayMetaFile",
  "stderr_file=$privateDayStderrFile",
  "request_summary_file=$privateDaySummaryFile",
  "curl_native_exit_status=$privateDayExit",
  "http_code=$($privateDayFields[0])",
  "effective_url=$($privateDayFields[1])",
  "remote_ip=$($privateDayFields[2])",
  "redirect_count=$($privateDayFields[3])",
  "redirect_url=$($privateDayFields[4])",
  "tls_verification_result=$($privateDayFields[5])"
) | Set-Content -LiteralPath $privateDaySummaryFile -ErrorAction Stop
if ($privateDayExit -ne 0) { throw "D6 private FAIL: Day View curl.exe exit status $privateDayExit" }
if (
  $privateDayFields.Count -ne 6 -or
  $privateDayFields[0] -ne '200' -or
  $privateDayFields[1] -ne $privateDayUrl -or
  $privateDayFields[2] -ne '100.98.215.31' -or
  $privateDayFields[3] -ne '0' -or
  $privateDayFields[4] -ne '' -or
  $privateDayFields[5] -ne '0'
) { throw "D6 private FAIL: Day View destination result $privateDayResult" }
```

```powershell
$privateDayPanelCount = Assert-DayViewStructure -Path $privateDayFile -Mode candidate
if ($privateDayPanelCount -ne 10) { throw 'D6 private FAIL: structural candidate result is not ten panels' }
```

```powershell
[pscustomobject]@{
  CheckedAtUtc = [DateTime]::UtcNow.ToString('o')
  Operator = "$env:USERDOMAIN\$env:USERNAME"
  Device = $env:COMPUTERNAME
  BackendState = $tailscale.BackendState
  DarnassusIPs = (@($tailscale.Self.TailscaleIPs) -join ',')
  PrivateDNS = ($privateDns -join ',')
  HealthUrl = $privateHealthUrl
  HealthBodyFile = $privateHealthFile
  HealthMetadataFile = $privateHealthMetaFile
  HealthStderrFile = $privateHealthStderrFile
  HealthRequestSummaryFile = $privateHealthSummaryFile
  HealthCurlExit = $privateHealthExit
  HealthHttp = $privateHealthFields[0]
  HealthEffectiveUrl = $privateHealthFields[1]
  HealthRemoteIp = $privateHealthFields[2]
  HealthRedirectCount = $privateHealthFields[3]
  HealthRedirectUrl = $privateHealthFields[4]
  HealthTlsVerify = $privateHealthFields[5]
  HealthStatus = $privateHealth.status
  DatabaseStatus = $privateHealth.database
  DayUrl = $privateDayUrl
  DayBodyFile = $privateDayFile
  DayMetadataFile = $privateDayMetaFile
  DayStderrFile = $privateDayStderrFile
  DayRequestSummaryFile = $privateDaySummaryFile
  DayCurlExit = $privateDayExit
  DayHttp = $privateDayFields[0]
  DayEffectiveUrl = $privateDayFields[1]
  DayRemoteIp = $privateDayFields[2]
  DayRedirectCount = $privateDayFields[3]
  DayRedirectUrl = $privateDayFields[4]
  DayTlsVerify = $privateDayFields[5]
  ContributorCount = $privateDayPanelCount
  StructuralValidation = 'PASS'
} | Format-List | Tee-Object -FilePath (Join-Path $privateEvidenceRoot 'd6-private-summary.txt')
```

```powershell
Stop-Transcript
```

```powershell
$privateChecksumFile = Join-Path $privateEvidenceRoot 'SHA256SUMS.txt'
$privateChecksumInputs = @(
  Get-ChildItem -File $privateEvidenceRoot |
    Where-Object { $_.FullName -ne $privateChecksumFile } |
    Sort-Object FullName
)
@(
  $privateChecksumInputs | ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
    "$($hash.Hash)  $($_.FullName)"
  }
) | Out-File -FilePath $privateChecksumFile -NoClobber -Width 4096 `
  -ErrorAction Stop
foreach ($requiredRequestPath in $privateRequestEvidencePaths) {
  if (
    -not (Select-String -LiteralPath $privateChecksumFile -SimpleMatch `
      -Pattern ([System.IO.Path]::GetFullPath($requiredRequestPath)) -Quiet)
  ) {
    throw "D6 private FAIL: request evidence is absent from checksum manifest: $requiredRequestPath"
  }
}
```

The external operator must report the UTC time, device name, exact `Running`
BackendState, required Darnassus IP, exact one-address DNS result, and for each
request its native exit status, HTTP code, exact effective URL, exact remote
IP, zero redirect count, empty redirect URL, zero TLS verification result, and
correct body. Each request has fixed, collision-checked body, metadata, stderr,
and request-summary paths beneath the approved Darnassus evidence root. Native
stderr is redirected only to its request-specific file, retained even when
empty, associated in both request and candidate summaries, and included with
the body, metadata, and request summary in the final checksum manifest. The
transcript is supplementary evidence, never a stderr substitute. The Day View
result must be the same structural ten-panel candidate validation required
locally and publicly. `curl.exe` does not follow redirects. Missing external
evidence is a rollback trigger; the VPS operator must not mark D6 complete or
substitute a VPS-originated request.

### D6.5 Server — Final Repository Preservation

For the sealed D6.4 incident, the final completion record is the only
classification authority. Before any server command in D6.5, return to
Darnassus, load `Assert-AcceptedPrivateValidatorBinding` exactly as defined in
D6.4, set `$privateValidatorCompletionRecordPath` to the accepted final record,
and run the following **one compound PowerShell command/scriptblock**. It
revalidates the final marker's binding to the exact continuation inventory,
manifest hash, manifest entries, and accepted validator. It also authenticates
the fixed original manifest before parsing its exact 13 immediate members,
recomputes every member hash, rejects every reparse point or directory, and
uses `Get-ChildItem -Force` to require the exact 14-entry original-root
inventory before D6.5 may begin:

```powershell
& {
  if (
    $null -eq (
      Get-Command Assert-AcceptedPrivateValidatorBinding `
        -CommandType Function -ErrorAction SilentlyContinue
    ) -or
    [string]::IsNullOrWhiteSpace($privateValidatorCompletionRecordPath)
  ) {
    throw 'D6.5 handoff FAIL: accepted binding function or record path is absent'
  }
  $acceptedPrivateValidator = Assert-AcceptedPrivateValidatorBinding `
    -CompletionRecordPath $privateValidatorCompletionRecordPath
  Write-Output 'D6_5_PRIVATE_RECOVERY_BINDING=VERIFIED'
  Write-Output "RUNBOOK_CONTROL_COMMIT=$($acceptedPrivateValidator.RunbookControlCommit)"
  Write-Output "STRUCTURAL_VALIDATION_CONTINUATION_ROOT=$($acceptedPrivateValidator.ContinuationRoot)"
  Write-Output "STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST=$($acceptedPrivateValidator.ManifestPath)"
  Write-Output "STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST_SHA256=$($acceptedPrivateValidator.ManifestHash)"
  Write-Output "ACCEPTED_VALIDATOR_PATH=$($acceptedPrivateValidator.ValidatorPath)"
  Write-Output "ACCEPTED_VALIDATOR_SHA256=$($acceptedPrivateValidator.ValidatorHash)"
}
```

Stop unless the command exits successfully and its reported control commit is
the exact approved `$RUNBOOK_CONTROL_COMMIT` used on the server. This read-only
handoff must show that the final record says `D6_4=PASS` and
`D6_5=MAY_BEGIN`; a non-final gate file or a temporary publication file is not
authority. Then verify that execution did not alter the server repository:

```bash
test "$(git rev-parse HEAD)" = "$RUNBOOK_CONTROL_COMMIT"
```

```bash
test "$(git rev-parse refs/heads/main)" = "$RUNBOOK_CONTROL_COMMIT"
```

```bash
test "$(git rev-parse refs/remotes/origin/main)" = "$RUNBOOK_CONTROL_COMMIT"
```

```bash
test -z "$(git status --porcelain=v1 --untracked-files=all)"
```

## D7 — Conditional Application Rollback

Checkpoint D must roll back the application if any of these occurs:

- The candidate fails to start or local readiness does not pass within 120
  seconds.
- Health does not report HTTP 200 with exact application `ok` and database
  `ok` states.
- Candidate index, platform, config, label, or running-container identity does
  not match its recorded layer.
- Day View is not exactly ten contributors with the required labels, order,
  empty states, and source links.
- A required local, public, or private route fails.
- The application is not loopback-only.
- PostgreSQL is recreated, restarted, unhealthy, published, detached from its
  volume or network, or otherwise differs from the fixed baseline.
- Private or public proxy validation fails.
- An unexpected NAM Compose container exists.
- Repository identity or cleanliness changes.

An unexpected PostgreSQL change is also an infrastructure incident. The
application rollback below must not attempt to restore or alter the database.

### D7.1 Rollback Authorization And Command

Recheck the only allowed rollback authority:

```bash
test "$(docker image inspect "$NAM_D_ROLLBACK" --format '{{.Id}}')" = 'sha256:8cba9cb2122f9010ff815d56056866b7fe910d958f70d3a3bb6ca74d3a82ef95'
```

**Approval point:** use an explicitly pre-authorized rollback decision or
obtain operator authorization now. Execute only this application-service
replacement:

```bash
docker compose -p nam -f compose.yaml -f "$NAM_D_ROLLBACK_OVERRIDE" \
  up -d --no-deps --no-build --pull never --force-recreate app
```

This uses the same override mechanism as D5, leaves PostgreSQL untouched, and
does not retag any image. Preserve the failed candidate, its tag, the build
context, logs, metadata, overrides, and all failure evidence.

### D7.2 Rollback Validation

Require the complete rollback identity chain and bounded local readiness. The
rollback container must reference the immutable rollback tag, resolve to the
accepted rollback OCI index, expose the accepted `linux/amd64` manifest
descriptor, and link that selected manifest to the accepted rollback config:

```bash
test "$(docker image inspect "$NAM_D_ROLLBACK" --format '{{.Id}}')" = \
  "$NAM_D_ROLLBACK_INDEX"
```

```bash
test "$(docker inspect nam-app --format '{{.Config.Image}}')" = \
  "$NAM_D_ROLLBACK"
```

```bash
test "$(docker inspect nam-app --format '{{.Image}}')" = \
  "$NAM_D_ROLLBACK_INDEX"
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.MediaType}}'
)" = 'application/vnd.oci.image.manifest.v1+json'
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Digest}}'
)" = "$NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID"
```

```bash
test "$NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID" = \
  'sha256:9245ca496b592eec9fe39011d704e39db76d95e32d95838e685e98de8ae4420b'
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Platform.OS}}'
)" = 'linux'
```

```bash
test "$(
  docker inspect nam-app \
    --format '{{.ImageManifestDescriptor.Platform.Architecture}}'
)" = 'amd64'
```

```bash
test "$(
  tar -xOf "$NAM_D_ROLLBACK_OCI_ARCHIVE" \
    "blobs/sha256/${NAM_D_ROLLBACK_PLATFORM_MANIFEST_ID#sha256:}" \
    | jq -er '.config.digest'
)" = "$NAM_D_ROLLBACK_CONFIG_ID"
```

```bash
test "$NAM_D_ROLLBACK_CONFIG_ID" = \
  'sha256:d3408873dabab192f3b4e8fcedf6834953b0028f68c385d92e7a539bc5789633'
```

```bash
NAM_D_ROLLBACK_HEALTH_STARTED=$SECONDS
NAM_D_ROLLBACK_DEADLINE=$((NAM_D_ROLLBACK_HEALTH_STARTED + 120))
NAM_D_ROLLBACK_ATTEMPT=0
NAM_D_ROLLBACK_READY='no'
while :; do
  NAM_D_ROLLBACK_REMAINING=$((NAM_D_ROLLBACK_DEADLINE - SECONDS))
  (( NAM_D_ROLLBACK_REMAINING > 0 )) || break
  NAM_D_ROLLBACK_ATTEMPT=$((NAM_D_ROLLBACK_ATTEMPT + 1))
  printf -v NAM_D_ROLLBACK_ATTEMPT_ID '%03d' "$NAM_D_ROLLBACK_ATTEMPT"
  NAM_D_ROLLBACK_BODY="$NAM_D_EXECUTION_ROOT/evidence/d7-local-health-attempt-$NAM_D_ROLLBACK_ATTEMPT_ID.json"
  NAM_D_ROLLBACK_META="$NAM_D_EXECUTION_ROOT/evidence/d7-local-health-attempt-$NAM_D_ROLLBACK_ATTEMPT_ID.meta.txt"
  NAM_D_ROLLBACK_STDERR="$NAM_D_EXECUTION_ROOT/evidence/d7-local-health-attempt-$NAM_D_ROLLBACK_ATTEMPT_ID.stderr.txt"
  if ! { : > "$NAM_D_ROLLBACK_BODY" && : > "$NAM_D_ROLLBACK_STDERR"; }; then
    printf 'D7 rollback readiness FAIL: cannot create attempt evidence\n' >&2
    break
  fi
  NAM_D_ROLLBACK_CONNECT_TIMEOUT=$NAM_D_ROLLBACK_REMAINING
  (( NAM_D_ROLLBACK_CONNECT_TIMEOUT <= 5 )) \
    || NAM_D_ROLLBACK_CONNECT_TIMEOUT=5
  NAM_D_ROLLBACK_RESULT=''
  NAM_D_ROLLBACK_CURL_STATUS=0
  NAM_D_ROLLBACK_RESULT="$(curl --silent --show-error \
    --connect-timeout "$NAM_D_ROLLBACK_CONNECT_TIMEOUT" \
    --max-time "$NAM_D_ROLLBACK_REMAINING" \
    --header 'Cache-Control: no-cache' \
    --header 'Pragma: no-cache' \
    --output "$NAM_D_ROLLBACK_BODY" \
    --write-out '%{http_code}|%{url_effective}|%{time_total}' \
    http://127.0.0.1:3000/api/health \
    2>"$NAM_D_ROLLBACK_STDERR")" \
    || NAM_D_ROLLBACK_CURL_STATUS=$?
  if ! printf 'requested_url=%s\nattempt=%s\nremaining_before_request_seconds=%s\nconnect_timeout_seconds=%s\ntotal_timeout_seconds=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\nstderr_file=%s\n' \
      'http://127.0.0.1:3000/api/health' \
      "$NAM_D_ROLLBACK_ATTEMPT_ID" "$NAM_D_ROLLBACK_REMAINING" \
      "$NAM_D_ROLLBACK_CONNECT_TIMEOUT" "$NAM_D_ROLLBACK_REMAINING" \
      "$NAM_D_ROLLBACK_CURL_STATUS" "$NAM_D_ROLLBACK_RESULT" \
      "$NAM_D_ROLLBACK_BODY" "$NAM_D_ROLLBACK_STDERR" \
      > "$NAM_D_ROLLBACK_META"
  then
    printf 'D7 rollback readiness FAIL: cannot write attempt metadata\n' >&2
    break
  fi
  IFS='|' read -r NAM_D_ROLLBACK_HTTP NAM_D_ROLLBACK_EFFECTIVE \
    NAM_D_ROLLBACK_TIME_TOTAL <<< "$NAM_D_ROLLBACK_RESULT"
  if [[ "$NAM_D_ROLLBACK_CURL_STATUS" -eq 0 \
      && "$NAM_D_ROLLBACK_HTTP" == '200' \
      && "$NAM_D_ROLLBACK_EFFECTIVE" == 'http://127.0.0.1:3000/api/health' ]] \
    && jq -e '
      type == "object"
      and (keys == ["database","status"])
      and .status == "ok"
      and .database == "ok"
    ' "$NAM_D_ROLLBACK_BODY" >/dev/null 2>&1
  then
    NAM_D_ROLLBACK_READY='yes'
    break
  fi
  NAM_D_ROLLBACK_REMAINING=$((NAM_D_ROLLBACK_DEADLINE - SECONDS))
  (( NAM_D_ROLLBACK_REMAINING > 0 )) || break
  NAM_D_ROLLBACK_SLEEP=2
  (( NAM_D_ROLLBACK_SLEEP <= NAM_D_ROLLBACK_REMAINING )) \
    || NAM_D_ROLLBACK_SLEEP=$NAM_D_ROLLBACK_REMAINING
  sleep "$NAM_D_ROLLBACK_SLEEP"
done
NAM_D_ROLLBACK_HEALTH_ELAPSED=$((SECONDS - NAM_D_ROLLBACK_HEALTH_STARTED))
test "$NAM_D_ROLLBACK_HEALTH_ELAPSED" -le 120 \
  && test "$NAM_D_ROLLBACK_READY" = 'yes'
```

The rollback readiness clock, request budgets, exact JSON contract, fresh
attempt files, and evidence-preservation rules are identical to D5. A rollback
readiness timeout or invalid health result leaves rollback validation failed;
it never authorizes a database action or an unbounded retry.

Require the fixed PostgreSQL, volume, network, and exposure baseline:

```bash
test "$(docker inspect nam-postgres --format '{{.Id}}|{{.State.StartedAt}}|{{.RestartCount}}|{{.State.Health.Status}}')" = '0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1|2026-06-30T18:17:12.705151191Z|0|healthy'
```

```bash
test "$(docker inspect nam-postgres --format '{{len .Mounts}}|{{(index .Mounts 0).Name}}|{{(index .Mounts 0).Destination}}|{{json .NetworkSettings.Ports}}')" = '1|postgres-data|/var/lib/postgresql|{"5432/tcp":null}'
```

```bash
test "$(docker network inspect nam-network --format '{{.Id}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker inspect nam-postgres --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker port nam-app 3000/tcp)" = '127.0.0.1:3000'
```

```bash
test "$(docker inspect nam-app --format '{{json .NetworkSettings.Ports}}')" = '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3000"}]}'
```

```bash
test "$(docker inspect nam-app --format '{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}{{end}}')" = 'e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
```

```bash
test "$(docker ps -a --filter label=com.docker.compose.project=nam --format '{{.Names}}' | sort)" = $'nam-app\nnam-postgres'
```

```bash
test "$(docker compose -p nam -f compose.yaml ps -a --services | sort)" = $'app\npostgres'
```

Capture the known old Day View baseline locally and publicly:

```bash
NAM_D_ROLLBACK_LOCAL_DAY_RESULT=''
NAM_D_ROLLBACK_LOCAL_DAY_CURL_STATUS=0
NAM_D_ROLLBACK_LOCAL_DAY_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d7-local-day-view.html" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}' \
  http://127.0.0.1:3000/day-view)" \
  || NAM_D_ROLLBACK_LOCAL_DAY_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'http://127.0.0.1:3000/day-view' "$NAM_D_ROLLBACK_LOCAL_DAY_CURL_STATUS" \
  "$NAM_D_ROLLBACK_LOCAL_DAY_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d7-local-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d7-local-day-view.meta.txt" \
  && test "$NAM_D_ROLLBACK_LOCAL_DAY_CURL_STATUS" -eq 0
IFS='|' read -r NAM_D_ROLLBACK_LOCAL_DAY_HTTP \
  NAM_D_ROLLBACK_LOCAL_DAY_EFFECTIVE NAM_D_ROLLBACK_LOCAL_DAY_REDIRECTS \
  NAM_D_ROLLBACK_LOCAL_DAY_REDIRECT_URL <<< "$NAM_D_ROLLBACK_LOCAL_DAY_RESULT"
test "$NAM_D_ROLLBACK_LOCAL_DAY_HTTP" = '200' \
  && test "$NAM_D_ROLLBACK_LOCAL_DAY_EFFECTIVE" = 'http://127.0.0.1:3000/day-view' \
  && test "$NAM_D_ROLLBACK_LOCAL_DAY_REDIRECTS" = '0' \
  && test -z "$NAM_D_ROLLBACK_LOCAL_DAY_REDIRECT_URL"
python3 "$NAM_D_DAY_VIEW_VALIDATOR" rollback \
  "$NAM_D_EXECUTION_ROOT/evidence/d7-local-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d7-local-day-view-structure.txt"
```

```bash
NAM_D_ROLLBACK_PUBLIC_HEALTH_RESULT=''
NAM_D_ROLLBACK_PUBLIC_HEALTH_CURL_STATUS=0
NAM_D_ROLLBACK_PUBLIC_HEALTH_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d7-public-health.json" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' \
  https://dev.alemany.me/api/health)" \
  || NAM_D_ROLLBACK_PUBLIC_HEALTH_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'https://dev.alemany.me/api/health' \
  "$NAM_D_ROLLBACK_PUBLIC_HEALTH_CURL_STATUS" \
  "$NAM_D_ROLLBACK_PUBLIC_HEALTH_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d7-public-health.json" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d7-public-health.meta.txt" \
  && test "$NAM_D_ROLLBACK_PUBLIC_HEALTH_CURL_STATUS" -eq 0
IFS='|' read -r NAM_D_ROLLBACK_PUBLIC_HEALTH_HTTP \
  NAM_D_ROLLBACK_PUBLIC_HEALTH_EFFECTIVE \
  NAM_D_ROLLBACK_PUBLIC_HEALTH_REDIRECTS \
  NAM_D_ROLLBACK_PUBLIC_HEALTH_REDIRECT_URL \
  NAM_D_ROLLBACK_PUBLIC_HEALTH_TLS \
  <<< "$NAM_D_ROLLBACK_PUBLIC_HEALTH_RESULT"
test "$NAM_D_ROLLBACK_PUBLIC_HEALTH_HTTP" = '200' \
  && test "$NAM_D_ROLLBACK_PUBLIC_HEALTH_EFFECTIVE" = 'https://dev.alemany.me/api/health' \
  && test "$NAM_D_ROLLBACK_PUBLIC_HEALTH_REDIRECTS" = '0' \
  && test -z "$NAM_D_ROLLBACK_PUBLIC_HEALTH_REDIRECT_URL" \
  && test "$NAM_D_ROLLBACK_PUBLIC_HEALTH_TLS" = '0'
jq -e '
  type == "object"
  and (keys == ["database","status"])
  and .status == "ok"
  and .database == "ok"
' "$NAM_D_EXECUTION_ROOT/evidence/d7-public-health.json" >/dev/null
```

```bash
NAM_D_ROLLBACK_PUBLIC_DAY_RESULT=''
NAM_D_ROLLBACK_PUBLIC_DAY_CURL_STATUS=0
NAM_D_ROLLBACK_PUBLIC_DAY_RESULT="$(curl --silent --show-error \
  --connect-timeout 5 --max-time 30 \
  --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' \
  --output "$NAM_D_EXECUTION_ROOT/evidence/d7-public-day-view.html" \
  --write-out '%{http_code}|%{url_effective}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' \
  https://dev.alemany.me/day-view)" \
  || NAM_D_ROLLBACK_PUBLIC_DAY_CURL_STATUS=$?
printf 'requested_url=%s\ncurl_exit_status=%s\nwrite_out=%s\nbody_file=%s\n' \
  'https://dev.alemany.me/day-view' \
  "$NAM_D_ROLLBACK_PUBLIC_DAY_CURL_STATUS" \
  "$NAM_D_ROLLBACK_PUBLIC_DAY_RESULT" \
  "$NAM_D_EXECUTION_ROOT/evidence/d7-public-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d7-public-day-view.meta.txt" \
  && test "$NAM_D_ROLLBACK_PUBLIC_DAY_CURL_STATUS" -eq 0
IFS='|' read -r NAM_D_ROLLBACK_PUBLIC_DAY_HTTP \
  NAM_D_ROLLBACK_PUBLIC_DAY_EFFECTIVE NAM_D_ROLLBACK_PUBLIC_DAY_REDIRECTS \
  NAM_D_ROLLBACK_PUBLIC_DAY_REDIRECT_URL NAM_D_ROLLBACK_PUBLIC_DAY_TLS \
  <<< "$NAM_D_ROLLBACK_PUBLIC_DAY_RESULT"
test "$NAM_D_ROLLBACK_PUBLIC_DAY_HTTP" = '200' \
  && test "$NAM_D_ROLLBACK_PUBLIC_DAY_EFFECTIVE" = 'https://dev.alemany.me/day-view' \
  && test "$NAM_D_ROLLBACK_PUBLIC_DAY_REDIRECTS" = '0' \
  && test -z "$NAM_D_ROLLBACK_PUBLIC_DAY_REDIRECT_URL" \
  && test "$NAM_D_ROLLBACK_PUBLIC_DAY_TLS" = '0'
python3 "$NAM_D_DAY_VIEW_VALIDATOR" rollback \
  "$NAM_D_EXECUTION_ROOT/evidence/d7-public-day-view.html" \
  > "$NAM_D_EXECUTION_ROOT/evidence/d7-public-day-view-structure.txt"
```

Both parser calls must print
`DAY_VIEW_STRUCTURE=PASS mode=rollback panels=8`. The exact known eight panels,
their order, in-panel headings, `aria-labelledby` relationships, and source
links are required; the Operational Safety Checklists and Equipment Fuel Events
panels and heading IDs must be absent. Public rollback validation is
structurally equivalent to local rollback validation.

### D7.3 Darnassus — External Rollback Validation

Run these commands in PowerShell on Darnassus. They deliberately expect the
known eight-contributor rollback baseline, not the D6 candidate result.
First define the exact fixed request-evidence leaf-name namespace,
`Assert-PrivateEvidencePaths`, `Initialize-PrivateRequestStderr`,
`Confirm-PrivateRequestStderr`, `Assert-AcceptedPrivateValidatorBinding`, and
the WSL-backed `Assert-DayViewStructure` definition from D6.4 in this
PowerShell session. Set `$privateValidatorCompletionRecordPath` to the accepted
D6.4 final completion record; the validator path is derived from that record
and may not be supplied independently. Require that root, its exact inventory,
and its checksum manifest to have passed the
[Checkpoint D Private Validator Recovery](checkpoint-d-private-validator-recovery.md).
Do not use the retired Windows COM parser. This setup is required even when D7
is invoked before any new external rollback request.

The following PowerShell block is **a script containing multiple top-level
statements**:

```powershell
$requiredPrivateFunctions = @(
  'Assert-PrivateEvidencePaths',
  'Initialize-PrivateRequestStderr',
  'Confirm-PrivateRequestStderr',
  'Assert-AcceptedPrivateValidatorBinding',
  'Assert-DayViewStructure'
)
foreach ($requiredPrivateFunction in $requiredPrivateFunctions) {
  if (
    $null -eq (Get-Command $requiredPrivateFunction -CommandType Function `
      -ErrorAction SilentlyContinue)
  ) {
    throw "D7 private FAIL: required function is not loaded: $requiredPrivateFunction"
  }
}
if (
  [string]::IsNullOrWhiteSpace($privateValidatorCompletionRecordPath)
) {
  throw 'D7 private FAIL: accepted D6.4 final completion record is absent'
}
$acceptedPrivateValidator = Assert-AcceptedPrivateValidatorBinding `
  -CompletionRecordPath $privateValidatorCompletionRecordPath
if (
  @($privateRequestEvidenceLeafNames | Sort-Object -Unique).Count -ne 16
) {
  throw 'D7 private FAIL: four-request evidence namespace is incomplete or colliding'
}
```

Close a D6 transcript that may still be active after a failed private check.
This preserves that transcript and does not delete or overwrite evidence:

```powershell
Stop-Transcript -ErrorAction SilentlyContinue
```

```powershell
$rollbackPrivateEvidenceParent = Join-Path $env:USERPROFILE 'nam-deployment-evidence'; New-Item -ItemType Directory -Path $rollbackPrivateEvidenceParent -Force | Out-Null
```

```powershell
$rollbackPrivateExecutionId = "checkpoint-d-rollback-76cdba9530e4-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))"; $rollbackPrivateEvidenceRoot = Join-Path $rollbackPrivateEvidenceParent $rollbackPrivateExecutionId; New-Item -ItemType Directory -Path $rollbackPrivateEvidenceRoot -ErrorAction Stop | Out-Null
```

```powershell
Start-Transcript -Path (Join-Path $rollbackPrivateEvidenceRoot 'd7-private-transcript.txt') -NoClobber
```

```powershell
$privateHostName = 'ops-console.tailf57e61.ts.net'
$tailscale = tailscale status --json | ConvertFrom-Json
if ($tailscale.BackendState -ne 'Running') { throw "D7 private FAIL: BackendState is $($tailscale.BackendState)" }
if (@($tailscale.Self.TailscaleIPs) -notcontains '100.121.217.67') { throw 'D7 private FAIL: Darnassus does not include 100.121.217.67' }
```

```powershell
$privateDns = @(Resolve-DnsName -Name $privateHostName -Type A -DnsOnly | Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress | Sort-Object -Unique); if ($privateDns.Count -ne 1 -or $privateDns[0] -ne '100.98.215.31') { throw "D7 private FAIL: unexpected DNS result: $($privateDns -join ',')" }
```

```powershell
$rollbackPrivateHealthUrl = 'https://ops-console.tailf57e61.ts.net/api/health'
$rollbackPrivateHealthFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-health.json'
$rollbackPrivateHealthMetaFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-health.meta.txt'
$rollbackPrivateHealthStderrFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-health.stderr.txt'
$rollbackPrivateHealthSummaryFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-health.request-summary.txt'
$rollbackPrivateDayUrl = 'https://ops-console.tailf57e61.ts.net/day-view'
$rollbackPrivateDayFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-day-view.html'
$rollbackPrivateDayMetaFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-day-view.meta.txt'
$rollbackPrivateDayStderrFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-day-view.stderr.txt'
$rollbackPrivateDaySummaryFile = Join-Path $rollbackPrivateEvidenceRoot 'd7-private-day-view.request-summary.txt'
$rollbackPrivateRequestEvidencePaths = @(
  $rollbackPrivateHealthFile,
  $rollbackPrivateHealthMetaFile,
  $rollbackPrivateHealthStderrFile,
  $rollbackPrivateHealthSummaryFile,
  $rollbackPrivateDayFile,
  $rollbackPrivateDayMetaFile,
  $rollbackPrivateDayStderrFile,
  $rollbackPrivateDaySummaryFile
)
Assert-PrivateEvidencePaths -ApprovedParent $rollbackPrivateEvidenceParent `
  -Root $rollbackPrivateEvidenceRoot `
  -Paths $rollbackPrivateRequestEvidencePaths
Initialize-PrivateRequestStderr -Path $rollbackPrivateHealthStderrFile
$rollbackPrivateHealthOutput = @(
  curl.exe --silent --show-error --connect-timeout 5 --max-time 30 --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' --output $rollbackPrivateHealthFile --write-out '%{http_code}|%{url_effective}|%{remote_ip}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' $rollbackPrivateHealthUrl 2> $rollbackPrivateHealthStderrFile
)
$rollbackPrivateHealthExit = $LASTEXITCODE
$rollbackPrivateHealthResult = (($rollbackPrivateHealthOutput -join [Environment]::NewLine).Trim())
Confirm-PrivateRequestStderr -Path $rollbackPrivateHealthStderrFile
@(
  "requested_url=$rollbackPrivateHealthUrl",
  "body_file=$rollbackPrivateHealthFile",
  "metadata_file=$rollbackPrivateHealthMetaFile",
  "stderr_file=$rollbackPrivateHealthStderrFile",
  "request_summary_file=$rollbackPrivateHealthSummaryFile",
  "curl_exit_status=$rollbackPrivateHealthExit",
  "write_out=$rollbackPrivateHealthResult"
) | Set-Content -LiteralPath $rollbackPrivateHealthMetaFile -ErrorAction Stop
```

```powershell
$rollbackPrivateHealthFields = @($rollbackPrivateHealthResult -split '\|', 6)
@(
  "requested_url=$rollbackPrivateHealthUrl",
  "body_file=$rollbackPrivateHealthFile",
  "metadata_file=$rollbackPrivateHealthMetaFile",
  "stderr_file=$rollbackPrivateHealthStderrFile",
  "request_summary_file=$rollbackPrivateHealthSummaryFile",
  "curl_native_exit_status=$rollbackPrivateHealthExit",
  "http_code=$($rollbackPrivateHealthFields[0])",
  "effective_url=$($rollbackPrivateHealthFields[1])",
  "remote_ip=$($rollbackPrivateHealthFields[2])",
  "redirect_count=$($rollbackPrivateHealthFields[3])",
  "redirect_url=$($rollbackPrivateHealthFields[4])",
  "tls_verification_result=$($rollbackPrivateHealthFields[5])"
) | Set-Content -LiteralPath $rollbackPrivateHealthSummaryFile -ErrorAction Stop
if ($rollbackPrivateHealthExit -ne 0) { throw "D7 private FAIL: health curl.exe exit status $rollbackPrivateHealthExit" }
if (
  $rollbackPrivateHealthFields.Count -ne 6 -or
  $rollbackPrivateHealthFields[0] -ne '200' -or
  $rollbackPrivateHealthFields[1] -ne $rollbackPrivateHealthUrl -or
  $rollbackPrivateHealthFields[2] -ne '100.98.215.31' -or
  $rollbackPrivateHealthFields[3] -ne '0' -or
  $rollbackPrivateHealthFields[4] -ne '' -or
  $rollbackPrivateHealthFields[5] -ne '0'
) { throw "D7 private FAIL: health destination result $rollbackPrivateHealthResult" }
$rollbackPrivateHealth = Get-Content -Raw -LiteralPath $rollbackPrivateHealthFile -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$rollbackPrivateHealthProperties = @($rollbackPrivateHealth.PSObject.Properties.Name | Sort-Object)
if (
  $rollbackPrivateHealthProperties.Count -ne 2 -or
  $rollbackPrivateHealthProperties[0] -ne 'database' -or
  $rollbackPrivateHealthProperties[1] -ne 'status' -or
  $rollbackPrivateHealth.status -ne 'ok' -or
  $rollbackPrivateHealth.database -ne 'ok'
) { throw 'D7 private FAIL: invalid exact health body' }
```

```powershell
Initialize-PrivateRequestStderr -Path $rollbackPrivateDayStderrFile
$rollbackPrivateDayOutput = @(
  curl.exe --silent --show-error --connect-timeout 5 --max-time 30 --header 'Cache-Control: no-cache' --header 'Pragma: no-cache' --output $rollbackPrivateDayFile --write-out '%{http_code}|%{url_effective}|%{remote_ip}|%{num_redirects}|%{redirect_url}|%{ssl_verify_result}' $rollbackPrivateDayUrl 2> $rollbackPrivateDayStderrFile
)
$rollbackPrivateDayExit = $LASTEXITCODE
$rollbackPrivateDayResult = (($rollbackPrivateDayOutput -join [Environment]::NewLine).Trim())
Confirm-PrivateRequestStderr -Path $rollbackPrivateDayStderrFile
@(
  "requested_url=$rollbackPrivateDayUrl",
  "body_file=$rollbackPrivateDayFile",
  "metadata_file=$rollbackPrivateDayMetaFile",
  "stderr_file=$rollbackPrivateDayStderrFile",
  "request_summary_file=$rollbackPrivateDaySummaryFile",
  "curl_exit_status=$rollbackPrivateDayExit",
  "write_out=$rollbackPrivateDayResult"
) | Set-Content -LiteralPath $rollbackPrivateDayMetaFile -ErrorAction Stop
```

```powershell
$rollbackPrivateDayFields = @($rollbackPrivateDayResult -split '\|', 6)
@(
  "requested_url=$rollbackPrivateDayUrl",
  "body_file=$rollbackPrivateDayFile",
  "metadata_file=$rollbackPrivateDayMetaFile",
  "stderr_file=$rollbackPrivateDayStderrFile",
  "request_summary_file=$rollbackPrivateDaySummaryFile",
  "curl_native_exit_status=$rollbackPrivateDayExit",
  "http_code=$($rollbackPrivateDayFields[0])",
  "effective_url=$($rollbackPrivateDayFields[1])",
  "remote_ip=$($rollbackPrivateDayFields[2])",
  "redirect_count=$($rollbackPrivateDayFields[3])",
  "redirect_url=$($rollbackPrivateDayFields[4])",
  "tls_verification_result=$($rollbackPrivateDayFields[5])"
) | Set-Content -LiteralPath $rollbackPrivateDaySummaryFile -ErrorAction Stop
if ($rollbackPrivateDayExit -ne 0) { throw "D7 private FAIL: Day View curl.exe exit status $rollbackPrivateDayExit" }
if (
  $rollbackPrivateDayFields.Count -ne 6 -or
  $rollbackPrivateDayFields[0] -ne '200' -or
  $rollbackPrivateDayFields[1] -ne $rollbackPrivateDayUrl -or
  $rollbackPrivateDayFields[2] -ne '100.98.215.31' -or
  $rollbackPrivateDayFields[3] -ne '0' -or
  $rollbackPrivateDayFields[4] -ne '' -or
  $rollbackPrivateDayFields[5] -ne '0'
) { throw "D7 private FAIL: Day View destination result $rollbackPrivateDayResult" }
```

```powershell
$rollbackPrivateDayPanelCount = Assert-DayViewStructure -Path $rollbackPrivateDayFile -Mode rollback
if ($rollbackPrivateDayPanelCount -ne 8) { throw 'D7 private FAIL: structural rollback result is not eight panels' }
```

```powershell
[pscustomobject]@{
  CheckedAtUtc = [DateTime]::UtcNow.ToString('o')
  Operator = "$env:USERDOMAIN\$env:USERNAME"
  Device = $env:COMPUTERNAME
  BackendState = $tailscale.BackendState
  DarnassusIPs = (@($tailscale.Self.TailscaleIPs) -join ',')
  PrivateDNS = ($privateDns -join ',')
  HealthUrl = $rollbackPrivateHealthUrl
  HealthBodyFile = $rollbackPrivateHealthFile
  HealthMetadataFile = $rollbackPrivateHealthMetaFile
  HealthStderrFile = $rollbackPrivateHealthStderrFile
  HealthRequestSummaryFile = $rollbackPrivateHealthSummaryFile
  HealthCurlExit = $rollbackPrivateHealthExit
  HealthHttp = $rollbackPrivateHealthFields[0]
  HealthEffectiveUrl = $rollbackPrivateHealthFields[1]
  HealthRemoteIp = $rollbackPrivateHealthFields[2]
  HealthRedirectCount = $rollbackPrivateHealthFields[3]
  HealthRedirectUrl = $rollbackPrivateHealthFields[4]
  HealthTlsVerify = $rollbackPrivateHealthFields[5]
  HealthStatus = $rollbackPrivateHealth.status
  DatabaseStatus = $rollbackPrivateHealth.database
  DayUrl = $rollbackPrivateDayUrl
  DayBodyFile = $rollbackPrivateDayFile
  DayMetadataFile = $rollbackPrivateDayMetaFile
  DayStderrFile = $rollbackPrivateDayStderrFile
  DayRequestSummaryFile = $rollbackPrivateDaySummaryFile
  DayCurlExit = $rollbackPrivateDayExit
  DayHttp = $rollbackPrivateDayFields[0]
  DayEffectiveUrl = $rollbackPrivateDayFields[1]
  DayRemoteIp = $rollbackPrivateDayFields[2]
  DayRedirectCount = $rollbackPrivateDayFields[3]
  DayRedirectUrl = $rollbackPrivateDayFields[4]
  DayTlsVerify = $rollbackPrivateDayFields[5]
  ContributorCount = $rollbackPrivateDayPanelCount
  StructuralValidation = 'PASS'
} | Format-List | Tee-Object -FilePath (Join-Path $rollbackPrivateEvidenceRoot 'd7-private-summary.txt')
```

```powershell
Stop-Transcript
```

```powershell
$rollbackPrivateChecksumFile = Join-Path $rollbackPrivateEvidenceRoot 'SHA256SUMS.txt'
$rollbackPrivateChecksumInputs = @(
  Get-ChildItem -File $rollbackPrivateEvidenceRoot |
    Where-Object { $_.FullName -ne $rollbackPrivateChecksumFile } |
    Sort-Object FullName
)
@(
  $rollbackPrivateChecksumInputs | ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
    "$($hash.Hash)  $($_.FullName)"
  }
) | Out-File -FilePath $rollbackPrivateChecksumFile `
  -NoClobber -Width 4096 -ErrorAction Stop
foreach ($requiredRequestPath in $rollbackPrivateRequestEvidencePaths) {
  if (
    -not (Select-String -LiteralPath $rollbackPrivateChecksumFile `
      -SimpleMatch `
      -Pattern ([System.IO.Path]::GetFullPath($requiredRequestPath)) -Quiet)
  ) {
    throw "D7 private FAIL: request evidence is absent from checksum manifest: $requiredRequestPath"
  }
}
```

Preserve the external UTC timestamp, operator, exact tailnet state, exact DNS,
and both requests' native exit, HTTP, effective URL, remote IP, redirect count,
redirect URL, TLS, and body results. Each rollback request retains its unique
body, metadata, stderr, and request-summary paths beneath the approved
Darnassus rollback evidence root; the rollback summary associates those paths,
and the checksum manifest must include every one. Empty stderr remains evidence,
and the transcript is not a substitute. The rollback Day View must pass the
exact eight-panel standard-library structural validation through
`wsl.exe -d AlmaLinux-9` and explicitly exclude both new contributor panels.
The VPS cannot substitute for either rollback request.

Finally require repository cleanliness:

```bash
test "$(git rev-parse HEAD)" = "$RUNBOOK_CONTROL_COMMIT" && test "$(git rev-parse refs/heads/main)" = "$RUNBOOK_CONTROL_COMMIT" && test "$(git rev-parse refs/remotes/origin/main)" = "$RUNBOOK_CONTROL_COMMIT" && test -z "$(git status --porcelain=v1 --untracked-files=all)"
```

Checkpoint D remains **failed** even when rollback restores service. Do not
couple application rollback to database restoration.

Do not load the offline V17 archive unless the verified Docker rollback tag is
actually unavailable and a separately reviewed and approved recovery procedure
authorizes the load. Archive loading is not a Checkpoint D action.

## D8 — Acceptance And Evidence Capture

Checkpoint D may pass only when D1 through D6 pass without invoking D7. If D7
is invoked, record the rollback result and classify Checkpoint D as failed.

The evidence record must include:

| Evidence | Required content |
| --- | --- |
| People and time | Operator, independent reviewer, gate-by-gate UTC start and finish times. |
| Fixed identities | Operator-supplied exact approved runbook/control repository commit recorded in D1, immutable application-source commit `76cdba9530e49334e775009a811ae5ae74305c65`, and immutable candidate tag `nam-app:checkpoint-d-git-76cdba9530e49334e775009a811ae5ae74305c65`. |
| Repository | Branch, exact runbook/control commit, local `main`, local `origin/main`, remote `main`, and final clean state. |
| Candidate | Exact immutable tag, application-source revision label, creation label, Checkpoint D label, build log, and BuildKit metadata. |
| Image identities | Image index, index media type, `linux/amd64` platform manifest, and `linux/amd64` runtime config with layer names. |
| Application containers | Fixed old container ID/config/start time and new container ID/config/start time. |
| PostgreSQL | Same ID, start time, restart count, running/healthy state, unpublished port, volume, destination, network, and network ID before and after. |
| Migrations | Two exact 16-row name/checksum inventories, zero problem rows, and `MIGRATION_ACTION=NONE`. |
| Local | Per-attempt readiness bodies and metadata; exact health HTTP/body; Day View HTTP/body/metadata; and structural validation of the exact ten ordered, linked panels and the two correct in-panel empty states. |
| Public | Health and Day View bodies and metadata from `https://dev.alemany.me`; exact health body; and the same structural ten-panel validation as local. |
| Private | The sealed original Darnassus request root and its fixed checksum-manifest SHA-256; exact retained transport identities and results for both routes; the separate continuation root and checksum manifest; Windows/WSL agreement on the original Day View hash and size; exact standard-library validator stdout, stderr, and native exit status; structural ten-panel validation; and explicit records that requests were not repeated and rollback was not required. |
| Exposure and project | Rendered project name exactly `nam`, exact app image selection, loopback-only app publication, unchanged/unpublished PostgreSQL service, and exactly the `app` and `postgres` NAM Compose services and containers. |
| Rollback | Exact accepted V17 tag/index, artifact reference, archive checksum, and `INDEPENDENT_V17_VERIFICATION=PASS`. |
| Database boundary | Explicit confirmation that no migration, database write, database rollback, or PostgreSQL identity change occurred. |

Require and record the final fixed identities:

```bash
printf 'runbook_control_repository_commit=%s\nimmutable_application_source_commit=%s\nimmutable_candidate_tag=%s\n' \
  "$RUNBOOK_CONTROL_COMMIT" "$APPLICATION_SOURCE_COMMIT" "$NAM_D_CANDIDATE" \
  | tee "$NAM_D_EXECUTION_ROOT/evidence/d8-fixed-identities.txt"
```

Require the final repository identity and cleanliness against the
runbook/control commit, including a fresh read of remote `main`:

```bash
export NAM_D_FINAL_REMOTE_MAIN="$(git ls-remote --exit-code origin refs/heads/main | awk '{print $1}')"
test "$(git rev-parse HEAD)" = "$RUNBOOK_CONTROL_COMMIT" \
  && test "$(git rev-parse refs/heads/main)" = "$RUNBOOK_CONTROL_COMMIT" \
  && test "$(git rev-parse refs/remotes/origin/main)" = "$RUNBOOK_CONTROL_COMMIT" \
  && test "$NAM_D_FINAL_REMOTE_MAIN" = "$RUNBOOK_CONTROL_COMMIT" \
  && test -z "$(git status --porcelain=v1 --untracked-files=all)"
```

Record the final server-side UTC time:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ | tee "$NAM_D_EXECUTION_ROOT/evidence/d8-finished-at-utc.txt"
```

Create an evidence checksum manifest without deleting or moving any evidence:

```bash
find "$NAM_D_EXECUTION_ROOT/evidence" -maxdepth 1 -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum | tee "$NAM_D_EXECUTION_ROOT/evidence/SHA256SUMS"
```

Record one final disposition:

```text
CHECKPOINT_D=PASS
```

or:

```text
CHECKPOINT_D=FAIL
ROLLBACK_RESULT=PASS|FAIL|NOT_ATTEMPTED
```

Acceptance requires every required item, the operator signature, and
independent reviewer signature. No candidate image, rollback image, build
context, log, metadata, override, or evidence cleanup is part of acceptance.

## Prohibited And Deferred Work

Checkpoint D must not:

- Change `.env` permissions or print environment values.
- Change Caddy, UFW, SSH, DNS, Tailscale, Funnel, or any service.
- Remove the public route; that is Checkpoint E.
- Change authentication, authorization, or application source.
- Enable photo functionality.
- Execute backup or restore work.
- Pin base-image digests.
- Remove the candidate or rollback image.
- Prune images or perform unrelated cleanup.
- Alter the V17 artifact, checksum, manifest, or evidence.
- Alter retained failed V15 evidence or V1, V2, or V3 verifier evidence.
- Delete or modify `postgres-data`, `nam-network`, or any PostgreSQL data.

Photo functionality remains blocked until the application authorization
boundary and the other approved photo prerequisites exist.
