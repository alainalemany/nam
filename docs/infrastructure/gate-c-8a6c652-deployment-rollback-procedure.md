# Gate C Deployment And Rollback Procedure For `8a6c652`

This procedure is prepared for independent review only. It is not authorized
for execution. If independently approved, it must first be committed and
pushed as a focused one-file change under separate authorization. A later
deployment authorization must name that exact reviewed procedure commit.

Only the exact local `8a6c652` candidate described below may be deployed. No
substitute, rebuild, retag, pull, publication, migration, database operation,
or infrastructure change is permitted. The candidate is suitable only for a
tightly controlled same-host deployment while every exact local identity
remains present.

## Fixed Identities And Boundaries

```bash
readonly AUTHORIZED_HOST='nam'
readonly REPOSITORY_ROOT='/home/alain/projects/nam'
readonly PROCEDURE_PATH='docs/infrastructure/gate-c-8a6c652-deployment-rollback-procedure.md'
readonly READINESS_COMMIT='ad6791a661f77980f3e2318b63173917884547ba'
readonly GATE_C_EVIDENCE_COMMIT='63c7a1d75821aabd1948564197e9a3d066363308'
readonly CANDIDATE_REVISION='8a6c652b57f0b1b528d8965e8aa720f28f71008c'
readonly DEPLOYED_PARENT_REVISION='0e57e1e1d5082bb2d2b08528bf0082e2337a80da'
readonly CANDIDATE_TAG='nam-app:pre-pilot-candidate-git-8a6c652'
readonly CANDIDATE_INDEX='sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70'
readonly CANDIDATE_REFERENCE="nam-app@$CANDIDATE_INDEX"
readonly CANDIDATE_AMD64_MANIFEST='sha256:39557fa4c75c2a27993325a3313902d7ccda51eb267e168a21e98c20668126b3'
readonly CANDIDATE_CONFIG='sha256:b94d1f372db519ca0bdd73b63b3a078b05c8e0a62aae3e3e6e0d3e7be52faa2b'
readonly ROLLBACK_INDEX='sha256:88c4353c6a79a1f29f76adfdab94136a31bf11168814081db187168281994efc'
readonly ROLLBACK_REFERENCE="nam-app@$ROLLBACK_INDEX"
readonly LIVE_APP_CONTAINER='da91da2bb5538875af5abf10db87e2c4b3a847efefcf450ec60132a51e11e859'
readonly LIVE_POSTGRES_CONTAINER='0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1'
readonly LIVE_POSTGRES_IMAGE='sha256:4aabea78cf39b90e834caf3af7d602a18565f6fe2508705c8d01aa63245c2e20'
readonly LIVE_NETWORK_ID='e2eddeccb2bae37f48db1fcc69c5c4a7f6166cb32a9bf8fa720a9f79c0514a80'
readonly CANDIDATE_OVERRIDE='infrastructure/server-config/docker/gate-c-8a6c652-candidate.compose.yaml'
readonly ROLLBACK_OVERRIDE='infrastructure/server-config/docker/gate-c-8a6c652-rollback.compose.yaml'
readonly CHECKSUM_MANIFEST='infrastructure/server-config/docker/gate-c-8a6c652-compose.sha256'
```

The top-level candidate ID is an OCI index. Its `linux/amd64` manifest and
image-config digest are distinct identities and must not be compared as though
they were interchangeable. `nam-app@sha256:258615...` is a local
repository-digest/OCI-index reference, not evidence of registry publication.
The candidate has no registry digest and must remain unpublished.

## Operating Rules

- Use one dedicated Bash session and execute one documented block at a time.
- Do not paste the whole procedure into a shell.
- Keep the deployment authorization, independent reviewer, approved Windows
  Tailscale client, and rollback operator available before mutation. The
  approved iPad may supply an additional browser check.
- Stop on any failed command or unexpected value. Do not fix forward.
- Never print or inspect container environment values, secrets, credentials,
  cookies, database contents, authenticated page contents, or operational
  records.
- Do not connect to PostgreSQL or run a migration or database command.
- Do not manually remove evidence, containers, networks, volumes, or images.
  The only container replacement permitted is the exact Compose `app`
  recreation in Sections 6 or 10.
- Do not use `down`, pruning, broad deletion, recursive deletion, manual SQL,
  database restore, or host reconfiguration.

## 1. Authorization, Host, Repository, And Remote Gate

The written deployment authorization must supply the exact 40-character
lowercase commit that contains the independently approved version of this
procedure. Do not infer or invent it:

```bash
set -uo pipefail
umask 077
: "${AUTHORIZED_PROCEDURE_COMMIT:?set this only from the written deployment authorization}"
[[ "$AUTHORIZED_PROCEDURE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 1
```

Verify the authorized host and exact repository root before refreshing the
remote-tracking reference:

```bash
test "$(id -un)" = 'alain' || exit 1
test "$(hostname --short)" = "$AUTHORIZED_HOST" || exit 1
test "$(git rev-parse --show-toplevel)" = "$REPOSITORY_ROOT" || exit 1
test "$PWD" = "$REPOSITORY_ROOT" || exit 1
test "$(git branch --show-current)" = 'main' || exit 1
```

Refresh `origin/main` from the live remote and prove exact synchronization:

```bash
git fetch --quiet origin refs/heads/main:refs/remotes/origin/main || exit 1
REMOTE_MAIN="$(git ls-remote --exit-code origin refs/heads/main | awk 'NR == 1 { print $1 }')" || exit 1
test "$REMOTE_MAIN" = "$AUTHORIZED_PROCEDURE_COMMIT" || exit 1
test "$(git rev-parse HEAD)" = "$AUTHORIZED_PROCEDURE_COMMIT" || exit 1
test "$(git rev-parse origin/main)" = "$AUTHORIZED_PROCEDURE_COMMIT" || exit 1
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'0\t0' || exit 1
test -z "$(git status --porcelain=v1 --untracked-files=all)" || exit 1
```

Prove ancestry without treating either historical commit as the current tip,
then prove that the working copy of this procedure is the authorized blob:

