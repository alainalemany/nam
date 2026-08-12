# Gate C Deployment And Rollback Procedure For `8a6c652`

This hardened procedure is prepared for independent review only. It is not
authorized for execution. Only after correction and independent re-audit pass
may a separate authorization commit the exact six-file scope listed under
Governance Sequence And Exclusions. A later deployment authorization must name
that exact reviewed commit. The procedure and synthetic test are review
evidence, not execution authority.

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
readonly EVIDENCE_HELPER_PATH='infrastructure/server-config/scripts/gate-c-evidence.sh'
readonly EVIDENCE_TEST_PATH='tests/infrastructure/gate-c-evidence-synthetic.sh'
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
readonly LIVE_POSTGRES_IMAGE='sha256:4aabea78cf39b90e834caf3af7d602a18565f6fe2508705c8d01aa63245c2e20'
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

- Execute one documented phase at a time. A mutation phase must seal its
  checkpoint before client verification begins; the shell may and should end
  after that checkpoint is validated.
- A fresh-shell resume is a verification-only phase. It may never execute the
  deployment or rollback Compose command. A separately named rollback-mutation
  phase is permitted only after a validated `ROLLBACK_REQUIRED` checkpoint.
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

## Execution-State Model

The evidence is append-only. Each transition creates a new exclusive state or
checkpoint file; no state file is edited or replaced.

```text
PRE_MUTATION
  -> MUTATION_COMPLETED
  -> SERVER_VERIFICATION_COMPLETED
  -> AWAITING_CLIENT_EVIDENCE
  -> FRESH_SHELL_RESUME
  -> CANDIDATE_ACCEPTED
  -> EVIDENCE_SEALED

FRESH_SHELL_RESUME
  -> ROLLBACK_REQUIRED
  -> MUTATION_COMPLETED (rollback phase only)
  -> SERVER_VERIFICATION_COMPLETED
  -> AWAITING_CLIENT_EVIDENCE
  -> FRESH_SHELL_RESUME
  -> ROLLBACK_VERIFIED
  -> EVIDENCE_SEALED

Any state
  -> ESCALATION_REQUIRED
```

Permitted meanings are strict:

- A runtime failure permits application rollback only after every PostgreSQL,
  network, volume, container, topology, and port comparison proves unchanged.
- A timely, definite client-verification failure produces
  `ROLLBACK_REQUIRED` only after fresh runtime revalidation passes.
- Expired, missing, contradictory, or uncertain evidence produces
  `ESCALATION_REQUIRED`; it is neither success nor authority for speculative
  rollback.
- Evidence-capture, checkpoint, inventory, checksum, or sealing failure
  preserves existing evidence and produces an external escalation report. It
  does not retry a mutation or silently convert the execution to success.
- `EVIDENCE_SEALED` is proven only by a successfully validated final manifest
  after an exclusive completion/decision file has been created. The manifest
  itself is never self-hashed.

## 1. Authorization, Host, Repository, And Remote Gate

Because the separately authorized recovery recreated the application, the
historical live container ID in the earlier version of this procedure is no
longer current authority. The written deployment authorization must supply the
exact 40-character lowercase procedure commit and freshly reviewed exact
64-character lowercase application-container, PostgreSQL-container, and
network IDs. Do not infer, inspect during this procedure to fill a missing
authorization, or invent them:

```bash
set -uo pipefail
umask 077
: "${AUTHORIZED_PROCEDURE_COMMIT:?set this only from the written deployment authorization}"
: "${AUTHORIZED_LIVE_APP_CONTAINER:?set this only from the written deployment authorization}"
: "${AUTHORIZED_LIVE_POSTGRES_CONTAINER:?set this only from the written deployment authorization}"
: "${AUTHORIZED_LIVE_NETWORK_ID:?set this only from the written deployment authorization}"
[[ "$AUTHORIZED_PROCEDURE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$AUTHORIZED_LIVE_APP_CONTAINER" =~ ^[0-9a-f]{64}$ ]] || exit 1
[[ "$AUTHORIZED_LIVE_POSTGRES_CONTAINER" =~ ^[0-9a-f]{64}$ ]] || exit 1
[[ "$AUTHORIZED_LIVE_NETWORK_ID" =~ ^[0-9a-f]{64}$ ]] || exit 1
readonly LIVE_APP_CONTAINER="$AUTHORIZED_LIVE_APP_CONTAINER"
readonly LIVE_POSTGRES_CONTAINER="$AUTHORIZED_LIVE_POSTGRES_CONTAINER"
readonly LIVE_NETWORK_ID="$AUTHORIZED_LIVE_NETWORK_ID"
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
then prove that the procedure and helper are the exact authorized blobs. The
helper must not be sourced before these checks pass:

```bash
git merge-base --is-ancestor "$READINESS_COMMIT" HEAD || exit 1
git merge-base --is-ancestor "$GATE_C_EVIDENCE_COMMIT" HEAD || exit 1
test "$(git hash-object "$PROCEDURE_PATH")" = \
  "$(git rev-parse "$AUTHORIZED_PROCEDURE_COMMIT:$PROCEDURE_PATH")" || exit 1
test "$(git hash-object "$EVIDENCE_HELPER_PATH")" = \
  "$(git rev-parse "$AUTHORIZED_PROCEDURE_COMMIT:$EVIDENCE_HELPER_PATH")" || exit 1
git diff --quiet "$AUTHORIZED_PROCEDURE_COMMIT" -- \
  "$PROCEDURE_PATH" "$EVIDENCE_HELPER_PATH" || exit 1
```

Any failure is a pre-mutation safe stop. Neither `ad6791a` nor `63c7a1d` is a
permanently current branch tip; both are required ancestors of the exact
procedure commit named by authorization.

## 2. Secure Evidence Location And Capture Helper

Source the already identity-validated helper. It contains evidence operations
only and invokes no Docker, Compose, PostgreSQL, network, or host mutation:

```bash
. "$REPOSITORY_ROOT/$EVIDENCE_HELPER_PATH" || exit 1
```

Do not create evidence in the repository. Create one new unpredictable private
directory atomically under the established backup parent. The helper uses
`mktemp -d`, enforces owner `alain:alain` and mode `0700`, rejects symlinks,
and refuses path reuse:

```bash
readonly EVIDENCE_PARENT='/home/alain/backups/nam'
EVIDENCE_DIR="$(gatec_create_evidence_directory \
  "$EVIDENCE_PARENT" gate-c-8a6c652-deploy)" || exit 1
