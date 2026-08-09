# Gate D Public Exposure Cutover Procedure

## Status And Authority

**Designed, not executed. Gate D is not authorized. This document is not
acceptance evidence.** Every command and control-plane action below is a future
operator step that requires a separate, explicit execution authorization.

This procedure implements only Gate D of the unnumbered Controlled Pilot
Readiness Security and Deployment Re-baseline. The
[Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md)
remains the current-state and sequencing authority. The
[Gate B evidence](gate-b-private-access-administrator-recovery-evidence.md)
establishes the accepted private-access and independent-recovery prerequisites.
The [Gate C evidence](gate-c-immutable-deployment-candidate-evidence.md) remains
deployment-candidate evidence; Gate D must not deploy that image.

If separately authorized, this document supersedes historical Checkpoint D
sequencing only for this public-exposure cutover. Historical Checkpoint D
documents remain evidence for the `76cdba9`/16-migration generation and are not
execution authority for Gate D.

No command in this document is authorized merely because it is documented.
Successful execution would produce evidence for independent Gate D review; it
would not accept Gate D or authorize a later gate.

## Objective And Completion Boundary

Gate D removes every public route from the NAM VPS to NAM Dashboard while
preserving both approved access paths:

- approved devices continue using tailnet-only HTTPS through Tailscale Serve;
- the administrator retains independent public, key-only SSH recovery; and
- public SSH remains separate from NAM application access.

Gate D is complete only when independent evidence proves all of the following:

- NAM is unavailable publicly through the VPS over IPv4 and IPv6;
- hostname, SNI, forced-address, redirect, direct-address, TCP `80`, TCP `443`,
  and UDP `443`/QUIC paths have been tested;
- no public Caddy, DNS, alternate-host, Funnel, or other public NAM bypass
  remains;
- approved Windows and iPad private access still works with valid TLS;
- public key-only SSH recovery still works independently of Tailscale;
- the application remains bound only to `127.0.0.1:3000`;
- PostgreSQL remains unpublished; and
- the selected container, image, Compose project/service, restart-count, mount,
  PostgreSQL-volume, network/attachment, and configured and observed runtime
  port-binding identities remain unchanged; and
- Gate D performed no Docker, database, migration, upload, backup, or restore
  mutation.

A TLS or certificate error alone is never denial evidence. TCP/UDP reachability
and correct hostname/SNI paths must be tested independently.

## Explicit Exclusions

Gate D does not authorize or include:

- application deployment, image pull, build, tag, or replacement;
- container start, stop, restart, recreation, or network changes;
- database inspection, migration, backup, restore, or other mutation;
- upload or operational-record inspection or mutation;
- application authentication or authorization;
- Tailscale Serve, Funnel, tag, grant, device, or MagicDNS changes;
- SSH configuration, key, user, group, sudo, Fail2ban, or TCP `22` changes;
- provider-firewall creation;
- unrelated DNS or legacy-destination cleanup;
- certificate or Caddy storage deletion;
- reboot, Docker-restart, revocation, re-enrollment, emergency-disablement, full
  contributor, or broader final Access Gate acceptance;
- confidential operational use or controlled-pilot authorization; or
- Gate E, deployment, or any later readiness gate.

## Roles And Evidence Sources

| Role | Responsibility |
| --- | --- |
| VPS operator | Runs approved preflight, state capture, Caddy, UFW, and verification steps while preserving the recovery session. |
| Independent Windows client | Provides off-VPS IPv4, IPv6, TCP, QUIC, private HTTPS, and public SSH evidence. |
| Approved iPad client | Proves cellular private access with Tailscale connected and denial with Tailscale disconnected. |
| DNS control-plane operator | Changes only the approved records and records authoritative before/after evidence without exposing credentials. |
| Reviewer/acceptance authority | Reviews the complete evidence bundle, deviations, and any rollback; only this separate decision can accept Gate D. |

VPS-originated requests are supporting diagnostics only. They cannot substitute
for independent public-denial, private-client, or recovery evidence.

## Accepted Design Inputs Requiring Fresh Validation

The design assumes the accepted discovery baseline below. Execution must
revalidate every item before mutation and stop on a material difference.

- Design lineage: this procedure was designed from the clean synchronized
  repository baseline
  `79bbb6e3223d9e46cca9a7418bd6fd5df657d6e8`. That revision is historical
  design evidence, not the future Gate D execution revision.
- Future execution requires a separate authorization naming an exact committed
  `<AUTHORIZED_GATE_D_EXECUTION_REVISION>` that contains the reviewed version
  of this procedure. The accepted Gate C source revision
  `130a7fe6bf7c8060a561e8ecb171be35e2724eef` must remain in its ancestry.
- Live Caddyfile: `/etc/caddy/Caddyfile` with one NAM site for
  `dev.alemany.me` proxying to `127.0.0.1:3000` and no unrelated site.
- Caddy exposes TCP `80`, TCP `443`, and UDP `443` through a dual-stack socket.
- The app is published only at `127.0.0.1:3000`; PostgreSQL has no host port.
- UFW is active with IPv6 enabled and default incoming/routed deny.
- Simple public allow rules exist for TCP `22`, `80`, and `443` over IPv4 and
  IPv6; no explicit UDP `443` allow rule exists.
- No provider firewall is attached. Gate D must not create one.
- Tailscale Serve is tailnet-only HTTPS for
  `ops-console.tailf57e61.ts.net`, forwarding `/` to
  `http://127.0.0.1:3000`; Funnel is disabled.
- `dev.alemany.me` has a public VPS `A` record with an observed TTL near 1,800
  seconds and no relevant `AAAA` or `CNAME`.
- `nam.alemany.me` has a stale VPS `A` record and an unrelated legacy `CNAME`
  to `wikijs-nam.fly.dev`; only the VPS `A` record is in Gate D scope.
- Independent private-client and public SSH recovery checks have passed, but
  both require fresh execution-time proof.
- Repository evidence establishes PostgreSQL as the only currently implemented
  durable application-data store. Compose uses the `postgres-data` volume at
  `/var/lib/postgresql`, defines no application persistent mount, and the
  application implements no upload/media store. `/var/lib/nam/media` is future
  architecture, not current storage. Live evidence establishes only the
  observed Docker mount and persistence topology and must be revalidated before
  mutation.
- Read-only readiness evidence confirmed `getfacl` 2.3.2 and `getfattr` 2.5.2
  support every option used below and inspected `/etc/caddy/Caddyfile`
  successfully. Their presence, versions, option compatibility, and current
  Caddyfile metadata must be revalidated at execution time.

### Persistence-Proof Boundary

Gate D must leave the application, PostgreSQL, Docker resources, uploads, and
persistent data untouched. Its approved persistence proof is exact equality of
the selected before/after container, immutable image, Compose project/service,
volume, mount, network, restart-count, and port-binding identities, together
with an evidence review confirming that Gate D performed no Docker, database,
migration, upload, backup, or restore mutation.

This resource-identity proof does not claim logical, row-level, or byte-for-byte
database equality. Normal application activity may change PostgreSQL contents.
If media storage, external object storage, another application persistence
mechanism, or any persistence topology not represented by the accepted
repository baseline is implemented or discovered, stop and require a new
persistence baseline and relevant procedure re-audit before reuse.

## Preconditions And Stop Conditions

### Required Before Mutation

The operator must have all of the following:

- explicit Gate D execution authorization naming this document and an exact
  committed `<AUTHORIZED_GATE_D_EXECUTION_REVISION>`;
- proof that `HEAD`, local `main`, and the locally recorded `origin/main` all
  equal that authorized revision, that the index and worktree are clean, and
  that the accepted Gate C source revision remains in its ancestry;
- two active SSH sessions through the public dedicated recovery-key path: one
  recovery anchor kept idle and one operator session used for Match-aware
  policy capture;
- fresh effective `sshd` proof of key-only, non-root recovery and a fresh
  external recovery-key login;
- current application and PostgreSQL container, immutable image, Compose
  project/service, mount, network, restart-count, and port-binding evidence;
- unambiguous proof that PostgreSQL uses the same `postgres-data` volume,
  including its attachment at `/var/lib/postgresql`, and that the application
  has no persistent Docker mount; the live volume driver is an anchored identity
  that must remain unchanged, not a driver value claimed from repository
  configuration;
- current Caddyfile identity and a complete NAM/unrelated-site inventory;
- proof that no unrelated workload depends on TCP `80`, TCP `443`, or UDP
  `443`;
- current UFW, IPv4/IPv6, nftables, and Docker-chain evidence showing the exact
  rules to change and no bypass;
- current authoritative `A`, `AAAA`, and `CNAME` records and TTLs for both
  public hostnames;
- current Tailscale node, tag, Serve, Funnel, Windows, and iPad evidence;
- independently usable public IPv4, public IPv6, and HTTP/3-only/QUIC test
  capability;
- the exact public IPv4 and IPv6 values stored privately as
  `<NAM_VPS_PUBLIC_IPV4>` and `<NAM_VPS_PUBLIC_IPV6>`;
- verified secure recovery copies and exact rollback inputs; and
- the DNS operator and acceptance reviewer available for the maintenance
  window.

### Mandatory Stop Conditions

Stop before mutation if:

- the repository, Caddy, UFW, DNS, Tailscale, SSH, container, listener, or
  binding state materially differs from the accepted design inputs;
- any unrelated workload uses the affected Caddy route or host-wide web ports;
- the private Tailscale route or either approved client fails;
- independent public SSH recovery or sudo eligibility is unavailable;
- the recovery anchor session is not open and healthy;
- external IPv6 or UDP `443`/QUIC testing is unavailable;
- the exact reviewed curl application cannot be uniquely pinned, hashed, or
  proven to support the direct no-config/no-proxy profile;
- any required IPv4, IPv6, HTTP/3, private-access, or pre-cutover TCP NAM
  positive control fails;
- a pre-cutover forced NAM HTTP/3 probe returns any HTTP response, indicating
  an unexpected UDP `443` path or firewall bypass;
- UFW contains a UDP `443` allow or nonstandard web rule not covered here;
- a Docker, nftables, provider, redirect, wildcard, alternate-host, or other
  public bypass is found;
- a container, immutable image, Compose project/service, volume, mount, network,
  restart-count, or port-binding identity is missing, ambiguous, unexpected, or
  differs from the captured before-state;
- the PostgreSQL volume cannot be identified unambiguously as `postgres-data`
  attached at `/var/lib/postgresql`, or its driver cannot be identified;
- an application persistent Docker mount exists, or repository or other
  approved evidence identifies an upload/media, external object, or other
  persistence mechanism outside the accepted baseline;
- any evidence suggests Gate D would require a Docker, database, migration,
  upload, backup, or restore mutation;
- rollback files, record values, checksums, ownership, permissions, ACLs, or
  extended-attribute evidence are incomplete;
- the DNS operator cannot distinguish the VPS `A` record from the unrelated
  legacy `CNAME`;
- a command, rule, record, address, target, or expected effect is ambiguous; or
- execution would require any excluded change.