```bash
git merge-base --is-ancestor "$READINESS_COMMIT" HEAD || exit 1
git merge-base --is-ancestor "$GATE_C_EVIDENCE_COMMIT" HEAD || exit 1
test "$(git hash-object "$PROCEDURE_PATH")" = \
  "$(git rev-parse "$AUTHORIZED_PROCEDURE_COMMIT:$PROCEDURE_PATH")" || exit 1
git diff --quiet "$AUTHORIZED_PROCEDURE_COMMIT" -- "$PROCEDURE_PATH" || exit 1
```

Any failure is a pre-mutation safe stop. Neither `ad6791a` nor `63c7a1d` is a
permanently current branch tip; both are required ancestors of the exact
procedure commit named by authorization.

## 2. Secure Evidence Location And Capture Helpers

Do not create evidence in the repository. Create one new unpredictable private
directory atomically under the established backup parent. `mktemp -d` refuses
to reuse an existing leaf:

```bash
readonly EVIDENCE_PARENT='/home/alain/backups/nam'
test -d "$EVIDENCE_PARENT" || exit 1
test ! -L "$EVIDENCE_PARENT" || exit 1
test "$(stat -c '%U:%G' "$EVIDENCE_PARENT")" = 'alain:alain' || exit 1
EVIDENCE_DIR="$(mktemp -d --tmpdir="$EVIDENCE_PARENT" 'gate-c-8a6c652-deploy.XXXXXXXXXX')" || exit 1
readonly EVIDENCE_DIR
test -d "$EVIDENCE_DIR" || exit 1
test ! -L "$EVIDENCE_DIR" || exit 1
test "$(stat -c '%F|%U:%G|%a' "$EVIDENCE_DIR")" = 'directory|alain:alain|700' || exit 1
case "$EVIDENCE_DIR" in "$REPOSITORY_ROOT"/*) exit 1 ;; esac
```

Use these no-clobber helpers. Leaf names containing a slash are rejected;
existing regular files, symlinks, and dangling symlinks are never reused:

```bash
capture_stdout() {
  local leaf=$1
  shift
  local target
  case "$leaf" in ''|*/*|'.'|'..') return 1 ;; esac
  target="$EVIDENCE_DIR/$leaf"
  test ! -e "$target" && test ! -L "$target" || return 1
  ( set -o noclobber; umask 077; "$@" >"$target" 2>&1 )
  local status=$?
  chmod 0600 "$target" || return 1
  test ! -L "$target" || return 1
  test "$(stat -c '%F|%U:%G|%a' "$target")" = 'regular file|alain:alain|600' || return 1
  return "$status"
}

capture_sorted() {
  local leaf=$1
  shift
  local target
  case "$leaf" in ''|*/*|'.'|'..') return 1 ;; esac
  target="$EVIDENCE_DIR/$leaf"
  test ! -e "$target" && test ! -L "$target" || return 1
  ( set -o noclobber; set -o pipefail; umask 077; "$@" 2>&1 | awk 'NF' | LC_ALL=C sort >"$target" )
  local status=$?
  chmod 0600 "$target" || return 1
  test ! -L "$target" || return 1
  test "$(stat -c '%F|%U:%G|%a' "$target")" = 'regular file|alain:alain|600' || return 1
  return "$status"
}

capture_note() {
  local leaf=$1
  shift
  capture_stdout "$leaf" printf '%s\n' "$@"
}
```

Record only nonsensitive authorization metadata:

```bash
capture_note authorization.txt \
  "authorized_procedure_commit=$AUTHORIZED_PROCEDURE_COMMIT" \
  "host=$AUTHORIZED_HOST" \
  "operator=$(id -un)" \
  "started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
```

Do not delete or clean this directory. Preserve it until independent review and
preservation are complete. No cleanup command is part of this procedure.

## 3. Artifact, Compose, Migration-Free, And Image Gates

Validate the committed checksums and the checksum manifest itself:

```bash
test "$(sha256sum "$CHECKSUM_MANIFEST" | awk '{print $1}')" = \
  '307e74b5cb48620bccc075d5c81d37d4532bc9ca87621239e1636c27acbeb40c' || exit 1
( cd infrastructure/server-config/docker && sha256sum -c gate-c-8a6c652-compose.sha256 ) || exit 1
capture_note artifact-checks.txt \
  'checksum_manifest=307e74b5cb48620bccc075d5c81d37d4532bc9ca87621239e1636c27acbeb40c' \
  'candidate_override=5e42c3abcb9f7277b785267f67fac51b367d9f3d37d22e3ac9da4e779d205284' \
  'rollback_override=ad36dc5d18cbb061ad89a0797c1fcac2f0329b43e19bd91887831242e5710cd0' || exit 1
```

Validate both effective merged models without printing resolved environment
values or other secret-bearing configuration:

```bash
sg docker -c "docker compose -p nam -f compose.yaml -f $CANDIDATE_OVERRIDE config --quiet" || exit 1
sg docker -c "docker compose -p nam -f compose.yaml -f $ROLLBACK_OVERRIDE config --quiet" || exit 1
sg docker -c "docker compose -p nam -f compose.yaml -f $CANDIDATE_OVERRIDE config --format json" \
  | jq -e --arg image "$CANDIDATE_REFERENCE" '
      .name == "nam"
      and (.services | keys | sort) == ["app","postgres"]
      and .services.app.image == $image
      and .services.app.pull_policy == "never"
      and (.services.app | has("build") | not)
      and .services.app.ports == [{"mode":"ingress","host_ip":"127.0.0.1","target":3000,"published":"3000","protocol":"tcp"}]
      and .services.postgres.image == "postgres:18"
      and .services.postgres.ports == null
    ' >/dev/null || exit 1
sg docker -c "docker compose -p nam -f compose.yaml -f $ROLLBACK_OVERRIDE config --format json" \
  | jq -e --arg image "$ROLLBACK_REFERENCE" '
      .name == "nam"
      and (.services | keys | sort) == ["app","postgres"]
      and .services.app.image == $image
      and .services.app.pull_policy == "never"
      and (.services.app | has("build") | not)
      and .services.app.ports == [{"mode":"ingress","host_ip":"127.0.0.1","target":3000,"published":"3000","protocol":"tcp"}]
      and .services.postgres.image == "postgres:18"
      and .services.postgres.ports == null
    ' >/dev/null || exit 1
capture_note compose-models.txt \
  'candidate_merged_model=PASS' \
  'rollback_merged_model=PASS' \
  'services=app,postgres' \
  'pull_policy=never' \
  'app_build=absent' || exit 1
```