readonly EVIDENCE_DIR
EVIDENCE_DIR_ID="$(stat -c '%d:%i' -- "$EVIDENCE_DIR")" || exit 1
readonly EVIDENCE_DIR_ID
gatec_assert_evidence_directory || exit 1
case "$EVIDENCE_DIR" in "$REPOSITORY_ROOT"/*) exit 1 ;; esac
```

`gatec_capture` and `gatec_capture_sorted` create a leaf exclusively under
`noclobber`, retain merged command output, normalize the file to owner
`alain:alain` and mode `0600`, and return the real command or pipeline status.
Zero-byte output is valid when the command succeeds. Only an evidence contract
that explicitly calls `gatec_require_nonempty_file` may reject an empty file.
No invocation in this procedure requires nonempty Git-status output.

Record only nonsensitive authorization metadata:

```bash
gatec_note authorization.txt \
  "authorized_procedure_commit=$AUTHORIZED_PROCEDURE_COMMIT" \
  "procedure_blob=$(git hash-object "$PROCEDURE_PATH")" \
  "helper_blob=$(git hash-object "$EVIDENCE_HELPER_PATH")" \
  "host=$AUTHORIZED_HOST" \
  "operator=$(id -un)" \
  "started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
gatec_note state-pre-mutation.txt 'execution_state=PRE_MUTATION' || exit 1
```

Do not delete or clean this directory. Preserve it until independent review and
preservation are complete. No cleanup command is part of this procedure.

## 3. Artifact, Compose, Migration-Free, And Image Gates

Validate the committed checksums and the checksum manifest itself:

```bash
test "$(sha256sum "$CHECKSUM_MANIFEST" | awk '{print $1}')" = \
  '307e74b5cb48620bccc075d5c81d37d4532bc9ca87621239e1636c27acbeb40c' || exit 1
( cd infrastructure/server-config/docker && sha256sum -c gate-c-8a6c652-compose.sha256 ) || exit 1
gatec_note artifact-checks.txt \
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
gatec_note compose-models.txt \
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
gatec_note migration-boundary.txt \
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
gatec_note image-identities.txt \
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
  gatec_capture "$1" sg docker -c \
    "docker inspect nam-app --format '{{.Id}}|{{.Image}}|{{.Config.Image}}|{{json .ImageManifestDescriptor}}|{{.State.Status}}|{{.State.Running}}|{{with index .State \"Health\"}}{{.Status}}{{else}}not-defined{{end}}|{{.RestartCount}}|{{.State.StartedAt}}'"
}

capture_app_topology() {
  gatec_capture "$1" sg docker -c \
    "docker inspect nam-app --format '{{.Name}}|{{index .Config.Labels \"com.docker.compose.project\"}}|{{index .Config.Labels \"com.docker.compose.service\"}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.RestartPolicy.MaximumRetryCount}}|{{.Config.User}}|{{.HostConfig.Privileged}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.CapAdd}}|{{json .HostConfig.CapDrop}}|security={{json .HostConfig.SecurityOpt}},apparmor={{.AppArmorProfile}},cgroupns={{.HostConfig.CgroupnsMode}},devices={{json .HostConfig.Devices}},deviceRequests={{json .HostConfig.DeviceRequests}}|{{.HostConfig.UsernsMode}}|{{.HostConfig.PidMode}}|{{.HostConfig.IpcMode}}|mounts={{len .Mounts}}:{{range .Mounts}}{{.Type}},{{.Name}},{{.Driver}},{{.Mode}},{{.Destination}},{{.RW}},{{.Propagation}};{{end}}|networks={{len .NetworkSettings.Networks}}:{{with index .NetworkSettings.Networks \"nam-network\"}}{{.NetworkID}},{{json .Aliases}}{{end}}|hostports={{json .HostConfig.PortBindings}}|runtimeports={{json .NetworkSettings.Ports}}|{{.State.Status}}|{{with index .State \"Health\"}}{{.Status}}{{else}}not-defined{{end}}|{{.RestartCount}}'"
}

capture_postgres_full() {
  gatec_capture "$1" sg docker -c \
    "docker inspect nam-postgres --format '{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.Name}}|{{index .Config.Labels \"com.docker.compose.project\"}}|{{index .Config.Labels \"com.docker.compose.service\"}}|{{.State.Status}}|{{.State.Running}}|{{with index .State \"Health\"}}{{.Status}}{{else}}not-defined{{end}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.RestartPolicy.MaximumRetryCount}}|{{.Config.User}}|{{.HostConfig.Privileged}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.CapAdd}}|{{json .HostConfig.CapDrop}}|security={{json .HostConfig.SecurityOpt}},apparmor={{.AppArmorProfile}},cgroupns={{.HostConfig.CgroupnsMode}},devices={{json .HostConfig.Devices}},deviceRequests={{json .HostConfig.DeviceRequests}}|{{.HostConfig.UsernsMode}}|{{.HostConfig.PidMode}}|{{.HostConfig.IpcMode}}|mounts={{len .Mounts}}:{{range .Mounts}}{{.Type}},{{.Name}},{{.Driver}},{{.Mode}},{{.Destination}},{{.RW}},{{.Propagation}};{{end}}|networks={{len .NetworkSettings.Networks}}:{{with index .NetworkSettings.Networks \"nam-network\"}}{{.NetworkID}},{{json .Aliases}}{{end}}|hostports={{json .HostConfig.PortBindings}}|runtimeports={{json .NetworkSettings.Ports}}'"
}

capture_project_inventory() {
  gatec_capture_sorted "$1" sg docker -c \
    "docker ps -a --filter label=com.docker.compose.project=nam --format '{{.Names}}|{{.Label \"com.docker.compose.service\"}}'"
}

capture_network_static() {
  gatec_capture "$1" sg docker -c \
    "docker network inspect nam-network --format '{{.Id}}|{{.Name}}|{{.Driver}}|{{.Scope}}|{{.Internal}}|{{.Attachable}}|{{.Ingress}}|{{json .IPAM.Config}}|{{index .Labels \"com.docker.compose.project\"}}|{{index .Labels \"com.docker.compose.network\"}}'"
}

capture_network_members() {
  gatec_capture_sorted "$1" sg docker -c \
    "docker network inspect nam-network --format '{{range .Containers}}{{println .Name}}{{end}}'"
}

capture_volume_static() {
  gatec_capture "$1" sg docker -c \
    "docker volume inspect postgres-data --format '{{.Name}}|{{.Driver}}|{{.Scope}}|{{json .Options}}|{{index .Labels \"com.docker.compose.project\"}}|{{index .Labels \"com.docker.compose.volume\"}}'"
}

capture_project_networks() {
  gatec_capture_sorted "$1" sg docker -c \
    "docker network ls --filter label=com.docker.compose.project=nam --format '{{.Name}}'"
}

capture_project_volumes() {
  gatec_capture_sorted "$1" sg docker -c \
    "docker volume ls --filter label=com.docker.compose.project=nam --format '{{.Name}}'"
}

capture_runtime_set() {
  local prefix=$1
  [[ "$prefix" =~ ^[a-z0-9][a-z0-9-]*$ ]] || return 1
  capture_app_identity "$prefix-app-identity.txt" || return 1
  capture_app_topology "$prefix-app-topology.txt" || return 1
  capture_postgres_full "$prefix-postgres-full.txt" || return 1
  capture_project_inventory "$prefix-project-containers.txt" || return 1
  capture_network_static "$prefix-network-static.txt" || return 1
  capture_network_members "$prefix-network-members.txt" || return 1
  capture_volume_static "$prefix-volume-static.txt" || return 1
  capture_project_networks "$prefix-project-networks.txt" || return 1
  capture_project_volumes "$prefix-project-volumes.txt" || return 1
}

validate_runtime_set() {
  local checkpoint=$1
  local prefix=$2
  [[ "$prefix" =~ ^[a-z0-9][a-z0-9-]*$ ]] || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" app_identity_sha256 \
    "$prefix-app-identity.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" app_topology_sha256 \
    "$prefix-app-topology.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" postgres_full_sha256 \
    "$prefix-postgres-full.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" network_static_sha256 \
    "$prefix-network-static.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" network_members_sha256 \
    "$prefix-network-members.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" volume_static_sha256 \
    "$prefix-volume-static.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" project_containers_sha256 \
    "$prefix-project-containers.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" project_networks_sha256 \
    "$prefix-project-networks.txt" || return 1
  gatec_checkpoint_expect_file_hash "$checkpoint" project_volumes_sha256 \
    "$prefix-project-volumes.txt" || return 1
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
gatec_capture_with_status deployment-compose-output.txt \
  deployment-command-status.txt deployment-capture-status.txt sg docker -c \
  "docker compose -p nam -f compose.yaml -f $CANDIDATE_OVERRIDE up -d --no-build --pull never --no-deps --force-recreate app"
CAPTURE_CALL_STATUS=$?
MUTATION_EPOCH="$(date -u +%s)" || exit 1
MUTATION_UTC="$(date -u -d "@$MUTATION_EPOCH" +%Y-%m-%dT%H:%M:%SZ)" || exit 1
gatec_validate_capture_statuses deployment-command-status.txt \
  deployment-capture-status.txt || exit 1
DEPLOY_STATUS="$(gatec_checkpoint_value deployment-command-status.txt command_exit_status)" || exit 1
DEPLOY_CAPTURE_STATUS="$(gatec_checkpoint_value deployment-capture-status.txt capture_integrity_status)" || exit 1
DEPLOY_CLASSIFICATION="$(gatec_classify_mutation_status \
  "$DEPLOY_STATUS" "$DEPLOY_CAPTURE_STATUS")" || exit 1
if [[ "$DEPLOY_CLASSIFICATION" = ESCALATION_REQUIRED ]]; then
  printf '%s\n' 'execution_state=ESCALATION_REQUIRED reason=CAPTURE_INTEGRITY_FAILURE'
  exit 1
fi
test "$CAPTURE_CALL_STATUS" -eq "$DEPLOY_STATUS" || exit 1
if [[ "$DEPLOY_CLASSIFICATION" = COMMAND_SUCCEEDED ]]; then
  gatec_note state-candidate-mutation-completed.txt \
    'execution_state=MUTATION_COMPLETED' \
    'mutation_kind=CANDIDATE' \
    "mutation_epoch=$MUTATION_EPOCH" \
    "mutation_utc=$MUTATION_UTC" || exit 1
fi
```

The command status and capture-integrity status are separate checksummed
records. A zero command status followed by any nonzero capture-integrity status
is evidence uncertainty: it transitions directly to `ESCALATION_REQUIRED`,
creates no rollback authority, and must never replay the mutation. When the
directory itself cannot be trusted, record that escalation outside it and
preserve the directory without further writes.

The base file preserves project `nam`, `nam-network`, `postgres-data`, app
loopback binding, PostgreSQL internal binding, restart behavior, and service
topology. The committed override removes the build and pins the local OCI-index
reference with `pull_policy: never`; `--no-build` and `--pull never` add
defense in depth. `--no-deps` prevents dependency traversal, and only `app` is
targeted. No migration or PostgreSQL operation is introduced.

If `DEPLOY_STATUS` is nonzero, immediately capture Section 7 state. If the
original app remains and all baseline comparisons pass, stop without rollback.
If the app changed while PostgreSQL and infrastructure remain proven unchanged,
use the application-only rollback in Section 11. Otherwise use the escalation
class in Section 10.

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

If Compose returned nonzero but the original application identity and every
infrastructure comparison are unchanged, stop without rollback. This is an
attempted mutation with proven no runtime transition, not a reason to recreate
the already restored app:

```bash
if [[ "$DEPLOY_STATUS" -ne 0 \
  && "$CANDIDATE_CAPTURE_FAILED" -eq 0 \
  && "$INFRASTRUCTURE_UNCHANGED" -eq 1 ]] \
  && cmp -s "$EVIDENCE_DIR/pre-app-identity.txt" \
    "$EVIDENCE_DIR/candidate-app-identity.txt"; then
  gatec_note state-deployment-no-change.txt \
    'execution_state=ESCALATION_REQUIRED' \
    'reason=DEPLOYMENT_COMMAND_FAILED_WITHOUT_RUNTIME_CHANGE' || exit 1
  printf '%s\n' 'deployment failed without runtime change; stop without rollback'
  exit 1
fi
```

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
checks. Enter Section 10 immediately. Section 8 is permitted only while its
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

gatec_capture candidate-local-health.txt candidate_local_health || CANDIDATE_MANDATORY_FAILURE=1
```

Do not retain application HTML, authenticated content, cookies, or records.

### 8.2 Seal the candidate handoff checkpoint

Do not begin client verification unless all immediate objective and local-health
checks passed. Create the server-completion state, then create and independently
validate an exclusive checksummed checkpoint. The deadline is
exactly 900 seconds after the candidate Compose command returned:

```bash
test "$CANDIDATE_MANDATORY_FAILURE" -eq 0 || {
  printf '%s\n' 'runtime_failure=FAIL; classify under Section 10'
  exit 1
}
SERVER_VERIFICATION_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
VERIFICATION_DEADLINE_EPOCH=$((MUTATION_EPOCH + 900))
VERIFICATION_DEADLINE_UTC="$(date -u -d "@$VERIFICATION_DEADLINE_EPOCH" +%Y-%m-%dT%H:%M:%SZ)" || exit 1
gatec_validate_deadline "$MUTATION_EPOCH" "$VERIFICATION_DEADLINE_EPOCH" \
  "$MUTATION_EPOCH" "$(date -u +%s)" || exit 1
gatec_note state-candidate-server-verified.txt \
  'execution_state=SERVER_VERIFICATION_COMPLETED' \
  'mutation_kind=CANDIDATE' \
  "verified_utc=$SERVER_VERIFICATION_UTC" || exit 1

gatec_create_checkpoint candidate-checkpoint.txt candidate-checkpoint.sha256 \
  'checkpoint_version=1' \
  'execution_state=AWAITING_CLIENT_EVIDENCE' \
  'mutation_kind=CANDIDATE' \
  "mutation_epoch=$MUTATION_EPOCH" \
  "mutation_utc=$MUTATION_UTC" \
  "verification_deadline_epoch=$VERIFICATION_DEADLINE_EPOCH" \
  "verification_deadline_utc=$VERIFICATION_DEADLINE_UTC" \
  "evidence_dir=$EVIDENCE_DIR" \
  "evidence_dir_id=$EVIDENCE_DIR_ID" \
  "repository_root=$REPOSITORY_ROOT" \
  "repository_head=$(git rev-parse HEAD)" \
  "authorized_procedure_commit=$AUTHORIZED_PROCEDURE_COMMIT" \
  "procedure_path=$PROCEDURE_PATH" \
  "procedure_blob=$(git hash-object "$PROCEDURE_PATH")" \
  "helper_blob=$(git hash-object "$EVIDENCE_HELPER_PATH")" \
  "candidate_revision=$CANDIDATE_REVISION" \
  "candidate_index=$CANDIDATE_INDEX" \
  "candidate_manifest=$CANDIDATE_AMD64_MANIFEST" \
  "candidate_config=$CANDIDATE_CONFIG" \
  "rollback_index=$ROLLBACK_INDEX" \
  "app_container_id=$(cut -d'|' -f1 "$EVIDENCE_DIR/candidate-app-identity.txt")" \
  "app_image_id=$(cut -d'|' -f2 "$EVIDENCE_DIR/candidate-app-identity.txt")" \
  "app_image_reference=$(cut -d'|' -f3 "$EVIDENCE_DIR/candidate-app-identity.txt")" \
  "app_started_at=$(cut -d'|' -f9 "$EVIDENCE_DIR/candidate-app-identity.txt")" \
  "app_identity_sha256=$(gatec_file_sha256 candidate-app-identity.txt)" \
  "app_topology_sha256=$(gatec_file_sha256 candidate-app-topology.txt)" \
  "postgres_container_id=$(cut -d'|' -f1 "$EVIDENCE_DIR/candidate-postgres-full.txt")" \
  "postgres_image_id=$(cut -d'|' -f2 "$EVIDENCE_DIR/candidate-postgres-full.txt")" \
  "postgres_started_at=$(cut -d'|' -f11 "$EVIDENCE_DIR/candidate-postgres-full.txt")" \
  "postgres_full_sha256=$(gatec_file_sha256 candidate-postgres-full.txt)" \
  "network_id=$(cut -d'|' -f1 "$EVIDENCE_DIR/candidate-network-static.txt")" \
  "network_static_sha256=$(gatec_file_sha256 candidate-network-static.txt)" \
  "network_members_sha256=$(gatec_file_sha256 candidate-network-members.txt)" \
  "volume_static_sha256=$(gatec_file_sha256 candidate-volume-static.txt)" \
  "project_containers_sha256=$(gatec_file_sha256 candidate-project-containers.txt)" \
  "project_networks_sha256=$(gatec_file_sha256 candidate-project-networks.txt)" \
  "project_volumes_sha256=$(gatec_file_sha256 candidate-project-volumes.txt)" \
  'expected_app_port=127.0.0.1:3000' \
  'expected_postgres_ports=none' \
  'server_health=PASS' \
  "server_health_sha256=$(gatec_file_sha256 candidate-local-health.txt)" \
  "server_verification_utc=$SERVER_VERIFICATION_UTC" || exit 1

gatec_validate_checkpoint_pair candidate-checkpoint.txt candidate-checkpoint.sha256 \
  app_container_id app_identity_sha256 app_image_id app_image_reference \
  app_started_at app_topology_sha256 authorized_procedure_commit \
  candidate_config candidate_index candidate_manifest candidate_revision \
  checkpoint_version evidence_dir evidence_dir_id execution_state \
  expected_app_port expected_postgres_ports helper_blob mutation_epoch \
  mutation_kind mutation_utc network_id network_members_sha256 \
  network_static_sha256 postgres_container_id postgres_full_sha256 \
  postgres_image_id postgres_started_at procedure_blob procedure_path \
  project_containers_sha256 project_networks_sha256 project_volumes_sha256 \
  repository_head repository_root rollback_index server_health \
  server_health_sha256 server_verification_utc verification_deadline_epoch \
  verification_deadline_utc volume_static_sha256 || exit 1
```

Record the exact `EVIDENCE_DIR` and deadline in the controlled operator
handoff. The original shell has no remaining authority and may now end. Losing
it is expected. Do not accept client results in that shell.

### 8.3 Approved Windows Tailscale client

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

### 8.4 Public HTTPS denial from Windows

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

### 8.5 Authentication and media/photo boundaries

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

### 8.6 State and Mine Type read-only verification

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

## 9. Candidate Fresh-Shell Resume

This phase is verification-only. It contains no Compose `up`, deployment,
rollback, image mutation, database operation, or retry of a previous mutation.

### 9.1 Bootstrap and validate the handoff

Start a new Bash shell in the repository. Set the four
`AUTHORIZED_*` identity values from the written authorization and
`EVIDENCE_DIR` from the controlled handoff. Re-enter the complete Fixed
Identities and Section 1 authorization blocks, then run the host, remote,
synchronization, ancestry, procedure-blob, and helper-blob checks from Section
1. Do not accept or record client results yet.

```bash
set -uo pipefail
umask 077
: "${AUTHORIZED_PROCEDURE_COMMIT:?required from written authorization}"
: "${EVIDENCE_DIR:?required from sealed handoff}"
readonly EVIDENCE_PARENT='/home/alain/backups/nam'
. "$REPOSITORY_ROOT/$EVIDENCE_HELPER_PATH" || exit 1
EVIDENCE_DIR_ID="$(stat -c '%d:%i' -- "$EVIDENCE_DIR")" || exit 1
readonly EVIDENCE_DIR_ID
gatec_assert_evidence_directory || exit 1

gatec_validate_checkpoint_pair candidate-checkpoint.txt candidate-checkpoint.sha256 \
  app_container_id app_identity_sha256 app_image_id app_image_reference \
  app_started_at app_topology_sha256 authorized_procedure_commit \
  candidate_config candidate_index candidate_manifest candidate_revision \
  checkpoint_version evidence_dir evidence_dir_id execution_state \
  expected_app_port expected_postgres_ports helper_blob mutation_epoch \
  mutation_kind mutation_utc network_id network_members_sha256 \
  network_static_sha256 postgres_container_id postgres_full_sha256 \
  postgres_image_id postgres_started_at procedure_blob procedure_path \
  project_containers_sha256 project_networks_sha256 project_volumes_sha256 \
  repository_head repository_root rollback_index server_health \
  server_health_sha256 server_verification_utc verification_deadline_epoch \
  verification_deadline_utc volume_static_sha256 || exit 1
CANDIDATE_CHECKPOINT_HASH="$(gatec_file_sha256 candidate-checkpoint.txt)" || exit 1
CANDIDATE_CHECKSUM_HASH="$(gatec_file_sha256 candidate-checkpoint.sha256)" || exit 1
readonly CANDIDATE_CHECKPOINT_HASH CANDIDATE_CHECKSUM_HASH

gatec_checkpoint_expect candidate-checkpoint.txt checkpoint_version 1 || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt execution_state AWAITING_CLIENT_EVIDENCE || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt mutation_kind CANDIDATE || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt evidence_dir "$EVIDENCE_DIR" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt evidence_dir_id "$EVIDENCE_DIR_ID" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt repository_root "$REPOSITORY_ROOT" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt repository_head "$AUTHORIZED_PROCEDURE_COMMIT" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt authorized_procedure_commit "$AUTHORIZED_PROCEDURE_COMMIT" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt procedure_path "$PROCEDURE_PATH" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt procedure_blob "$(git hash-object "$PROCEDURE_PATH")" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt helper_blob "$(git hash-object "$EVIDENCE_HELPER_PATH")" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt candidate_revision "$CANDIDATE_REVISION" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt candidate_index "$CANDIDATE_INDEX" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt candidate_manifest "$CANDIDATE_AMD64_MANIFEST" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt candidate_config "$CANDIDATE_CONFIG" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt rollback_index "$ROLLBACK_INDEX" || exit 1
gatec_checkpoint_expect candidate-checkpoint.txt server_health PASS || exit 1

gatec_checkpoint_expect_file_hash candidate-checkpoint.txt app_identity_sha256 candidate-app-identity.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt app_topology_sha256 candidate-app-topology.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt postgres_full_sha256 candidate-postgres-full.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt network_static_sha256 candidate-network-static.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt network_members_sha256 candidate-network-members.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt volume_static_sha256 candidate-volume-static.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_containers_sha256 candidate-project-containers.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_networks_sha256 candidate-project-networks.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_volumes_sha256 candidate-project-volumes.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt server_health_sha256 candidate-local-health.txt || exit 1

gatec_capture candidate-resume-git-status.txt \
  git status --porcelain=v1 --untracked-files=all || exit 1
test ! -s "$EVIDENCE_DIR/candidate-resume-git-status.txt" || exit 1
```

The zero-byte Git-status file above is successful evidence. Its command status
and its empty content are separate facts.

Re-enter the capture function definitions from Section 4 and the
`candidate_local_health` definition from Section 8.1 verbatim. Definitions do
not inspect or mutate runtime state. Capture a new complete runtime set:

```bash
capture_app_identity resume-candidate-app-identity.txt || exit 1
capture_app_topology resume-candidate-app-topology.txt || exit 1
capture_postgres_full resume-candidate-postgres-full.txt || exit 1
capture_project_inventory resume-candidate-project-containers.txt || exit 1
capture_network_static resume-candidate-network-static.txt || exit 1
capture_network_members resume-candidate-network-members.txt || exit 1
capture_volume_static resume-candidate-volume-static.txt || exit 1
capture_project_networks resume-candidate-project-networks.txt || exit 1
capture_project_volumes resume-candidate-project-volumes.txt || exit 1
gatec_capture resume-candidate-local-health.txt candidate_local_health || exit 1

gatec_checkpoint_expect_file_hash candidate-checkpoint.txt app_identity_sha256 resume-candidate-app-identity.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt app_topology_sha256 resume-candidate-app-topology.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt postgres_full_sha256 resume-candidate-postgres-full.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt network_static_sha256 resume-candidate-network-static.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt network_members_sha256 resume-candidate-network-members.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt volume_static_sha256 resume-candidate-volume-static.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_containers_sha256 resume-candidate-project-containers.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_networks_sha256 resume-candidate-project-networks.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_volumes_sha256 resume-candidate-project-volumes.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt server_health_sha256 resume-candidate-local-health.txt || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1

create_runtime_bindings() {
  local binding_leaf=$1 checksum_leaf=$2 prefix=$3 checkpoint_leaf=$4
  local expected_state=${5:-FRESH_SHELL_RESUME}
  gatec_create_checkpoint "$binding_leaf" "$checksum_leaf" \
    'runtime_bindings_version=1' \
    "expected_state=$expected_state" \
    "captured_epoch=$(date -u +%s)" \
    "source_checkpoint_leaf=$checkpoint_leaf" \
    "source_checkpoint_sha256=$(gatec_file_sha256 "$checkpoint_leaf")" \
    "source_checkpoint_checksum_leaf=${checkpoint_leaf%.txt}.sha256" \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 "${checkpoint_leaf%.txt}.sha256")" \
    "app_identity_leaf=$prefix-app-identity.txt" \
    "app_identity_sha256=$(gatec_file_sha256 "$prefix-app-identity.txt")" \
    "app_topology_leaf=$prefix-app-topology.txt" \
    "app_topology_sha256=$(gatec_file_sha256 "$prefix-app-topology.txt")" \
    "local_health_leaf=$prefix-local-health.txt" \
    "local_health_sha256=$(gatec_file_sha256 "$prefix-local-health.txt")" \
    "network_members_leaf=$prefix-network-members.txt" \
    "network_members_sha256=$(gatec_file_sha256 "$prefix-network-members.txt")" \
    "network_static_leaf=$prefix-network-static.txt" \
    "network_static_sha256=$(gatec_file_sha256 "$prefix-network-static.txt")" \
    "postgres_full_leaf=$prefix-postgres-full.txt" \
    "postgres_full_sha256=$(gatec_file_sha256 "$prefix-postgres-full.txt")" \
    "project_containers_leaf=$prefix-project-containers.txt" \
    "project_containers_sha256=$(gatec_file_sha256 "$prefix-project-containers.txt")" \
    "project_networks_leaf=$prefix-project-networks.txt" \
    "project_networks_sha256=$(gatec_file_sha256 "$prefix-project-networks.txt")" \
    "project_volumes_leaf=$prefix-project-volumes.txt" \
    "project_volumes_sha256=$(gatec_file_sha256 "$prefix-project-volumes.txt")" \
    "volume_static_leaf=$prefix-volume-static.txt" \
    "volume_static_sha256=$(gatec_file_sha256 "$prefix-volume-static.txt")" || return 1
  gatec_validate_runtime_bindings "$binding_leaf" "$checksum_leaf"
}

create_runtime_bindings candidate-resume-runtime.txt \
  candidate-resume-runtime.sha256 resume-candidate candidate-checkpoint.txt || exit 1
gatec_create_state_transition candidate-resume-state.txt \
  candidate-resume-state.sha256 \
  'state_contract_version=1' \
  'execution_state=FRESH_SHELL_RESUME' \
  'predecessor_state=AWAITING_CLIENT_EVIDENCE' \
  "transition_epoch=$(date -u +%s)" \
  'source_checkpoint_leaf=candidate-checkpoint.txt' \
  "source_checkpoint_sha256=$(gatec_file_sha256 candidate-checkpoint.txt)" \
  'source_checkpoint_checksum_leaf=candidate-checkpoint.sha256' \
  "source_checkpoint_checksum_sha256=$(gatec_file_sha256 candidate-checkpoint.sha256)" \
  'runtime_bindings_leaf=candidate-resume-runtime.txt' \
  "runtime_bindings_sha256=$(gatec_file_sha256 candidate-resume-runtime.txt)" \
  'runtime_bindings_checksum_leaf=candidate-resume-runtime.sha256' \
  "runtime_bindings_checksum_sha256=$(gatec_file_sha256 candidate-resume-runtime.sha256)" || exit 1
```

Any mismatch proves restart, replacement, drift, capture failure, or uncertain
state. Create no acceptance or rollback-required decision. Preserve evidence,
record `ESCALATION_REQUIRED` externally, and stop.

### 9.2 Receive and classify client evidence

Only after Section 9.1 passes, receive the Section 8 results. Stamp receipt on
the server immediately. The client name is fixed and each result must be the
literal `PASS` or `FAIL`; missing, contradictory, malformed, or uncertain
results are escalation, not rollback authority.

```bash
CLIENT_RESULTS_RECEIVED_EPOCH="$(date -u +%s)" || exit 1
CLIENT_RESULTS_RECEIVED_UTC="$(date -u -d "@$CLIENT_RESULTS_RECEIVED_EPOCH" +%Y-%m-%dT%H:%M:%SZ)" || exit 1
: "${PRIVATE_TAILSCALE_HEALTH_RESULT:?PASS or FAIL required}"
: "${PUBLIC_HTTPS_DENIAL_RESULT:?PASS or FAIL required}"
: "${AUTHENTICATION_BOUNDARY_RESULT:?PASS or FAIL required}"
: "${MEDIA_PHOTO_BOUNDARY_RESULT:?PASS or FAIL required}"
: "${EQUIPMENT_NEW_READ_ONLY_RESULT:?PASS or FAIL required}"
for result in \
  "$PRIVATE_TAILSCALE_HEALTH_RESULT" "$PUBLIC_HTTPS_DENIAL_RESULT" \
  "$AUTHENTICATION_BOUNDARY_RESULT" "$MEDIA_PHOTO_BOUNDARY_RESULT" \
  "$EQUIPMENT_NEW_READ_ONLY_RESULT"; do
  [[ "$result" = PASS || "$result" = FAIL ]] || exit 1
done

test "$(gatec_file_sha256 candidate-checkpoint.txt)" = \
  "$CANDIDATE_CHECKPOINT_HASH" || exit 1
test "$(gatec_file_sha256 candidate-checkpoint.sha256)" = \
  "$CANDIDATE_CHECKSUM_HASH" || exit 1

MUTATION_EPOCH="$(gatec_checkpoint_value candidate-checkpoint.txt mutation_epoch)" || exit 1
VERIFICATION_DEADLINE_EPOCH="$(gatec_checkpoint_value candidate-checkpoint.txt verification_deadline_epoch)" || exit 1
gatec_validate_deadline "$MUTATION_EPOCH" "$VERIFICATION_DEADLINE_EPOCH" \
  "$CLIENT_RESULTS_RECEIVED_EPOCH" "$(date -u +%s)" || {
  printf '%s\n' 'execution_state=ESCALATION_REQUIRED reason=CLIENT_EVIDENCE_EXPIRED_OR_UNCERTAIN'
  exit 1
}

gatec_create_checkpoint candidate-client-evidence.txt \
  candidate-client-evidence.sha256 \
  'client_contract_version=1' \
  'client=darnassus' \
  'predecessor_state=FRESH_SHELL_RESUME' \
  "private_tailscale_health=$PRIVATE_TAILSCALE_HEALTH_RESULT" \
  "public_https_denial=$PUBLIC_HTTPS_DENIAL_RESULT" \
  "authentication_boundary=$AUTHENTICATION_BOUNDARY_RESULT" \
  "media_photo_boundary=$MEDIA_PHOTO_BOUNDARY_RESULT" \
  "equipment_new_read_only=$EQUIPMENT_NEW_READ_ONLY_RESULT" \
  "received_epoch=$CLIENT_RESULTS_RECEIVED_EPOCH" \
  "received_utc=$CLIENT_RESULTS_RECEIVED_UTC" \
  "deadline_epoch=$VERIFICATION_DEADLINE_EPOCH" \
  'source_checkpoint_leaf=candidate-checkpoint.txt' \
  "source_checkpoint_sha256=$(gatec_file_sha256 candidate-checkpoint.txt)" \
  'source_checkpoint_checksum_leaf=candidate-checkpoint.sha256' \
  "source_checkpoint_checksum_sha256=$(gatec_file_sha256 candidate-checkpoint.sha256)" || exit 1
gatec_validate_client_evidence candidate-client-evidence.txt \
  candidate-client-evidence.sha256 || exit 1
```

Recapture and compare the entire runtime set a second time after client result
capture. This closes drift during the resume handoff before any decision:

```bash
capture_app_identity decision-candidate-app-identity.txt || exit 1
capture_app_topology decision-candidate-app-topology.txt || exit 1
capture_postgres_full decision-candidate-postgres-full.txt || exit 1
capture_project_inventory decision-candidate-project-containers.txt || exit 1
capture_network_static decision-candidate-network-static.txt || exit 1
capture_network_members decision-candidate-network-members.txt || exit 1
capture_volume_static decision-candidate-volume-static.txt || exit 1
capture_project_networks decision-candidate-project-networks.txt || exit 1
capture_project_volumes decision-candidate-project-volumes.txt || exit 1
gatec_capture decision-candidate-local-health.txt candidate_local_health || exit 1

gatec_checkpoint_expect_file_hash candidate-checkpoint.txt app_identity_sha256 decision-candidate-app-identity.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt app_topology_sha256 decision-candidate-app-topology.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt postgres_full_sha256 decision-candidate-postgres-full.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt network_static_sha256 decision-candidate-network-static.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt network_members_sha256 decision-candidate-network-members.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt volume_static_sha256 decision-candidate-volume-static.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_containers_sha256 decision-candidate-project-containers.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_networks_sha256 decision-candidate-project-networks.txt || exit 1
gatec_checkpoint_expect_file_hash candidate-checkpoint.txt project_volumes_sha256 decision-candidate-project-volumes.txt || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1
test "$(gatec_file_sha256 candidate-checkpoint.txt)" = \
  "$CANDIDATE_CHECKPOINT_HASH" || exit 1
test "$(gatec_file_sha256 candidate-checkpoint.sha256)" = \
  "$CANDIDATE_CHECKSUM_HASH" || exit 1
gatec_validate_deadline "$MUTATION_EPOCH" "$VERIFICATION_DEADLINE_EPOCH" \
  "$CLIENT_RESULTS_RECEIVED_EPOCH" "$(date -u +%s)" || exit 1
create_runtime_bindings candidate-decision-runtime.txt \
  candidate-decision-runtime.sha256 decision-candidate candidate-checkpoint.txt || exit 1
```

If every literal result is `PASS`, create the acceptance decision. Otherwise a
definite timely client failure creates a separate rollback-required checkpoint;
it does not perform rollback:

```bash
create_candidate_terminal_decision() {
  local classification=$1 reason=$2 leaf=$3
  local decision_epoch
  decision_epoch=$(date -u +%s) || return 1
  gatec_create_terminal_decision "$leaf" "${leaf%.txt}.sha256" \
    'terminal_contract_version=1' \
    "execution_state=$classification" \
    "terminal_classification=$classification" \
    'expected_predecessor=FRESH_SHELL_RESUME' \
    "reason=$reason" \
    "decision_epoch=$decision_epoch" \
    'predecessor_leaf=candidate-resume-state.txt' \
    "predecessor_sha256=$(gatec_file_sha256 candidate-resume-state.txt)" \
    'predecessor_checksum_leaf=candidate-resume-state.sha256' \
    "predecessor_checksum_sha256=$(gatec_file_sha256 candidate-resume-state.sha256)" \
    'source_checkpoint_leaf=candidate-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 candidate-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=candidate-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 candidate-checkpoint.sha256)" \
    'client_evidence_leaf=candidate-client-evidence.txt' \
    "client_evidence_sha256=$(gatec_file_sha256 candidate-client-evidence.txt)" \
    'client_evidence_checksum_leaf=candidate-client-evidence.sha256' \
    "client_evidence_checksum_sha256=$(gatec_file_sha256 candidate-client-evidence.sha256)" \
    'runtime_bindings_leaf=candidate-decision-runtime.txt' \
    "runtime_bindings_sha256=$(gatec_file_sha256 candidate-decision-runtime.txt)" \
    'runtime_bindings_checksum_leaf=candidate-decision-runtime.sha256' \
    "runtime_bindings_checksum_sha256=$(gatec_file_sha256 candidate-decision-runtime.sha256)" \
    'client=darnassus' \
    "receipt_epoch=$CLIENT_RESULTS_RECEIVED_EPOCH" \
    "deadline_epoch=$VERIFICATION_DEADLINE_EPOCH" \
    "private_tailscale_health=$PRIVATE_TAILSCALE_HEALTH_RESULT" \
    "public_https_denial=$PUBLIC_HTTPS_DENIAL_RESULT" \
    "authentication_boundary=$AUTHENTICATION_BOUNDARY_RESULT" \
    "media_photo_boundary=$MEDIA_PHOTO_BOUNDARY_RESULT" \
    "equipment_new_read_only=$EQUIPMENT_NEW_READ_ONLY_RESULT"
}

if [[ "$PRIVATE_TAILSCALE_HEALTH_RESULT" = PASS \
  && "$PUBLIC_HTTPS_DENIAL_RESULT" = PASS \
  && "$AUTHENTICATION_BOUNDARY_RESULT" = PASS \
  && "$MEDIA_PHOTO_BOUNDARY_RESULT" = PASS \
  && "$EQUIPMENT_NEW_READ_ONLY_RESULT" = PASS ]]; then
  create_candidate_terminal_decision CANDIDATE_ACCEPTED \
    ALL_MANDATORY_CHECKS_PASS candidate-accepted.txt || exit 1
else
  create_candidate_terminal_decision ROLLBACK_REQUIRED \
    CLIENT_VERIFICATION_FAILURE rollback-required.txt || exit 1
fi
```

`gatec_create_terminal_decision` refuses every existing terminal or legacy
decision marker before exclusive creation. Therefore classification is
one-shot and monotonic: rerunning it, attempting acceptance after
`ROLLBACK_REQUIRED` or `ESCALATION_REQUIRED`, or presenting incompatible
markers fails closed. The validator enforces the exact schema, all five literal
results, client identity, receipt/deadline relationship, predecessor, source
checkpoint, decision-time runtime bundle, and every referenced digest.

## 10. Unambiguous Failure Classes

### Class A — failure before mutation

Stop. Do not run deployment or rollback. Preserve any evidence already
created. No Docker mutation is required.

### Class B — application-only failure after candidate recreation

This class applies only when every PostgreSQL, network, volume, project
inventory, published-port, and evidence-integrity comparison proves unchanged.
Immediately run Section 11. Do not leave the failed candidate running while
investigating and do not attempt a fix forward.

A definite client-verification `FAIL` received before the checkpoint deadline
uses Section 9.2's checksummed `ROLLBACK_REQUIRED` checkpoint directly. A
runtime failure uses the recapture below. Neither path includes uncertain,
missing, or expired evidence.

Immediately recapture infrastructure at the failure decision point rather than
relying on the earlier post-Compose snapshot:

```bash
FAILURE_INFRASTRUCTURE_UNCHANGED=1
capture_app_identity failure-app-identity.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_app_topology failure-app-topology.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_postgres_full failure-postgres-full.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_project_inventory failure-project-containers.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_network_static failure-network-static.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_network_members failure-network-members.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_volume_static failure-volume-static.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_project_networks failure-project-networks.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
capture_project_volumes failure-project-volumes.txt || FAILURE_INFRASTRUCTURE_UNCHANGED=0
gatec_capture failure-local-health.txt candidate_local_health
FAILURE_LOCAL_HEALTH_STATUS=$?

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
  FAILURE_DECISION_EPOCH="$(date -u +%s)" || exit 1
  gatec_create_checkpoint runtime-failure-checkpoint.txt \
    runtime-failure-checkpoint.sha256 \
    'checkpoint_version=1' \
    'execution_state=MUTATION_COMPLETED' \
    "mutation_epoch=$MUTATION_EPOCH" \
    "verification_deadline_epoch=$((MUTATION_EPOCH + 900))" || exit 1
  create_runtime_bindings runtime-failure-bindings.txt \
    runtime-failure-bindings.sha256 failure runtime-failure-checkpoint.txt \
    ROLLBACK_DECISION_POINT || exit 1
  gatec_create_state_transition runtime-failure-state.txt \
    runtime-failure-state.sha256 \
    'state_contract_version=1' \
    'execution_state=ROLLBACK_DECISION_POINT' \
    'predecessor_state=MUTATION_COMPLETED' \
    "transition_epoch=$FAILURE_DECISION_EPOCH" \
    'source_checkpoint_leaf=runtime-failure-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 runtime-failure-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=runtime-failure-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 runtime-failure-checkpoint.sha256)" \
    'runtime_bindings_leaf=runtime-failure-bindings.txt' \
    "runtime_bindings_sha256=$(gatec_file_sha256 runtime-failure-bindings.txt)" \
    'runtime_bindings_checksum_leaf=runtime-failure-bindings.sha256' \
    "runtime_bindings_checksum_sha256=$(gatec_file_sha256 runtime-failure-bindings.sha256)" || exit 1
  gatec_create_terminal_decision rollback-required.txt rollback-required.sha256 \
    'terminal_contract_version=1' \
    'execution_state=ROLLBACK_REQUIRED' \
    'terminal_classification=ROLLBACK_REQUIRED' \
    'expected_predecessor=ROLLBACK_DECISION_POINT' \
    'reason=RUNTIME_FAILURE' \
    "decision_epoch=$FAILURE_DECISION_EPOCH" \
    'predecessor_leaf=runtime-failure-state.txt' \
    "predecessor_sha256=$(gatec_file_sha256 runtime-failure-state.txt)" \
    'predecessor_checksum_leaf=runtime-failure-state.sha256' \
    "predecessor_checksum_sha256=$(gatec_file_sha256 runtime-failure-state.sha256)" \
    'source_checkpoint_leaf=runtime-failure-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 runtime-failure-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=runtime-failure-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 runtime-failure-checkpoint.sha256)" \
    'client_evidence_leaf=none' 'client_evidence_sha256=none' \
    'client_evidence_checksum_leaf=none' 'client_evidence_checksum_sha256=none' \
    'runtime_bindings_leaf=runtime-failure-bindings.txt' \
    "runtime_bindings_sha256=$(gatec_file_sha256 runtime-failure-bindings.txt)" \
    'runtime_bindings_checksum_leaf=runtime-failure-bindings.sha256' \
    "runtime_bindings_checksum_sha256=$(gatec_file_sha256 runtime-failure-bindings.sha256)" \
    'client=NONE' 'receipt_epoch=0' 'deadline_epoch=0' \
    'private_tailscale_health=NONE' 'public_https_denial=NONE' \
    'authentication_boundary=NONE' 'media_photo_boundary=NONE' \
    'equipment_new_read_only=NONE' || exit 1
  printf '%s\n' 'failure_class=B; ROLLBACK_REQUIRED checkpoint sealed; execute Section 11'
else
  printf '%s\n' 'failure_class=C; do not run application rollback; escalate immediately'
fi
```

Only the exact `failure_class=B` result permits Section 11.

### Class C — PostgreSQL, infrastructure, capture, or evidence uncertainty

Any PostgreSQL identity/topology change, unexpected network/volume/container
or port change, missing comparison, lost/unreliable evidence, or ambiguous
state, expired deadline, checkpoint mismatch, or evidence capture/sealing
failure requires an immediate safe stop and escalation. Do **not** assume an
application rollback will repair it and do not run speculative Docker,
database, network, or host commands. Preserve the evidence directory and any
remaining shell only as diagnostic context, block all application use, and
escalate immediately to the deployment authority. There is no authorized
wait-and-investigate state and no requirement that the original shell survive.

### Class D — rollback failure or ambiguity

Stop and escalate immediately. Do not retry with another image, tag, Compose
file, database action, or host change.

PostgreSQL or infrastructure mutation is never an automatic application
rollback trigger.

## 11. Application-Only Rollback

This is a separately named mutation phase. It may start in a fresh shell, but
only from the exclusive, checksummed `ROLLBACK_REQUIRED` state. Re-enter the
Fixed Identities block and repeat Section 1's host, repository, remote,
procedure, and helper identity gates. Set and validate the handed-off evidence
directory exactly as in Section 9.1, source the helper, and re-enter Section
4's capture definitions.

Validate the rollback-required checkpoint and prove that the unchanged failed
candidate runtime is still exactly the runtime that the decision observed:

```bash
gatec_validate_terminal_decision rollback-required.txt \
  rollback-required.sha256 || exit 1
gatec_checkpoint_expect rollback-required.txt terminal_contract_version 1 || exit 1
gatec_checkpoint_expect rollback-required.txt terminal_classification \
  ROLLBACK_REQUIRED || exit 1

capture_app_identity rollback-pre-app-identity.txt || exit 1
capture_app_topology rollback-pre-app-topology.txt || exit 1
capture_postgres_full rollback-pre-postgres-full.txt || exit 1
capture_project_inventory rollback-pre-project-containers.txt || exit 1
capture_network_static rollback-pre-network-static.txt || exit 1
capture_network_members rollback-pre-network-members.txt || exit 1
capture_volume_static rollback-pre-volume-static.txt || exit 1
capture_project_networks rollback-pre-project-networks.txt || exit 1
capture_project_volumes rollback-pre-project-volumes.txt || exit 1

ROLLBACK_SOURCE_RUNTIME="$(gatec_checkpoint_value rollback-required.txt runtime_bindings_leaf)" || exit 1
ROLLBACK_BOUND_APP_IDENTITY="$(gatec_checkpoint_value "$ROLLBACK_SOURCE_RUNTIME" app_identity_leaf)" || exit 1
test "$(gatec_file_sha256 rollback-pre-app-identity.txt)" = \
  "$(gatec_file_sha256 "$ROLLBACK_BOUND_APP_IDENTITY")" || exit 1
test "$(cut -d'|' -f2 "$EVIDENCE_DIR/rollback-pre-app-identity.txt")" = "$CANDIDATE_INDEX" || exit 1
cmp -s "$EVIDENCE_DIR/pre-app-topology.txt" "$EVIDENCE_DIR/rollback-pre-app-topology.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-postgres-full.txt" "$EVIDENCE_DIR/rollback-pre-postgres-full.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-network-static.txt" "$EVIDENCE_DIR/rollback-pre-network-static.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-network-members.txt" "$EVIDENCE_DIR/rollback-pre-network-members.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-volume-static.txt" "$EVIDENCE_DIR/rollback-pre-volume-static.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-project-containers.txt" "$EVIDENCE_DIR/rollback-pre-project-containers.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-project-networks.txt" "$EVIDENCE_DIR/rollback-pre-project-networks.txt" || exit 1
cmp -s "$EVIDENCE_DIR/pre-project-volumes.txt" "$EVIDENCE_DIR/rollback-pre-project-volumes.txt" || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1
```

If the application container no longer matches, the rollback may already have
run or unauthorized drift may have occurred. Do not replay it. Enter Class D.

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
gatec_capture_with_status rollback-compose-output.txt \
  rollback-command-status.txt rollback-capture-status.txt sg docker -c \
  "docker compose -p nam -f compose.yaml -f $ROLLBACK_OVERRIDE up -d --no-build --pull never --no-deps --force-recreate app"
ROLLBACK_CAPTURE_CALL_STATUS=$?
ROLLBACK_MUTATION_EPOCH="$(date -u +%s)" || exit 1
ROLLBACK_MUTATION_UTC="$(date -u -d "@$ROLLBACK_MUTATION_EPOCH" +%Y-%m-%dT%H:%M:%SZ)" || exit 1
gatec_validate_capture_statuses rollback-command-status.txt \
  rollback-capture-status.txt || exit 1
ROLLBACK_STATUS="$(gatec_checkpoint_value rollback-command-status.txt command_exit_status)" || exit 1
ROLLBACK_CAPTURE_STATUS="$(gatec_checkpoint_value rollback-capture-status.txt capture_integrity_status)" || exit 1
test "$(gatec_classify_mutation_status "$ROLLBACK_STATUS" \
  "$ROLLBACK_CAPTURE_STATUS")" = COMMAND_SUCCEEDED || exit 1
test "$ROLLBACK_CAPTURE_CALL_STATUS" -eq "$ROLLBACK_STATUS" || exit 1
test "$ROLLBACK_STATUS" -eq 0 || exit 1
gatec_note state-rollback-mutation-completed.txt \
  'execution_state=MUTATION_COMPLETED' \
  'mutation_kind=ROLLBACK' \
  "mutation_epoch=$ROLLBACK_MUTATION_EPOCH" \
  "mutation_utc=$ROLLBACK_MUTATION_UTC" || exit 1
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

Run the exact bounded local health function again, then seal the rollback
server-verification checkpoint before any client pause:

```bash
gatec_capture rollback-local-health.txt candidate_local_health || exit 1
ROLLBACK_SERVER_VERIFICATION_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1
ROLLBACK_DEADLINE_EPOCH=$((ROLLBACK_MUTATION_EPOCH + 900))
ROLLBACK_DEADLINE_UTC="$(date -u -d "@$ROLLBACK_DEADLINE_EPOCH" +%Y-%m-%dT%H:%M:%SZ)" || exit 1
gatec_validate_deadline "$ROLLBACK_MUTATION_EPOCH" "$ROLLBACK_DEADLINE_EPOCH" \
  "$ROLLBACK_MUTATION_EPOCH" "$(date -u +%s)" || exit 1
gatec_note state-rollback-server-verified.txt \
  'execution_state=SERVER_VERIFICATION_COMPLETED' \
  'mutation_kind=ROLLBACK' \
  "verified_utc=$ROLLBACK_SERVER_VERIFICATION_UTC" || exit 1

gatec_create_checkpoint rollback-checkpoint.txt rollback-checkpoint.sha256 \
  'checkpoint_version=1' \
  'execution_state=AWAITING_CLIENT_EVIDENCE' \
  'mutation_kind=ROLLBACK' \
  "mutation_epoch=$ROLLBACK_MUTATION_EPOCH" \
  "mutation_utc=$ROLLBACK_MUTATION_UTC" \
  "verification_deadline_epoch=$ROLLBACK_DEADLINE_EPOCH" \
  "verification_deadline_utc=$ROLLBACK_DEADLINE_UTC" \
  "evidence_dir=$EVIDENCE_DIR" \
  "evidence_dir_id=$EVIDENCE_DIR_ID" \
  "repository_root=$REPOSITORY_ROOT" \
  "repository_head=$(git rev-parse HEAD)" \
  "authorized_procedure_commit=$AUTHORIZED_PROCEDURE_COMMIT" \
  "procedure_path=$PROCEDURE_PATH" \
  "procedure_blob=$(git hash-object "$PROCEDURE_PATH")" \
  "helper_blob=$(git hash-object "$EVIDENCE_HELPER_PATH")" \
  "candidate_index=$CANDIDATE_INDEX" \
  "rollback_index=$ROLLBACK_INDEX" \
  "app_container_id=$(cut -d'|' -f1 "$EVIDENCE_DIR/rollback-app-identity.txt")" \
  "app_image_id=$(cut -d'|' -f2 "$EVIDENCE_DIR/rollback-app-identity.txt")" \
  "app_image_reference=$(cut -d'|' -f3 "$EVIDENCE_DIR/rollback-app-identity.txt")" \
  "app_started_at=$(cut -d'|' -f9 "$EVIDENCE_DIR/rollback-app-identity.txt")" \
  "app_identity_sha256=$(gatec_file_sha256 rollback-app-identity.txt)" \
  "app_topology_sha256=$(gatec_file_sha256 rollback-app-topology.txt)" \
  "postgres_container_id=$(cut -d'|' -f1 "$EVIDENCE_DIR/rollback-postgres-full.txt")" \
  "postgres_image_id=$(cut -d'|' -f2 "$EVIDENCE_DIR/rollback-postgres-full.txt")" \
  "postgres_started_at=$(cut -d'|' -f11 "$EVIDENCE_DIR/rollback-postgres-full.txt")" \
  "postgres_full_sha256=$(gatec_file_sha256 rollback-postgres-full.txt)" \
  "network_id=$(cut -d'|' -f1 "$EVIDENCE_DIR/rollback-network-static.txt")" \
  "network_static_sha256=$(gatec_file_sha256 rollback-network-static.txt)" \
  "network_members_sha256=$(gatec_file_sha256 rollback-network-members.txt)" \
  "volume_static_sha256=$(gatec_file_sha256 rollback-volume-static.txt)" \
  "project_containers_sha256=$(gatec_file_sha256 rollback-project-containers.txt)" \
  "project_networks_sha256=$(gatec_file_sha256 rollback-project-networks.txt)" \
  "project_volumes_sha256=$(gatec_file_sha256 rollback-project-volumes.txt)" \
  'expected_app_port=127.0.0.1:3000' \
  'expected_postgres_ports=none' \
  'server_health=PASS' \
  "server_health_sha256=$(gatec_file_sha256 rollback-local-health.txt)" \
  "server_verification_utc=$ROLLBACK_SERVER_VERIFICATION_UTC" || exit 1

gatec_validate_checkpoint_pair rollback-checkpoint.txt rollback-checkpoint.sha256 \
  app_container_id app_identity_sha256 app_image_id app_image_reference \
  app_started_at app_topology_sha256 authorized_procedure_commit candidate_index \
  checkpoint_version evidence_dir evidence_dir_id execution_state \
  expected_app_port expected_postgres_ports helper_blob mutation_epoch \
  mutation_kind mutation_utc network_id network_members_sha256 \
  network_static_sha256 postgres_container_id postgres_full_sha256 \
  postgres_image_id postgres_started_at procedure_blob procedure_path \
  project_containers_sha256 project_networks_sha256 project_volumes_sha256 \
  repository_head repository_root rollback_index server_health \
  server_health_sha256 server_verification_utc verification_deadline_epoch \
  verification_deadline_utc volume_static_sha256 || exit 1
```

The rollback-mutation shell may now end. Repeat Sections 8.3 through 8.6 on the
approved client. Then start a fresh verification-only shell and repeat Section
9.1's authorization, repository, helper, evidence-directory, and empty-safe
Git-status gates. Re-enter Section 4's functions and Section 8.1's health
function. Validate the full rollback-checkpoint schema shown above, then run:

```bash
gatec_capture rollback-resume-git-status.txt \
  git status --porcelain=v1 --untracked-files=all || exit 1
test ! -s "$EVIDENCE_DIR/rollback-resume-git-status.txt" || exit 1
ROLLBACK_CHECKPOINT_HASH="$(gatec_file_sha256 rollback-checkpoint.txt)" || exit 1
ROLLBACK_CHECKSUM_HASH="$(gatec_file_sha256 rollback-checkpoint.sha256)" || exit 1
readonly ROLLBACK_CHECKPOINT_HASH ROLLBACK_CHECKSUM_HASH
gatec_checkpoint_expect rollback-checkpoint.txt checkpoint_version 1 || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt execution_state AWAITING_CLIENT_EVIDENCE || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt mutation_kind ROLLBACK || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt rollback_index "$ROLLBACK_INDEX" || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt app_image_id "$ROLLBACK_INDEX" || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt evidence_dir "$EVIDENCE_DIR" || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt evidence_dir_id "$EVIDENCE_DIR_ID" || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt repository_head "$AUTHORIZED_PROCEDURE_COMMIT" || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt procedure_blob "$(git hash-object "$PROCEDURE_PATH")" || exit 1
gatec_checkpoint_expect rollback-checkpoint.txt helper_blob "$(git hash-object "$EVIDENCE_HELPER_PATH")" || exit 1

capture_runtime_set resume-rollback || exit 1
validate_runtime_set rollback-checkpoint.txt resume-rollback || exit 1
gatec_capture resume-rollback-local-health.txt candidate_local_health || exit 1
gatec_checkpoint_expect_file_hash rollback-checkpoint.txt server_health_sha256 \
  resume-rollback-local-health.txt || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1
create_runtime_bindings rollback-resume-runtime.txt \
  rollback-resume-runtime.sha256 resume-rollback rollback-checkpoint.txt || exit 1
gatec_create_state_transition rollback-resume-state.txt \
  rollback-resume-state.sha256 \
  'state_contract_version=1' \
  'execution_state=FRESH_SHELL_RESUME' \
  'predecessor_state=AWAITING_CLIENT_EVIDENCE' \
  "transition_epoch=$(date -u +%s)" \
  'source_checkpoint_leaf=rollback-checkpoint.txt' \
  "source_checkpoint_sha256=$(gatec_file_sha256 rollback-checkpoint.txt)" \
  'source_checkpoint_checksum_leaf=rollback-checkpoint.sha256' \
  "source_checkpoint_checksum_sha256=$(gatec_file_sha256 rollback-checkpoint.sha256)" \
  'runtime_bindings_leaf=rollback-resume-runtime.txt' \
  "runtime_bindings_sha256=$(gatec_file_sha256 rollback-resume-runtime.txt)" \
  'runtime_bindings_checksum_leaf=rollback-resume-runtime.sha256' \
  "runtime_bindings_checksum_sha256=$(gatec_file_sha256 rollback-resume-runtime.sha256)" || exit 1
```

Only now stamp client receipt and set the same five result variables used in
Section 9.2. Every value must be literal `PASS`; rollback verification has no
further mutation fallback. Use the rollback checkpoint's epochs and record the
sanitized result before the final drift check:

```bash
CLIENT_RESULTS_RECEIVED_EPOCH="$(date -u +%s)" || exit 1
CLIENT_RESULTS_RECEIVED_UTC="$(date -u -d "@$CLIENT_RESULTS_RECEIVED_EPOCH" +%Y-%m-%dT%H:%M:%SZ)" || exit 1
for result in \
  "$PRIVATE_TAILSCALE_HEALTH_RESULT" "$PUBLIC_HTTPS_DENIAL_RESULT" \
  "$AUTHENTICATION_BOUNDARY_RESULT" "$MEDIA_PHOTO_BOUNDARY_RESULT" \
  "$EQUIPMENT_NEW_READ_ONLY_RESULT"; do
  [[ "$result" = PASS ]] || exit 1
done
test "$(gatec_file_sha256 rollback-checkpoint.txt)" = \
  "$ROLLBACK_CHECKPOINT_HASH" || exit 1
test "$(gatec_file_sha256 rollback-checkpoint.sha256)" = \
  "$ROLLBACK_CHECKSUM_HASH" || exit 1
ROLLBACK_MUTATION_EPOCH="$(gatec_checkpoint_value rollback-checkpoint.txt mutation_epoch)" || exit 1
ROLLBACK_DEADLINE_EPOCH="$(gatec_checkpoint_value rollback-checkpoint.txt verification_deadline_epoch)" || exit 1
gatec_validate_deadline "$ROLLBACK_MUTATION_EPOCH" "$ROLLBACK_DEADLINE_EPOCH" \
  "$CLIENT_RESULTS_RECEIVED_EPOCH" "$(date -u +%s)" || exit 1
gatec_create_checkpoint rollback-client-evidence.txt \
  rollback-client-evidence.sha256 \
  'client_contract_version=1' \
  'client=darnassus' \
  'predecessor_state=FRESH_SHELL_RESUME' \
  'private_tailscale_health=PASS' \
  'public_https_denial=PASS' \
  'authentication_boundary=PASS' \
  'media_photo_boundary=PASS' \
  'equipment_new_read_only=PASS' \
  "received_epoch=$CLIENT_RESULTS_RECEIVED_EPOCH" \
  "received_utc=$CLIENT_RESULTS_RECEIVED_UTC" \
  "deadline_epoch=$ROLLBACK_DEADLINE_EPOCH" \
  'source_checkpoint_leaf=rollback-checkpoint.txt' \
  "source_checkpoint_sha256=$(gatec_file_sha256 rollback-checkpoint.txt)" \
  'source_checkpoint_checksum_leaf=rollback-checkpoint.sha256' \
  "source_checkpoint_checksum_sha256=$(gatec_file_sha256 rollback-checkpoint.sha256)" || exit 1
gatec_validate_client_evidence rollback-client-evidence.txt \
  rollback-client-evidence.sha256 || exit 1
```

Any late, missing, uncertain, malformed, or `FAIL` rollback result is Class D
and `ESCALATION_REQUIRED`; there is no second rollback or deployment retry.

After all five client results are timely `PASS`, recapture and validate the
full runtime a second time, then recheck ports and create the decision:

```bash
capture_runtime_set decision-rollback || exit 1
validate_runtime_set rollback-checkpoint.txt decision-rollback || exit 1
gatec_capture decision-rollback-local-health.txt candidate_local_health || exit 1
test "$(sg docker -c "docker port nam-app 3000/tcp")" = '127.0.0.1:3000' || exit 1
test -z "$(sg docker -c 'docker port nam-postgres')" || exit 1
test "$(gatec_file_sha256 rollback-checkpoint.txt)" = \
  "$ROLLBACK_CHECKPOINT_HASH" || exit 1
test "$(gatec_file_sha256 rollback-checkpoint.sha256)" = \
  "$ROLLBACK_CHECKSUM_HASH" || exit 1
gatec_validate_deadline "$ROLLBACK_MUTATION_EPOCH" "$ROLLBACK_DEADLINE_EPOCH" \
  "$CLIENT_RESULTS_RECEIVED_EPOCH" "$(date -u +%s)" || exit 1
create_runtime_bindings rollback-decision-runtime.txt \
  rollback-decision-runtime.sha256 decision-rollback rollback-checkpoint.txt || exit 1
ROLLBACK_DECISION_EPOCH="$(date -u +%s)" || exit 1
gatec_create_terminal_decision rollback-verified.txt rollback-verified.sha256 \
  'terminal_contract_version=1' \
  'execution_state=ROLLBACK_VERIFIED' \
  'terminal_classification=ROLLBACK_VERIFIED' \
  'expected_predecessor=FRESH_SHELL_RESUME' \
  'reason=ALL_MANDATORY_CHECKS_PASS' \
  "decision_epoch=$ROLLBACK_DECISION_EPOCH" \
  'predecessor_leaf=rollback-resume-state.txt' \
  "predecessor_sha256=$(gatec_file_sha256 rollback-resume-state.txt)" \
  'predecessor_checksum_leaf=rollback-resume-state.sha256' \
  "predecessor_checksum_sha256=$(gatec_file_sha256 rollback-resume-state.sha256)" \
  'source_checkpoint_leaf=rollback-checkpoint.txt' \
  "source_checkpoint_sha256=$(gatec_file_sha256 rollback-checkpoint.txt)" \
  'source_checkpoint_checksum_leaf=rollback-checkpoint.sha256' \
  "source_checkpoint_checksum_sha256=$(gatec_file_sha256 rollback-checkpoint.sha256)" \
  'client_evidence_leaf=rollback-client-evidence.txt' \
  "client_evidence_sha256=$(gatec_file_sha256 rollback-client-evidence.txt)" \
  'client_evidence_checksum_leaf=rollback-client-evidence.sha256' \
  "client_evidence_checksum_sha256=$(gatec_file_sha256 rollback-client-evidence.sha256)" \
  'runtime_bindings_leaf=rollback-decision-runtime.txt' \
  "runtime_bindings_sha256=$(gatec_file_sha256 rollback-decision-runtime.txt)" \
  'runtime_bindings_checksum_leaf=rollback-decision-runtime.sha256' \
  "runtime_bindings_checksum_sha256=$(gatec_file_sha256 rollback-decision-runtime.sha256)" \
  'client=darnassus' \
  "receipt_epoch=$CLIENT_RESULTS_RECEIVED_EPOCH" \
  "deadline_epoch=$ROLLBACK_DEADLINE_EPOCH" \
  'private_tailscale_health=PASS' \
  'public_https_denial=PASS' \
  'authentication_boundary=PASS' \
  'media_photo_boundary=PASS' \
  'equipment_new_read_only=PASS' || exit 1
```

This repeats local HTTP, loopback/unpublished bindings, public HTTPS denial,
approved-client private health, authentication, media/photo, feature checks,
and two complete runtime comparisons. Resuming verification never repeats the
rollback mutation.

No down-migration is required or permitted because the exact candidate range
contains no Prisma schema or migration change and this procedure performs no
database operation.

## 12. Evidence Inventory And Final Report

Proceed only when the exclusive current outcome is `CANDIDATE_ACCEPTED`, or
when the monotonic `ROLLBACK_REQUIRED -> ROLLBACK_VERIFIED` chain exists.
Those two rollback records are a compatible predecessor/successor pair, not
two competing classifications. Revalidate the decision file,
authorized Git identity, evidence-directory identity, applicable checkpoint,
and both runtime capture sets that immediately preceded the decision. Re-enter
Section 4's validation functions if this is a separate shell. Enforce the
mandatory leaf contract before treating every regular file in the directory as
the intended evidence set. This sealing phase validates retained proof; it does
not claim a new live-runtime observation.

```bash
gatec_require_files \
  authorization.txt state-pre-mutation.txt artifact-checks.txt \
  compose-models.txt migration-boundary.txt image-identities.txt \
  pre-app-identity.txt pre-app-topology.txt pre-postgres-full.txt \
  pre-project-containers.txt pre-network-static.txt pre-network-members.txt \
  pre-volume-static.txt pre-project-networks.txt pre-project-volumes.txt \
  deployment-compose-output.txt deployment-command-status.txt \
  deployment-command-status.txt.sha256 deployment-capture-status.txt \
  deployment-capture-status.txt.sha256 candidate-app-identity.txt \
  candidate-app-topology.txt candidate-postgres-full.txt \
  candidate-project-containers.txt candidate-network-static.txt \
  candidate-network-members.txt candidate-volume-static.txt \
  candidate-project-networks.txt candidate-project-volumes.txt || exit 1

if test -f "$EVIDENCE_DIR/candidate-accepted.txt" \
  && test ! -e "$EVIDENCE_DIR/rollback-required.txt" \
  && test ! -e "$EVIDENCE_DIR/escalation-required.txt" \
  && test ! -e "$EVIDENCE_DIR/rollback-verified.txt" \
  && gatec_validate_terminal_decision candidate-accepted.txt \
    candidate-accepted.sha256; then
  gatec_require_files \
    state-candidate-mutation-completed.txt candidate-local-health.txt \
    state-candidate-server-verified.txt candidate-checkpoint.txt \
    candidate-checkpoint.sha256 candidate-resume-git-status.txt \
    resume-candidate-app-identity.txt resume-candidate-app-topology.txt \
    resume-candidate-postgres-full.txt resume-candidate-project-containers.txt \
    resume-candidate-network-static.txt resume-candidate-network-members.txt \
    resume-candidate-volume-static.txt resume-candidate-project-networks.txt \
    resume-candidate-project-volumes.txt resume-candidate-local-health.txt \
    candidate-resume-state.txt candidate-resume-state.sha256 \
    candidate-resume-runtime.txt candidate-resume-runtime.sha256 \
    candidate-client-evidence.txt candidate-client-evidence.sha256 \
    decision-candidate-app-identity.txt decision-candidate-app-topology.txt \
    decision-candidate-postgres-full.txt decision-candidate-project-containers.txt \
    decision-candidate-network-static.txt decision-candidate-network-members.txt \
    decision-candidate-volume-static.txt decision-candidate-project-networks.txt \
    decision-candidate-project-volumes.txt decision-candidate-local-health.txt \
    candidate-decision-runtime.txt candidate-decision-runtime.sha256 \
    candidate-accepted.txt candidate-accepted.sha256 || exit 1
  gatec_validate_checkpoint_pair candidate-checkpoint.txt candidate-checkpoint.sha256 \
    app_container_id app_identity_sha256 app_image_id app_image_reference \
    app_started_at app_topology_sha256 authorized_procedure_commit \
    candidate_config candidate_index candidate_manifest candidate_revision \
    checkpoint_version evidence_dir evidence_dir_id execution_state \
    expected_app_port expected_postgres_ports helper_blob mutation_epoch \
    mutation_kind mutation_utc network_id network_members_sha256 \
    network_static_sha256 postgres_container_id postgres_full_sha256 \
    postgres_image_id postgres_started_at procedure_blob procedure_path \
    project_containers_sha256 project_networks_sha256 project_volumes_sha256 \
    repository_head repository_root rollback_index server_health \
    server_health_sha256 server_verification_utc verification_deadline_epoch \
    verification_deadline_utc volume_static_sha256 || exit 1
  validate_runtime_set candidate-checkpoint.txt resume-candidate || exit 1
  validate_runtime_set candidate-checkpoint.txt decision-candidate || exit 1
  FINAL_DECISION=CANDIDATE_ACCEPTED
elif test -f "$EVIDENCE_DIR/rollback-verified.txt" \
  && test ! -e "$EVIDENCE_DIR/candidate-accepted.txt" \
  && test -f "$EVIDENCE_DIR/rollback-required.txt" \
  && test ! -e "$EVIDENCE_DIR/escalation-required.txt" \
  && gatec_validate_terminal_decision rollback-verified.txt \
    rollback-verified.sha256; then
  gatec_require_files \
    rollback-required.txt rollback-required.sha256 \
    rollback-pre-app-identity.txt rollback-pre-app-topology.txt \
    rollback-pre-postgres-full.txt rollback-pre-project-containers.txt \
    rollback-pre-network-static.txt rollback-pre-network-members.txt \
    rollback-pre-volume-static.txt rollback-pre-project-networks.txt \
    rollback-pre-project-volumes.txt rollback-compose-output.txt \
    rollback-command-status.txt rollback-command-status.txt.sha256 \
    rollback-capture-status.txt rollback-capture-status.txt.sha256 \
    state-rollback-mutation-completed.txt rollback-app-identity.txt \
    rollback-app-topology.txt rollback-postgres-full.txt \
    rollback-project-containers.txt rollback-network-static.txt \
    rollback-network-members.txt rollback-volume-static.txt \
    rollback-project-networks.txt rollback-project-volumes.txt \
    rollback-local-health.txt state-rollback-server-verified.txt \
    rollback-checkpoint.txt rollback-checkpoint.sha256 \
    rollback-resume-git-status.txt \
    resume-rollback-app-identity.txt resume-rollback-app-topology.txt \
    resume-rollback-postgres-full.txt resume-rollback-project-containers.txt \
    resume-rollback-network-static.txt resume-rollback-network-members.txt \
    resume-rollback-volume-static.txt resume-rollback-project-networks.txt \
    resume-rollback-project-volumes.txt resume-rollback-local-health.txt \
    rollback-resume-state.txt rollback-resume-state.sha256 \
    rollback-resume-runtime.txt rollback-resume-runtime.sha256 \
    rollback-client-evidence.txt rollback-client-evidence.sha256 \
    decision-rollback-app-identity.txt decision-rollback-app-topology.txt \
    decision-rollback-postgres-full.txt decision-rollback-project-containers.txt \
    decision-rollback-network-static.txt decision-rollback-network-members.txt \
    decision-rollback-volume-static.txt decision-rollback-project-networks.txt \
    decision-rollback-project-volumes.txt decision-rollback-local-health.txt \
    rollback-decision-runtime.txt rollback-decision-runtime.sha256 \
    rollback-verified.txt rollback-verified.sha256 || exit 1
  gatec_validate_terminal_decision rollback-required.txt \
    rollback-required.sha256 || exit 1
  ROLLBACK_REASON="$(gatec_checkpoint_value rollback-required.txt reason)" || exit 1
  if [[ "$ROLLBACK_REASON" = CLIENT_VERIFICATION_FAILURE ]]; then
    gatec_require_files state-candidate-mutation-completed.txt \
      candidate-local-health.txt state-candidate-server-verified.txt \
      candidate-checkpoint.txt candidate-checkpoint.sha256 \
      candidate-resume-git-status.txt resume-candidate-app-identity.txt \
      resume-candidate-app-topology.txt resume-candidate-postgres-full.txt \
      resume-candidate-project-containers.txt resume-candidate-network-static.txt \
      resume-candidate-network-members.txt resume-candidate-volume-static.txt \
      resume-candidate-project-networks.txt resume-candidate-project-volumes.txt \
      resume-candidate-local-health.txt candidate-resume-state.txt \
      candidate-resume-state.sha256 candidate-client-evidence.txt \
      candidate-client-evidence.sha256 decision-candidate-app-identity.txt \
      decision-candidate-app-topology.txt decision-candidate-postgres-full.txt \
      decision-candidate-project-containers.txt decision-candidate-network-static.txt \
      decision-candidate-network-members.txt decision-candidate-volume-static.txt \
      decision-candidate-project-networks.txt decision-candidate-project-volumes.txt || exit 1
  elif [[ "$ROLLBACK_REASON" = RUNTIME_FAILURE ]]; then
    gatec_require_files failure-app-identity.txt failure-app-topology.txt \
      failure-postgres-full.txt failure-project-containers.txt \
      failure-network-static.txt failure-network-members.txt \
      failure-volume-static.txt failure-project-networks.txt \
      failure-project-volumes.txt failure-local-health.txt \
      runtime-failure-checkpoint.txt runtime-failure-checkpoint.sha256 \
      runtime-failure-bindings.txt runtime-failure-bindings.sha256 \
      runtime-failure-state.txt runtime-failure-state.sha256 || exit 1
  else
    exit 1
  fi
  gatec_validate_checkpoint_pair rollback-checkpoint.txt rollback-checkpoint.sha256 \
    app_container_id app_identity_sha256 app_image_id app_image_reference \
    app_started_at app_topology_sha256 authorized_procedure_commit candidate_index \
    checkpoint_version evidence_dir evidence_dir_id execution_state \
    expected_app_port expected_postgres_ports helper_blob mutation_epoch \
    mutation_kind mutation_utc network_id network_members_sha256 \
    network_static_sha256 postgres_container_id postgres_full_sha256 \
    postgres_image_id postgres_started_at procedure_blob procedure_path \
    project_containers_sha256 project_networks_sha256 project_volumes_sha256 \
    repository_head repository_root rollback_index server_health \
    server_health_sha256 server_verification_utc verification_deadline_epoch \
    verification_deadline_utc volume_static_sha256 || exit 1
  validate_runtime_set rollback-checkpoint.txt resume-rollback || exit 1
  validate_runtime_set rollback-checkpoint.txt decision-rollback || exit 1
  FINAL_DECISION=ROLLBACK_VERIFIED
else
  exit 1
fi

gatec_assert_evidence_directory || exit 1
gatec_assert_only_regular_evidence_files || exit 1
while IFS= read -r -d '' evidence_file; do
  gatec_assert_file_metadata "$evidence_file" || exit 1
done < <(find -P "$EVIDENCE_DIR" -mindepth 1 -maxdepth 1 -type f -print0)
gatec_capture final-git-status.txt \
  git status --porcelain=v1 --untracked-files=all || exit 1
test ! -s "$EVIDENCE_DIR/final-git-status.txt" || exit 1
gatec_note seal-inputs-ready.txt \
  'execution_state=SEAL_INPUTS_VALIDATED' \
  "final_decision=$FINAL_DECISION" \
  'seal_target_state=EVIDENCE_SEALED' \
  "validated_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)" || exit 1

gatec_create_inventory evidence-files.txt SHA256SUMS || exit 1
gatec_assert_file_metadata "$EVIDENCE_DIR/evidence-files.txt" || exit 1
LC_ALL=C sort -c -u "$EVIDENCE_DIR/evidence-files.txt" || exit 1
gatec_create_manifest evidence-files.txt SHA256SUMS || exit 1
gatec_assert_file_metadata "$EVIDENCE_DIR/SHA256SUMS" || exit 1
if test "$FINAL_DECISION" = CANDIDATE_ACCEPTED; then
  gatec_validate_terminal_decision candidate-accepted.txt \
    candidate-accepted.sha256 || exit 1
else
  gatec_validate_terminal_decision rollback-required.txt \
    rollback-required.sha256 || exit 1
  gatec_validate_terminal_decision rollback-verified.txt \
    rollback-verified.sha256 || exit 1
fi
gatec_validate_seal evidence-files.txt SHA256SUMS || exit 1
```

The sorted inventory includes itself and every other intended regular evidence
file. `SHA256SUMS` covers exactly that inventory and is the sole exclusion, so
there is no self-referential hash. Final successful
`gatec_validate_seal` opens every leaf with `O_NOFOLLOW`, holds descriptors
open, requires one-link regular files owned by `alain:alain` with mode `0600`,
and performs three full content/identity/metadata passes plus an immediate
final descriptor/path/directory comparison. Only its final zero status permits
the external execution report to record `EVIDENCE_SEALED`.

This mechanism assumes the local filesystem correctly implements no-follow
open, stable device/inode identity, link counts, SHA-256 reads, and modification
and change timestamps, and that no privileged actor can falsify kernel metadata
or mutate the files after validation returns. Modes `0700`/`0600` do not make
owner-writable evidence permanently immutable. The mechanism proves a stable,
manifest-consistent snapshot throughout its repeated validation and at its
immediate final check; it does not claim protection from a privileged host
adversary or from a later authorized owner write.

If any sealing operation fails, do not delete, rename, overwrite, regenerate,
or append evidence and do not retry deployment or rollback. Preserve the
directory exactly as it stands, report the specific failed operation and
`ESCALATION_REQUIRED` outside that directory, and stop.

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

1. Complete the six-file hardening implementation without staging or commit.
2. Complete an independent audit.
3. Correct every confirmed audit finding while preserving passing controls.
4. Obtain an independent re-audit of the complete corrected implementation.
5. Only after re-audit passes, separately authorize a focused commit containing
   exactly `docs/README.md`,
   `docs/infrastructure/controlled-pilot-readiness-rebaseline.md`,
   `docs/infrastructure/gate-c-8a6c652-deployment-rollback-procedure.md`,
   `infrastructure/server-config/README.md`,
   `infrastructure/server-config/scripts/gate-c-evidence.sh`, and
   `tests/infrastructure/gate-c-evidence-synthetic.sh`.
6. Any future deployment requires a separate authorization naming that exact
   reviewed commit. A commit, push, or re-audit is not deployment authority.

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