During mutation, stop at the current checkpoint if private access or public SSH
degrades, a command fails, an identity changes, or an unexpected route remains.
Before any authorized rollback, attempt the mandatory failure/pre-rollback
persistence capture defined below. Failure of that inspection or comparison
keeps Gate D failed and prohibits an unchanged-persistence claim, but it must
not prevent the minimum safety rollback needed for Caddy, firewall, DNS, or
access recovery.
Do not describe NAM as fail-closed until independent testing proves every
relevant public path is denied; an older Caddy runtime or another bypass may
still be active. Determine the actual public state immediately. Do not
automatically restore unauthenticated public access; rollback requires an
explicit owner decision under [Rollback](#rollback).

## Secure State Capture And Rollback Preparation

The commands in this and later sections are **future commands; do not run them
without Gate D execution authorization**.

### Secure Recovery Directory

Use the existing operator-controlled backup parent only after confirming it is
the expected directory. Do not create a replacement parent implicitly. All VPS
blocks should run in one persistent operator shell so strict-shell state,
functions, and the exact recovery-directory identity remain available across
checkpoints. Keep that shell and the separate recovery anchor open through the
DNS TTL wait.

```bash
set -euo pipefail
umask 077
test -d /home/alain/backups/nam
test -w /home/alain/backups/nam
GATE_D_RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
GATE_D_RECOVERY_DIR="/home/alain/backups/nam/gate-d-${GATE_D_RUN_ID}"
mkdir --mode=0700 -- "$GATE_D_RECOVERY_DIR"
test "$(stat -c %a "$GATE_D_RECOVERY_DIR")" = 700
test "$(stat -c %u "$GATE_D_RECOVERY_DIR")" = "$(id -u)"
printf '%s\n' "$GATE_D_RUN_ID" > "$GATE_D_RECOVERY_DIR/run-id"
printf '%s\n' "$GATE_D_RECOVERY_DIR" > "$GATE_D_RECOVERY_DIR/absolute-path"
```

Keep this directory outside Git. Do not print or commit its raw contents. It may
contain public addresses, DNS answers, firewall details, and recoverable host
configuration.

If re-entry is unavoidable, use only the exact absolute path and run identifier
recorded privately by the operator. Never select a `latest` directory, expand a
glob, or discover a run automatically. In the new public SSH session, substitute
the two exact recorded values below, then revalidate them before any other step:

```bash
set -euo pipefail
umask 077
GATE_D_RUN_ID="<EXACT_PRIVATELY_RECORDED_GATE_D_RUN_ID>"
GATE_D_RECOVERY_DIR="<EXACT_PRIVATELY_RECORDED_ABSOLUTE_RECOVERY_DIRECTORY>"
test "$GATE_D_RECOVERY_DIR" = "/home/alain/backups/nam/gate-d-${GATE_D_RUN_ID}"
test -d "$GATE_D_RECOVERY_DIR"
test ! -L "$GATE_D_RECOVERY_DIR"
test "$(realpath -- "$GATE_D_RECOVERY_DIR")" = "$GATE_D_RECOVERY_DIR"
test "$(stat -c %u "$GATE_D_RECOVERY_DIR")" = "$(id -u)"
test "$(stat -c %a "$GATE_D_RECOVERY_DIR")" = 700
test "$(cat "$GATE_D_RECOVERY_DIR/run-id")" = "$GATE_D_RUN_ID"
test "$(cat "$GATE_D_RECOVERY_DIR/absolute-path")" = "$GATE_D_RECOVERY_DIR"
test -s "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.list"
test -s "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.sha256"
test -s "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.stat"
test -s "$GATE_D_RECOVERY_DIR/pre-mutation-manifest.anchor.sha256"
test -s "$GATE_D_RECOVERY_DIR/checkpoint-state"
(
  cd -- "$GATE_D_RECOVERY_DIR"
  sha256sum --check --strict pre-mutation-manifest.anchor.sha256
  sha256sum --check --strict checkpoint-state.sha256
  sudo sha256sum --check --strict pre-mutation-artifacts.sha256
)
while IFS='|' read -r artifact expected_uid expected_gid expected_mode expected_size; do
  test -n "$artifact"
  test ! -L "$GATE_D_RECOVERY_DIR/$artifact"
  test "$(sudo stat -c %u "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_uid"
  test "$(sudo stat -c %g "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_gid"
  test "$(sudo stat -c %a "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_mode"
  test "$(sudo stat -c %s "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_size"
done < "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.stat"
GATE_D_CHECKPOINT="$(cat "$GATE_D_RECOVERY_DIR/checkpoint-state")"
case "$GATE_D_CHECKPOINT" in
  PRE_MUTATION_CAPTURE_COMPLETE|CANDIDATE_VALIDATED_RUNTIME_UNCHANGED|\
  CANDIDATE_ACTIVE_PERSISTENT_BEFORE|CANDIDATE_ACTIVE_AND_PERSISTED|\
  WEB_UFW_RULES_REMOVED|VPS_DNS_RECORDS_REMOVED) ;;
  *) exit 31 ;;
esac

verify_gate_d_candidate_artifacts() {
  test -s "$GATE_D_RECOVERY_DIR/caddy-candidate.sha256"
  test -s "$GATE_D_RECOVERY_DIR/caddy-candidate.stat"
  (cd -- "$GATE_D_RECOVERY_DIR" && \
    sudo sha256sum --check --strict caddy-candidate.sha256)
  while IFS='|' read -r artifact expected_uid expected_gid expected_mode expected_size; do
    test -n "$artifact"
    test ! -L "$GATE_D_RECOVERY_DIR/$artifact"
    test "$(sudo stat -c %u "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_uid"
    test "$(sudo stat -c %g "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_gid"
    test "$(sudo stat -c %a "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_mode"
    test "$(sudo stat -c %s "$GATE_D_RECOVERY_DIR/$artifact")" = "$expected_size"
  done < "$GATE_D_RECOVERY_DIR/caddy-candidate.stat"
}

case "$GATE_D_CHECKPOINT" in
  PRE_MUTATION_CAPTURE_COMPLETE)
    sudo cmp --silent /etc/caddy/Caddyfile \
      "$GATE_D_RECOVERY_DIR/Caddyfile.before"
    ;;
  CANDIDATE_VALIDATED_RUNTIME_UNCHANGED)
    verify_gate_d_candidate_artifacts
    sudo cmp --silent /etc/caddy/Caddyfile \
      "$GATE_D_RECOVERY_DIR/Caddyfile.before"
    ;;
  CANDIDATE_ACTIVE_PERSISTENT_BEFORE)
    exit 32
    ;;
  CANDIDATE_ACTIVE_AND_PERSISTED|WEB_UFW_RULES_REMOVED|VPS_DNS_RECORDS_REMOVED)
    verify_gate_d_candidate_artifacts
    sudo cmp --silent /etc/caddy/Caddyfile \
      "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d"
    ;;
esac
```

The recorded checkpoint must be one of the explicitly defined states below.
Before any forward cutover mutation after re-entry, verify the
checkpoint-specific artifacts, re-run the complete recovery-copy verification,
re-inspect the active Caddy runtime and persistent Caddyfile, and re-run the
Match-aware SSH policy block in the new public session. Re-enter all reviewed
persistence validation, comparison, and capture function
definitions without invoking them. The verified and anchored before snapshot
and checksum must already exist;
the new re-entry output and checksum must not exist. Fail closed on a missing,
empty, altered, or unverifiable before artifact. Then invoke the exact `reentry`
phase; the common capture function creates both new artifacts without
overwriting either one:

```bash
test -s "$GATE_D_RECOVERY_DIR/runtime-persistence.before.txt"
test -s "$GATE_D_RECOVERY_DIR/runtime-persistence.before.sha256"
test ! -L "$GATE_D_RECOVERY_DIR/runtime-persistence.before.txt"
test ! -L "$GATE_D_RECOVERY_DIR/runtime-persistence.before.sha256"
test ! -e "$GATE_D_RECOVERY_DIR/runtime-persistence.reentry.txt"
test ! -e "$GATE_D_RECOVERY_DIR/runtime-persistence.reentry.sha256"
verify_gate_d_persistence_before
capture_gate_d_persistence_identity reentry
verify_gate_d_persistence_phase reentry
compare_gate_d_persistence_with_before reentry
```

Missing, empty, inconsistent, or unexpected artifacts or persistence topology,
an ambiguous runtime/persistent checkpoint, or an SSH policy mismatch prohibits
all further cutover mutation. It does not prohibit an explicitly authorized
minimum safety rollback after a failed cutover; that path must attempt the
failure/pre-rollback capture, record any inspection failure, complete only the
necessary rollback, and attempt the post-rollback comparison. Never infer
progress from filenames or select a recovery directory automatically.

For every candidate-bearing checkpoint, compare current candidate metadata to
`caddy-candidate.stat`. For a persisted checkpoint, also run the verified
active-config export and normalized semantic comparison before continuing. For
`WEB_UFW_RULES_REMOVED` and `VPS_DNS_RECORDS_REMOVED`, additionally recapture
and review the exact effective firewall or DNS state appropriate to that
checkpoint. These are mandatory state validations, not recovery-directory
discovery. The explicit exit for `CANDIDATE_ACTIVE_PERSISTENT_BEFORE` prevents
automated continuation across a known runtime/disk mismatch.

### Repository, Runtime, And Persistence Identity

This safeguard assumes one trusted operator uses a dedicated shell and that no
concurrent same-user process is maliciously changing the recovery directory or
its evidence files. It does not defend against a compromised Linux account or a
precisely timed same-UID attack. The recovery directory remains private, and an
unexpected or incomplete artifact still stops the procedure for operator
review.

```bash
pwd
AUTHORIZED_GATE_D_EXECUTION_REVISION="<AUTHORIZED_GATE_D_EXECUTION_REVISION>"
test "$(git branch --show-current)" = main
test "$(git rev-parse HEAD)" = "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
test "$(git rev-parse main)" = "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
test "$(git rev-parse --verify origin/main)" = \
  "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
test -z "$(git status --porcelain=v1)"
git diff --quiet
git diff --cached --quiet
git merge-base --is-ancestor \
  130a7fe6bf7c8060a561e8ecb171be35e2724eef \
  "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
git rev-parse HEAD > "$GATE_D_RECOVERY_DIR/repository-head.before.txt"
git status --porcelain=v1 \
  > "$GATE_D_RECOVERY_DIR/repository-status.before.txt"
test ! -s "$GATE_D_RECOVERY_DIR/repository-status.before.txt"

gate_d_require_single_record() {
  local record="${1-}" expected_fields="$2" delimiters
  test -n "$record" || return 1
  case "$record" in *$'\n'*|*$'\r'*) return 1 ;; esac
  delimiters="${record//[^|]/}"
  test "$(( ${#delimiters} + 1 ))" -eq "$expected_fields"
}

gate_d_require_full_id() {
  [[ "${1-}" =~ ^[0-9a-f]{64}$ ]]
}

gate_d_require_image_id() {
  [[ "${1-}" =~ ^sha256:[0-9a-f]{64}$ ]]
}

gate_d_require_image_ref() {
  [[ "${1-}" =~ ^[A-Za-z0-9][A-Za-z0-9._/@:+-]*$ ]]
}

gate_d_require_started_at() {
  [[ "${1-}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$ ]]
}

gate_d_require_safe_token() {
  [[ "${1-}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]
}

gate_d_validate_recovery_directory() {
  test ! -L "$GATE_D_RECOVERY_DIR" || return 1
  test -d "$GATE_D_RECOVERY_DIR" || return 1
  test "$(realpath -- "$GATE_D_RECOVERY_DIR")" = "$GATE_D_RECOVERY_DIR" || \
    return 1
  test "$(stat -c %u -- "$GATE_D_RECOVERY_DIR")" = "$(id -u)" || return 1
  test "$(stat -c %a -- "$GATE_D_RECOVERY_DIR")" = 700
}

gate_d_require_private_file() {
  local path="$1"
  test ! -L "$path" || return 1
  test -f "$path" || return 1
  test "$(stat -c %u -- "$path")" = "$(id -u)" || return 1
  test "$(stat -c %a -- "$path")" = 600
}

verify_gate_d_persistence_phase() {
  local phase="$1" output_name checksum_name output checksum
  case "$phase" in
    before|reentry|after|failure-pre-rollback|post-rollback) ;;
    *) return 47 ;;
  esac
  output_name="runtime-persistence.${phase}.txt"
  checksum_name="runtime-persistence.${phase}.sha256"
  output="$GATE_D_RECOVERY_DIR/$output_name"
  checksum="$GATE_D_RECOVERY_DIR/$checksum_name"
  gate_d_validate_recovery_directory || return 48
  gate_d_require_private_file "$output" || return 49
  gate_d_require_private_file "$checksum" || return 50
  test -s "$output" || return 51
  test -s "$checksum" || return 52
  test "$(wc -l < "$output")" -eq 12 || return 53
  (cd -- "$GATE_D_RECOVERY_DIR" && \
    sha256sum --check --strict -- "$checksum_name")
}

verify_gate_d_persistence_before() {
  verify_gate_d_persistence_phase before || return 54
  test -f "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.sha256" || return 55
  test ! -L "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.sha256" || return 56
  test -s "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.sha256" || return 57
  test -f "$GATE_D_RECOVERY_DIR/pre-mutation-manifest.anchor.sha256" || return 58
  test ! -L "$GATE_D_RECOVERY_DIR/pre-mutation-manifest.anchor.sha256" || return 59
  test -s "$GATE_D_RECOVERY_DIR/pre-mutation-manifest.anchor.sha256" || return 60
  (
    set -euo pipefail
    cd -- "$GATE_D_RECOVERY_DIR"
    sha256sum --check --strict pre-mutation-manifest.anchor.sha256
    sudo sha256sum --check --strict pre-mutation-artifacts.sha256
  )
}

compare_gate_d_persistence_with_before() {
  local phase="$1" before phase_output
  case "$phase" in
    reentry|after|failure-pre-rollback|post-rollback) ;;
    *) return 61 ;;
  esac
  verify_gate_d_persistence_before || return 62
  verify_gate_d_persistence_phase "$phase" || return 63
  before="$GATE_D_RECOVERY_DIR/runtime-persistence.before.txt"
  phase_output="$GATE_D_RECOVERY_DIR/runtime-persistence.${phase}.txt"
  cmp --silent -- "$before" "$phase_output"
}

capture_gate_d_persistence_identity() {
  local phase="$1"
  local output_name checksum_name output checksum artifact_path partial
  local checksum_partial digest
  local capture_status=0 errexit_was_set=0
  case "$phase" in
    before|reentry|after|failure-pre-rollback|post-rollback) ;;
    *) return 40 ;;
  esac
  output_name="runtime-persistence.${phase}.txt"
  checksum_name="runtime-persistence.${phase}.sha256"
  output="$GATE_D_RECOVERY_DIR/$output_name"
  checksum="$GATE_D_RECOVERY_DIR/$checksum_name"
  gate_d_validate_recovery_directory || return 41
  for artifact_path in "$output" "$checksum"; do
    if test -e "$artifact_path" || test -L "$artifact_path"; then
      return 42
    fi
  done

  umask 077
  partial="$(mktemp --tmpdir="$GATE_D_RECOVERY_DIR" \
    ".runtime-persistence.${phase}.txt.XXXXXXXXXX")" || return 43
  checksum_partial="$(mktemp --tmpdir="$GATE_D_RECOVERY_DIR" \
    ".runtime-persistence.${phase}.sha256.XXXXXXXXXX")" || {
      rm -f -- "$partial"
      return 44
    }
  if ! gate_d_require_private_file "$partial" || \
     ! gate_d_require_private_file "$checksum_partial"; then
    rm -f -- "$partial" "$checksum_partial"
    return 45
  fi

  case "$-" in
    *e*) errexit_was_set=1 ;;
  esac
  set +e
  (
    set -euo pipefail
    umask 077
    local app_identity postgres_identity
    local app_name app_id app_image_id app_image_ref app_state app_started
    local app_restarts app_project app_service
    local postgres_name postgres_id postgres_image_id postgres_image_ref
    local postgres_state postgres_started postgres_restarts postgres_project
    local postgres_service
    local postgres_mount mount_count mount_type mount_name mount_destination
    local mount_rw app_network postgres_network app_network_count
    local postgres_network_count app_network_id postgres_network_id
    local app_endpoint_id postgres_endpoint_id network_identity network_name
    local network_id network_driver network_scope network_attachment_count
    local actual_attachments expected_attachments volume_identity volume_name
    local volume_driver volume_scope app_mount_count project_inventory
    local attachment_inventory app_config_port app_config_port_count
    local app_config_binding_count app_config_host_ip app_config_host_port
    local app_runtime_port app_runtime_port_count app_runtime_binding_count
    local app_runtime_host_ip app_runtime_host_port postgres_config_port_count
    local postgres_runtime_port
    local project_record enum_id enum_name enum_project enum_service
    local enum_app_id='' enum_postgres_id='' app_matches=0 postgres_matches=0
    local attachment_record attachment_id attachment_name attachment_endpoint
    local -a project_records=() attachment_records=()

    if test "$phase" != before; then
      verify_gate_d_persistence_before
    fi

    app_identity="$(docker inspect --type container nam-app --format \
      '{{.Name}}|{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.State.Status}}|{{.State.StartedAt}}|{{.RestartCount}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}')"
    gate_d_require_single_record "$app_identity" 9
    IFS='|' read -r app_name app_id app_image_id app_image_ref app_state \
      app_started app_restarts app_project app_service <<< "$app_identity"
    test "$app_name" = /nam-app
    gate_d_require_full_id "$app_id"
    gate_d_require_image_id "$app_image_id"
    gate_d_require_image_ref "$app_image_ref"
    test "$app_state" = running
    gate_d_require_started_at "$app_started"
    case "$app_restarts" in ''|*[!0-9]*) exit 42 ;; esac
    test "$app_project|$app_service" = 'nam|app'

    postgres_identity="$(docker inspect --type container nam-postgres --format \
      '{{.Name}}|{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.State.Status}}|{{.State.StartedAt}}|{{.RestartCount}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}')"
    gate_d_require_single_record "$postgres_identity" 9
    IFS='|' read -r postgres_name postgres_id postgres_image_id \
      postgres_image_ref postgres_state postgres_started postgres_restarts \
      postgres_project postgres_service <<< "$postgres_identity"
    test "$postgres_name" = /nam-postgres
    gate_d_require_full_id "$postgres_id"
    gate_d_require_image_id "$postgres_image_id"
    gate_d_require_image_ref "$postgres_image_ref"
    test "$postgres_state" = running
    gate_d_require_started_at "$postgres_started"
    case "$postgres_restarts" in ''|*[!0-9]*) exit 43 ;; esac
    test "$postgres_project|$postgres_service" = 'nam|postgres'
    test "$app_id" != "$postgres_id"

    project_inventory="$(docker ps --all --no-trunc \
      --filter label=com.docker.compose.project=nam \
      --format '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}' | \
      LC_ALL=C sort)"
    test -n "$project_inventory"
    case "$project_inventory" in *$'\r'*) exit 44 ;; esac
    mapfile -t project_records <<< "$project_inventory"
    test "${#project_records[@]}" -eq 2
    for project_record in "${project_records[@]}"; do
      gate_d_require_single_record "$project_record" 4
      IFS='|' read -r enum_id enum_name enum_project enum_service \
        <<< "$project_record"
      gate_d_require_full_id "$enum_id"
      test "$enum_project" = nam
      case "$enum_service|$enum_name" in
        app\|nam-app)
          app_matches=$((app_matches + 1))
          enum_app_id="$enum_id"
          ;;
        postgres\|nam-postgres)
          postgres_matches=$((postgres_matches + 1))
          enum_postgres_id="$enum_id"
          ;;
        *) exit 45 ;;
      esac
    done
    test "$app_matches" -eq 1
    test "$postgres_matches" -eq 1
    test "$enum_app_id" = "$app_id"
    test "$enum_postgres_id" = "$postgres_id"

    app_mount_count="$(docker inspect --type container nam-app --format \
      '{{len .Mounts}}')"
    gate_d_require_single_record "$app_mount_count" 1
    test "$app_mount_count" = 0
    postgres_mount="$(docker inspect --type container nam-postgres --format \
      '{{len .Mounts}}|{{with index .Mounts 0}}{{.Type}}|{{.Name}}|{{.Destination}}|{{.RW}}{{end}}')"
    gate_d_require_single_record "$postgres_mount" 5
    IFS='|' read -r mount_count mount_type mount_name mount_destination \
      mount_rw <<< "$postgres_mount"
    test "$mount_count|$mount_type|$mount_name|$mount_destination|$mount_rw" = \
      '1|volume|postgres-data|/var/lib/postgresql|true'

    app_network="$(docker inspect --type container nam-app --format \
      '{{len .NetworkSettings.Networks}}|{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}|{{.EndpointID}}{{end}}')"
    gate_d_require_single_record "$app_network" 3
    IFS='|' read -r app_network_count app_network_id app_endpoint_id \
      <<< "$app_network"
    test "$app_network_count" = 1
    gate_d_require_full_id "$app_network_id"
    gate_d_require_full_id "$app_endpoint_id"
    postgres_network="$(docker inspect --type container nam-postgres --format \
      '{{len .NetworkSettings.Networks}}|{{with index .NetworkSettings.Networks "nam-network"}}{{.NetworkID}}|{{.EndpointID}}{{end}}')"
    gate_d_require_single_record "$postgres_network" 3
    IFS='|' read -r postgres_network_count postgres_network_id \
      postgres_endpoint_id <<< "$postgres_network"
    test "$postgres_network_count" = 1
    gate_d_require_full_id "$postgres_network_id"
    gate_d_require_full_id "$postgres_endpoint_id"
    test "$app_network_id" = "$postgres_network_id"
    test "$app_endpoint_id" != "$postgres_endpoint_id"

    network_identity="$(docker network inspect nam-network --format \
      '{{.Name}}|{{.Id}}|{{.Driver}}|{{.Scope}}|{{len .Containers}}')"
    gate_d_require_single_record "$network_identity" 5
    IFS='|' read -r network_name network_id network_driver network_scope \
      network_attachment_count <<< "$network_identity"
    test "$network_name" = nam-network
    gate_d_require_full_id "$network_id"
    test "$network_driver" = bridge
    gate_d_require_safe_token "$network_scope"
    test "$network_attachment_count" = 2
    test "$network_id" = "$app_network_id"
    attachment_inventory="$(docker network inspect nam-network --format \
      '{{range $id, $attachment := .Containers}}{{printf "%s|%s|%s\n" $id $attachment.Name $attachment.EndpointID}}{{end}}')"
    test -n "$attachment_inventory"
    case "$attachment_inventory" in *$'\r'*) exit 46 ;; esac
    mapfile -t attachment_records <<< "$attachment_inventory"
    test "${#attachment_records[@]}" -eq 2
    for attachment_record in "${attachment_records[@]}"; do
      gate_d_require_single_record "$attachment_record" 3
      IFS='|' read -r attachment_id attachment_name attachment_endpoint \
        <<< "$attachment_record"
      gate_d_require_full_id "$attachment_id"
      gate_d_require_full_id "$attachment_endpoint"
      case "$attachment_name" in nam-app|nam-postgres) ;; *) exit 47 ;; esac
    done
    actual_attachments="$(printf '%s\n' "${attachment_records[@]}" | \
      LC_ALL=C sort)"
    expected_attachments="$(printf '%s|nam-app|%s\n%s|nam-postgres|%s\n' \
      "$app_id" "$app_endpoint_id" "$postgres_id" "$postgres_endpoint_id" | \
      LC_ALL=C sort)"
    test "$actual_attachments" = "$expected_attachments"

    volume_identity="$(docker volume inspect postgres-data --format \
      '{{.Name}}|{{.Driver}}|{{.Scope}}')"
    gate_d_require_single_record "$volume_identity" 3
    IFS='|' read -r volume_name volume_driver volume_scope <<< "$volume_identity"
    test "$volume_name" = postgres-data
    gate_d_require_safe_token "$volume_driver"
    gate_d_require_safe_token "$volume_scope"

    app_config_port="$(docker inspect --type container nam-app --format \
      '{{len .HostConfig.PortBindings}}|{{with index .HostConfig.PortBindings "3000/tcp"}}{{len .}}|{{(index . 0).HostIp}}|{{(index . 0).HostPort}}{{end}}')"
    gate_d_require_single_record "$app_config_port" 4
    IFS='|' read -r app_config_port_count app_config_binding_count \
      app_config_host_ip app_config_host_port <<< "$app_config_port"
    test "$app_config_port_count|$app_config_binding_count|$app_config_host_ip|$app_config_host_port" = \
      '1|1|127.0.0.1|3000'
    app_runtime_port="$(docker inspect --type container nam-app --format \
      '{{len .NetworkSettings.Ports}}|{{with index .NetworkSettings.Ports "3000/tcp"}}{{len .}}|{{(index . 0).HostIp}}|{{(index . 0).HostPort}}{{end}}')"
    gate_d_require_single_record "$app_runtime_port" 4
    IFS='|' read -r app_runtime_port_count app_runtime_binding_count \
      app_runtime_host_ip app_runtime_host_port <<< "$app_runtime_port"
    test "$app_runtime_port_count|$app_runtime_binding_count|$app_runtime_host_ip|$app_runtime_host_port" = \
      '1|1|127.0.0.1|3000'
    test "$app_runtime_port" = "$app_config_port"
    postgres_config_port_count="$(docker inspect --type container nam-postgres \
      --format '{{len .HostConfig.PortBindings}}')"
    gate_d_require_single_record "$postgres_config_port_count" 1
    test "$postgres_config_port_count" = 0
    postgres_runtime_port="$(docker inspect --type container nam-postgres \
      --format '{{json .NetworkSettings.Ports}}')"
    case "$postgres_runtime_port" in
      null|'{}'|'{"5432/tcp":null}') ;;
      *) exit 48 ;;
    esac

    {
      printf 'container|name=%s|id=%s|image_id=%s|image_ref=%s|state=%s|started=%s|restarts=%s|compose_project=%s|compose_service=%s\n' \
        "$app_name" "$app_id" "$app_image_id" "$app_image_ref" "$app_state" \
        "$app_started" "$app_restarts" "$app_project" "$app_service"
      printf 'container|name=%s|id=%s|image_id=%s|image_ref=%s|state=%s|started=%s|restarts=%s|compose_project=%s|compose_service=%s\n' \
        "$postgres_name" "$postgres_id" "$postgres_image_id" \
        "$postgres_image_ref" "$postgres_state" "$postgres_started" \
        "$postgres_restarts" "$postgres_project" "$postgres_service"
      printf 'mount|container=%s|none=true\n' "$app_name"
      printf 'mount|container=%s|type=%s|name=%s|destination=%s|rw=%s\n' \
        "$postgres_name" "$mount_type" "$mount_name" "$mount_destination" \
        "$mount_rw"
      printf 'network|name=%s|id=%s|driver=%s|scope=%s\n' \
        "$network_name" "$network_id" "$network_driver" "$network_scope"
      printf 'network_attachment|network=%s|network_id=%s|container=%s|container_id=%s|endpoint_id=%s\n' \
        "$network_name" "$network_id" "$app_name" "$app_id" "$app_endpoint_id"
      printf 'network_attachment|network=%s|network_id=%s|container=%s|container_id=%s|endpoint_id=%s\n' \
        "$network_name" "$network_id" "$postgres_name" "$postgres_id" \
        "$postgres_endpoint_id"
      printf 'volume|name=%s|driver=%s|scope=%s\n' \
        "$volume_name" "$volume_driver" "$volume_scope"
      printf 'port|source=configured|container=%s|container_port=3000/tcp|host_ip=%s|host_port=%s\n' \
        "$app_name" "$app_config_host_ip" "$app_config_host_port"
      printf 'port|source=runtime|container=%s|container_port=3000/tcp|host_ip=%s|host_port=%s\n' \
        "$app_name" "$app_runtime_host_ip" "$app_runtime_host_port"
      printf 'port|source=configured|container=%s|none=true\n' "$postgres_name"
      printf 'port|source=runtime|container=%s|none=true\n' "$postgres_name"
    } > "$partial"
    test "$(wc -l < "$partial")" -eq 12
    digest="$(sha256sum -- "$partial" | awk '{print $1}')"
    [[ "$digest" =~ ^[0-9a-f]{64}$ ]]
    printf '%s  %s\n' "$digest" "$output_name" > "$checksum_partial"
  )
  capture_status=$?
  if test "$errexit_was_set" -eq 1; then
    set -e
  else
    set +e
  fi
  if test "$capture_status" -ne 0; then
    rm -f -- "$partial" "$checksum_partial"
    return "$capture_status"
  fi

  if ! ln -- "$partial" "$output"; then
    rm -f -- "$partial" "$checksum_partial"
    return 46
  fi
  if ! ln -- "$checksum_partial" "$checksum"; then
    rm -f -- "$output" "$partial" "$checksum_partial"
    return 47
  fi
  rm -- "$partial" "$checksum_partial"
  verify_gate_d_persistence_phase "$phase"
}

capture_gate_d_persistence_identity before
verify_gate_d_persistence_phase before
```

This capture validates all expected topology before writing evidence records.
It uses a no-truncation, all-container inventory so stopped, stale, and one-off
Compose containers cannot disappear from the guard. It enumerates only
allowlisted identity fields for every container in Compose project `nam`,
requires exactly `nam/app/nam-app` and
`nam/postgres/nam-postgres`, and then targets only those two containers,
`postgres-data`, and `nam-network`. Configured and observed runtime port maps are
validated separately and reconciled before fixed-order sanitized records are
written. The capture never records raw mount sources, volume mountpoints, volume
options, unrestricted labels, container environments, secrets, credentials,
tokens, raw JSON, or unrestricted inspect output.
Repository evidence establishes that no upload/media store is implemented; the
zero application-mount guard establishes only the observed Docker mount
topology. The repository explicitly establishes the `bridge` network driver.
Because Compose does not explicitly declare a volume driver, the nonempty live
volume driver is captured as an anchored identity that must compare unchanged,
not as a repository-validated driver value.

Run the functions only in the persistent Bash shell initialized above with
`set -euo pipefail`. Fixed record order and `LC_ALL=C` project-enumeration and
attachment checks make serialization deterministic. `mktemp` atomically creates
unpredictable mode-`0600` regular temporary files in the verified recovery
directory; topology guards must all succeed before evidence is written.
Evidence and checksum are then hard-linked to unique final names without
overwrite. A failed second publication removes the first link. No phase is
valid unless both final paths are owner-controlled mode-`0600` regular
non-symlink files, the evidence has the fixed 12-record schema, and its checksum
verifies.

### Caddy Recovery Material

```bash
sudo -v
command -v getfacl
command -v getfattr
sudo cp --archive -- /etc/caddy/Caddyfile \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before"
sudo stat -c '%u %g %a' /etc/caddy/Caddyfile \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.before.stat"
sudo getfacl --absolute-names --numeric --omit-header /etc/caddy/Caddyfile \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl"
sudo getfacl --absolute-names --numeric --omit-header \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before" \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.backup.acl"
sudo getfattr --absolute-names --dump -m- /etc/caddy/Caddyfile 2>/dev/null | \
  sed '/^# file:/d;/^[[:space:]]*$/d' \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs"
sudo getfattr --absolute-names --dump -m- \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before" 2>/dev/null | \
  sed '/^# file:/d;/^[[:space:]]*$/d' \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.backup.xattrs"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.acl"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.xattrs"
sudo sha256sum /etc/caddy/Caddyfile | awk '{print $1}' \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.live.sha256"
sudo sha256sum "$GATE_D_RECOVERY_DIR/Caddyfile.before" | awk '{print $1}' \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.backup.sha256"
sudo cmp --silent /etc/caddy/Caddyfile \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.live.sha256" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.sha256"
printf 'nam_sites=%s\nnam_backends=%s\n' \
  "$(sudo grep -Ec '^dev\.alemany\.me[[:space:]]*\{' /etc/caddy/Caddyfile)" \
  "$(sudo grep -Ec 'reverse_proxy[[:space:]]+127\.0\.0\.1:3000' /etc/caddy/Caddyfile)" \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.before.summary.txt"
sudo systemctl cat caddy > "$GATE_D_RECOVERY_DIR/caddy-systemd.before.txt"
sudo systemctl show caddy \
  --property=FragmentPath --property=DropInPaths --property=ExecStart \
  --property=ExecReload --property=User --property=Group \
  > "$GATE_D_RECOVERY_DIR/caddy-service.before.txt"
```

Fresh inspection must prove there is exactly one
`dev.alemany.me`/`127.0.0.1:3000` site and no unrelated, wildcard, catch-all, or
alternate NAM route. It must also establish the installed Caddy binary, config
path, adapter, active-config inspection method, and exact graceful `ExecReload`
form from the unit and any drop-ins. If any value is ambiguous, stop and revise
the procedure for the observed service before mutation.

Review the ACL and extended-attribute captures privately. If the live Caddyfile
has a nonstandard ACL or any extended attribute, stop rather than allowing the
candidate install to discard metadata. The verified recovery copy must preserve
all source metadata; repository evidence records only the sanitized result.

### Firewall Recovery Material

```bash
sudo ufw status verbose > "$GATE_D_RECOVERY_DIR/ufw.before.txt"
sudo ufw status numbered > "$GATE_D_RECOVERY_DIR/ufw.before.numbered.txt"
sudo nft list ruleset > "$GATE_D_RECOVERY_DIR/nft-full.before.txt"
sudo iptables-save > "$GATE_D_RECOVERY_DIR/iptables-v4-full.before.txt"
sudo ip6tables-save > "$GATE_D_RECOVERY_DIR/iptables-v6-full.before.txt"
sudo nft list ruleset | \
  grep -E 'hook input|policy (accept|drop)|DOCKER|dport (22|80|443|3000|5432)' \
  > "$GATE_D_RECOVERY_DIR/nft-relevant.before.txt"
sudo iptables -S DOCKER-USER \
  > "$GATE_D_RECOVERY_DIR/docker-user-v4.before.txt"
sudo ip6tables -S DOCKER-USER \
  > "$GATE_D_RECOVERY_DIR/docker-user-v6.before.txt"
sudo cp --archive -- /etc/default/ufw "$GATE_D_RECOVERY_DIR/ufw.default.before"
sudo cp --archive -- /etc/ufw/user.rules "$GATE_D_RECOVERY_DIR/ufw.user.before"
sudo cp --archive -- /etc/ufw/user6.rules "$GATE_D_RECOVERY_DIR/ufw.user6.before"
sudo sha256sum /etc/default/ufw /etc/ufw/user.rules /etc/ufw/user6.rules \
  > "$GATE_D_RECOVERY_DIR/ufw.before.sha256"
```

The rule files are emergency recovery material, not review evidence. Do not
commit or print them. The complete nftables and IPv4/IPv6 iptables captures are
restricted raw evidence outside Git and must be reviewed privately to establish
the effective packet path and absence of a bypass; the filtered output alone is
not sufficient. Sanitized review evidence identifies only the exact UFW rules
being removed and the relevant IPv4, IPv6, input, forwarding, and Docker-chain
conclusions. The normal rollback adds back only the two rules Gate D removed;
it must not overwrite unrelated firewall changes.

### Access, Listener, And DNS State

```bash
sudo systemctl cat ssh > "$GATE_D_RECOVERY_DIR/ssh-systemd.before.txt"
sudo systemctl show ssh \
  --property=FragmentPath --property=DropInPaths --property=ExecStart \
  > "$GATE_D_RECOVERY_DIR/ssh-service.before.txt"

capture_recovery_sshd_policy() {
  output_path="$1"
  test -n "${SSH_CONNECTION-}"
  read -r -a SSH_CONNECTION_FIELDS <<< "$SSH_CONNECTION"
  test "${#SSH_CONNECTION_FIELDS[@]}" -eq 4
  SSH_CLIENT_ADDR="${SSH_CONNECTION_FIELDS[0]}"
  SSH_CLIENT_PORT="${SSH_CONNECTION_FIELDS[1]}"
  SSH_LOCAL_ADDR="${SSH_CONNECTION_FIELDS[2]}"
  SSH_LOCAL_PORT="${SSH_CONNECTION_FIELDS[3]}"
  test -n "$SSH_CLIENT_ADDR"
  test -n "$SSH_CLIENT_PORT"
  test -n "$SSH_LOCAL_ADDR"
  test -n "$SSH_LOCAL_PORT"
  case "$SSH_CLIENT_PORT" in *[!0-9]*|'') return 25 ;; esac
  case "$SSH_LOCAL_PORT" in *[!0-9]*|'') return 26 ;; esac
  test "$SSH_LOCAL_PORT" -eq 22
  test "$(id -un)" = alain
  test "$SSH_CLIENT_ADDR" = "<EXPECTED_RECOVERY_CLIENT_PUBLIC_ADDRESS>"
  case "$SSH_LOCAL_ADDR" in
    "<NAM_VPS_PUBLIC_IPV4>"|"<NAM_VPS_PUBLIC_IPV6>") ;;
    *) return 23 ;;
  esac

  mapfile -t SSH_RESOLVED_HOSTS < <(
    getent hosts "$SSH_CLIENT_ADDR" | awk '{print $2}' | sort -u
  )
  case "${#SSH_RESOLVED_HOSTS[@]}" in
    0) SSH_RESOLVED_CLIENT_HOST="$SSH_CLIENT_ADDR" ;;
    1) SSH_RESOLVED_CLIENT_HOST="${SSH_RESOLVED_HOSTS[0]}" ;;
    *) return 24 ;;
  esac

  sudo /usr/sbin/sshd -T -C \
    "user=alain,addr=${SSH_CLIENT_ADDR},host=${SSH_RESOLVED_CLIENT_HOST},laddr=${SSH_LOCAL_ADDR},lport=${SSH_LOCAL_PORT}" | \
    awk '$1 ~ /^(authenticationmethods|kbdinteractiveauthentication|passwordauthentication|permitrootlogin|pubkeyauthentication)$/ {print}' | \
    sort > "$output_path"
  test "$(wc -l < "$output_path")" -eq 5
  grep -Fx 'authenticationmethods publickey' "$output_path" >/dev/null
  grep -Fx 'kbdinteractiveauthentication no' "$output_path" >/dev/null
  grep -Fx 'passwordauthentication no' "$output_path" >/dev/null
  grep -Fx 'permitrootlogin no' "$output_path" >/dev/null
  grep -Fx 'pubkeyauthentication yes' "$output_path" >/dev/null
}

capture_recovery_sshd_policy \
  "$GATE_D_RECOVERY_DIR/sshd-effective.before.txt"
sudo ss -H -ltnup \
  '( sport = :22 or sport = :80 or sport = :443 or sport = :3000 or sport = :5432 )' \
  > "$GATE_D_RECOVERY_DIR/listeners-relevant.before.txt"
tailscale status --json > "$GATE_D_RECOVERY_DIR/tailscale-status.before.json"
test -s "$GATE_D_RECOVERY_DIR/tailscale-status.before.json"
jq -e '
  type == "object" and
  (.BackendState | type == "string") and
  (.Self | type == "object") and
  (.Self.DNSName | type == "string") and
  (.Self.Tags | type == "array") and
  .BackendState == "Running" and
  ((.Self.DNSName | rtrimstr(".")) == "ops-console.tailf57e61.ts.net") and
  (.Self.Tags | index("tag:nam-pilot") != null)
' "$GATE_D_RECOVERY_DIR/tailscale-status.before.json" >/dev/null

tailscale serve status > "$GATE_D_RECOVERY_DIR/tailscale-serve.before.txt"
test -s "$GATE_D_RECOVERY_DIR/tailscale-serve.before.txt"
tailscale serve status --json \
  > "$GATE_D_RECOVERY_DIR/tailscale-serve.before.json"
test -s "$GATE_D_RECOVERY_DIR/tailscale-serve.before.json"
jq -e 'type == "object"' \
  "$GATE_D_RECOVERY_DIR/tailscale-serve.before.json" >/dev/null
TAILSCALE_SERVE_JQ_FILTER='<VERIFIED_EXECUTION_TIME_SERVE_SCHEMA_AND_SEMANTICS_FILTER>'
test "$TAILSCALE_SERVE_JQ_FILTER" != \
  '<VERIFIED_EXECUTION_TIME_SERVE_SCHEMA_AND_SEMANTICS_FILTER>'
printf '%s\n' "$TAILSCALE_SERVE_JQ_FILTER" \
  > "$GATE_D_RECOVERY_DIR/tailscale-serve-semantics.jq"
test -s "$GATE_D_RECOVERY_DIR/tailscale-serve-semantics.jq"
jq -e -f "$GATE_D_RECOVERY_DIR/tailscale-serve-semantics.jq" \
  "$GATE_D_RECOVERY_DIR/tailscale-serve.before.json" >/dev/null

capture_dns_query() {
  dns_test_id="$1"
  dns_server="$2"
  dns_name="$3"
  dns_type="$4"
  dns_kind="$5"
  dns_evidence_path="$6"
  dns_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  set +e
  dns_result="$(dig @"$dns_server" "$dns_name" "$dns_type" \
    +time=5 +tries=1 +comments +answer +authority +stats 2>&1)"
  dns_exit=$?
  set -e
  {
    printf 'test=%s timestamp=%s exit=%s name=%s type=%s\n' \
      "$dns_test_id" "$dns_timestamp" "$dns_exit" "$dns_name" "$dns_type"
    printf '%s\n' "$dns_result"
    printf '%s\n' '---'
  } >> "$dns_evidence_path"
  test "$dns_exit" -eq 0
  test -n "$dns_result"
  grep -Eq '^;; ->>HEADER<<-.* status: (NOERROR|NXDOMAIN),' \
    <<< "$dns_result"
  if test "$dns_kind" = control; then
    grep -Eq '^alemany\.me\.[[:space:]]+[0-9]+[[:space:]]+IN[[:space:]]+SOA[[:space:]]' \
      <<< "$dns_result"
    grep -Eq '^;; ->>HEADER<<-.* status: NOERROR,' <<< "$dns_result"
  fi
}

: > "$GATE_D_RECOVERY_DIR/dns-authoritative.before.txt"
for server in dns1.registrar-servers.com dns2.registrar-servers.com; do
  capture_dns_query "control-${server}" "$server" alemany.me SOA control \
    "$GATE_D_RECOVERY_DIR/dns-authoritative.before.txt"
  for host in dev.alemany.me nam.alemany.me; do
    for type in A AAAA CNAME; do
      capture_dns_query "${server}-${host}-${type}" \
        "$server" "$host" "$type" relevant \
        "$GATE_D_RECOVERY_DIR/dns-authoritative.before.txt"
    done
  done
done
```

Run the policy function inside the actual open public recovery-key SSH session.
It uses that connection's source address, resolved source host, server address,
local port, and `alain` user context without printing them. An absent or
malformed `SSH_CONNECTION`, an unexpected public endpoint, ambiguous source
host, `/usr/sbin/sshd -T -C` failure, or any policy mismatch is a mandatory stop.
Privately substitute the expected client and VPS address placeholders before
use; never print them or accept the literal placeholders. Use the same function
and connection-context checks after Gate D.

Before invoking `/usr/sbin/sshd -T -C`, review the captured installed SSH unit,
drop-ins, and `ExecStart`. It must prove that the installed service uses
`/usr/sbin/sshd` and the default configuration source evaluated by that command.
If the service uses `-f`, another binary, or another configuration source, stop
and revise the command profile for the observed invocation; do not evaluate the
wrong configuration.

Before assigning `TAILSCALE_SERVE_JQ_FILTER`, inspect the installed
`tailscale serve status --help`, non-JSON output, and JSON schema. Record a
reviewed `jq -e` filter that fails unless it proves all four semantics exactly:

- private hostname `ops-console.tailf57e61.ts.net`;
- `/` proxies to `http://127.0.0.1:3000`;
- access is tailnet-only; and
- Funnel or other public sharing is disabled.

The generic object check is only schema-entry validation; it is not acceptance.
If the installed version exposes these facts through different fields or
commands, stop and revise this profile from inspected local help/output without
changing Tailscale.

Record the exact pre-cutover VPS `A` values privately for DNS rollback. Do not
store credentials, private-key material, tokens, connection strings, container
environments, complete firewall dumps, or unrelated host configuration in the
reviewable evidence report.

Each authoritative resolver must pass its positive `alemany.me SOA` control
before its relevant answers are considered. The restricted output preserves
timestamp, numeric tool exit, DNS header status, answer, authority, and query
statistics so the reviewer can distinguish authoritative `NODATA` or
`NXDOMAIN`, a valid non-VPS answer, timeout, refusal, unreachable resolver,
malformed response, and local tool failure. A nonzero exit, empty output,
missing classifiable header, `REFUSED`, `SERVFAIL`, timeout, or failed control is
a stop—not evidence of record removal.

### Recovery-Copy Verification

```bash
sudo cmp --silent /etc/caddy/Caddyfile \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.live.sha256" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.sha256"
test -s "$GATE_D_RECOVERY_DIR/ufw.before.numbered.txt"
test -s "$GATE_D_RECOVERY_DIR/nft-full.before.txt"
test -s "$GATE_D_RECOVERY_DIR/iptables-v4-full.before.txt"
test -s "$GATE_D_RECOVERY_DIR/iptables-v6-full.before.txt"
test -s "$GATE_D_RECOVERY_DIR/dns-authoritative.before.txt"
test -s "$GATE_D_RECOVERY_DIR/caddy-systemd.before.txt"
test -s "$GATE_D_RECOVERY_DIR/caddy-service.before.txt"

PRE_MUTATION_ARTIFACTS=(
  run-id absolute-path
  repository-head.before.txt repository-status.before.txt
  runtime-persistence.before.txt runtime-persistence.before.sha256
  Caddyfile.before Caddyfile.before.stat
  Caddyfile.before.acl Caddyfile.backup.acl
  Caddyfile.before.xattrs Caddyfile.backup.xattrs
  Caddyfile.live.sha256 Caddyfile.backup.sha256
  Caddyfile.before.summary.txt
  caddy-systemd.before.txt caddy-service.before.txt
  ufw.before.txt ufw.before.numbered.txt
  nft-full.before.txt iptables-v4-full.before.txt
  iptables-v6-full.before.txt nft-relevant.before.txt
  docker-user-v4.before.txt docker-user-v6.before.txt
  ufw.default.before ufw.user.before ufw.user6.before ufw.before.sha256
  ssh-systemd.before.txt ssh-service.before.txt sshd-effective.before.txt
  listeners-relevant.before.txt
  tailscale-status.before.json tailscale-serve.before.txt
  tailscale-serve.before.json tailscale-serve-semantics.jq
  dns-authoritative.before.txt
)
for artifact in "${PRE_MUTATION_ARTIFACTS[@]}"; do
  test -f "$GATE_D_RECOVERY_DIR/$artifact"
  test ! -L "$GATE_D_RECOVERY_DIR/$artifact"
  case "$artifact" in
    repository-status.before.txt|Caddyfile.before.xattrs|Caddyfile.backup.xattrs) ;;
    *) test -s "$GATE_D_RECOVERY_DIR/$artifact" ;;
  esac
done
test ! -s "$GATE_D_RECOVERY_DIR/repository-status.before.txt"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.xattrs"
printf '%s\n' "${PRE_MUTATION_ARTIFACTS[@]}" \
  > "$GATE_D_RECOVERY_DIR/pre-mutation-artifacts.list"
(
  cd -- "$GATE_D_RECOVERY_DIR"
  sudo sha256sum -- "${PRE_MUTATION_ARTIFACTS[@]}" \
    > pre-mutation-artifacts.sha256
  : > pre-mutation-artifacts.stat
  for artifact in "${PRE_MUTATION_ARTIFACTS[@]}"; do
    sudo stat -c '%n|%u|%g|%a|%s' -- "$artifact" \
      >> pre-mutation-artifacts.stat
  done
)

set_gate_d_checkpoint() {
  checkpoint="$1"
  case "$checkpoint" in
    PRE_MUTATION_CAPTURE_COMPLETE|CANDIDATE_VALIDATED_RUNTIME_UNCHANGED|\
    CANDIDATE_ACTIVE_PERSISTENT_BEFORE|CANDIDATE_ACTIVE_AND_PERSISTED|\
    WEB_UFW_RULES_REMOVED|VPS_DNS_RECORDS_REMOVED) ;;
    *) return 30 ;;
  esac
  printf '%s\n' "$checkpoint" > "$GATE_D_RECOVERY_DIR/checkpoint-state.next"
  mv -- "$GATE_D_RECOVERY_DIR/checkpoint-state.next" \
    "$GATE_D_RECOVERY_DIR/checkpoint-state"
  (
    cd -- "$GATE_D_RECOVERY_DIR"
    sha256sum checkpoint-state > checkpoint-state.sha256.next
    mv -- checkpoint-state.sha256.next checkpoint-state.sha256
  )
}

set_gate_d_checkpoint PRE_MUTATION_CAPTURE_COMPLETE
(
  cd -- "$GATE_D_RECOVERY_DIR"
  sha256sum run-id absolute-path pre-mutation-artifacts.list \
    pre-mutation-artifacts.sha256 pre-mutation-artifacts.stat \
    > pre-mutation-manifest.anchor.sha256
  sha256sum --check --strict pre-mutation-manifest.anchor.sha256
  sha256sum --check --strict checkpoint-state.sha256
  sudo sha256sum --check --strict pre-mutation-artifacts.sha256
)
```

After mutation, verify the recovery copy against its dedicated backup checksum;
do not interpret the expected live Caddyfile checksum change as backup
corruption.

The manifest is checkpoint-aware. Candidate artifacts created at D1 must be
checksummed and recorded before the checkpoint advances. On re-entry, validate
the stable pre-mutation manifest, the current checkpoint checksum, every
artifact required to reach that checkpoint, and current runtime/persistent
state. `CANDIDATE_ACTIVE_PERSISTENT_BEFORE` deliberately records a sensitive
runtime/disk mismatch: re-entry at that state always stops for explicit review;
it never permits an automatic reload, persistence step, UFW change, or DNS
change. An unrecognized or unverified state is equally prohibitive.

## Independent Preflight

Before the first mutation:

1. From Windows, open the dedicated public recovery-key SSH session and keep it
   open. The dedicated key is passphrase-protected. Its local private-key
   passphrase prompt is expected and acceptable; a VPS account-password prompt
   is forbidden. Do not disable host-key validation or permit password fallback.
2. In a second Windows terminal, run a fresh read-only recovery check using the
   privately stored `<WINDOWS_RECOVERY_KEY_PATH>` and
   `<NAM_VPS_PUBLIC_IPV4>`:

   ```powershell
   ssh -o IdentitiesOnly=yes -o PreferredAuthentications=publickey `
     -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no `
     -o StrictHostKeyChecking=yes -o ConnectTimeout=10 `
     -i "<WINDOWS_RECOVERY_KEY_PATH>" `
     alain@<NAM_VPS_PUBLIC_IPV4> "hostname; id -u; id -nG"
   ```

   Enter only the local key passphrase if prompted. Abort if SSH requests the
   `alain` account password or offers another authentication method. Do not use
   `BatchMode=yes` unless a separately verified `ssh-agent` preparation step
   proves that this exact dedicated key fingerprint—and no substitute default
   identity—is loaded for the test.

3. From Windows, load the reviewed [external test profiles](#external-test-command-profiles)
   and run `Invoke-GateDPrivateChecks "before"`. Require the complete
   classifiable record for root, `/api/health`, and `/day-view`, with HTTP `200`
   and TLS verification result `0`.

4. From the iPad on cellular, with Tailscale connected, load the private root,
   `/api/health`, and `/day-view` without a certificate warning.
5. Pin and hash the exact curl application, then pass the independent IPv4,
   IPv6, and HTTP/3-only positive controls. Positively prove forced NAM TCP
   HTTP/HTTPS over both families. Finally, after the matching HTTP/3 controls
   pass, prove the expected existing NAM UDP `443` denial over both families.
   Any NAM HTTP/3 response, unclassified error, failed control, or missing TCP
   NAM path is a stop before mutation.

## Controlled Execution Sequence

Each checkpoint requires successful private HTTPS and recovery-session checks
before proceeding. Record command exits and sanitized results. Never close the
recovery anchor session during the cutover.

### Checkpoint D1: Prepare A NAM-Free Caddy Candidate

The accepted baseline has one exact site block. Generate a candidate by removing
only that block from the verified backup. The script stops unless it finds
exactly one opening site declaration and reaches its matching closing brace.

```bash
sudo awk '
BEGIN { in_nam=0; depth=0; matches=0 }
/^dev\.alemany\.me[[:space:]]*\{[[:space:]]*$/ {
  if (in_nam) exit 20
  in_nam=1
  depth=1
  matches++
  next
}
in_nam {
  line=$0
  opens=gsub(/\{/, "{", line)
  closes=gsub(/\}/, "}", line)
  depth += opens - closes
  if (depth < 0) exit 21
  if (depth == 0) in_nam=0
  next
}
{ print }
END {
  if (in_nam || depth != 0 || matches != 1) exit 22
}
' "$GATE_D_RECOVERY_DIR/Caddyfile.before" \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d"

test "$(sudo grep -Ec '^dev\.alemany\.me[[:space:]]*\{' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before")" -eq 1
test "$(sudo grep -Ec 'reverse_proxy[[:space:]]+127\.0\.0\.1:3000' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before")" -eq 1
test "$(grep -Ec '^dev\.alemany\.me[[:space:]]*\{' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d")" -eq 0
test "$(grep -Ec 'reverse_proxy[[:space:]]+127\.0\.0\.1:3000' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d")" -eq 0
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d" --adapter caddyfile
(
  cd -- "$GATE_D_RECOVERY_DIR"
  sudo sha256sum Caddyfile.gate-d > caddy-candidate.sha256
  sudo stat -c '%n|%u|%g|%a|%s' Caddyfile.gate-d \
    > caddy-candidate.stat
)
set_gate_d_checkpoint CANDIDATE_VALIDATED_RUNTIME_UNCHANGED
```

If validation fails or the resulting configuration would remove an unrelated
site, stop without changing the live Caddyfile.

### Checkpoint D2: Install And Reload The Caddy Candidate

Do not guess Caddy's reload or active-config command. From the captured systemd
unit and `systemctl show` output, the operator and reviewer must first record:

- `<VERIFIED_ABSOLUTE_CADDY_BINARY>`;
- `<VERIFIED_CADDY_RELOAD_COMMAND_USING_GATE_D_CANDIDATE>`;
- `<VERIFIED_CADDY_EXECRELOAD_COMMAND_USING_PERSISTENT_CONFIG>`; and
- `<VERIFIED_CADDY_ACTIVE_CONFIG_EXPORT_COMMAND>` plus a reviewed normalization
  method that can compare the active runtime with the adapted candidate without
  exposing unrelated configuration.

The first reload command must be the installed graceful Caddy reload form with
the recovery-directory candidate explicitly supplied as a Caddyfile. The
persistent command must match the installed service's actual `ExecReload` and
config path. If these cannot be established exactly at execution time, stop.
Never substitute a restart or stop/start.

First adapt and validate the candidate explicitly as a Caddyfile while the
persistent Caddyfile remains unchanged:

```bash
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" adapt \
  --config "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d" --adapter caddyfile \
  --pretty > "$GATE_D_RECOVERY_DIR/caddy-candidate.adapted.json"
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d" --adapter caddyfile
(
  cd -- "$GATE_D_RECOVERY_DIR"
  sudo sha256sum Caddyfile.gate-d caddy-candidate.adapted.json \
    > caddy-candidate.sha256
  sudo stat -c '%n|%u|%g|%a|%s' \
    Caddyfile.gate-d caddy-candidate.adapted.json \
    > caddy-candidate.stat
)
```

Next, run the separately recorded
`<VERIFIED_CADDY_RELOAD_COMMAND_USING_GATE_D_CANDIDATE>`. Do not execute the
placeholder literally. Immediately run
`<VERIFIED_CADDY_ACTIVE_CONFIG_EXPORT_COMMAND>` into the restricted recovery
directory and compare its reviewed normalized route summary with the adapted
candidate. Prove that:

- the active runtime contains no `dev.alemany.me` matcher and no
  `127.0.0.1:3000` NAM proxy;
- every unrelated route from the before-state remains; and
- independent forced-host behavior no longer reaches NAM.

The persistent `/etc/caddy/Caddyfile` must still match its before checksum at
this point. A generic or TLS-error response is not proof that the runtime is
correct. If candidate reload or active-runtime verification fails, do not
persist anything. Inspect the active state; if it cannot be proven, stop and
escalate. If the old runtime is still active, public NAM may still be exposed.
If the candidate became active but verification cannot complete, use only the
reviewed recovery path and an explicit owner decision.

```bash
test "$(sudo sha256sum /etc/caddy/Caddyfile | awk '{print $1}')" = \
  "$(cat "$GATE_D_RECOVERY_DIR/Caddyfile.live.sha256")"
set_gate_d_checkpoint CANDIDATE_ACTIVE_PERSISTENT_BEFORE
```

Only after the candidate is proven active may it be persisted. Standard owner,
group, and mode are preserved below. Preflight must already have proven that
the source has no nonstandard ACL or extended attribute; otherwise this block
is prohibited.

```bash
read -r CADDY_UID CADDY_GID CADDY_MODE \
  < "$GATE_D_RECOVERY_DIR/Caddyfile.before.stat"
test ! -s "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs"
test "$(grep -Ec '^(user::|group::|other::)' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl")" -eq 3
test "$(awk 'NF {count++} END {print count+0}' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl")" -eq 3

sudo install --owner="$CADDY_UID" --group="$CADDY_GID" \
  --mode="$CADDY_MODE" "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d" \
  /etc/caddy/Caddyfile.gate-d
test "$(sudo stat -c %u /etc/caddy/Caddyfile.gate-d)" = "$CADDY_UID"
test "$(sudo stat -c %g /etc/caddy/Caddyfile.gate-d)" = "$CADDY_GID"
test "$(sudo stat -c %a /etc/caddy/Caddyfile.gate-d)" = "$CADDY_MODE"
sudo cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d" \
  /etc/caddy/Caddyfile.gate-d
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config /etc/caddy/Caddyfile.gate-d --adapter caddyfile

sudo mv --force -- /etc/caddy/Caddyfile.gate-d /etc/caddy/Caddyfile
sudo cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.gate-d" \
  /etc/caddy/Caddyfile
test "$(sudo stat -c %u /etc/caddy/Caddyfile)" = "$CADDY_UID"
test "$(sudo stat -c %g /etc/caddy/Caddyfile)" = "$CADDY_GID"
test "$(sudo stat -c %a /etc/caddy/Caddyfile)" = "$CADDY_MODE"
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile
```

Run the separately recorded
`<VERIFIED_CADDY_EXECRELOAD_COMMAND_USING_PERSISTENT_CONFIG>` and verify the
active runtime again using the same export and normalized comparison. Confirm
the active runtime and persistent file both contain the candidate and both omit
the NAM route before proceeding. Only after that comparison succeeds, record:

```bash
set_gate_d_checkpoint CANDIDATE_ACTIVE_AND_PERSISTED
```

Every failure is handled immediately and recorded:

- validation failure changes neither disk nor runtime;
- initial reload failure leaves the persistent file unchanged, but the active
  runtime must be inspected rather than assumed;
- active-runtime verification failure prohibits persistence;
- install or persistence failure leaves a known runtime/disk mismatch that must
  be resolved immediately by either completing verified persistence or, with
  explicit owner approval, reloading the verified before-state; and
- final persistent-config reload or verification failure stops the cutover and
  requires the same explicit recovery decision.

Never continue with an unresolved runtime/disk mismatch. Do not delete or
modify Caddy certificate/storage material. Confirm private Windows and iPad
access and the open recovery session after the runtime and disk agree. The
firewall and independent denial tests remain mandatory. Any path from this
checkpoint into rollback must follow the mandatory failure/pre-rollback
persistence attempt. An inspection failure does not delay the minimum safety
rollback and cannot support an unchanged-persistence claim.

### Checkpoint D3: Remove Public Web Allows From UFW

Fresh preflight must show the accepted simple `80/tcp` and `443/tcp` public
allow rules for both address families and no nonstandard equivalent. UFW must
have IPv6 enabled. These commands intentionally do not reference TCP `22` or
UDP `443`.

```bash
sudo ufw --force delete allow 80/tcp
sudo ufw --force delete allow 443/tcp
sudo ufw status verbose
sudo ufw status numbered
```

Verify that:

- TCP `22` remains allowed over IPv4 and IPv6;
- TCP `80` and `443` have no public allow;
- UDP `443` still has no public allow;
- the input default remains deny;
- Docker/nftables do not create a bypass;
- TCP `3000` remains loopback-only; and
- TCP `5432` remains unpublished.

Only after these effective IPv4, IPv6, and Docker-chain checks succeed, record:

```bash
set_gate_d_checkpoint WEB_UFW_RULES_REMOVED
```

Before any DNS mutation, run `Invoke-GateDPositiveControls "after-ufw"`, the
strict `Invoke-GateDPostCutoverNamDenialChecks` with the same prefix and reviewed
classes, `Invoke-GateDDirectDenialChecks "after-ufw"`, and
`Invoke-GateDPrivateChecks "after-ufw"`. Confirm the recovery anchor. Any failed
validator stops execution and requires an explicit recovery or rollback
decision; evidence files alone do not authorize D4. Before rollback, follow the
mandatory failure/pre-rollback persistence attempt without allowing an
inspection failure to delay safety recovery.

### Checkpoint D4: Remove Only The VPS DNS Records

In the Namecheap DNS control plane, the authorized DNS operator must perform
these precise actions:

1. Select the zone for `alemany.me` and record the before-state privately.
2. Delete only the `A` record for host `dev` whose value exactly matches the
   privately recorded NAM VPS IPv4 address.
3. For host `nam`, delete only the `A` record whose value exactly matches the
   same NAM VPS address.
4. Leave the `nam` legacy `CNAME` to `wikijs-nam.fly.dev` unchanged.
5. Do not add, remove, or edit `AAAA`, wildcard, mail, verification, or any
   unrelated record.
6. Save the change and record the control-plane confirmation and time without
   recording authentication data.

After authenticated control-plane confirmation identifies both exact VPS `A`
record removals, record:

```bash
set_gate_d_checkpoint VPS_DNS_RECORDS_REMOVED
```

Immediately confirm that the recovery anchor remains healthy and re-run the
Windows and iPad private checks before waiting for DNS TTL expiry.

If the control plane cannot represent the `nam` `A` and legacy `CNAME`
separately, or the matching VPS `A` record is ambiguous, stop without changing
either record. Do not turn stale-record cleanup into Gate D scope.

Wait at least the fresh authoritative TTL observed during preflight—expected to
be approximately 1,800 seconds—before final DNS acceptance. Query both
authoritative nameservers and independent resolvers. DNS removal does not
replace forced-address and direct IPv6/SNI testing.

### Checkpoint D5: Independent Acceptance Execution

Run every applicable row in the [Acceptance Matrix](#acceptance-matrix). Do not
weaken a test because tooling or connectivity is unavailable. Any unexpected
public response, certificate-only failure, missing IPv6/QUIC evidence, private
access failure, SSH recovery failure, or runtime identity change is a failed
execution requiring a stop and explicit decision.

Immediately before this matrix, run matching `final` positive controls, strict
NAM denial checks, direct checks, and private checks. A result from an earlier
checkpoint cannot substitute for these final validators.

Capture the VPS post-state before closing the recovery anchor:

```bash
sudo stat -c '%u %g %a' /etc/caddy/Caddyfile \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.after.stat"
sudo getfacl --absolute-names --numeric --omit-header /etc/caddy/Caddyfile \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.after.acl"
sudo getfattr --absolute-names --dump -m- /etc/caddy/Caddyfile 2>/dev/null | \
  sed '/^# file:/d;/^[[:space:]]*$/d' \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.after.xattrs"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.stat" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.after.stat"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.after.acl"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.after.xattrs"
sudo sha256sum /etc/caddy/Caddyfile | awk '{print $1}' \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.after.sha256"
printf 'nam_sites=%s\nnam_backends=%s\n' \
  "$(sudo grep -Ec '^dev\.alemany\.me[[:space:]]*\{' /etc/caddy/Caddyfile)" \
  "$(sudo grep -Ec 'reverse_proxy[[:space:]]+127\.0\.0\.1:3000' /etc/caddy/Caddyfile)" \
  > "$GATE_D_RECOVERY_DIR/Caddyfile.after.summary.txt"
grep -qx 'nam_sites=0' "$GATE_D_RECOVERY_DIR/Caddyfile.after.summary.txt"
grep -qx 'nam_backends=0' "$GATE_D_RECOVERY_DIR/Caddyfile.after.summary.txt"

capture_gate_d_persistence_identity after
verify_gate_d_persistence_phase after
compare_gate_d_persistence_with_before after

sudo ss -H -ltnup \
  '( sport = :22 or sport = :80 or sport = :443 or sport = :3000 or sport = :5432 )' \
  > "$GATE_D_RECOVERY_DIR/listeners-relevant.after.txt"
capture_recovery_sshd_policy \
  "$GATE_D_RECOVERY_DIR/sshd-effective.after.txt"
cmp --silent "$GATE_D_RECOVERY_DIR/sshd-effective.before.txt" \
  "$GATE_D_RECOVERY_DIR/sshd-effective.after.txt"
sudo ufw status verbose > "$GATE_D_RECOVERY_DIR/ufw.after.txt"
sudo ufw status numbered > "$GATE_D_RECOVERY_DIR/ufw.after.numbered.txt"
sudo nft list ruleset > "$GATE_D_RECOVERY_DIR/nft-full.after.txt"
sudo iptables-save > "$GATE_D_RECOVERY_DIR/iptables-v4-full.after.txt"
sudo ip6tables-save > "$GATE_D_RECOVERY_DIR/iptables-v6-full.after.txt"
sudo nft list ruleset | \
  grep -E 'hook input|policy (accept|drop)|DOCKER|dport (22|80|443|3000|5432)' \
  > "$GATE_D_RECOVERY_DIR/nft-relevant.after.txt"
sudo iptables -S DOCKER-USER \
  > "$GATE_D_RECOVERY_DIR/docker-user-v4.after.txt"
sudo ip6tables -S DOCKER-USER \
  > "$GATE_D_RECOVERY_DIR/docker-user-v6.after.txt"

tailscale status --json > "$GATE_D_RECOVERY_DIR/tailscale-status.after.json"
test -s "$GATE_D_RECOVERY_DIR/tailscale-status.after.json"
jq -e '
  type == "object" and
  (.BackendState | type == "string") and
  (.Self | type == "object") and
  (.Self.DNSName | type == "string") and
  (.Self.Tags | type == "array") and
  .BackendState == "Running" and
  ((.Self.DNSName | rtrimstr(".")) == "ops-console.tailf57e61.ts.net") and
  (.Self.Tags | index("tag:nam-pilot") != null)
' "$GATE_D_RECOVERY_DIR/tailscale-status.after.json" >/dev/null
tailscale serve status > "$GATE_D_RECOVERY_DIR/tailscale-serve.after.txt"
test -s "$GATE_D_RECOVERY_DIR/tailscale-serve.after.txt"
tailscale serve status --json \
  > "$GATE_D_RECOVERY_DIR/tailscale-serve.after.json"
test -s "$GATE_D_RECOVERY_DIR/tailscale-serve.after.json"
jq -e 'type == "object"' \
  "$GATE_D_RECOVERY_DIR/tailscale-serve.after.json" >/dev/null
test -s "$GATE_D_RECOVERY_DIR/tailscale-serve-semantics.jq"
jq -e -f "$GATE_D_RECOVERY_DIR/tailscale-serve-semantics.jq" \
  "$GATE_D_RECOVERY_DIR/tailscale-serve.after.json" >/dev/null
cmp --silent "$GATE_D_RECOVERY_DIR/tailscale-serve.before.txt" \
  "$GATE_D_RECOVERY_DIR/tailscale-serve.after.txt"
cmp --silent "$GATE_D_RECOVERY_DIR/tailscale-serve.before.json" \
  "$GATE_D_RECOVERY_DIR/tailscale-serve.after.json"

: > "$GATE_D_RECOVERY_DIR/dns-authoritative.after.txt"
for server in dns1.registrar-servers.com dns2.registrar-servers.com; do
  capture_dns_query "control-${server}" "$server" alemany.me SOA control \
    "$GATE_D_RECOVERY_DIR/dns-authoritative.after.txt"
  for host in dev.alemany.me nam.alemany.me; do
    for type in A AAAA CNAME; do
      capture_dns_query "${server}-${host}-${type}" \
        "$server" "$host" "$type" relevant \
        "$GATE_D_RECOVERY_DIR/dns-authoritative.after.txt"
    done
  done
done

test "$(git rev-parse HEAD)" = "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
test "$(git rev-parse main)" = "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
test "$(git rev-parse --verify origin/main)" = \
  "$AUTHORIZED_GATE_D_EXECUTION_REVISION"
git rev-parse HEAD > "$GATE_D_RECOVERY_DIR/repository-head.after.txt"
git status --porcelain=v1 \
  > "$GATE_D_RECOVERY_DIR/repository-status.after.txt"
cmp --silent "$GATE_D_RECOVERY_DIR/repository-head.before.txt" \
  "$GATE_D_RECOVERY_DIR/repository-head.after.txt"
test ! -s "$GATE_D_RECOVERY_DIR/repository-status.after.txt"
git diff --quiet
git diff --cached --quiet
```

The Tailscale node summary may contain transient health changes, so review it
field by field. The Serve/Funnel configuration must compare exactly. Review the
complete before/after nftables and IPv4/IPv6 iptables captures privately and
prove that their only intended web-access changes correspond to the exact UFW
rules removed, with no input, forwarding, or Docker-chain bypass. Sanitize all
review evidence; keep raw restricted files outside Git and never print or
commit the complete firewall state.

## External Test Command Profiles

Use one independently reviewed Windows client and one pinned curl executable for
every control and probe. Store raw output in a restricted, non-repository
evidence directory and publish only sanitized summaries. Privately set:

```powershell
$Vps4 = "<NAM_VPS_PUBLIC_IPV4>"
$Vps6 = "<NAM_VPS_PUBLIC_IPV6>"
$PositiveControl = "<APPROVED_IPV4_IPV6_HTTP3_POSITIVE_CONTROL_ENDPOINT>"
$PositiveControlExpectedStatus = "<APPROVED_POSITIVE_CONTROL_HTTP_STATUS>"
$ExpectedNamHttpStatus = "<APPROVED_PRE_CUTOVER_NAM_HTTP_STATUS>"
$ExpectedNamHttpLocation = "<APPROVED_PRE_CUTOVER_NAM_HTTP_LOCATION>"
$EvidenceDir = "<EXACT_PRIVATE_GATE_D_EVIDENCE_DIRECTORY>"
$Dev = "dev.alemany.me"
$Alt = "nam.alemany.me"

function ConvertTo-GateDLiteralAddress {
  param(
    [Parameter(Mandatory=$true)][string]$Value,
    [Parameter(Mandatory=$true)][ValidateSet("IPv4", "IPv6")][string]$Family,
    [Parameter(Mandatory=$true)][string]$Name
  )
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Contains("<") -or
      $Value.Contains(">") -or $Value -ne $Value.Trim()) {
    throw "$Name is unresolved or malformed"
  }
  $Parsed = $null
  if (-not [Net.IPAddress]::TryParse($Value, [ref]$Parsed)) {
    throw "$Name is not a literal IP address"
  }
  if ($Family -eq "IPv4") {
    if ($Value -notmatch '^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$' -or
        $Parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
        $Parsed.ToString() -ne $Value) {
      throw "$Name is not an unambiguous canonical IPv4 literal"
    }
  } elseif ($Parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetworkV6 -or
            -not $Value.Contains(":") -or $Value.Contains("%") -or
            $Parsed.IsIPv4MappedToIPv6 -or $Parsed.ScopeId -ne 0) {
    throw "$Name is not an unambiguous unscoped IPv6 literal"
  }
  $Parsed
}

$Vps4Address = ConvertTo-GateDLiteralAddress $Vps4 "IPv4" "NAM VPS IPv4"
$Vps6Address = ConvertTo-GateDLiteralAddress $Vps6 "IPv6" "NAM VPS IPv6"
$Vps4 = $Vps4Address.ToString()
$Vps6 = $Vps6Address.ToString()
```

The literal validation must pass before any probe profile is created. It
rejects unresolved placeholders, hostnames, malformed or ambiguous values,
wrong families, scoped IPv6 values, and IPv4-mapped IPv6 values. All later NAM
`--resolve` entries and direct-address URLs are generated only from these two
validated address objects; operators must not hand-compose or override them.

The approved positive-control endpoint must be selected before execution. It
must be independent of the NAM VPS and support valid TLS, public IPv4, public
IPv6, and genuine HTTP/3 over UDP `443`. Do not substitute an ad hoc endpoint.

### Pin The Curl Executable

Resolve curl once, before any probe, and require exactly one reviewed
application executable. Record its absolute path only in restricted evidence;
the sanitized record retains filename, size, SHA-256, version, and features.

```powershell
$CurlCommands = @(Get-Command -Name curl.exe -CommandType Application -All -ErrorAction Stop)
$CurlPaths = @($CurlCommands | ForEach-Object { $_.Source } | Sort-Object -Unique)
if ($CurlPaths.Count -ne 1) {
  throw "Gate D requires exactly one reviewed curl application"
}
$CurlPath = [IO.Path]::GetFullPath($CurlPaths[0])
$CurlItem = Get-Item -LiteralPath $CurlPath -ErrorAction Stop
if (-not $CurlItem.Exists -or $CurlItem.Length -le 0) {
  throw "Pinned curl executable is missing or empty"
}
$CurlHash = Get-FileHash -LiteralPath $CurlPath -Algorithm SHA256 -ErrorAction Stop
$CurlIdentity = [pscustomobject]@{
  AbsolutePath = $CurlPath
  Size = $CurlItem.Length
  SHA256 = $CurlHash.Hash
}
$CurlIdentity | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidenceDir "curl-identity.restricted.json")

$CurlVersionPath = Join-Path $EvidenceDir "curl-version.txt"
$CurlHelpPath = Join-Path $EvidenceDir "curl-help-all.txt"
$CurlManualPath = Join-Path $EvidenceDir "curl-manual.txt"
& $CurlPath --disable --noproxy "*" --version 1> $CurlVersionPath
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $CurlVersionPath).Length -eq 0) {
  throw "Pinned curl version capture failed"
}
& $CurlPath --disable --noproxy "*" --help all 1> $CurlHelpPath
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $CurlHelpPath).Length -eq 0) {
  throw "Pinned curl help capture failed"
}
& $CurlPath --disable --noproxy "*" --manual 1> $CurlManualPath
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $CurlManualPath).Length -eq 0) {
  throw "Pinned curl manual capture failed"
}
$CurlHelp = Get-Content -Raw -LiteralPath $CurlHelpPath
$CurlVersion = Get-Content -Raw -LiteralPath $CurlVersionPath
if ($CurlVersion -notmatch '(?m)^Features:.*\bHTTP3\b') {
  throw "Pinned curl does not report HTTP3 support"
}
foreach ($RequiredOption in @("--disable", "--noproxy", "--http3-only")) {
  if (-not $CurlHelp.Contains($RequiredOption)) {
    throw "Pinned curl lacks required option $RequiredOption"
  }
}
$CurlManual = Get-Content -Raw -LiteralPath $CurlManualPath
foreach ($RequiredField in @("%{exitcode}", "%{http_code}", "%{ssl_verify_result}", "%{http_version}", "%{redirect_url}", "%{remote_ip}", "%{errormsg}")) {
  if (-not $CurlManual.Contains($RequiredField)) {
    throw "Pinned curl lacks required write-out field $RequiredField"
  }
}
```

The version/help/manual capture must prove every option and `%{...}` field used
below. If the pinned binary cannot satisfy the profile, stop and revise this
procedure; do not select or install another binary during Gate D. Every later
curl call uses `$CurlPath`. `--disable` is always its first argument so no
`.curlrc` or `_curlrc` can alter the test, and `--noproxy "*"` requires a direct
connection despite proxy environment settings.

### Classifiable Curl Evidence And Validators

```powershell
function Get-GateDAddressFamilyName {
  param([Parameter(Mandatory=$true)][Net.IPAddress]$Address)
  if ($Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) { return "IPv4" }
  if ($Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetworkV6) { return "IPv6" }
  throw "Unsupported target address family"
}

function Assert-GateDOfficialTarget {
  param(
    [Parameter(Mandatory=$true)][Net.IPAddress]$Address,
    [Parameter(Mandatory=$true)][ValidateSet("IPv4", "IPv6")][string]$Family
  )
  $ActualFamily = Get-GateDAddressFamilyName $Address
  if ($ActualFamily -ne $Family) { throw "Target address has the wrong family" }
  $Expected = if ($Family -eq "IPv4") { $Vps4Address } else { $Vps6Address }
  if (-not $Address.Equals($Expected)) { throw "Target is not the validated NAM VPS $Family address" }
}

function New-GateDForcedHostProfile {
  param(
    [Parameter(Mandatory=$true)][string]$TestId,
    [Parameter(Mandatory=$true)][ValidateSet("dev.alemany.me", "nam.alemany.me")][string]$Hostname,
    [Parameter(Mandatory=$true)][ValidateSet("http", "https")][string]$Protocol,
    [Parameter(Mandatory=$true)][ValidateSet("80", "443")][int]$Port,
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][Net.IPAddress]$TargetAddress,
    [switch]$Http3Only
  )
  $Family = Get-GateDAddressFamilyName $TargetAddress
  Assert-GateDOfficialTarget $TargetAddress $Family
  if (($Protocol -eq "http" -and $Port -ne 80) -or
      ($Protocol -eq "https" -and $Port -ne 443) -or
      ($Http3Only -and ($Protocol -ne "https" -or $Port -ne 443)) -or
      -not $Path.StartsWith("/")) {
    throw "$TestId has an invalid forced-host protocol, port, or path"
  }
  $Literal = $TargetAddress.ToString()
  $ResolveTarget = if ($Family -eq "IPv6") { "[$Literal]" } else { $Literal }
  $Resolve = "{0}:{1}:{2}" -f $Hostname,$Port,$ResolveTarget
  $Url = "{0}://{1}{2}" -f $Protocol,$Hostname,$Path
  $ParsedUrl = [uri]$Url
  if ($ParsedUrl.Scheme -ne $Protocol -or $ParsedUrl.DnsSafeHost -ne $Hostname -or
      $ParsedUrl.Port -ne $Port) {
    throw "$TestId did not preserve its hostname, scheme, SNI, or port"
  }
  $Arguments = @("--$($Family.ToLowerInvariant())", "--resolve", $Resolve)
  if ($Http3Only) { $Arguments += "--http3-only" }
  $Arguments += $Url
  [pscustomobject]@{
    Kind = "ForcedHost"
    TestId = $TestId
    RequestedFamily = $Family
    AttemptedTargetAddress = $Literal
    Hostname = $Hostname
    Port = $Port
    Protocol = $Protocol
    SniHostname = if ($Protocol -eq "https") { $Hostname } else { "" }
    ForcedAddressProfile = $Resolve
    Url = $Url
    Http3Only = [bool]$Http3Only
    Arguments = $Arguments
  }
}

function New-GateDDirectAddressProfile {
  param(
    [Parameter(Mandatory=$true)][string]$TestId,
    [Parameter(Mandatory=$true)][ValidateSet("http", "https")][string]$Protocol,
    [Parameter(Mandatory=$true)][ValidateSet("80", "443")][int]$Port,
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][Net.IPAddress]$TargetAddress
  )
  $Family = Get-GateDAddressFamilyName $TargetAddress
  Assert-GateDOfficialTarget $TargetAddress $Family
  if (($Protocol -eq "http" -and $Port -ne 80) -or
      ($Protocol -eq "https" -and $Port -ne 443) -or -not $Path.StartsWith("/")) {
    throw "$TestId has an invalid direct-address protocol, port, or path"
  }
  $Literal = $TargetAddress.ToString()
  $UrlHost = if ($Family -eq "IPv6") { "[$Literal]" } else { $Literal }
  $Url = "{0}://{1}{2}" -f $Protocol,$UrlHost,$Path
  $Arguments = @("--$($Family.ToLowerInvariant())", $Url)
  [pscustomobject]@{
    Kind = "DirectAddress"
    TestId = $TestId
    RequestedFamily = $Family
    AttemptedTargetAddress = $Literal
    Hostname = $Literal
    Port = $Port
    Protocol = $Protocol
    SniHostname = ""
    ForcedAddressProfile = $Url
    Url = $Url
    Http3Only = $false
    Arguments = $Arguments
  }
}

function New-GateDEndpointProfile {
  param(
    [Parameter(Mandatory=$true)][string]$TestId,
    [Parameter(Mandatory=$true)][uri]$Url,
    [Parameter(Mandatory=$true)][ValidateSet("Any", "IPv4", "IPv6")][string]$RequestedFamily,
    [switch]$Http3Only
  )
  if ($Url.Scheme -notin @("http", "https") -or ($Http3Only -and $Url.Scheme -ne "https")) {
    throw "$TestId has an invalid endpoint URL"
  }
  $Arguments = @()
  if ($RequestedFamily -ne "Any") { $Arguments += "--$($RequestedFamily.ToLowerInvariant())" }
  if ($Http3Only) { $Arguments += "--http3-only" }
  $Arguments += $Url.AbsoluteUri
  [pscustomobject]@{
    Kind = "Endpoint"
    TestId = $TestId
    RequestedFamily = $RequestedFamily
    AttemptedTargetAddress = ""
    Hostname = $Url.DnsSafeHost
    Port = $Url.Port
    Protocol = $Url.Scheme
    SniHostname = if ($Url.Scheme -eq "https") { $Url.DnsSafeHost } else { "" }
    ForcedAddressProfile = ""
    Url = $Url.AbsoluteUri
    Http3Only = [bool]$Http3Only
    Arguments = $Arguments
  }
}

function Assert-GateDProbeProfile {
  param([Parameter(Mandatory=$true)]$Profile)
  foreach ($Name in @("Kind", "TestId", "RequestedFamily", "AttemptedTargetAddress", "Hostname", "Port", "Protocol", "SniHostname", "ForcedAddressProfile", "Url", "Http3Only", "Arguments")) {
    if ($null -eq $Profile.PSObject.Properties[$Name]) { throw "Probe profile lacks $Name" }
  }
  if ($Profile.TestId -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*$') {
    throw "Probe profile has an invalid test identifier"
  }
  switch ($Profile.Kind) {
    "ForcedHost" {
      $Address = ConvertTo-GateDLiteralAddress $Profile.AttemptedTargetAddress $Profile.RequestedFamily "forced-host target"
      $Expected = New-GateDForcedHostProfile $Profile.TestId $Profile.Hostname $Profile.Protocol $Profile.Port ([uri]$Profile.Url).PathAndQuery $Address -Http3Only:([bool]$Profile.Http3Only)
    }
    "DirectAddress" {
      $Address = ConvertTo-GateDLiteralAddress $Profile.AttemptedTargetAddress $Profile.RequestedFamily "direct-address target"
      $Expected = New-GateDDirectAddressProfile $Profile.TestId $Profile.Protocol $Profile.Port ([uri]$Profile.Url).PathAndQuery $Address
    }
    "Endpoint" {
      if (-not [string]::IsNullOrEmpty($Profile.AttemptedTargetAddress) -or
          -not [string]::IsNullOrEmpty($Profile.ForcedAddressProfile)) {
        throw "Endpoint profile contains a forced target"
      }
      $Expected = New-GateDEndpointProfile $Profile.TestId ([uri]$Profile.Url) $Profile.RequestedFamily -Http3Only:([bool]$Profile.Http3Only)
    }
    default { throw "Unknown probe-profile kind" }
  }
  foreach ($Name in @("Kind", "TestId", "RequestedFamily", "AttemptedTargetAddress", "Hostname", "Port", "Protocol", "SniHostname", "ForcedAddressProfile", "Url", "Http3Only")) {
    $ActualValue = [string]$Profile.PSObject.Properties[$Name].Value
    $ExpectedValue = [string]$Expected.PSObject.Properties[$Name].Value
    if ($ActualValue -cne $ExpectedValue) {
      throw "$($Profile.TestId) has a mismatched profile field $Name"
    }
  }
  if (($Profile.Arguments -join [char]0) -cne ($Expected.Arguments -join [char]0)) {
    throw "$($Profile.TestId) has mismatched generated curl arguments"
  }
}

function Get-GateDMetadataField {
  param([string]$Metadata, [string]$Name)
  $FieldMatches = [regex]::Matches($Metadata, "(?m)^$([regex]::Escape($Name))=(.*)\r?$")
  if ($FieldMatches.Count -ne 1) {
    throw "Missing or duplicate curl metadata field $Name"
  }
  $FieldMatches[0].Groups[1].Value.TrimEnd([char]13)
}

function Invoke-GateDCurlProbe {
  param(
    [Parameter(Mandatory=$true)]$ProbeProfile,
    [string[]]$CurlArguments = @(),
    [switch]$CaptureBody
  )
  Assert-GateDProbeProfile $ProbeProfile
  $TestId = $ProbeProfile.TestId
  foreach ($Argument in $CurlArguments) {
    if ($Argument -match '^--(disable|noproxy|proxy|preproxy|config|insecure|ipv4|ipv6|resolve|connect-to|url|http3|http3-only|header|interface|unix-socket|abstract-unix-socket)(=|$)' -or
        $Argument -match '^-(q|x|K|k|4|6|H).*$' -or
        $Argument -match '^[A-Za-z][A-Za-z0-9+.-]*://') {
      throw "$TestId contains a target-affecting or wrapper-owned curl argument"
    }
  }

  $Timestamp = [DateTime]::UtcNow.ToString("o")
  $StdoutPath = Join-Path $EvidenceDir "$TestId.stdout.txt"
  $StderrPath = Join-Path $EvidenceDir "$TestId.stderr.txt"
  $BodyPath = Join-Path $EvidenceDir "$TestId.body.txt"
  $OutputPath = if ($CaptureBody) { $BodyPath } else { "NUL" }
  $Format = "test=$TestId`ntimestamp=$Timestamp`ndirect_required=true`nprofile_kind=$($ProbeProfile.Kind)`nrequested_family=$($ProbeProfile.RequestedFamily)`nattempted_target=$($ProbeProfile.AttemptedTargetAddress)`nhostname=$($ProbeProfile.Hostname)`nport=$($ProbeProfile.Port)`nprotocol=$($ProbeProfile.Protocol)`nsni_hostname=$($ProbeProfile.SniHostname)`nforced_address_profile=$($ProbeProfile.ForcedAddressProfile)`nurl=$($ProbeProfile.Url)`ncurl_exit=%{exitcode}`nhttp_status=%{http_code}`ntls_verify=%{ssl_verify_result}`nhttp_version=%{http_version}`nredirect_url=%{redirect_url}`nremote_ip=%{remote_ip}`nerror=%{errormsg}`n"
  $PinnedArguments = @("--disable", "--noproxy", "*") + $CurlArguments + $ProbeProfile.Arguments

  $CurrentCurlItem = Get-Item -LiteralPath $CurlPath -ErrorAction Stop
  $CurrentCurlHash = Get-FileHash -LiteralPath $CurlPath -Algorithm SHA256 -ErrorAction Stop
  if ($CurrentCurlItem.Length -ne $CurlItem.Length -or $CurrentCurlHash.Hash -ne $CurlHash.Hash) {
    throw "Pinned curl identity changed before $TestId"
  }

  & $CurlPath @PinnedArguments --output $OutputPath --write-out $Format `
    1> $StdoutPath 2> $StderrPath
  $NativeExit = $LASTEXITCODE
  $Metadata = Get-Content -Raw -LiteralPath $StdoutPath
  if ([string]::IsNullOrWhiteSpace($Metadata)) {
    throw "$TestId produced no classifiable curl metadata"
  }
  $ReportedExit = [int](Get-GateDMetadataField $Metadata "curl_exit")
  if ($NativeExit -ne $ReportedExit) {
    throw "$TestId native and reported curl exits differ"
  }
  foreach ($RecordedField in (@{
    profile_kind = [string]$ProbeProfile.Kind
    requested_family = [string]$ProbeProfile.RequestedFamily
    attempted_target = [string]$ProbeProfile.AttemptedTargetAddress
    hostname = [string]$ProbeProfile.Hostname
    port = [string]$ProbeProfile.Port
    protocol = [string]$ProbeProfile.Protocol
    sni_hostname = [string]$ProbeProfile.SniHostname
    forced_address_profile = [string]$ProbeProfile.ForcedAddressProfile
    url = [string]$ProbeProfile.Url
  }).GetEnumerator()) {
    if ((Get-GateDMetadataField $Metadata $RecordedField.Key) -cne $RecordedField.Value) {
      throw "$TestId recorded a mismatched target-profile field $($RecordedField.Key)"
    }
  }
  $RecordedBodyPath = $null
  if ($CaptureBody) { $RecordedBodyPath = $BodyPath }
  $RemoteIp = Get-GateDMetadataField $Metadata "remote_ip"
  $ObservedFamily = "none"
  $ObservedRemoteIp = ""
  if (-not [string]::IsNullOrWhiteSpace($RemoteIp)) {
    $ParsedIp = $null
    if (-not [Net.IPAddress]::TryParse($RemoteIp, [ref]$ParsedIp)) {
      throw "$TestId returned a malformed remote_ip"
    }
    $ObservedRemoteIp = $ParsedIp.ToString()
    if ($ParsedIp.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) {
      $ObservedFamily = "IPv4"
    } elseif ($ParsedIp.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetworkV6) {
      $ObservedFamily = "IPv6"
    } else {
      throw "$TestId returned an unsupported address family"
    }
  }
  [pscustomobject]@{
    TestId = $TestId
    Timestamp = $Timestamp
    NativeExit = $NativeExit
    ReportedExit = $ReportedExit
    HttpStatus = [int](Get-GateDMetadataField $Metadata "http_status")
    TlsVerify = [int](Get-GateDMetadataField $Metadata "tls_verify")
    HttpVersion = Get-GateDMetadataField $Metadata "http_version"
    RedirectUrl = Get-GateDMetadataField $Metadata "redirect_url"
    ProfileKind = $ProbeProfile.Kind
    RequestedFamily = $ProbeProfile.RequestedFamily
    AttemptedTargetAddress = $ProbeProfile.AttemptedTargetAddress
    Hostname = $ProbeProfile.Hostname
    Port = $ProbeProfile.Port
    Protocol = $ProbeProfile.Protocol
    SniHostname = $ProbeProfile.SniHostname
    ForcedAddressProfile = $ProbeProfile.ForcedAddressProfile
    Url = $ProbeProfile.Url
    ObservedRemoteIp = $ObservedRemoteIp
    ObservedAddressFamily = $ObservedFamily
    BodyPath = $RecordedBodyPath
    MetadataPath = $StdoutPath
    ErrorPath = $StderrPath
  }
}

function Assert-GateDObservedRemote {
  param($Result, [bool]$RequireRemoteIp, [bool]$RequireTargetMatch)
  if ([string]::IsNullOrWhiteSpace($Result.ObservedRemoteIp)) {
    if ($RequireRemoteIp) { throw "$($Result.TestId) lacks observed remote_ip" }
    return
  }
  $Observed = $null
  if (-not [Net.IPAddress]::TryParse($Result.ObservedRemoteIp, [ref]$Observed)) {
    throw "$($Result.TestId) has malformed observed remote_ip"
  }
  $ObservedFamily = Get-GateDAddressFamilyName $Observed
  if ($Result.ObservedAddressFamily -ne $ObservedFamily) {
    throw "$($Result.TestId) recorded an inconsistent observed address family"
  }
  if ($Result.RequestedFamily -ne "Any" -and $ObservedFamily -ne $Result.RequestedFamily) {
    throw "$($Result.TestId) observed the wrong address family"
  }
  if ($RequireTargetMatch) {
    $Target = ConvertTo-GateDLiteralAddress $Result.AttemptedTargetAddress $Result.RequestedFamily "attempted target"
    if (-not $Observed.Equals($Target)) {
      throw "$($Result.TestId) observed a remote_ip different from its attempted target"
    }
  }
}

function Assert-GateDPositiveControl {
  param($Result, [ValidateSet("IPv4", "IPv6")][string]$Family, [bool]$RequireHttp3)
  if ($PositiveControlExpectedStatus -notmatch '^[0-9]{3}$') { throw "Positive-control status is unresolved" }
  if ([int]$PositiveControlExpectedStatus -lt 200 -or [int]$PositiveControlExpectedStatus -ge 300) { throw "Positive-control status is not HTTP success" }
  if ($Result.NativeExit -ne 0 -or $Result.ReportedExit -ne 0) { throw "$($Result.TestId) control failed" }
  if ($Result.HttpStatus -ne [int]$PositiveControlExpectedStatus) { throw "$($Result.TestId) returned the wrong status" }
  if ($Result.TlsVerify -ne 0) { throw "$($Result.TestId) TLS verification failed" }
  if ($Result.RequestedFamily -ne $Family) { throw "$($Result.TestId) requested the wrong address family" }
  Assert-GateDObservedRemote $Result $true $false
  if ($RequireHttp3 -and $Result.HttpVersion -ne "3") { throw "$($Result.TestId) did not negotiate HTTP/3" }
}

function Assert-GateDPreCutoverNamTcp {
  param($Result, [int]$ExpectedStatus, [bool]$RequireTls)
  if ($Result.NativeExit -ne 0 -or $Result.ReportedExit -ne 0) { throw "$($Result.TestId) did not reach NAM" }
  if ($Result.HttpStatus -ne $ExpectedStatus) { throw "$($Result.TestId) returned an unexpected NAM status" }
  if ($Result.ProfileKind -ne "ForcedHost") { throw "$($Result.TestId) lacks a forced-host profile" }
  Assert-GateDObservedRemote $Result $true $true
  if ($RequireTls) {
    if ($Result.TlsVerify -ne 0) { throw "$($Result.TestId) TLS verification failed" }
    if ($Result.HttpStatus -ne 200 -or -not $Result.BodyPath) { throw "$($Result.TestId) lacks the NAM health response" }
    $Health = Get-Content -Raw -LiteralPath $Result.BodyPath | ConvertFrom-Json -ErrorAction Stop
    if ($Health.status -ne "ok" -or $Health.database -ne "ok" -or @($Health.PSObject.Properties).Count -ne 2) {
      throw "$($Result.TestId) did not return the exact NAM health payload"
    }
  } else {
    if ($ExpectedStatus -lt 300 -or $ExpectedStatus -ge 400) { throw "Expected NAM HTTP redirect status is invalid" }
    if ($ExpectedNamHttpLocation -eq "<APPROVED_PRE_CUTOVER_NAM_HTTP_LOCATION>" -or
        $Result.RedirectUrl -ne $ExpectedNamHttpLocation) {
      throw "$($Result.TestId) did not return the expected NAM HTTPS redirect"
    }
  }
}

function Assert-GateDPrivateResult {
  param($Result)
  if ($Result.NativeExit -ne 0 -or $Result.ReportedExit -ne 0 -or
      $Result.HttpStatus -ne 200 -or $Result.TlsVerify -ne 0) {
    throw "$($Result.TestId) private-access check failed"
  }
  Assert-GateDObservedRemote $Result $true $false
}

function Assert-GateDReviewedDenial {
  param($Result, [string]$ReviewedClass)
  if ($Result.HttpStatus -ne 0) { throw "$($Result.TestId) received an HTTP response" }
  if ($Result.ProfileKind -notin @("ForcedHost", "DirectAddress") -or
      $Result.RequestedFamily -notin @("IPv4", "IPv6")) {
    throw "$($Result.TestId) lacks a validated forced or direct target profile"
  }
  $Target = ConvertTo-GateDLiteralAddress $Result.AttemptedTargetAddress $Result.RequestedFamily "denial target"
  Assert-GateDOfficialTarget $Target $Result.RequestedFamily
  Assert-GateDObservedRemote $Result $false $true
  switch ($ReviewedClass) {
    "CONNECTION_REFUSED" { if ($Result.NativeExit -ne 7 -or $Result.ReportedExit -ne 7) { throw "$($Result.TestId) is not a reviewed refusal" } }
    "CONNECTION_TIMEOUT" { if ($Result.NativeExit -ne 28 -or $Result.ReportedExit -ne 28) { throw "$($Result.TestId) is not a reviewed timeout" } }
    default { throw "$($Result.TestId) lacks an approved denial classification" }
  }
}
```

The restricted metadata records the pinned binary, direct-connection
requirement, identifier, timestamp, requested family, exact attempted target,
hostname, port, protocol, SNI hostname, generated forced-address profile,
numeric exits, HTTP status, TLS result, HTTP version, and observed `remote_ip`
when curl supplies it. Publish only sanitized target/family conclusions and a
reviewed error class. Successful probes require a parseable observed address;
forced-host success must match the exact attempted target. A reviewed refusal
or timeout may have an empty `remote_ip`, but only a strictly validated forced
or direct target profile can then prove its attempted family and address. A
nonempty denial `remote_ip` must parse and exactly match that profile. Any HTTP
response fails denial acceptance.
Certificate/TLS, DNS, proxy, malformed-command, unsupported-option,
local-client, or unexplained failures never prove denial. Evidence-file creation
alone never permits the next checkpoint.

Consequently, an IPv4 refusal or IPv6 timeout with empty `remote_ip` can pass
only when its regenerated profile proves the exact validated VPS address and
family. A wrong-family, wrong-target, malformed, unresolved, or mismatched
profile stops before curl runs; a nonempty mismatched `remote_ip` stops in the
validator. Successful positive controls require a parseable observed family,
and successful forced pre-cutover NAM probes additionally require the observed
address to equal the intended target.

### Private Windows Continuity

Private checks use normal tailnet resolution, no TLS bypass, and the same pinned
direct curl wrapper. All three route validators must pass; this does not replace
the independent iPad tests.

```powershell
function Invoke-GateDPrivateChecks {
  param([Parameter(Mandatory=$true)][string]$Prefix)
  foreach ($Path in @("/", "/api/health", "/day-view")) {
    $RouteId = $Path.Trim('/').Replace('/', '-') -replace '^$', 'root'
    $Profile = New-GateDEndpointProfile "$Prefix-private-$RouteId" ([uri]"https://ops-console.tailf57e61.ts.net$Path") "Any"
    $Result = Invoke-GateDCurlProbe -ProbeProfile $Profile -CurlArguments @(
      "--silent", "--show-error", "--fail", "--connect-timeout", "5",
      "--max-time", "15"
    )
    Assert-GateDPrivateResult $Result
  }
}
```

### Mandatory Positive Controls

```powershell
$script:GateDPositiveControlPass = @{}
function Invoke-GateDPositiveControls {
  param([Parameter(Mandatory=$true)][string]$Prefix)
  [void]$script:GateDPositiveControlPass.Remove($Prefix)
  if (-not $PositiveControl.StartsWith("https://", [StringComparison]::OrdinalIgnoreCase)) { throw "Positive control must use HTTPS" }
  $V4Profile = New-GateDEndpointProfile "$Prefix-control-ipv4" ([uri]$PositiveControl) "IPv4"
  $V4 = Invoke-GateDCurlProbe -ProbeProfile $V4Profile -CurlArguments @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  Assert-GateDPositiveControl $V4 "IPv4" $false
  $V6Profile = New-GateDEndpointProfile "$Prefix-control-ipv6" ([uri]$PositiveControl) "IPv6"
  $V6 = Invoke-GateDCurlProbe -ProbeProfile $V6Profile -CurlArguments @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  Assert-GateDPositiveControl $V6 "IPv6" $false
  $H3V4Profile = New-GateDEndpointProfile "$Prefix-control-http3-ipv4" ([uri]$PositiveControl) "IPv4" -Http3Only
  $H3V4 = Invoke-GateDCurlProbe -ProbeProfile $H3V4Profile -CurlArguments @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  Assert-GateDPositiveControl $H3V4 "IPv4" $true
  $H3V6Profile = New-GateDEndpointProfile "$Prefix-control-http3-ipv6" ([uri]$PositiveControl) "IPv6" -Http3Only
  $H3V6 = Invoke-GateDCurlProbe -ProbeProfile $H3V6Profile -CurlArguments @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  Assert-GateDPositiveControl $H3V6 "IPv6" $true
  $script:GateDPositiveControlPass[$Prefix] = $true
}
```

Run `Invoke-GateDPositiveControls "before"` immediately before pre-cutover NAM
testing and `Invoke-GateDPositiveControls "final"` immediately before final
acceptance. Both sets must pass. HTTP/3 controls must report version `3`, proving
UDP/QUIC without TCP fallback.

### Pre-Cutover NAM Baseline

TCP HTTP/HTTPS must positively prove the expected NAM paths over both families.
The expected status placeholders must be resolved and reviewed before use.

```powershell
function Invoke-GateDPreCutoverNamTcpChecks {
  if ($ExpectedNamHttpStatus -notmatch '^[0-9]{3}$') {
    throw "Pre-cutover NAM status expectations are unresolved"
  }
  if (-not $script:GateDPositiveControlPass.ContainsKey("before")) { throw "Before controls have not passed" }
  $Common = @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  $HttpV4Profile = New-GateDForcedHostProfile "before-dev-http-v4" $Dev "http" 80 "/api/health" $Vps4Address
  $HttpV4 = Invoke-GateDCurlProbe -ProbeProfile $HttpV4Profile -CurlArguments $Common
  Assert-GateDPreCutoverNamTcp $HttpV4 ([int]$ExpectedNamHttpStatus) $false
  $HttpsV4Profile = New-GateDForcedHostProfile "before-dev-https-v4" $Dev "https" 443 "/api/health" $Vps4Address
  $HttpsV4 = Invoke-GateDCurlProbe -ProbeProfile $HttpsV4Profile -CurlArguments $Common -CaptureBody
  Assert-GateDPreCutoverNamTcp $HttpsV4 200 $true
  $HttpV6Profile = New-GateDForcedHostProfile "before-dev-http-v6" $Dev "http" 80 "/api/health" $Vps6Address
  $HttpV6 = Invoke-GateDCurlProbe -ProbeProfile $HttpV6Profile -CurlArguments $Common
  Assert-GateDPreCutoverNamTcp $HttpV6 ([int]$ExpectedNamHttpStatus) $false
  $HttpsV6Profile = New-GateDForcedHostProfile "before-dev-https-v6" $Dev "https" 443 "/api/health" $Vps6Address
  $HttpsV6 = Invoke-GateDCurlProbe -ProbeProfile $HttpsV6Profile -CurlArguments $Common -CaptureBody
  Assert-GateDPreCutoverNamTcp $HttpsV6 200 $true
}
```

Because UFW already denies UDP `443` and preflight must prove no bypass, forced
NAM HTTP/3 must already be denied before mutation. First pass the separate
HTTP/3 positive controls, then run both forced NAM probes and require an
independent review classification:

```powershell
function Invoke-GateDPreCutoverNamHttp3Checks {
  param([Parameter(Mandatory=$true)][hashtable]$ReviewedClasses)
  if (-not $script:GateDPositiveControlPass.ContainsKey("before")) { throw "Before HTTP/3 controls have not passed" }
  $Common = @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  foreach ($Profile in @(
    (New-GateDForcedHostProfile "before-dev-http3-v4" $Dev "https" 443 "/api/health" $Vps4Address -Http3Only),
    (New-GateDForcedHostProfile "before-dev-http3-v6" $Dev "https" 443 "/api/health" $Vps6Address -Http3Only)
  )) {
    if (-not $ReviewedClasses.ContainsKey($Profile.TestId)) { throw "Missing reviewed class for $($Profile.TestId)" }
    $Result = Invoke-GateDCurlProbe -ProbeProfile $Profile -CurlArguments $Common
    Assert-GateDReviewedDenial $Result $ReviewedClasses[$Profile.TestId]
  }
}
```

Any pre-cutover NAM HTTP/3 response or success proves the firewall baseline is
materially wrong or a bypass exists and stops execution. TLS, proxy, DNS,
unsupported-feature, client, or unexplained errors do not pass.

The complete pre-mutation external sequence is mandatory:

```powershell
Invoke-GateDPositiveControls "before"
Invoke-GateDPreCutoverNamTcpChecks
$BeforeHttp3Classes = @{
  "before-dev-http3-v4" = "<REVIEWED_CONNECTION_REFUSED_OR_TIMEOUT>"
  "before-dev-http3-v6" = "<REVIEWED_CONNECTION_REFUSED_OR_TIMEOUT>"
}
Invoke-GateDPreCutoverNamHttp3Checks $BeforeHttp3Classes
Invoke-GateDPrivateChecks "before"
```

Literal placeholders cannot pass the denial validator. Do not proceed to D1
until all control, NAM TCP, NAM UDP, and private validators return successfully.

### Post-Cutover Public Denial

For each checkpoint-specific prefix, supply an explicit reviewer-approved class
for every test ID. The function stops on a missing or invalid classification:

```powershell
function Invoke-GateDPostCutoverNamDenialChecks {
  param([Parameter(Mandatory=$true)][string]$Prefix, [Parameter(Mandatory=$true)][hashtable]$ReviewedClasses)
  if (-not $script:GateDPositiveControlPass.ContainsKey($Prefix)) { throw "Matching controls have not passed for $Prefix" }
  $Common = @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
  $Profiles = @(
    (New-GateDForcedHostProfile "$Prefix-dev-http-v4" $Dev "http" 80 "/api/health" $Vps4Address),
    (New-GateDForcedHostProfile "$Prefix-dev-https-v4" $Dev "https" 443 "/api/health" $Vps4Address),
    (New-GateDForcedHostProfile "$Prefix-dev-http-v6" $Dev "http" 80 "/api/health" $Vps6Address),
    (New-GateDForcedHostProfile "$Prefix-dev-https-v6" $Dev "https" 443 "/api/health" $Vps6Address),
    (New-GateDForcedHostProfile "$Prefix-dev-http3-v4" $Dev "https" 443 "/api/health" $Vps4Address -Http3Only),
    (New-GateDForcedHostProfile "$Prefix-dev-http3-v6" $Dev "https" 443 "/api/health" $Vps6Address -Http3Only),
    (New-GateDForcedHostProfile "$Prefix-alt-http-v4" $Alt "http" 80 "/api/health" $Vps4Address),
    (New-GateDForcedHostProfile "$Prefix-alt-https-v4" $Alt "https" 443 "/api/health" $Vps4Address),
    (New-GateDForcedHostProfile "$Prefix-alt-http-v6" $Alt "http" 80 "/api/health" $Vps6Address),
    (New-GateDForcedHostProfile "$Prefix-alt-https-v6" $Alt "https" 443 "/api/health" $Vps6Address)
  )
  foreach ($Profile in $Profiles) {
    if (-not $ReviewedClasses.ContainsKey($Profile.TestId)) { throw "Missing reviewed class for $($Profile.TestId)" }
    $Result = Invoke-GateDCurlProbe -ProbeProfile $Profile -CurlArguments $Common
    Assert-GateDReviewedDenial $Result $ReviewedClasses[$Profile.TestId]
  }
}
```

Run matching positive controls and this strict denial set after UFW, then repeat
both with distinct `final` identifiers for acceptance. The Caddy checkpoint has
its own active-runtime semantic verification and need not pretend a generic
Caddy response is already host-level denial. The alternate hostname is forced
to the VPS; its preserved legacy destination remains untouched. Post-cutover
HTTP/3 denial must pass over both families, and the matching controls must still
pass.

### Direct TCP And Address Checks

```powershell
function Invoke-GateDDirectDenialChecks {
  param([Parameter(Mandatory=$true)][string]$ControlPrefix, [Parameter(Mandatory=$true)][hashtable]$ReviewedClasses)
  if (-not $script:GateDPositiveControlPass.ContainsKey($ControlPrefix)) { throw "Matching controls have not passed for direct checks" }
  $Targets = @(
    [pscustomobject]@{ Id="$ControlPrefix-tcp80-v4"; Family="IPv4"; Address=$Vps4Address; Port=80 },
    [pscustomobject]@{ Id="$ControlPrefix-tcp443-v4"; Family="IPv4"; Address=$Vps4Address; Port=443 },
    [pscustomobject]@{ Id="$ControlPrefix-tcp80-v6"; Family="IPv6"; Address=$Vps6Address; Port=80 },
    [pscustomobject]@{ Id="$ControlPrefix-tcp443-v6"; Family="IPv6"; Address=$Vps6Address; Port=443 }
  )
  $TcpResults = @()
  foreach ($Target in $Targets) {
    Assert-GateDOfficialTarget $Target.Address $Target.Family
    try {
      [bool]$Reachable = Test-NetConnection -ComputerName $Target.Address.ToString() -Port $Target.Port -InformationLevel Quiet -ErrorAction Stop
    } catch {
      throw "$($Target.Id) Test-NetConnection failed: $($_.Exception.GetType().Name)"
    }
    $TcpResults += [pscustomobject]@{
      Test=$Target.Id
      Time=[DateTime]::UtcNow.ToString("o")
      RequestedFamily=$Target.Family
      AttemptedTarget=$Target.Address.ToString()
      Port=$Target.Port
      Result=$Reachable
    }
    if ($Reachable -ne $false) { throw "$($Target.Id) remained reachable" }
  }
  if ($TcpResults.Count -ne 4 -or @($TcpResults | Where-Object { $_.Result -ne $false }).Count -ne 0) {
    throw "Direct TCP denial result set is incomplete or reachable"
  }
  $TcpResults | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidenceDir "$ControlPrefix-direct-tcp.json")

  foreach ($Profile in @(
    (New-GateDDirectAddressProfile "$ControlPrefix-direct-http-v4" "http" 80 "/" $Vps4Address),
    (New-GateDDirectAddressProfile "$ControlPrefix-direct-http-v6" "http" 80 "/" $Vps6Address)
  )) {
    if (-not $ReviewedClasses.ContainsKey($Profile.TestId)) { throw "Missing reviewed class for $($Profile.TestId)" }
    $Result = Invoke-GateDCurlProbe -ProbeProfile $Profile -CurlArguments @("--silent", "--show-error", "--connect-timeout", "5", "--max-time", "15")
    Assert-GateDReviewedDenial $Result $ReviewedClasses[$Profile.TestId]
  }
}
```

### Classifiable DNS Evidence

Do not use `-ErrorAction SilentlyContinue`, suppressed exceptions, or empty
output as DNS evidence. At execution time, first inspect the installed Windows
DNS tool and establish a reviewed command profile represented by:

`<VERIFIED_WINDOWS_DNS_QUERY_COMMAND_WITH_RCODE_AND_EXIT>`

The verified profile must record test identifier, UTC timestamp, numeric process
exit, queried resolver/name/type, response RCODE/status, and answer/authority
sections. For each authoritative and approved independent resolver, first run a
positive `alemany.me SOA` control and require `NOERROR` with a valid SOA answer.
Only then query `A`, `AAAA`, and `CNAME` for `dev.alemany.me` and
`nam.alemany.me`.

Each result must distinguish authoritative `NODATA` or `NXDOMAIN`, a valid
answer without the VPS address, timeout, refusal, unreachable resolver,
malformed response, and local tool failure. Do not guess PowerShell exception
identifiers. A failed control, timeout, refusal, unreachable resolver,
unclassifiable/empty response, malformed output, or client failure is a stop.
DNS acceptance requires both authenticated control-plane confirmation and
successful, classifiable authoritative and independent resolver responses after
the observed TTL; neither source alone is sufficient.

## Acceptance Matrix

| Check | Source and method | Expected result | Evidence to retain | Failure/rollback trigger |
| --- | --- | --- | --- | --- |
| Pinned curl identity | Exactly one `Application` result, absolute path, size, SHA-256, full version/help | One reviewed binary supports `--disable`, `--noproxy`, HTTP/3-only, and required metadata | Sanitized identity and restricted path/help | Ambiguous binary, identity drift, or missing option/field |
| External IPv4 control | Approved independent control through pinned direct curl profile | Exit `0`, approved status, TLS `0`, IPv4 negotiated | Version, hash, direct flag, timestamp, exits, status, TLS, family | Validator fails before or after cutover |
| External IPv6 control | Same forced to IPv6 | Exit `0`, approved status, TLS `0`, IPv6 negotiated | Same sanitized fields | Validator fails before or after cutover |
| HTTP/3 controls | Pinned `--http3-only` direct profile to approved control over each family | Exit `0`, approved status, TLS `0`, HTTP version `3`, no TCP fallback | Binary identity, family, version, exits, status | Either before/after family validator fails |
| Pre-cutover NAM TCP controls | Generated forced `dev` HTTP/HTTPS profiles over both validated literal targets | Exit `0`, exact redirect or NAM health payload, required family and observed target match, HTTPS TLS `0` | Restricted attempted/observed target profile and sanitized validated record | Any TCP path, profile, family, or observed target fails validation |
| Pre-cutover NAM UDP `443` | Generated forced HTTP/3 profiles after matching controls | Reviewed refusal/timeout, no HTTP response, both validated targets; empty `remote_ip` allowed | Controls plus attempted-target proof and any observed address | Any response, target/profile mismatch, invalid class, failed control, or missing family |
| `dev` public DNS | Authenticated control-plane result plus SOA-controlled authoritative and independent `A`, `AAAA`, `CNAME` queries | Classifiable response; no public record routes `dev` to VPS | Timestamp, numeric exit, RCODE, sanitized answer class | Control/query failure, unclassifiable result, or VPS answer after TTL |
| `nam` public DNS | Same controlled queries for `nam` | VPS `A` absent; unrelated legacy `CNAME` unchanged | Before/after RCODE, type, TTL, target class | Query/control failure, VPS `A` remains, or CNAME changed |
| Forced IPv4 HTTP | Generated profile with exact Host, port, scheme, URL, and validated VPS IPv4 target | Reviewed refusal/timeout; no HTTP response; observed address empty or exact match | ID/time, generated profile, attempted target, exits, status, observed address, error class | Any response, malformed/mismatched profile or target, or unqualified failure |
| Forced IPv4 HTTPS/SNI | Same with exact HTTPS hostname/SNI and validated VPS IPv4 target | Reviewed refusal/timeout; certificate/TLS error is not denial | Profile, attempted/observed target, exits, status, TLS result, error class | Response, target/SNI mismatch, TLS-only failure, or unqualified failure |
| Forced IPv6 HTTP | Generated profile with exact Host, port, scheme, URL, and validated VPS IPv6 target | Reviewed refusal/timeout; no response; observed address empty or exact match | Complete attempted/observed target record | Response, target/profile mismatch, or failed IPv6 control |
| Forced IPv6 HTTPS/SNI | Same with exact HTTPS hostname/SNI and validated VPS IPv6 target | Reviewed refusal/timeout; no response | Complete attempted/observed target and TLS record | Response, target/SNI mismatch, TLS-only failure, or failed IPv6 control |
| Redirect behavior | Forced HTTP for both hostnames and families | No HTTP response and therefore no redirect | Complete classified records | Any 3xx or other HTTP response |
| Direct IPv4 | Four-result TCP validator and generated direct URL from validated VPS IPv4 | TCP `80`/`443` exactly false; reviewed refusal/timeout; observed address empty or exact match | Attempted target/port booleans plus direct curl record | Tool error, incomplete set, target mismatch, reachable TCP, response, or failed control |
| Direct IPv6 | Same using validated VPS IPv6 | TCP `80`/`443` exactly false; reviewed refusal/timeout; observed address empty or exact match | Attempted target/port booleans plus direct curl record | Tool error, incomplete set, target mismatch, reachable TCP, response, or failed control |
| TCP `80` IPv4/IPv6 | Independent Windows TCP tests | Closed/filtered on both families | Timestamped booleans | Either family reachable |
| TCP `443` IPv4/IPv6 | Independent Windows TCP tests | Closed/filtered on both families | Timestamped booleans | Either family reachable |
| UDP `443`/QUIC IPv4 | Compare forced NAM before/after denial; matching controls pass both times | Reviewed refusal/timeout before and after; no response | Pinned binary, controls, both classified denials | Either response, fallback/uncertainty, or failed control |
| UDP `443`/QUIC IPv6 | Same over proven IPv6 | Reviewed refusal/timeout before and after; no response | Same controls and classified records | Response, missing evidence, or failed control |
| Alternate-host forced VPS path | Force `nam.alemany.me` to VPS over HTTP/HTTPS and both families | Reviewed refusal/timeout; TLS error alone insufficient | Complete classified records | VPS response or unqualified failure |
| Windows private access | Pinned direct profile; normal tailnet hostname, root, health, Day View | Every validator returns exit `0`, HTTP `200`, TLS `0` | Binary identity and per-route validated summary | Any validator fails |
| iPad cellular private access | Tailscale connected; root, health, Day View | Pages work without certificate warning | Time, network class, routes, result | Any private route fails |
| iPad without Tailscale | Disconnect Tailscale while remaining on cellular; retry private hostname only | Private NAM unavailable | Time and denial result | Private NAM remains reachable |
| Independent public SSH | Fresh dedicated-key login outside Tailscale; retain anchor session | Key-only non-root login and sudo membership confirmed | Sanitized auth method, hostname, UID/group result | Login fails or password/root path appears |
| App container and persistence identity | Compare the common sanitized before/after captures and checksums | Exactly one enumerated `nam/app/nam-app`; container, image, network attachment, restart count, and separately recorded configured and observed runtime loopback bindings match exactly; observed Docker mount count remains zero | Sanitized capture, checksums, and exact comparison | Any identity difference, extra project container, configured/runtime disagreement, or persistent Docker mount |
| PostgreSQL container and volume identity | Same capture plus exact `postgres-data` attachment | Exactly one enumerated `nam/postgres/nam-postgres`; container, image, network attachment, restart count, volume name, anchored driver/scope, mount destination, and attachment match exactly; configured and observed runtime host publication both remain absent | Sanitized capture, checksums, and exact comparison | Missing, ambiguous, or changed container, volume, mount, network, restart, or binding identity |
| Docker network identity | Targeted `nam-network` resource and attachment guards | Exact `nam-network` bridge ID; exactly the expected app and PostgreSQL container IDs with distinct nonempty endpoints on the same network ID | Sanitized network and attachment records | Missing, renamed, duplicate, additional, ambiguous, or changed resource or attachment |
| Persistence mutation boundary | Operator log and evidence review | Gate D performed no Docker, database, migration, upload, backup, or restore mutation; no claim of logical database equality | Sanitized command/deviation review | Any Gate D persistence mutation, unexpected topology, or need for one |
| Failure and rollback persistence | On every post-mutation failure, attempt failure/pre-rollback capture without blocking safety rollback; after rollback require post-rollback capture | Successful captures use the common schema and compare exactly with verified anchored before evidence; any unavailable or failed proof keeps Gate D failed | Conditional captures, checksums, comparisons, numeric pre-rollback results, and deviation record | Missing attempt, bypassed rollback comparison, inspection failure, mismatch, or unchanged-persistence claim without proof |
| Application/database ports | VPS `ss` plus configured and observed Docker runtime bindings | App configured and runtime maps both contain only `127.0.0.1:3000:3000`; PostgreSQL has no configured or runtime host publication | Sanitized listener/binding matrix with explicit binding source | Public `3000`/`5432`, configured/runtime disagreement, or changed binding |
| Tailscale Serve/Funnel | Compare filtered before/after status | Same tailnet-only proxy; Funnel disabled | Sanitized comparison | Serve changes or sharing enabled |
| Repository immutability | `git status --porcelain=v1`, HEAD, local refs, index check, Gate C ancestry | Exact authorized revision; clean worktree/index; Gate C ancestor | Command output | Dirty tree, identity change, or missing ancestry |

The normal public `nam.alemany.me` result may belong to the preserved legacy
destination. Gate D tests the forced VPS route and verifies removal of only the
VPS `A` record; it does not require the unrelated destination to be unavailable.

### Mandatory Failure/Pre-Rollback Persistence Attempt

After the first Gate D mutation, every failure path must attempt one unique
`failure-pre-rollback` capture before rollback whenever the operator shell and
Docker inspection remain usable. This applies to Caddy, UFW, DNS, acceptance,
client, interruption, recovery/re-entry, and unexpected-state failures. The
common function first verifies the anchored before evidence, validates the live
topology in memory, and creates a sanitized output and checksum only on complete
success.

Run this block before rollback. It deliberately completes with status zero so a
failed inspection cannot block the minimum safety rollback. The initialized
result variable is evidence state for the operator log, not authorization to
continue the cutover:

```bash
GATE_D_PERSISTENCE_PRE_ROLLBACK_VERIFIED=0
GATE_D_PERSISTENCE_PRE_ROLLBACK_CAPTURE_EXIT=125
GATE_D_PERSISTENCE_PRE_ROLLBACK_CHECKSUM_EXIT=125
GATE_D_PERSISTENCE_PRE_ROLLBACK_COMPARE_EXIT=125
case "$-" in
  *e*) GATE_D_PERSISTENCE_PRE_ROLLBACK_ERREXIT_WAS_SET=1 ;;
  *) GATE_D_PERSISTENCE_PRE_ROLLBACK_ERREXIT_WAS_SET=0 ;;
esac
set +e
capture_gate_d_persistence_identity failure-pre-rollback
GATE_D_PERSISTENCE_PRE_ROLLBACK_CAPTURE_EXIT=$?
if test "$GATE_D_PERSISTENCE_PRE_ROLLBACK_CAPTURE_EXIT" -eq 0; then
  verify_gate_d_persistence_phase failure-pre-rollback
  GATE_D_PERSISTENCE_PRE_ROLLBACK_CHECKSUM_EXIT=$?
  compare_gate_d_persistence_with_before failure-pre-rollback
  GATE_D_PERSISTENCE_PRE_ROLLBACK_COMPARE_EXIT=$?
fi
if test "$GATE_D_PERSISTENCE_PRE_ROLLBACK_ERREXIT_WAS_SET" -eq 1; then
  set -e
else
  set +e
fi
if test "$GATE_D_PERSISTENCE_PRE_ROLLBACK_CAPTURE_EXIT" -eq 0 && \
   test "$GATE_D_PERSISTENCE_PRE_ROLLBACK_CHECKSUM_EXIT" -eq 0 && \
   test "$GATE_D_PERSISTENCE_PRE_ROLLBACK_COMPARE_EXIT" -eq 0; then
  GATE_D_PERSISTENCE_PRE_ROLLBACK_VERIFIED=1
  printf '%s\n' 'Gate D persistence identity matched before rollback.' >&2
else
  printf '%s\n' \
    'Gate D persistence identity was not proven before rollback; continue minimum safety rollback, keep Gate D failed, and make no unchanged-persistence claim.' \
    >&2
fi
true
```

If interruption requires a new session, complete the recovery-directory,
anchored-before, checkpoint, Caddy, SSH, and `reentry` validations first when
they are available. A failed or unavailable re-entry or failure/pre-rollback
capture prohibits forward cutover work but must not prevent the minimum
authorized safety rollback. Record all four numeric results above, or record why
the attempt was operationally unavailable. In either case Gate D remains failed.

## Rollback

Rollback is never automatic. After cutover begins, a private-path failure may
coexist with an old Caddy runtime or another public bypass; determine the actual
state and do not label it fail-closed without complete denial evidence. Keep the
recovery anchor open. The owner must explicitly decide whether to recover the
private path in place or intentionally restore the pre-cutover public
development route. Do not enter confidential data before Gate D acceptance.

If intentional rollback is authorized, first complete or attempt the mandatory
failure/pre-rollback block above, then restore only Gate D changes in this order.

### R1: Restore The Verified Caddyfile

First inspect and record whether the active runtime and persistent file contain
the before-state or candidate. Do not run a blind rollback. Revalidate the exact
systemd/reload commands and recovery-directory continuity, then verify and adapt
the before-state:

```bash
test "$(sudo sha256sum "$GATE_D_RECOVERY_DIR/Caddyfile.before" | awk '{print $1}')" = \
  "$(cat "$GATE_D_RECOVERY_DIR/Caddyfile.backup.sha256")"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.acl"
cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs" \
  "$GATE_D_RECOVERY_DIR/Caddyfile.backup.xattrs"
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" adapt \
  --config "$GATE_D_RECOVERY_DIR/Caddyfile.before" --adapter caddyfile \
  --pretty > "$GATE_D_RECOVERY_DIR/caddy-before.rollback.adapted.json"
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config "$GATE_D_RECOVERY_DIR/Caddyfile.before" --adapter caddyfile
```

Run the reviewed `<VERIFIED_CADDY_RELOAD_COMMAND_USING_BEFORE_STATE>`, then use
the verified active-config export and normalization method to prove the exact
before-state is active. If reload or verification fails, stop and record the
actual runtime; do not assume either public availability or denial.

Only after the before-state is proven active, persist it atomically with the
captured standard metadata:

```bash
read -r CADDY_UID CADDY_GID CADDY_MODE \
  < "$GATE_D_RECOVERY_DIR/Caddyfile.before.stat"
test ! -s "$GATE_D_RECOVERY_DIR/Caddyfile.before.xattrs"
test "$(grep -Ec '^(user::|group::|other::)' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl")" -eq 3
test "$(awk 'NF {count++} END {print count+0}' \
  "$GATE_D_RECOVERY_DIR/Caddyfile.before.acl")" -eq 3
sudo install --owner="$CADDY_UID" --group="$CADDY_GID" \
  --mode="$CADDY_MODE" "$GATE_D_RECOVERY_DIR/Caddyfile.before" \
  /etc/caddy/Caddyfile.gate-d.rollback
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config /etc/caddy/Caddyfile.gate-d.rollback --adapter caddyfile
sudo mv --force -- /etc/caddy/Caddyfile.gate-d.rollback /etc/caddy/Caddyfile
sudo cmp --silent "$GATE_D_RECOVERY_DIR/Caddyfile.before" \
  /etc/caddy/Caddyfile
test "$(sudo stat -c %u /etc/caddy/Caddyfile)" = "$CADDY_UID"
test "$(sudo stat -c %g /etc/caddy/Caddyfile)" = "$CADDY_GID"
test "$(sudo stat -c %a /etc/caddy/Caddyfile)" = "$CADDY_MODE"
sudo "<VERIFIED_ABSOLUTE_CADDY_BINARY>" validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile
```

Run the verified persistent-config `ExecReload` form and prove active runtime,
persistent checksum, owner, group, mode, ACL, and extended attributes match the
captured before-state. Handle any runtime/disk mismatch immediately and do not
continue. Never restart or stop Caddy. Do not restore, delete, or otherwise
modify Caddy certificate/storage material. Recheck private access and SSH before
continuing.

### R2: Restore Only The Removed UFW Allows

These commands are valid only when preflight proved that they exactly recreate
the original simple paired IPv4/IPv6 rules:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status verbose
sudo ufw status numbered
```

Do not touch TCP `22`, UDP `443`, defaults, Docker chains, or unrelated rules.
If the original rules were not exact simple allows, do not use these commands;
stop and require a reviewed rollback specific to the captured rules.

### R3: Restore Only The Removed VPS DNS Records

In the Namecheap control plane:

1. Restore the exact captured `dev` VPS `A` value and TTL.
2. Restore the exact captured `nam` VPS `A` value and TTL only if that record was
   removed by Gate D.
3. Leave the legacy `nam` `CNAME` and every unrelated record unchanged.
4. Wait the authoritative TTL and verify both authoritative servers and
   independent resolvers.

### R4: Verify Rollback

After Caddy, UFW, DNS, and access recovery actions are complete, create a new
non-overwriting `post-rollback` capture with the common sanitized schema. The
function verifies the anchored before evidence before inspection. Verify the
new checksum and compare the new snapshot exactly with that anchored before
snapshot:

```bash
capture_gate_d_persistence_identity post-rollback
verify_gate_d_persistence_phase post-rollback
compare_gate_d_persistence_with_before post-rollback
```

If capture, checksum validation, or comparison fails, rollback verification is
incomplete, Gate D remains failed, and no unchanged-persistence claim may be
made. Safety rollback actions already completed must not be reversed merely to
retry this inspection.

Prove:

- the recovery anchor and a fresh independent key-only SSH login work;
- Tailscale private access remains unchanged;
- intentionally restored public behavior matches the captured pre-state;
- app, PostgreSQL, volume, mount, network, restart-count, and configured and
  observed runtime binding identities are unchanged;
- Caddyfile ownership, mode, and checksum match the captured pre-state;
- only the intended UFW and DNS records were restored; and
- Gate D performed no Docker, database, migration, upload, backup, or restore
  mutation; and
- no Gate D container, certificate-storage, or unrelated-configuration mutation
  occurred.

Record the reason, decision authority, commands, results, and deviations.
Rollback means Gate D execution did not pass.

## Evidence Bundle

An authorized execution must produce a restricted raw bundle outside Git and a
concise sanitized review record. Record:

- UTC start/end timestamps, operator, DNS operator, external clients, and
  reviewer;
- authorized repository revision and clean-state result;
- before/after Caddy persistent identity, metadata, active-runtime identity,
  reload-command identity, and sanitized route summary;
- before/after UFW, nftables/Docker-chain, and listener summaries for only the
  relevant ports and address families;
- authenticated DNS control-plane confirmation, authoritative and independent
  resolver control/query exits and RCODE classes, TTL wait, and exact record
  changes;
- pinned curl filename, size, SHA-256, version/features, direct/no-config/no-proxy
  enforcement, and pre/post IPv4/IPv6/HTTP3 positive controls;
- validated pre-cutover NAM TCP-positive results, verified before/after NAM UDP
  `443` denials, and every forced-address, SNI, direct-address, redirect, and TCP
  test identifier, timestamp, requested family, exact attempted target, hostname,
  port, protocol, SNI hostname, generated forced-address profile, numeric
  native/curl exit, status, TLS result, observed address when supplied,
  negotiated family/version, and reviewed sanitized error class;
- Windows and iPad private-access results;
- independent recovery SSH result, Match-aware effective-policy result, and
  confirmation that the anchor remained open;
- before/after selected app, PostgreSQL, immutable image, allowlisted Compose
  project/service, volume, mount, network resource/attachments, configured and
  observed runtime binding, restart-count, Tailscale, and Git comparisons,
  including proof that the observed application Docker mount set remained empty
  and `postgres-data` remained unambiguously attached;
- every applicable persistence output and checksum: `before` for every run;
  normal `after` for a no-rollback completion path; `reentry` after
  interruption; and `failure-pre-rollback` plus `post-rollback` for any rollback
  path, including the numeric pre-rollback capture, checksum, and comparison
  results or an explicit reason the attempt was unavailable;
- every command exit, stop, deviation, unexpected observation, and rollback
  action; and
- explicit confirmation that Gate D performed no Docker, database, migration,
  upload, backup, or restore mutation, and that no deployment, container,
  Tailscale, SSH, provider-firewall, or pilot mutation occurred.

The persistence record proves selected resource identity and, together with the
command/deviation review, supports the conclusion that Gate D performed no
Docker, database, migration, upload, backup, or restore mutation. It does not
prove logical, row-level, or byte-for-byte database equality; normal application
activity may change PostgreSQL contents. If media storage, external object
storage, or another persistence mechanism is implemented later, this procedure
requires a new persistence baseline and relevant re-audit before reuse.

Do not capture or include credentials, private/public key material, tokens,
cookies, database URLs, environment values, raw mount sources, volume
mountpoints, volume options, unrestricted labels, unrestricted Docker inspect
output, complete public or tailnet addresses, full firewall dumps, raw Caddy
configuration, unrelated DNS/configuration, or Caddy certificate/storage
contents in repository evidence.

## Governance Boundary

- Procedure execution would create evidence for Gate D review; it would not
  accept Gate D automatically.
- Gate D remains unexecuted and unauthorized until a separate execution
  decision is recorded.
- Acceptance requires independent review of every matrix row and an explicit
  owner/architect decision.
- This procedure does not satisfy broader final Access Gate requirements such
  as reboot, Docker-restart persistence, device revocation/re-enrollment,
  emergency disablement, or post-deployment eleven-contributor coverage unless
  current authority separately assigns and accepts them.
- Gate D acceptance would not authorize Gate E, deployment, database work,
  confidential operational use, or controlled-pilot execution.
- No gate implicitly authorizes another gate. Phase 29 has not been assigned.