Verify the application range contains no schema or migration change. Do not
connect to PostgreSQL:

```bash
git diff --quiet "$DEPLOYED_PARENT_REVISION..$CANDIDATE_REVISION" -- \
  prisma/schema.prisma prisma/migrations || exit 1
capture_note migration-boundary.txt \
  'schema_change=none' 'migration_change=none' 'database_action=none' || exit 1
```

Verify candidate identity layers independently:

```bash
CANDIDATE_TOP="$(sg docker -c "docker image inspect $CANDIDATE_TAG --format '{{.Id}}|{{json .RepoTags}}|{{json .RepoDigests}}'")" || exit 1
test "$CANDIDATE_TOP" = "$CANDIDATE_INDEX|[\"$CANDIDATE_TAG\"]|[\"$CANDIDATE_REFERENCE\"]" || exit 1

CANDIDATE_OCI_INDEX="$(sg docker -c "docker image save $CANDIDATE_TAG | tar -xOf - index.json | jq -er 'select(.schemaVersion == 2 and .mediaType == \"application/vnd.oci.image.index.v1+json\" and (.manifests | length) == 1 and .manifests[0].mediaType == \"application/vnd.oci.image.index.v1+json\") | [.mediaType, .manifests[0].mediaType, .manifests[0].digest] | join(\"|\")'")" || exit 1
test "$CANDIDATE_OCI_INDEX" = "application/vnd.oci.image.index.v1+json|application/vnd.oci.image.index.v1+json|$CANDIDATE_INDEX" || exit 1

CANDIDATE_PLATFORM="$(sg docker -c "docker image inspect --platform linux/amd64 $CANDIDATE_TAG --format '{{.Id}}|{{.Os}}/{{.Architecture}}'")" || exit 1
test "$CANDIDATE_PLATFORM" = "$CANDIDATE_AMD64_MANIFEST|linux/amd64" || exit 1

CANDIDATE_CONFIG_OBSERVED="$(sg docker -c "docker image save $CANDIDATE_TAG | tar -xOf - blobs/sha256/${CANDIDATE_AMD64_MANIFEST#sha256:} | jq -er '.config.digest'")" || exit 1
test "$CANDIDATE_CONFIG_OBSERVED" = "$CANDIDATE_CONFIG" || exit 1

test "$(sg docker -c "docker image inspect --platform linux/amd64 $CANDIDATE_TAG --format '{{index .Config.Labels \"org.opencontainers.image.revision\"}}|{{index .Config.Labels \"io.alemany.nam.application-revision\"}}|{{.Config.User}}|{{json .Config.Cmd}}'")" = \
  "$CANDIDATE_REVISION|$CANDIDATE_REVISION|nextjs|[\"node\",\"server.js\"]" || exit 1
```

The exact `RepoDigests` value above is only the local `nam-app@...` reference.
Any additional repository digest, registry-qualified digest, tag, missing
platform manifest, or mismatch is a pre-mutation stop.

Verify rollback identity independently and tie it to the currently running
container through container `.Image`, not `.Config.Image`:

```bash
ROLLBACK_TOP="$(sg docker -c "docker image inspect $ROLLBACK_INDEX --format '{{.Id}}'")" || exit 1
test "$ROLLBACK_TOP" = "$ROLLBACK_INDEX" || exit 1
ROLLBACK_OCI_INDEX="$(sg docker -c "docker image save $ROLLBACK_INDEX | tar -xOf - index.json | jq -er 'select(.schemaVersion == 2 and .mediaType == \"application/vnd.oci.image.index.v1+json\" and (.manifests | length) == 1 and .manifests[0].mediaType == \"application/vnd.oci.image.index.v1+json\") | [.mediaType, .manifests[0].mediaType, .manifests[0].digest] | join(\"|\")'")" || exit 1
test "$ROLLBACK_OCI_INDEX" = "application/vnd.oci.image.index.v1+json|application/vnd.oci.image.index.v1+json|$ROLLBACK_INDEX" || exit 1
test "$(sg docker -c "docker inspect nam-app --format '{{.Image}}'")" = "$ROLLBACK_INDEX" || exit 1
capture_note image-identities.txt \
  "candidate_local_tag=$CANDIDATE_TAG" \
  "candidate_oci_index=$CANDIDATE_INDEX" \
  "candidate_linux_amd64_manifest=$CANDIDATE_AMD64_MANIFEST" \
  "candidate_image_config=$CANDIDATE_CONFIG" \
  "candidate_local_reference=$CANDIDATE_REFERENCE" \
  'candidate_registry_digest=none' \
  "rollback_oci_index=$ROLLBACK_INDEX" || exit 1
```

## 4. Stable Sanitized Baseline

The following templates deliberately avoid Go-template shell variables. They
use top-level `.RestartCount`, render null/unpublished ports as JSON without
indexing them, and inspect no environment field.

```bash
capture_app_identity() {
  capture_stdout "$1" sg docker -c \
    "docker inspect nam-app --format '{{.Id}}|{{.Image}}|{{.Config.Image}}|{{json .ImageManifestDescriptor}}|{{.State.Status}}|{{.State.Running}}|{{with index .State \"Health\"}}{{.Status}}{{else}}not-defined{{end}}|{{.RestartCount}}|{{.State.StartedAt}}'"
}

capture_app_topology() {
  capture_stdout "$1" sg docker -c \
    "docker inspect nam-app --format '{{.Name}}|{{index .Config.Labels \"com.docker.compose.project\"}}|{{index .Config.Labels \"com.docker.compose.service\"}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.RestartPolicy.MaximumRetryCount}}|{{.Config.User}}|{{.HostConfig.Privileged}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.CapAdd}}|{{json .HostConfig.CapDrop}}|security={{json .HostConfig.SecurityOpt}},apparmor={{.AppArmorProfile}},cgroupns={{.HostConfig.CgroupnsMode}},devices={{json .HostConfig.Devices}},deviceRequests={{json .HostConfig.DeviceRequests}}|{{.HostConfig.UsernsMode}}|{{.HostConfig.PidMode}}|{{.HostConfig.IpcMode}}|mounts={{len .Mounts}}:{{range .Mounts}}{{.Type}},{{.Name}},{{.Driver}},{{.Mode}},{{.Destination}},{{.RW}},{{.Propagation}};{{end}}|networks={{len .NetworkSettings.Networks}}:{{with index .NetworkSettings.Networks \"nam-network\"}}{{.NetworkID}},{{json .Aliases}}{{end}}|hostports={{json .HostConfig.PortBindings}}|runtimeports={{json .NetworkSettings.Ports}}|{{.State.Status}}|{{with index .State \"Health\"}}{{.Status}}{{else}}not-defined{{end}}|{{.RestartCount}}'"
}

capture_postgres_full() {
  capture_stdout "$1" sg docker -c \
    "docker inspect nam-postgres --format '{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.Name}}|{{index .Config.Labels \"com.docker.compose.project\"}}|{{index .Config.Labels \"com.docker.compose.service\"}}|{{.State.Status}}|{{.State.Running}}|{{with index .State \"Health\"}}{{.Status}}{{else}}not-defined{{end}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.RestartPolicy.MaximumRetryCount}}|{{.Config.User}}|{{.HostConfig.Privileged}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.CapAdd}}|{{json .HostConfig.CapDrop}}|security={{json .HostConfig.SecurityOpt}},apparmor={{.AppArmorProfile}},cgroupns={{.HostConfig.CgroupnsMode}},devices={{json .HostConfig.Devices}},deviceRequests={{json .HostConfig.DeviceRequests}}|{{.HostConfig.UsernsMode}}|{{.HostConfig.PidMode}}|{{.HostConfig.IpcMode}}|mounts={{len .Mounts}}:{{range .Mounts}}{{.Type}},{{.Name}},{{.Driver}},{{.Mode}},{{.Destination}},{{.RW}},{{.Propagation}};{{end}}|networks={{len .NetworkSettings.Networks}}:{{with index .NetworkSettings.Networks \"nam-network\"}}{{.NetworkID}},{{json .Aliases}}{{end}}|hostports={{json .HostConfig.PortBindings}}|runtimeports={{json .NetworkSettings.Ports}}'"
}

capture_project_inventory() {
  capture_sorted "$1" sg docker -c \
    "docker ps -a --filter label=com.docker.compose.project=nam --format '{{.Names}}|{{.Label \"com.docker.compose.service\"}}'"
}

capture_network_static() {
  capture_stdout "$1" sg docker -c \
    "docker network inspect nam-network --format '{{.Id}}|{{.Name}}|{{.Driver}}|{{.Scope}}|{{.Internal}}|{{.Attachable}}|{{.Ingress}}|{{json .IPAM.Config}}|{{index .Labels \"com.docker.compose.project\"}}|{{index .Labels \"com.docker.compose.network\"}}'"
}

capture_network_members() {
  capture_sorted "$1" sg docker -c \
    "docker network inspect nam-network --format '{{range .Containers}}{{println .Name}}{{end}}'"
}

capture_volume_static() {
  capture_stdout "$1" sg docker -c \
    "docker volume inspect postgres-data --format '{{.Name}}|{{.Driver}}|{{.Scope}}|{{json .Options}}|{{index .Labels \"com.docker.compose.project\"}}|{{index .Labels \"com.docker.compose.volume\"}}'"
}

capture_project_networks() {
  capture_sorted "$1" sg docker -c \
    "docker network ls --filter label=com.docker.compose.project=nam --format '{{.Name}}'"
}

capture_project_volumes() {
  capture_sorted "$1" sg docker -c \
    "docker volume ls --filter label=com.docker.compose.project=nam --format '{{.Name}}'"
}
```

Capture and validate the pre-deployment state:

```bash
capture_app_identity pre-app-identity.txt || exit 1
capture_app_topology pre-app-topology.txt || exit 1
capture_postgres_full pre-postgres-full.txt || exit 1
capture_project_inventory pre-project-containers.txt || exit 1
capture_network_static pre-network-static.txt || exit 1
capture_network_members pre-network-members.txt || exit 1
capture_volume_static pre-volume-static.txt || exit 1
capture_project_networks pre-project-networks.txt || exit 1
capture_project_volumes pre-project-volumes.txt || exit 1

test "$(cut -d'|' -f1 "$EVIDENCE_DIR/pre-app-identity.txt")" = "$LIVE_APP_CONTAINER" || exit 1
test "$(cut -d'|' -f2 "$EVIDENCE_DIR/pre-app-identity.txt")" = "$ROLLBACK_INDEX" || exit 1
cut -d'|' -f4 "$EVIDENCE_DIR/pre-app-identity.txt" | jq -e '
  .mediaType == "application/vnd.oci.image.manifest.v1+json"
  and .platform.os == "linux"
  and .platform.architecture == "amd64"
' >/dev/null || exit 1
test "$(cut -d'|' -f5-8 "$EVIDENCE_DIR/pre-app-identity.txt")" = 'running|true|not-defined|0' || exit 1
test "$(cut -d'|' -f1-3 "$EVIDENCE_DIR/pre-app-topology.txt")" = '/nam-app|nam|app' || exit 1
test "$(cut -d'|' -f1-2 "$EVIDENCE_DIR/pre-postgres-full.txt")" = \
  "$LIVE_POSTGRES_CONTAINER|$LIVE_POSTGRES_IMAGE" || exit 1
test "$(cut -d'|' -f4-10 "$EVIDENCE_DIR/pre-postgres-full.txt")" = \
  '/nam-postgres|nam|postgres|running|true|healthy|0' || exit 1
test "$(cut -d'|' -f1-3 "$EVIDENCE_DIR/pre-project-containers.txt")" = $'nam-app|app\nnam-postgres|postgres' || exit 1
test "$(cat "$EVIDENCE_DIR/pre-network-members.txt")" = $'nam-app\nnam-postgres' || exit 1
test "$(cat "$EVIDENCE_DIR/pre-project-networks.txt")" = 'nam-network' || exit 1
test "$(cat "$EVIDENCE_DIR/pre-project-volumes.txt")" = 'postgres-data' || exit 1
test "$(cut -d'|' -f1 "$EVIDENCE_DIR/pre-network-static.txt")" = "$LIVE_NETWORK_ID" || exit 1
test "$(cat "$EVIDENCE_DIR/pre-volume-static.txt")" = 'postgres-data|local|local|null|nam|postgres-data' || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1
```

The project-scoped inventories avoid exposing unrelated containers. The
topology snapshots capture project/service labels, complete logical mounts,
volume identities, network counts and IDs, host/runtime ports, runtime users,
restart settings, health where defined, privileges, root-filesystem mode,
capabilities, security options, and namespace modes. Dynamic application
container identity is intentionally separated from comparable topology.

## 5. Pre-Mutation Client Readiness

Do not recreate the application unless the approved Windows Tailscale client
and its operator are ready to run Section 8 immediately. The application
currently has no application login system; the authenticated access boundary
is the already-approved Tailscale device/session. Do not approve a device,
change Tailscale, or enter credentials during this procedure. If the existing
approved client is unavailable or requests re-enrollment or reauthorization,
stop before mutation.

Historical Gate D evidence establishes that public HTTPS must be denied and
that the approved private Tailscale route must work. Photo/media implementation
and real photo use remain disabled. No public or authenticated application
behavior beyond those established boundaries may be invented.

## 6. Application Deployment

This is the first mutation. Run it only after every prior gate passes and the
separate deployment authorization is active:

```bash
capture_stdout deployment-compose-output.txt sg docker -c \
  "docker compose -p nam -f compose.yaml -f $CANDIDATE_OVERRIDE up -d --no-build --pull never --no-deps --force-recreate app"
DEPLOY_STATUS=$?
```

The base file preserves project `nam`, `nam-network`, `postgres-data`, app
loopback binding, PostgreSQL internal binding, restart behavior, and service
topology. The committed override removes the build and pins the local OCI-index
reference with `pull_policy: never`; `--no-build` and `--pull never` add
defense in depth. `--no-deps` prevents dependency traversal, and only `app` is
targeted. No migration or PostgreSQL operation is introduced.

If `DEPLOY_STATUS` is nonzero, immediately capture Section 7 state. If the
original app remains and all baseline comparisons pass, stop without rollback.
If the app changed while PostgreSQL and infrastructure remain proven unchanged,
use the application-only rollback in Section 10. Otherwise use the escalation
class in Section 9.

## 7. Immediate Candidate State And Objective Comparisons

Capture immediately after Compose returns, whether it reported success or
failure:

```bash
INFRASTRUCTURE_UNCHANGED=1
CANDIDATE_CAPTURE_FAILED=0
CANDIDATE_MANDATORY_FAILURE=0
capture_app_identity candidate-app-identity.txt || CANDIDATE_CAPTURE_FAILED=1
capture_app_topology candidate-app-topology.txt || CANDIDATE_CAPTURE_FAILED=1
capture_postgres_full candidate-postgres-full.txt || CANDIDATE_CAPTURE_FAILED=1
capture_project_inventory candidate-project-containers.txt || CANDIDATE_CAPTURE_FAILED=1
capture_network_static candidate-network-static.txt || CANDIDATE_CAPTURE_FAILED=1
capture_network_members candidate-network-members.txt || CANDIDATE_CAPTURE_FAILED=1
capture_volume_static candidate-volume-static.txt || CANDIDATE_CAPTURE_FAILED=1
capture_project_networks candidate-project-networks.txt || CANDIDATE_CAPTURE_FAILED=1
capture_project_volumes candidate-project-volumes.txt || CANDIDATE_CAPTURE_FAILED=1
```

Infrastructure is proven unchanged only if every comparison succeeds:

```bash
cmp -s "$EVIDENCE_DIR/pre-postgres-full.txt" "$EVIDENCE_DIR/candidate-postgres-full.txt" || INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-network-static.txt" "$EVIDENCE_DIR/candidate-network-static.txt" || INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-network-members.txt" "$EVIDENCE_DIR/candidate-network-members.txt" || INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-volume-static.txt" "$EVIDENCE_DIR/candidate-volume-static.txt" || INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-project-containers.txt" "$EVIDENCE_DIR/candidate-project-containers.txt" || INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-project-networks.txt" "$EVIDENCE_DIR/candidate-project-networks.txt" || INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-project-volumes.txt" "$EVIDENCE_DIR/candidate-project-volumes.txt" || INFRASTRUCTURE_UNCHANGED=0
```

Any missing capture, comparison failure, unexpected container/network/volume,
PostgreSQL change, or lost evidence sets `INFRASTRUCTURE_UNCHANGED` to `0` and
requires escalation; it must never be treated as an application-only rollback
case.

For a successful deployment, require only the intended app identity transition
and byte-identical app topology/security settings:

```bash
test "$DEPLOY_STATUS" -eq 0 || CANDIDATE_MANDATORY_FAILURE=1
test "${CANDIDATE_CAPTURE_FAILED:-0}" -eq 0 || CANDIDATE_MANDATORY_FAILURE=1
test "${INFRASTRUCTURE_UNCHANGED:-0}" -eq 1 || CANDIDATE_MANDATORY_FAILURE=1
test "$(cut -d'|' -f1 "$EVIDENCE_DIR/candidate-app-identity.txt")" != \
  "$(cut -d'|' -f1 "$EVIDENCE_DIR/pre-app-identity.txt")" || CANDIDATE_MANDATORY_FAILURE=1
test "$(cut -d'|' -f2 "$EVIDENCE_DIR/candidate-app-identity.txt")" = "$CANDIDATE_INDEX" || CANDIDATE_MANDATORY_FAILURE=1
test "$(cut -d'|' -f3 "$EVIDENCE_DIR/candidate-app-identity.txt")" = "$CANDIDATE_REFERENCE" || CANDIDATE_MANDATORY_FAILURE=1
cut -d'|' -f4 "$EVIDENCE_DIR/candidate-app-identity.txt" | jq -e \
  --arg digest "$CANDIDATE_AMD64_MANIFEST" '
    .digest == $digest
    and .mediaType == "application/vnd.oci.image.manifest.v1+json"
    and .platform.os == "linux"
    and .platform.architecture == "amd64"
  ' >/dev/null || CANDIDATE_MANDATORY_FAILURE=1
test "$(cut -d'|' -f5-8 "$EVIDENCE_DIR/candidate-app-identity.txt")" = 'running|true|not-defined|0' || CANDIDATE_MANDATORY_FAILURE=1
cmp -s "$EVIDENCE_DIR/pre-app-topology.txt" "$EVIDENCE_DIR/candidate-app-topology.txt" || CANDIDATE_MANDATORY_FAILURE=1
test "$(sg docker -c "docker inspect nam-app --format '{{.Image}}'")" = "$CANDIDATE_INDEX" || CANDIDATE_MANDATORY_FAILURE=1
test "$(sg docker -c "docker inspect nam-app --format '{{.Config.Image}}'")" = "$CANDIDATE_REFERENCE" || CANDIDATE_MANDATORY_FAILURE=1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || CANDIDATE_MANDATORY_FAILURE=1
test -z "$(sg docker -c 'docker port nam-postgres')" || CANDIDATE_MANDATORY_FAILURE=1
```

`.Image` proves the resolved running image. `.Config.Image` records the Compose
reference used to create the container. Neither is the platform manifest or
image-config digest; those were verified separately before mutation.

If `CANDIDATE_MANDATORY_FAILURE` is nonzero here, do not run client or feature
checks. Enter Section 9 immediately. Section 8 is permitted only while its
value remains `0`.

## 8. Mandatory Runtime And Approved-Client Checks

All checks must begin immediately. Complete them within 15 minutes of
candidate recreation. There is no authorized pause to investigate while a
failed candidate remains in service.

### 8.1 Server-side local health

The authoritative health contract is HTTP `200` with exactly the JSON object
`{"status":"ok","database":"ok"}`. Retry only within a bounded 120-second
window; retain only the nonsensitive PASS marker:

```bash
candidate_local_health() {
  local deadline=$((SECONDS + 120))
  local result body http status
  while (( SECONDS < deadline )); do
    status=0
    result="$(curl --silent --show-error --connect-timeout 5 --max-time 10 \
      --write-out $'\n%{http_code}' \
      http://127.0.0.1:3000/api/health)" || status=$?
    http="${result##*$'\n'}"
    body="${result%$'\n'*}"
    if [[ "$status" -eq 0 && "$http" == '200' ]] && jq -e '
      type == "object"
      and (keys == ["database","status"])
      and .status == "ok"
      and .database == "ok"
    ' <<<"$body" >/dev/null 2>&1; then
      printf '%s\n' 'local_health=PASS http=200 body=status:ok,database:ok'
      return 0
    fi
    sleep 2
  done
  return 1
}

capture_stdout candidate-local-health.txt candidate_local_health || CANDIDATE_MANDATORY_FAILURE=1
```

Do not retain application HTML, authenticated content, cookies, or records.

### 8.2 Approved Windows Tailscale client

On the already-approved Windows client `darnassus`, run this PowerShell block.
It uses no application credential and prints only a PASS marker:

```powershell
$privateUrl = 'https://ops-console.tailf57e61.ts.net/api/health'
$httpCode = & curl.exe --silent --show-error --output NUL --write-out '%{http_code}' `
  --connect-timeout 5 --max-time 15 $privateUrl
$statusExit = $LASTEXITCODE
if ($statusExit -ne 0 -or $httpCode -ne '200') {
  throw "private health status failed: curl=$statusExit http=$httpCode"
}
$body = & curl.exe --silent --show-error --connect-timeout 5 --max-time 15 $privateUrl
$curlExit = $LASTEXITCODE
if ($curlExit -ne 0) { throw "private health curl failed: $curlExit" }
$health = $body | ConvertFrom-Json
$healthKeys = @($health.PSObject.Properties.Name | Sort-Object)
if (
  ($healthKeys -join ',') -ne 'database,status' -or
  $health.status -ne 'ok' -or
  $health.database -ne 'ok'
) {
  throw 'private health contract failed'
}
'private_tailscale_health=PASS http=200 body=status:ok,database:ok'
```

The approved Windows result is mandatory because it provides the exact status
and JSON checks above. The previously approved iPad may perform an additional
browser check, but it is not a substitute for the exact Windows command. A
server-originated request is not a substitute for either approved client.

### 8.3 Public HTTPS denial from Windows

Run from `darnassus`. Historical Gate D evidence requires no public HTTP
response. DNS absence, connection refusal, or bounded timeout are acceptable;
an HTTP response is a failure:

```powershell
$publicUrl = 'https://dev.alemany.me'
$httpCode = & curl.exe --silent --show-error --output NUL --write-out '%{http_code}' `
  --connect-timeout 5 --max-time 10 $publicUrl
$curlExit = $LASTEXITCODE
if ($httpCode -ne '000' -or $curlExit -notin @(6, 7, 28)) {
  throw "public HTTPS denial failed: curl=$curlExit http=$httpCode"
}
"public_https_denial=PASS curl=$curlExit http=$httpCode"
```

Do not weaken the result by accepting TLS errors or an unexpected HTTP status.

### 8.4 Authentication and media/photo boundaries

Using the existing approved Tailscale client/session only:

1. Open `https://ops-console.tailf57e61.ts.net/equipment/new`.
2. Confirm it loads through private HTTPS without an application login prompt,
   credential prompt, new redirect, or Tailscale reauthorization request. The
   application intentionally has no application-authentication system; the
   approved Tailscale session is the current access boundary.
3. Open
   `https://ops-console.tailf57e61.ts.net/operational-safety-checklists/new`.
4. Confirm no file input, `Add Photo Evidence` control, photo upload control,
   or photo-serving link exists. Photo/media implementation and real photo use
   remain disabled and unauthorized.
5. Retain only `authentication_boundary=PASS` and
   `media_photo_boundary=PASS` with operator, client, and UTC time. Do not
   retain credentials, cookies, page contents, records, or screenshots.

Any new authentication behavior, media capability, client reauthorization, or
uncertain result is a mandatory candidate failure. Do not invent an expected
result beyond the boundaries above.

### 8.5 State and Mine Type read-only verification

On the same approved client, use only `/equipment/new`. Do not use or refer to
separate City or Mine forms; none exists.

Without submitting the form:

1. Confirm State is a dropdown with exactly 51 options: `AL`, `AK`, `AZ`, `AR`,
   `CA`, `CO`, `CT`, `DE`, `DC`, `FL`, `GA`, `HI`, `ID`, `IL`, `IN`, `IA`,
   `KS`, `KY`, `LA`, `ME`, `MD`, `MA`, `MI`, `MN`, `MS`, `MO`, `MT`, `NE`,
   `NV`, `NH`, `NJ`, `NM`, `NY`, `NC`, `ND`, `OH`, `OK`, `OR`, `PA`, `RI`,
   `SC`, `SD`, `TN`, `TX`, `UT`, `VT`, `VA`, `WA`, `WV`, `WI`, and `WY`.
2. Confirm `FL` is selected by default.
3. Confirm Mine Type is a dropdown with exactly these eight options and no
   others:
   - `Quarry`
   - `Open-Pit Mine`
   - `Strip Mine`
   - `Underground Mine`
   - `Placer Mine`
   - `Dredging Operation`
   - `In-Situ/Solution Mine`
   - `Other`
4. Confirm `Quarry` is selected by default.
5. Do not submit, create, edit, or save any City, Mine, Equipment, or other
   record. Retain only a nonsensitive PASS/FAIL summary, not page content or a
   screenshot.

Deployment-time UI inspection does **not** freshly prove preservation of
existing null values, legacy/out-of-catalog values, non-reassignment of
existing Equipment, or continued existence of the six historically observed
null values. Those properties remain supported by the approved implementation
and Gate C executor-recorded evidence, together with this procedure's verified
absence of schema changes, migrations, database commands, and form submission.
Do not claim fresh proof and do not query PostgreSQL or invent a legacy record.

### 8.6 Candidate decision

If every server, topology, private-client, public-denial, authentication,
media, and read-only feature check passes within 15 minutes, record sanitized
PASS markers:

```bash
capture_note candidate-client-checks.txt \
  'private_tailscale_health=PASS' \
  'public_https_denial=PASS' \
  'authentication_boundary=PASS' \
  'media_photo_boundary=PASS' \
  'equipment_new_read_only=PASS' \
  "observed_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" || CANDIDATE_MANDATORY_FAILURE=1
```

Any failure or timeout must immediately enter Section 9; no continued
candidate use or open-ended investigation is authorized. Do not create the
PASS record unless every named client/UI check actually passed. A failed
Windows/iPad/UI action must be reported to the server operator immediately and
sets `CANDIDATE_MANDATORY_FAILURE=1`.

```bash
if [[ "$CANDIDATE_MANDATORY_FAILURE" -ne 0 ]]; then
  printf '%s\n' 'candidate_mandatory_check=FAIL; classify immediately under Section 9'
else
  capture_note candidate-decision.txt 'candidate_mandatory_checks=PASS' || exit 1
fi
```

## 9. Unambiguous Failure Classes

### Class A — failure before mutation

Stop. Do not run deployment or rollback. Preserve any evidence already
created. No Docker mutation is required.

### Class B — application-only failure after candidate recreation

This class applies only when every PostgreSQL, network, volume, project
inventory, published-port, and evidence-integrity comparison proves unchanged.
Immediately run Section 10. Do not leave the failed candidate running while
investigating and do not attempt a fix forward.

Immediately recapture infrastructure at the failure decision point rather than
relying on the earlier post-Compose snapshot:

```bash
FAILURE_INFRASTRUCTURE_UNCHANGED=1
capture_app_topology failure-app-topology.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_postgres_full failure-postgres-full.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_project_inventory failure-project-containers.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_network_static failure-network-static.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_network_members failure-network-members.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_volume_static failure-volume-static.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_project_networks failure-project-networks.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_project_volumes failure-project-volumes.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0

test "$(cut -d'|' -f1-18 "$EVIDENCE_DIR/pre-app-topology.txt")" = \
  "$(cut -d'|' -f1-18 "$EVIDENCE_DIR/failure-app-topology.txt")" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-postgres-full.txt" "$EVIDENCE_DIR/failure-postgres-full.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-project-containers.txt" "$EVIDENCE_DIR/failure-project-containers.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-network-static.txt" "$EVIDENCE_DIR/failure-network-static.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-network-members.txt" "$EVIDENCE_DIR/failure-network-members.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-volume-static.txt" "$EVIDENCE_DIR/failure-volume-static.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-project-networks.txt" "$EVIDENCE_DIR/failure-project-networks.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0
cmp -s "$EVIDENCE_DIR/pre-project-volumes.txt" "$EVIDENCE_DIR/failure-project-volumes.txt" || FAILURE_INFRASTRUCTURE_UNCHANGED=0

if [[ "$FAILURE_INFRASTRUCTURE_UNCHANGED" -eq 1 ]]; then
  printf '%s\n' 'failure_class=B; execute Section 10 immediately'
else
  printf '%s\n' 'failure_class=C; do not run application rollback; escalate immediately'
fi
```

Only the exact `failure_class=B` result permits Section 10.

### Class C — PostgreSQL, infrastructure, or evidence uncertainty

Any PostgreSQL identity/topology change, unexpected network/volume/container
or port change, missing comparison, lost/unreliable evidence, or ambiguous
state requires an immediate safe stop and escalation. Do **not** assume an
application rollback will repair it and do not run speculative Docker,
database, network, or host commands. Preserve the live session and evidence,
block all application use, and escalate immediately to the deployment
authority. There is no authorized wait-and-investigate state.

### Class D — rollback failure or ambiguity

Stop and escalate immediately. Do not retry with another image, tag, Compose
file, database action, or host change.

PostgreSQL or infrastructure mutation is never an automatic application
rollback trigger.

## 10. Application-Only Rollback

Before rollback, reverify the exact local rollback image. If this fails, enter
Class D:

```bash
test "$(sg docker -c "docker image inspect $ROLLBACK_INDEX --format '{{.Id}}'")" = \
  "$ROLLBACK_INDEX" || exit 1
test "$(sg docker -c "docker image save $ROLLBACK_INDEX | tar -xOf - index.json | jq -er 'select(.schemaVersion == 2 and .mediaType == \"application/vnd.oci.image.index.v1+json\" and (.manifests | length) == 1 and .manifests[0].mediaType == \"application/vnd.oci.image.index.v1+json\") | .manifests[0].digest'")" = \
  "$ROLLBACK_INDEX" || exit 1
```

Run only the symmetric app recreation:

```bash
capture_stdout rollback-compose-output.txt sg docker -c \
  "docker compose -p nam -f compose.yaml -f $ROLLBACK_OVERRIDE up -d --no-build --pull never --no-deps --force-recreate app"
ROLLBACK_STATUS=$?
test "$ROLLBACK_STATUS" -eq 0 || exit 1
```

Immediately capture rollback state using the same stable templates:

```bash
capture_app_identity rollback-app-identity.txt || exit 1
capture_app_topology rollback-app-topology.txt || exit 1
capture_postgres_full rollback-postgres-full.txt || exit 1
capture_project_inventory rollback-project-containers.txt || exit 1
capture_network_static rollback-network-static.txt || exit 1
capture_network_members rollback-network-members.txt || exit 1
capture_volume_static rollback-volume-static.txt || exit 1
capture_project_networks rollback-project-networks.txt || exit 1
capture_project_volumes rollback-project-volumes.txt || exit 1

test "$(cut -d'|' -f2 "$EVIDENCE_DIR/rollback-app-identity.txt")" = "$ROLLBACK_INDEX" || exit 1
test "$(cut -d'|' -f3 "$EVIDENCE_DIR/rollback-app-identity.txt")" = "$ROLLBACK_REFERENCE" || exit 1
test "$(cut -d'|' -f4 "$EVIDENCE_DIR/rollback-app-identity.txt")" = \
  "$(cut -d'|' -f4 "$EVIDENCE_DIR/pre-app-identity.txt")" || exit 1
test "$(cut -d'|' -f5-8 "$EVIDENCE_DIR/rollback-app-identity.txt")" = 'running|true|not-defined|0' || exit 1
test "$(sg docker -c "docker inspect nam-app --format '{{.Image}}'")" = "$ROLLBACK_INDEX" || exit 1
test "$(sg docker -c "docker inspect nam-app --format '{{.Config.Image}}'")" = "$ROLLBACK_REFERENCE" || exit 1
cmp -s "$EVIDENCE_DIR/pre-app-topology.txt" "$EVIDENCE_DIR/rollback-app-topology.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-postgres-full.txt" "$EVIDENCE_DIR/rollback-postgres-full.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-network-static.txt" "$EVIDENCE_DIR/rollback-network-static.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-network-members.txt" "$EVIDENCE_DIR/rollback-network-members.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-volume-static.txt" "$EVIDENCE_DIR/rollback-volume-static.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-project-containers.txt" "$EVIDENCE_DIR/rollback-project-containers.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-project-networks.txt" "$EVIDENCE_DIR/rollback-project-networks.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-project-volumes.txt" "$EVIDENCE_DIR/rollback-project-volumes.txt" || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1
```

Repeat **all** Section 8 checks after rollback. Run the exact bounded local
health function again:

```bash
capture_stdout rollback-local-health.txt candidate_local_health || exit 1
```

Then repeat the exact Windows/iPad private-health and public-denial blocks,
authentication-boundary observation, disabled media/photo-control observation,
and read-only `/equipment/new` dropdown check. Create the rollback result only
after all have passed:

```bash
capture_note rollback-client-checks.txt \
  'private_tailscale_health=PASS' \
  'public_https_denial=PASS' \
  'authentication_boundary=PASS' \
  'media_photo_boundary=PASS' \
  'equipment_new_read_only=PASS' \
  "observed_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
```

This explicitly repeats local HTTP, loopback/unpublished bindings, public
HTTPS denial, approved-client private health, authentication, media/photo, and
feature checks. Any failure is Class D.

No down-migration is required or permitted because the exact candidate range
contains no Prisma schema or migration change and this procedure performs no
database operation.

## 11. Evidence Inventory And Final Report

After the candidate is accepted or rollback verification finishes, create the
inventory and checksum manifest without overwriting anything:

```bash
capture_stdout final-git-status.txt git status --short || exit 1
capture_note completed.txt "completed_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
(
  cd "$EVIDENCE_DIR" || exit 1
  test ! -e evidence-files.txt && test ! -L evidence-files.txt || exit 1
  test ! -e SHA256SUMS && test ! -L SHA256SUMS || exit 1
  set -o noclobber
  find . -maxdepth 1 -type f ! -name evidence-files.txt ! -name SHA256SUMS \
    -printf '%f\n' | LC_ALL=C sort > evidence-files.txt || exit 1
  xargs -r sha256sum < evidence-files.txt > SHA256SUMS || exit 1
  chmod 0600 evidence-files.txt SHA256SUMS || exit 1
)
```

The execution report must state the reviewed procedure commit, authorization
identity/date, exact candidate and rollback identity layers, artifact and
Compose validation, pre/post/rollback comparisons, all server and approved
client outcomes, decision class, final Git status, and exact mutation boundary.
It must distinguish retained command evidence from operator-observed client/UI
results. Do not claim independent proof where only an operator observation was
retained.

Preserve the evidence directory unchanged until independent review and
preservation are complete. This procedure contains no evidence cleanup or
deletion command.

## Governance Sequence And Exclusions

The required sequence is:

1. Repair this untracked procedure without committing it.
2. Obtain another independent read-only review.
3. If approved, obtain separate authorization for a focused commit and push of
   this one procedure file.
4. A later deployment authorization must name that exact reviewed procedure
   commit.
5. Only then may the procedure be considered for execution.

Gate B was not freshly revalidated. These exact exercises remain deferred:

- unapproved-device denial testing;
- device revocation and re-enrollment; and
- emergency disablement.

The broader pilot recovery gate remains open. Controlled-pilot use,
confidential operational use, database cleanup, State/Mine Type data cleanup,
public-exposure changes, Gate D execution or revalidation, authentication
changes, media/photo implementation or authorization, and Phase 29 remain
unauthorized. Historical Gate D evidence applies only while its established
infrastructure and access boundaries remain unchanged. No new Gate D execution
is required for this application-only candidate, but immediate binding,
public-denial, and approved-private-client checks remain mandatory after any
future separately authorized deployment.
