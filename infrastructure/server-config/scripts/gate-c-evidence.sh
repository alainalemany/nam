#!/usr/bin/env bash

# Gate C evidence primitives. This file is sourced by the reviewed procedure;
# it performs no deployment, Docker, database, network, or host mutation.

gatec_error() {
  printf 'gate-c evidence error: %s\n' "$*" >&2
}

gatec_validate_leaf() {
  local leaf=${1-}
  [[ "$leaf" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || {
    gatec_error "unsafe evidence leaf: $leaf"
    return 1
  }
}

gatec_assert_directory_metadata() {
  local path=$1
  test -d "$path" && test ! -L "$path" || {
    gatec_error "not a real directory: $path"
    return 1
  }
  test "$(stat -c '%F|%U:%G|%a' -- "$path")" = \
    'directory|alain:alain|700' || {
    gatec_error "directory owner or mode mismatch: $path"
    return 1
  }
}

gatec_assert_file_metadata() {
  local path=$1
  test -f "$path" && test ! -L "$path" || {
    gatec_error "not a real regular file: $path"
    return 1
  }
  test "$(stat -c '%U:%G|%a' -- "$path")" = 'alain:alain|600' || {
    gatec_error "file owner or mode mismatch: $path"
    return 1
  }
  test "$(stat -c '%h' -- "$path")" -eq 1 || {
    gatec_error "evidence file has multiple hard links: $path"
    return 1
  }
}

# Open with O_NOFOLLOW, hash through the descriptor, and prove that the path
# still names the same unchanged regular file. The record binds content to
# device, inode, mode, link count, owner, size, mtime, and ctime.
gatec_stable_file_record() {
  local path=$1
  perl -MDigest::SHA -MTime::HiRes -MFcntl=:DEFAULT,:mode -e '
    use strict;
    use warnings;
    my ($path) = @ARGV;
    sysopen(my $fh, $path, O_RDONLY | O_NOFOLLOW) or die "open: $!\n";
    my @before = Time::HiRes::stat($fh);
    @before && S_ISREG($before[2]) or die "not regular\n";
    $before[3] == 1 or die "multiple hard links\n";
    my $sha = Digest::SHA->new(256);
    $sha->addfile($fh);
    my $digest = $sha->hexdigest;
    my @after = Time::HiRes::stat($fh);
    my @path_stat = Time::HiRes::lstat($path);
    @after && @path_stat or die "stat: $!\n";
    S_ISREG($path_stat[2]) or die "path not regular\n";
    my @bound = (0, 1, 2, 3, 4, 5, 7, 9, 10);
    for my $index (@bound) {
      $before[$index] eq $after[$index] or die "changed while hashing\n";
      $after[$index] eq $path_stat[$index] or die "path identity changed\n";
    }
    printf "%s|%d|%d|%o|%d|%d|%d|%d|%.9f|%.9f\n",
      $digest, @after[0, 1, 2, 3, 4, 5, 7, 9, 10];
  ' -- "$path"
}

gatec_create_evidence_directory() {
  local parent=$1
  local prefix=$2
  local created

  test -d "$parent" && test ! -L "$parent" || {
    gatec_error "invalid evidence parent: $parent"
    return 1
  }
  test "$(stat -c '%U:%G' -- "$parent")" = 'alain:alain' || {
    gatec_error "evidence parent owner mismatch: $parent"
    return 1
  }
  [[ "$prefix" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || {
    gatec_error "unsafe evidence prefix: $prefix"
    return 1
  }

  created=$(mktemp -d --tmpdir="$parent" "$prefix.XXXXXXXXXX") || return 1
  chmod 0700 -- "$created" || return 1
  gatec_assert_directory_metadata "$created" || return 1
  test "$(dirname -- "$created")" = "$parent" || return 1
  printf '%s\n' "$created"
}

gatec_assert_evidence_directory() {
  : "${EVIDENCE_PARENT:?EVIDENCE_PARENT is required}"
  : "${EVIDENCE_DIR:?EVIDENCE_DIR is required}"

  test -d "$EVIDENCE_PARENT" && test ! -L "$EVIDENCE_PARENT" || {
    gatec_error "invalid evidence parent"
    return 1
  }
  test "$(stat -c '%U:%G' -- "$EVIDENCE_PARENT")" = 'alain:alain' || {
    gatec_error "evidence parent owner mismatch"
    return 1
  }
  gatec_assert_directory_metadata "$EVIDENCE_DIR" || return 1
  test "$(dirname -- "$EVIDENCE_DIR")" = "$EVIDENCE_PARENT" || {
    gatec_error "evidence directory is outside its parent"
    return 1
  }
  test "$(realpath -e -- "$EVIDENCE_DIR")" = "$EVIDENCE_DIR" || {
    gatec_error "evidence directory is not canonical"
    return 1
  }
  if test -n "${EVIDENCE_DIR_ID:-}"; then
    test "$(stat -c '%d:%i' -- "$EVIDENCE_DIR")" = "$EVIDENCE_DIR_ID" || {
      gatec_error "evidence directory identity changed"
      return 1
    }
  fi
}

gatec_target_path() {
  local leaf=$1
  gatec_validate_leaf "$leaf" || return 1
  gatec_assert_evidence_directory || return 1
  printf '%s/%s\n' "$EVIDENCE_DIR" "$leaf"
}

gatec_assert_absent_leaf() {
  local leaf=$1
  local target
  target=$(gatec_target_path "$leaf") || return 1
  test ! -e "$target" && test ! -L "$target" || {
    gatec_error "evidence leaf already exists: $leaf"
    return 1
  }
}

gatec_capture() {
  local leaf=$1
  shift
  local target status

  target=$(gatec_target_path "$leaf") || return 1
  test ! -e "$target" && test ! -L "$target" || {
    gatec_error "refusing to reuse evidence leaf: $leaf"
    return 1
  }

  ( set -o noclobber; umask 077; "$@" >"$target" 2>&1 )
  status=$?
  gatec_assert_evidence_directory || return 1
  chmod 0600 -- "$target" || return 1
  gatec_assert_file_metadata "$target" || return 1
  return "$status"
}

gatec_capture_sorted() {
  local leaf=$1
  shift
  local target status

  target=$(gatec_target_path "$leaf") || return 1
  test ! -e "$target" && test ! -L "$target" || {
    gatec_error "refusing to reuse evidence leaf: $leaf"
    return 1
  }

  (
    set -o noclobber
    set -o pipefail
    umask 077
    "$@" 2>&1 | sed '/^$/d' | LC_ALL=C sort >"$target"
  )
  status=$?
  gatec_assert_evidence_directory || return 1
  chmod 0600 -- "$target" || return 1
  gatec_assert_file_metadata "$target" || return 1
  return "$status"
}

gatec_synthetic_hook_allowed() {
  test "${GATEC_SYNTHETIC_TESTING:-0}" = 1 || return 1
  case "${EVIDENCE_PARENT:-}" in
    /tmp/nam-gate-c-evidence-test.*) return 0 ;;
    *) return 1 ;;
  esac
}

# Capture a mutation command while persisting command outcome independently
# from evidence finalization. Callers must classify the two exact status files;
# the function return alone is deliberately insufficient for mutation policy.
gatec_capture_with_status() {
  local output_leaf=$1
  local command_status_leaf=$2
  local capture_status_leaf=$3
  shift 3
  local output_path command_status capture_status=0

  gatec_assert_absent_leaf "$output_leaf" || return 1
  gatec_assert_absent_leaf "$command_status_leaf" || return 1
  gatec_assert_absent_leaf "$command_status_leaf.sha256" || return 1
  gatec_assert_absent_leaf "$capture_status_leaf" || return 1
  gatec_assert_absent_leaf "$capture_status_leaf.sha256" || return 1
  output_path=$(gatec_target_path "$output_leaf") || return 1

  ( set -o noclobber; umask 077; "$@" >"$output_path" 2>&1 )
  command_status=$?
  gatec_create_checkpoint "$command_status_leaf" "$command_status_leaf.sha256" \
    'status_contract_version=1' \
    "command_exit_status=$command_status" || return 1

  if gatec_synthetic_hook_allowed \
    && test "${GATEC_SYNTHETIC_FAIL_CAPTURE_FINALIZATION:-0}" = 1; then
    capture_status=97
  else
    gatec_assert_evidence_directory || capture_status=98
    if test "$capture_status" -eq 0; then
      chmod 0600 -- "$output_path" || capture_status=99
    fi
    if test "$capture_status" -eq 0; then
      gatec_assert_file_metadata "$output_path" || capture_status=100
    fi
  fi

  # This second status is best-effort when directory integrity itself failed.
  gatec_create_checkpoint "$capture_status_leaf" "$capture_status_leaf.sha256" \
    'status_contract_version=1' \
    "capture_integrity_status=$capture_status" || return 125
  GATEC_LAST_COMMAND_STATUS=$command_status
  GATEC_LAST_CAPTURE_STATUS=$capture_status
  export GATEC_LAST_COMMAND_STATUS GATEC_LAST_CAPTURE_STATUS
  test "$capture_status" -eq 0 || return 125
  return "$command_status"
}

gatec_validate_capture_statuses() {
  local command_status_leaf=$1
  local capture_status_leaf=$2
  gatec_validate_checkpoint_pair "$command_status_leaf" \
    "$command_status_leaf.sha256" command_exit_status \
    status_contract_version || return 1
  gatec_validate_checkpoint_pair "$capture_status_leaf" \
    "$capture_status_leaf.sha256" capture_integrity_status \
    status_contract_version || return 1
  gatec_checkpoint_expect "$command_status_leaf" status_contract_version 1 || return 1
  gatec_checkpoint_expect "$capture_status_leaf" status_contract_version 1 || return 1
  [[ "$(gatec_checkpoint_value "$command_status_leaf" command_exit_status)" =~ ^[0-9]+$ ]] || return 1
  [[ "$(gatec_checkpoint_value "$capture_status_leaf" capture_integrity_status)" =~ ^[0-9]+$ ]] || return 1
}

gatec_classify_mutation_status() {
  local command_status=$1
  local capture_status=$2
  [[ "$command_status" =~ ^[0-9]+$ && "$capture_status" =~ ^[0-9]+$ ]] || return 1
  if test "$capture_status" -ne 0; then
    printf '%s\n' ESCALATION_REQUIRED
  elif test "$command_status" -ne 0; then
    printf '%s\n' COMMAND_FAILED
  else
    printf '%s\n' COMMAND_SUCCEEDED
  fi
}

gatec_note() {
  local leaf=$1
  shift
  local value
  for value in "$@"; do
    [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || {
      gatec_error "multiline note value rejected"
      return 1
    }
  done
  gatec_capture "$leaf" printf '%s\n' "$@"
}

gatec_require_nonempty_file() {
  local leaf=$1
  local target
  target=$(gatec_target_path "$leaf") || return 1
  gatec_assert_file_metadata "$target" || return 1
  test -s "$target" || {
    gatec_error "evidence contract requires nonempty output: $leaf"
    return 1
  }
}

gatec_file_sha256() {
  local leaf=$1
  local target
  target=$(gatec_target_path "$leaf") || return 1
  gatec_assert_file_metadata "$target" || return 1
  gatec_stable_file_record "$target" | cut -d'|' -f1
}

gatec_validate_checkpoint_pair() {
  local state_leaf=$1
  local checksum_leaf=$2
  shift 2
  local state_path checksum_path expected_line actual_hash
  local state_before state_after checksum_before checksum_after
  local actual_keys required_keys line

  state_path=$(gatec_target_path "$state_leaf") || return 1
  checksum_path=$(gatec_target_path "$checksum_leaf") || return 1
  gatec_assert_file_metadata "$state_path" || return 1
  gatec_assert_file_metadata "$checksum_path" || return 1

  state_before=$(gatec_stable_file_record "$state_path") || return 1
  checksum_before=$(gatec_stable_file_record "$checksum_path") || return 1
  actual_hash=${state_before%%|*}
  expected_line="$actual_hash  $state_leaf"
  test "$(wc -l < "$checksum_path")" -eq 1 || {
    gatec_error "checkpoint checksum must contain exactly one line"
    return 1
  }
  test "$(cat -- "$checksum_path")" = "$expected_line" || {
    gatec_error "checkpoint checksum mismatch"
    return 1
  }

  LC_ALL=C sort -c -u -- "$state_path" 2>/dev/null || {
    gatec_error "checkpoint is not sorted and unique"
    return 1
  }
  while IFS= read -r line; do
    [[ "$line" =~ ^[a-z][a-z0-9_]*=[A-Za-z0-9_./:@,+-]+$ ]] || {
      gatec_error "unsafe checkpoint record"
      return 1
    }
  done < "$state_path"

  actual_keys=$(cut -d= -f1 -- "$state_path" | LC_ALL=C sort)
  required_keys=$(printf '%s\n' "$@" | LC_ALL=C sort)
  test "$actual_keys" = "$required_keys" || {
    gatec_error "checkpoint schema mismatch"
    return 1
  }
  state_after=$(gatec_stable_file_record "$state_path") || return 1
  checksum_after=$(gatec_stable_file_record "$checksum_path") || return 1
  test "$state_before" = "$state_after" \
    && test "$checksum_before" = "$checksum_after" || {
    gatec_error "checkpoint changed during validation"
    return 1
  }
}

gatec_create_checkpoint() {
  local state_leaf=$1
  local checksum_leaf=$2
  shift 2
  local state_path checksum_path status line

  gatec_assert_absent_leaf "$state_leaf" || return 1
  gatec_assert_absent_leaf "$checksum_leaf" || return 1
  for line in "$@"; do
    [[ "$line" =~ ^[a-z][a-z0-9_]*=[A-Za-z0-9_./:@,+-]+$ ]] || {
      gatec_error "unsafe checkpoint record"
      return 1
    }
  done
  test "$(printf '%s\n' "$@" | cut -d= -f1 | LC_ALL=C sort -u | wc -l)" -eq "$#" || {
    gatec_error "duplicate checkpoint key"
    return 1
  }

  state_path=$(gatec_target_path "$state_leaf") || return 1
  (
    set -o noclobber
    umask 077
    printf '%s\n' "$@" | LC_ALL=C sort >"$state_path"
  )
  status=$?
  test "$status" -eq 0 || return "$status"
  gatec_assert_evidence_directory || return 1
  chmod 0600 -- "$state_path" || return 1
  gatec_assert_file_metadata "$state_path" || return 1

  checksum_path=$(gatec_target_path "$checksum_leaf") || return 1
  (
    set -o noclobber
    umask 077
    cd -- "$EVIDENCE_DIR" || exit 1
    sha256sum -- "$state_leaf" >"$checksum_leaf"
  )
  status=$?
  test "$status" -eq 0 || return "$status"
  gatec_assert_evidence_directory || return 1
  chmod 0600 -- "$checksum_path" || return 1
  gatec_assert_file_metadata "$checksum_path" || return 1
}

gatec_checkpoint_value() {
  local state_leaf=$1
  local key=$2
  local state_path
  [[ "$key" =~ ^[a-z][a-z0-9_]*$ ]] || return 1
  state_path=$(gatec_target_path "$state_leaf") || return 1
  gatec_assert_file_metadata "$state_path" || return 1
  perl -MTime::HiRes -MFcntl=:DEFAULT,:mode -e '
    use strict;
    use warnings;
    my ($path, $key) = @ARGV;
    sysopen(my $fh, $path, O_RDONLY | O_NOFOLLOW) or die "open: $!\n";
    my @before = Time::HiRes::stat($fh);
    @before && S_ISREG($before[2]) && $before[3] == 1 or die "invalid file\n";
    local $/;
    my $content = <$fh>;
    defined($content) or $content = "";
    my @after = Time::HiRes::stat($fh);
    my @path_stat = Time::HiRes::lstat($path);
    for my $index (0, 1, 2, 3, 4, 5, 7, 9, 10) {
      $before[$index] eq $after[$index] or die "changed while reading\n";
      $after[$index] eq $path_stat[$index] or die "path changed\n";
    }
    my @values = map { substr($_, length($key) + 1) }
      grep { index($_, "$key=") == 0 } split(/\n/, $content, -1);
    @values == 1 or die "checkpoint key missing or duplicated: $key\n";
    $values[0] !~ /[\r\n]/ or die "invalid value\n";
    print "$values[0]\n";
  ' -- "$state_path" "$key" || {
    gatec_error "checkpoint key read failed: $key"
    return 1
  }
}

gatec_checkpoint_expect() {
  local state_leaf=$1
  local key=$2
  local expected=$3
  local actual
  actual=$(gatec_checkpoint_value "$state_leaf" "$key") || return 1
  test "$actual" = "$expected" || {
    gatec_error "checkpoint value mismatch: $key"
    return 1
  }
}

gatec_checkpoint_expect_file_hash() {
  local state_leaf=$1
  local key=$2
  local evidence_leaf=$3
  local expected actual
  expected=$(gatec_checkpoint_value "$state_leaf" "$key") || return 1
  actual=$(gatec_file_sha256 "$evidence_leaf") || return 1
  test "$actual" = "$expected" || {
    gatec_error "checkpoint file hash mismatch: $evidence_leaf"
    return 1
  }
}

gatec_validate_deadline() {
  local mutation_epoch=$1
  local deadline_epoch=$2
  local received_epoch=$3
  local current_epoch=$4
  local value

  for value in "$mutation_epoch" "$deadline_epoch" "$received_epoch" "$current_epoch"; do
    [[ "$value" =~ ^[0-9]+$ ]] || {
      gatec_error "deadline value is not an epoch"
      return 1
    }
  done
  test "$deadline_epoch" -eq $((mutation_epoch + 900)) || {
    gatec_error "checkpoint deadline is not exactly 15 minutes"
    return 1
  }
  test "$received_epoch" -ge "$mutation_epoch" || {
    gatec_error "client evidence predates mutation"
    return 1
  }
  test "$received_epoch" -le "$deadline_epoch" || {
    gatec_error "client evidence was received after the deadline"
    return 1
  }
  test "$current_epoch" -le "$deadline_epoch" || {
    gatec_error "resume occurred after the deadline"
    return 1
  }
  test "$received_epoch" -le "$current_epoch" || {
    gatec_error "client receipt time is in the future"
    return 1
  }
}

gatec_validate_checkpoint_checksum_only() {
  local state_leaf=$1
  local checksum_leaf=$2
  local checksum_path expected before after
  gatec_validate_leaf "$state_leaf" || return 1
  gatec_validate_leaf "$checksum_leaf" || return 1
  checksum_path=$(gatec_target_path "$checksum_leaf") || return 1
  gatec_assert_file_metadata "$checksum_path" || return 1
  before=$(gatec_stable_file_record "$checksum_path") || return 1
  test "$(wc -l < "$checksum_path")" -eq 1 || return 1
  expected="$(gatec_file_sha256 "$state_leaf")  $state_leaf" || return 1
  test "$(cat -- "$checksum_path")" = "$expected" || {
    gatec_error "checkpoint checksum mismatch: $state_leaf"
    return 1
  }
  after=$(gatec_stable_file_record "$checksum_path") || return 1
  test "$before" = "$after" || {
    gatec_error "checkpoint checksum changed during validation"
    return 1
  }
}

gatec_validate_client_evidence() {
  local state_leaf=$1
  local checksum_leaf=$2
  gatec_validate_checkpoint_pair "$state_leaf" "$checksum_leaf" \
    authentication_boundary client client_contract_version deadline_epoch \
    equipment_new_read_only media_photo_boundary predecessor_state \
    private_tailscale_health public_https_denial received_epoch received_utc \
    source_checkpoint_checksum_leaf source_checkpoint_checksum_sha256 \
    source_checkpoint_leaf source_checkpoint_sha256 || return 1
  gatec_checkpoint_expect "$state_leaf" client_contract_version 1 || return 1
  gatec_checkpoint_expect "$state_leaf" client darnassus || return 1
  gatec_checkpoint_expect "$state_leaf" predecessor_state FRESH_SHELL_RESUME || return 1
  local result
  for result in authentication_boundary equipment_new_read_only \
    media_photo_boundary private_tailscale_health public_https_denial; do
    case "$(gatec_checkpoint_value "$state_leaf" "$result")" in
      PASS|FAIL) ;;
      *) gatec_error "invalid client result: $result"; return 1 ;;
    esac
  done
}

gatec_validate_runtime_bindings() {
  local state_leaf=$1
  local checksum_leaf=$2
  gatec_validate_checkpoint_pair "$state_leaf" "$checksum_leaf" \
    app_identity_leaf app_identity_sha256 app_topology_leaf \
    app_topology_sha256 captured_epoch expected_state local_health_leaf \
    local_health_sha256 network_members_leaf network_members_sha256 \
    network_static_leaf network_static_sha256 postgres_full_leaf \
    postgres_full_sha256 project_containers_leaf project_containers_sha256 \
    project_networks_leaf project_networks_sha256 project_volumes_leaf \
    project_volumes_sha256 runtime_bindings_version \
    source_checkpoint_checksum_leaf source_checkpoint_checksum_sha256 \
    source_checkpoint_leaf source_checkpoint_sha256 volume_static_leaf \
    volume_static_sha256 || return 1
  gatec_checkpoint_expect "$state_leaf" runtime_bindings_version 1 || return 1
  local prefix leaf hash source source_checksum
  source=$(gatec_checkpoint_value "$state_leaf" source_checkpoint_leaf) || return 1
  source_checksum=$(gatec_checkpoint_value "$state_leaf" source_checkpoint_checksum_leaf) || return 1
  gatec_validate_checkpoint_checksum_only "$source" "$source_checksum" || return 1
  gatec_checkpoint_expect "$state_leaf" source_checkpoint_sha256 \
    "$(gatec_file_sha256 "$source")" || return 1
  gatec_checkpoint_expect "$state_leaf" source_checkpoint_checksum_sha256 \
    "$(gatec_file_sha256 "$source_checksum")" || return 1
  for prefix in app_identity app_topology local_health network_members \
    network_static postgres_full project_containers project_networks \
    project_volumes volume_static; do
    leaf=$(gatec_checkpoint_value "$state_leaf" "${prefix}_leaf") || return 1
    hash=$(gatec_checkpoint_value "$state_leaf" "${prefix}_sha256") || return 1
    gatec_validate_leaf "$leaf" || return 1
    test "$(gatec_file_sha256 "$leaf")" = "$hash" || {
      gatec_error "runtime binding mismatch: $leaf"
      return 1
    }
  done
  [[ "$(gatec_checkpoint_value "$state_leaf" captured_epoch)" =~ ^[0-9]+$ ]] || return 1
}

gatec_validate_state_transition() {
  local state_leaf=$1
  local checksum_leaf=$2
  gatec_validate_checkpoint_pair "$state_leaf" "$checksum_leaf" \
    execution_state predecessor_state runtime_bindings_checksum_leaf \
    runtime_bindings_checksum_sha256 runtime_bindings_leaf \
    runtime_bindings_sha256 source_checkpoint_checksum_leaf \
    source_checkpoint_checksum_sha256 source_checkpoint_leaf \
    source_checkpoint_sha256 state_contract_version transition_epoch || return 1
  gatec_checkpoint_expect "$state_leaf" state_contract_version 1 || return 1
  local execution predecessor source source_checksum runtime runtime_checksum
  execution=$(gatec_checkpoint_value "$state_leaf" execution_state) || return 1
  predecessor=$(gatec_checkpoint_value "$state_leaf" predecessor_state) || return 1
  case "$execution:$predecessor" in
    FRESH_SHELL_RESUME:AWAITING_CLIENT_EVIDENCE) ;;
    ROLLBACK_DECISION_POINT:MUTATION_COMPLETED) ;;
    *) gatec_error "invalid state transition: $predecessor -> $execution"; return 1 ;;
  esac
  source=$(gatec_checkpoint_value "$state_leaf" source_checkpoint_leaf) || return 1
  source_checksum=$(gatec_checkpoint_value "$state_leaf" source_checkpoint_checksum_leaf) || return 1
  runtime=$(gatec_checkpoint_value "$state_leaf" runtime_bindings_leaf) || return 1
  runtime_checksum=$(gatec_checkpoint_value "$state_leaf" runtime_bindings_checksum_leaf) || return 1
  gatec_validate_checkpoint_checksum_only "$source" "$source_checksum" || return 1
  gatec_validate_runtime_bindings "$runtime" "$runtime_checksum" || return 1
  test "$(gatec_file_sha256 "$source")" = \
    "$(gatec_checkpoint_value "$state_leaf" source_checkpoint_sha256)" || return 1
  test "$(gatec_file_sha256 "$source_checksum")" = \
    "$(gatec_checkpoint_value "$state_leaf" source_checkpoint_checksum_sha256)" || return 1
  test "$(gatec_file_sha256 "$runtime")" = \
    "$(gatec_checkpoint_value "$state_leaf" runtime_bindings_sha256)" || return 1
  test "$(gatec_file_sha256 "$runtime_checksum")" = \
    "$(gatec_checkpoint_value "$state_leaf" runtime_bindings_checksum_sha256)" || return 1
  gatec_checkpoint_expect "$runtime" expected_state "$execution" || return 1
  gatec_checkpoint_expect "$runtime" source_checkpoint_leaf "$source" || return 1
  gatec_checkpoint_expect "$runtime" source_checkpoint_sha256 \
    "$(gatec_file_sha256 "$source")" || return 1
  [[ "$(gatec_checkpoint_value "$state_leaf" transition_epoch)" =~ ^[0-9]+$ ]] || return 1
}

gatec_terminal_leaf_for_state() {
  case "$1" in
    CANDIDATE_ACCEPTED) printf '%s\n' candidate-accepted.txt ;;
    ROLLBACK_REQUIRED) printf '%s\n' rollback-required.txt ;;
    ESCALATION_REQUIRED) printf '%s\n' escalation-required.txt ;;
    ROLLBACK_VERIFIED) printf '%s\n' rollback-verified.txt ;;
    *) return 1 ;;
  esac
}

gatec_assert_no_terminal_markers() {
  local desired=${1-}
  local leaf
  gatec_assert_evidence_directory || return 1
  for leaf in candidate-accepted.txt candidate-accepted.sha256 \
    rollback-required.txt rollback-required.sha256 \
    escalation-required.txt escalation-required.sha256 \
    rollback-verified.txt rollback-verified.sha256 \
    candidate-decision.txt rollback-decision.txt \
    state-candidate-escalation-required.txt state-deployment-no-change.txt; do
    if test -e "$EVIDENCE_DIR/$leaf" || test -L "$EVIDENCE_DIR/$leaf"; then
      if { test "$desired" = rollback-verified.txt \
          || test "$desired" = rollback-resume-state.txt; } \
        && { test "$leaf" = rollback-required.txt \
          || test "$leaf" = rollback-required.sha256; }; then
        continue
      fi
      gatec_error "existing terminal or incompatible marker: $leaf"
      return 1
    fi
  done
}

gatec_create_state_transition() {
  local state_leaf=$1
  local checksum_leaf=$2
  shift 2
  gatec_assert_no_terminal_markers "$state_leaf" || return 1
  gatec_create_checkpoint "$state_leaf" "$checksum_leaf" "$@" || return 1
  gatec_validate_state_transition "$state_leaf" "$checksum_leaf"
}

gatec_create_terminal_decision() {
  local state_leaf=$1
  local checksum_leaf=$2
  shift 2
  gatec_assert_no_terminal_markers "$state_leaf" || return 1
  gatec_create_checkpoint "$state_leaf" "$checksum_leaf" "$@" || return 1
  gatec_validate_terminal_decision "$state_leaf" "$checksum_leaf"
}

gatec_validate_terminal_decision() {
  local state_leaf=$1
  local checksum_leaf=$2
  gatec_validate_checkpoint_pair "$state_leaf" "$checksum_leaf" \
    authentication_boundary client client_evidence_checksum_leaf \
    client_evidence_checksum_sha256 client_evidence_leaf client_evidence_sha256 \
    deadline_epoch decision_epoch equipment_new_read_only execution_state \
    expected_predecessor media_photo_boundary predecessor_checksum_leaf \
    predecessor_checksum_sha256 predecessor_leaf predecessor_sha256 \
    private_tailscale_health public_https_denial reason receipt_epoch \
    runtime_bindings_checksum_leaf runtime_bindings_checksum_sha256 \
    runtime_bindings_leaf runtime_bindings_sha256 \
    source_checkpoint_checksum_leaf source_checkpoint_checksum_sha256 \
    source_checkpoint_leaf source_checkpoint_sha256 terminal_classification \
    terminal_contract_version || return 1
  gatec_checkpoint_expect "$state_leaf" terminal_contract_version 1 || return 1

  local incompatible
  for incompatible in candidate-decision.txt rollback-decision.txt \
    state-candidate-escalation-required.txt state-deployment-no-change.txt; do
    if test -e "$EVIDENCE_DIR/$incompatible" \
      || test -L "$EVIDENCE_DIR/$incompatible"; then
      gatec_error "legacy or incompatible terminal marker: $incompatible"
      return 1
    fi
  done

  local classification expected_leaf marker marker_count=0 predecessor predecessor_checksum
  local rollback_required_seen=0 rollback_verified_seen=0
  local source source_checksum client client_checksum runtime runtime_checksum
  local mutation_epoch deadline receipt decision result fail_count=0
  classification=$(gatec_checkpoint_value "$state_leaf" terminal_classification) || return 1
  gatec_checkpoint_expect "$state_leaf" execution_state "$classification" || return 1
  expected_leaf=$(gatec_terminal_leaf_for_state "$classification") || return 1
  test "$state_leaf" = "$expected_leaf" || {
    gatec_error "terminal state uses the wrong marker leaf"
    return 1
  }
  test "$checksum_leaf" = "${state_leaf%.txt}.sha256" || return 1
  for marker in candidate-accepted rollback-required escalation-required \
    rollback-verified; do
    if test -e "$EVIDENCE_DIR/$marker.sha256" \
      || test -L "$EVIDENCE_DIR/$marker.sha256"; then
      test -f "$EVIDENCE_DIR/$marker.txt" \
        && test ! -L "$EVIDENCE_DIR/$marker.txt" || {
        gatec_error "orphan terminal checksum: $marker.sha256"
        return 1
      }
    fi
  done
  for marker in candidate-accepted.txt rollback-required.txt \
    escalation-required.txt rollback-verified.txt; do
    if test -e "$EVIDENCE_DIR/$marker" || test -L "$EVIDENCE_DIR/$marker"; then
      marker_count=$((marker_count + 1))
      if test "$classification" = ROLLBACK_VERIFIED \
        && test "$marker" = rollback-required.txt; then
        rollback_required_seen=1
        continue
      fi
      if test "$classification" = ROLLBACK_REQUIRED \
        && test "$marker" = rollback-verified.txt; then
        rollback_verified_seen=1
        continue
      fi
      test "$marker" = "$state_leaf" || {
        gatec_error "incompatible terminal marker: $marker"
        return 1
      }
    fi
  done
  if test "$classification" = ROLLBACK_VERIFIED; then
    test "$marker_count" -eq 2 && test "$rollback_required_seen" -eq 1 || return 1
    gatec_validate_checkpoint_checksum_only rollback-required.txt \
      rollback-required.sha256 || return 1
  elif test "$classification" = ROLLBACK_REQUIRED \
    && test "$rollback_verified_seen" -eq 1; then
    test "$marker_count" -eq 2 || return 1
    gatec_validate_checkpoint_checksum_only rollback-verified.txt \
      rollback-verified.sha256 || return 1
  else
    test "$marker_count" -eq 1 || return 1
  fi

  predecessor=$(gatec_checkpoint_value "$state_leaf" predecessor_leaf) || return 1
  predecessor_checksum=$(gatec_checkpoint_value "$state_leaf" predecessor_checksum_leaf) || return 1
  source=$(gatec_checkpoint_value "$state_leaf" source_checkpoint_leaf) || return 1
  source_checksum=$(gatec_checkpoint_value "$state_leaf" source_checkpoint_checksum_leaf) || return 1
  runtime=$(gatec_checkpoint_value "$state_leaf" runtime_bindings_leaf) || return 1
  runtime_checksum=$(gatec_checkpoint_value "$state_leaf" runtime_bindings_checksum_leaf) || return 1
  gatec_validate_state_transition "$predecessor" "$predecessor_checksum" || return 1
  gatec_validate_checkpoint_checksum_only "$source" "$source_checksum" || return 1
  gatec_validate_runtime_bindings "$runtime" "$runtime_checksum" || return 1
  gatec_checkpoint_expect "$state_leaf" expected_predecessor \
    "$(gatec_checkpoint_value "$predecessor" execution_state)" || return 1
  gatec_checkpoint_expect "$state_leaf" predecessor_sha256 \
    "$(gatec_file_sha256 "$predecessor")" || return 1
  gatec_checkpoint_expect "$state_leaf" predecessor_checksum_sha256 \
    "$(gatec_file_sha256 "$predecessor_checksum")" || return 1
  gatec_checkpoint_expect "$state_leaf" source_checkpoint_sha256 \
    "$(gatec_file_sha256 "$source")" || return 1
  gatec_checkpoint_expect "$state_leaf" source_checkpoint_checksum_sha256 \
    "$(gatec_file_sha256 "$source_checksum")" || return 1
  gatec_checkpoint_expect "$state_leaf" runtime_bindings_sha256 \
    "$(gatec_file_sha256 "$runtime")" || return 1
  gatec_checkpoint_expect "$state_leaf" runtime_bindings_checksum_sha256 \
    "$(gatec_file_sha256 "$runtime_checksum")" || return 1
  gatec_checkpoint_expect "$runtime" source_checkpoint_leaf "$source" || return 1
  gatec_checkpoint_expect "$runtime" source_checkpoint_sha256 \
    "$(gatec_file_sha256 "$source")" || return 1
  gatec_checkpoint_expect "$predecessor" source_checkpoint_leaf "$source" || return 1
  gatec_checkpoint_expect "$predecessor" source_checkpoint_sha256 \
    "$(gatec_file_sha256 "$source")" || return 1
  [[ "$(gatec_checkpoint_value "$state_leaf" decision_epoch)" =~ ^[0-9]+$ ]] || return 1

  client=$(gatec_checkpoint_value "$state_leaf" client_evidence_leaf) || return 1
  client_checksum=$(gatec_checkpoint_value "$state_leaf" client_evidence_checksum_leaf) || return 1
  if test "$client" = none && test "$client_checksum" = none; then
    for result in client receipt_epoch deadline_epoch authentication_boundary \
      equipment_new_read_only media_photo_boundary private_tailscale_health \
      public_https_denial; do
      case "$result" in
        receipt_epoch|deadline_epoch) gatec_checkpoint_expect "$state_leaf" "$result" 0 || return 1 ;;
        *) gatec_checkpoint_expect "$state_leaf" "$result" NONE || return 1 ;;
      esac
    done
    gatec_checkpoint_expect "$state_leaf" client_evidence_sha256 none || return 1
    gatec_checkpoint_expect "$state_leaf" client_evidence_checksum_sha256 none || return 1
  else
    gatec_validate_client_evidence "$client" "$client_checksum" || return 1
    gatec_checkpoint_expect "$state_leaf" client_evidence_sha256 \
      "$(gatec_file_sha256 "$client")" || return 1
    gatec_checkpoint_expect "$state_leaf" client_evidence_checksum_sha256 \
      "$(gatec_file_sha256 "$client_checksum")" || return 1
    gatec_checkpoint_expect "$client" source_checkpoint_leaf "$source" || return 1
    gatec_checkpoint_expect "$client" source_checkpoint_sha256 \
      "$(gatec_file_sha256 "$source")" || return 1
    gatec_checkpoint_expect "$client" source_checkpoint_checksum_sha256 \
      "$(gatec_file_sha256 "$source_checksum")" || return 1
    gatec_checkpoint_expect "$state_leaf" client \
      "$(gatec_checkpoint_value "$client" client)" || return 1
    gatec_checkpoint_expect "$state_leaf" receipt_epoch \
      "$(gatec_checkpoint_value "$client" received_epoch)" || return 1
    gatec_checkpoint_expect "$state_leaf" deadline_epoch \
      "$(gatec_checkpoint_value "$client" deadline_epoch)" || return 1
    for result in authentication_boundary equipment_new_read_only \
      media_photo_boundary private_tailscale_health public_https_denial; do
      gatec_checkpoint_expect "$state_leaf" "$result" \
        "$(gatec_checkpoint_value "$client" "$result")" || return 1
    done
    mutation_epoch=$(gatec_checkpoint_value "$source" mutation_epoch) || return 1
    deadline=$(gatec_checkpoint_value "$source" verification_deadline_epoch) || return 1
    receipt=$(gatec_checkpoint_value "$state_leaf" receipt_epoch) || return 1
    decision=$(gatec_checkpoint_value "$state_leaf" decision_epoch) || return 1
    gatec_validate_deadline "$mutation_epoch" "$deadline" "$receipt" "$decision" || return 1
    gatec_checkpoint_expect "$state_leaf" deadline_epoch "$deadline" || return 1
  fi

  case "$classification" in
    CANDIDATE_ACCEPTED|ROLLBACK_VERIFIED)
      gatec_checkpoint_expect "$state_leaf" expected_predecessor FRESH_SHELL_RESUME || return 1
      gatec_checkpoint_expect "$state_leaf" reason ALL_MANDATORY_CHECKS_PASS || return 1
      for result in authentication_boundary equipment_new_read_only \
        media_photo_boundary private_tailscale_health public_https_denial; do
        gatec_checkpoint_expect "$state_leaf" "$result" PASS || return 1
      done
      ;;
    ROLLBACK_REQUIRED)
      case "$(gatec_checkpoint_value "$state_leaf" reason)" in
        CLIENT_VERIFICATION_FAILURE)
          gatec_checkpoint_expect "$state_leaf" expected_predecessor FRESH_SHELL_RESUME || return 1
          for result in authentication_boundary equipment_new_read_only \
            media_photo_boundary private_tailscale_health public_https_denial; do
            test "$(gatec_checkpoint_value "$state_leaf" "$result")" = FAIL \
              && fail_count=$((fail_count + 1))
          done
          test "$fail_count" -ge 1 || return 1
          ;;
        RUNTIME_FAILURE)
          gatec_checkpoint_expect "$state_leaf" expected_predecessor ROLLBACK_DECISION_POINT || return 1
          gatec_checkpoint_expect "$state_leaf" client_evidence_leaf none || return 1
          ;;
        *) return 1 ;;
      esac
      ;;
    ESCALATION_REQUIRED)
      test "$(gatec_checkpoint_value "$state_leaf" reason)" != ALL_MANDATORY_CHECKS_PASS || return 1
      ;;
    *) return 1 ;;
  esac
}

gatec_assert_only_regular_evidence_files() {
  local unexpected
  gatec_assert_evidence_directory || return 1
  unexpected=$(find -P "$EVIDENCE_DIR" -mindepth 1 -maxdepth 1 ! -type f -print -quit)
  test -z "$unexpected" || {
    gatec_error "non-regular evidence entry rejected"
    return 1
  }
}

gatec_require_files() {
  local leaf
  gatec_assert_evidence_directory || return 1
  for leaf in "$@"; do
    gatec_validate_leaf "$leaf" || return 1
    gatec_assert_file_metadata "$EVIDENCE_DIR/$leaf" || {
      gatec_error "mandatory evidence file rejected: $leaf"
      return 1
    }
  done
}

gatec_create_inventory() {
  local inventory_leaf=$1
  local manifest_leaf=$2
  local inventory_path status

  gatec_validate_leaf "$inventory_leaf" || return 1
  gatec_validate_leaf "$manifest_leaf" || return 1
  test "$inventory_leaf" != "$manifest_leaf" || return 1
  gatec_assert_only_regular_evidence_files || return 1
  gatec_assert_absent_leaf "$inventory_leaf" || return 1
  gatec_assert_absent_leaf "$manifest_leaf" || return 1

  inventory_path=$(gatec_target_path "$inventory_leaf") || return 1
  (
    set -o noclobber
    set -o pipefail
    umask 077
    exec {inventory_fd}>"$inventory_path" || exit 1
    find -P "$EVIDENCE_DIR" -mindepth 1 -maxdepth 1 -type f \
      ! -name "$manifest_leaf" -printf '%f\n' | LC_ALL=C sort >&"$inventory_fd"
  )
  status=$?
  test "$status" -eq 0 || return "$status"
  gatec_assert_evidence_directory || return 1
  chmod 0600 -- "$inventory_path" || return 1
  gatec_assert_file_metadata "$inventory_path" || return 1
  grep -Fxq -- "$inventory_leaf" "$inventory_path" || {
    gatec_error "inventory does not cover itself"
    return 1
  }
  LC_ALL=C sort -c -u -- "$inventory_path" || return 1
}

gatec_create_manifest() {
  local inventory_leaf=$1
  local manifest_leaf=$2
  local inventory_path manifest_path leaf status

  inventory_path=$(gatec_target_path "$inventory_leaf") || return 1
  manifest_path=$(gatec_target_path "$manifest_leaf") || return 1
  gatec_assert_file_metadata "$inventory_path" || return 1
  gatec_assert_absent_leaf "$manifest_leaf" || return 1

  while IFS= read -r leaf; do
    gatec_validate_leaf "$leaf" || return 1
    test "$leaf" != "$manifest_leaf" || {
      gatec_error "manifest cannot hash itself"
      return 1
    }
    gatec_assert_file_metadata "$EVIDENCE_DIR/$leaf" || return 1
  done < "$inventory_path"

  (
    set -o noclobber
    umask 077
    while IFS= read -r leaf; do
      record=$(gatec_stable_file_record "$EVIDENCE_DIR/$leaf") || exit 1
      printf '%s  %s\n' "${record%%|*}" "$leaf"
    done < "$inventory_path" >"$manifest_path"
  )
  status=$?
  test "$status" -eq 0 || return "$status"
  gatec_assert_evidence_directory || return 1
  chmod 0600 -- "$manifest_path" || return 1
  gatec_assert_file_metadata "$manifest_path" || return 1
}

gatec_validate_seal() {
  local inventory_leaf=$1
  local manifest_leaf=$2
  local test_marker=''
  gatec_validate_leaf "$inventory_leaf" || return 1
  gatec_validate_leaf "$manifest_leaf" || return 1
  test "$inventory_leaf" != "$manifest_leaf" || return 1
  gatec_assert_evidence_directory || return 1
  if gatec_synthetic_hook_allowed \
    && test -n "${GATEC_SYNTHETIC_VALIDATION_MARKER:-}"; then
    test_marker=$GATEC_SYNTHETIC_VALIDATION_MARKER
    case "$test_marker" in "$EVIDENCE_PARENT"/*) ;; *) return 1 ;; esac
    case "$test_marker" in "$EVIDENCE_DIR"/*) return 1 ;; esac
  fi

  perl -MDigest::SHA -MTime::HiRes -MFcntl=:DEFAULT,:mode -e '
    use strict;
    use warnings;
    my ($root, $inventory_name, $manifest_name, $test_marker) = @ARGV;
    my $owner_uid = getpwnam("alain");
    my $owner_gid = getgrnam("alain");
    defined($owner_uid) && defined($owner_gid) or die "owner unavailable\n";

    sysopen(my $root_fh, $root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
      or die "open evidence directory: $!\n";
    my @root_identity = Time::HiRes::stat($root_fh);
    @root_identity && S_ISDIR($root_identity[2]) or die "not directory\n";
    (($root_identity[2] & 07777) == 0700
      && $root_identity[4] == $owner_uid && $root_identity[5] == $owner_gid)
      or die "directory metadata mismatch\n";

    sub directory_entries {
      opendir(my $dh, $root) or die "opendir: $!\n";
      my @dir_stat = Time::HiRes::stat($dh);
      ($dir_stat[0] == $root_identity[0] && $dir_stat[1] == $root_identity[1])
        or die "directory identity changed\n";
      my @entries = sort grep { $_ ne "." && $_ ne ".." } readdir($dh);
      closedir($dh) or die "closedir: $!\n";
      return @entries;
    }

    my @entries = directory_entries();
    my (%fh, %identity);
    for my $leaf (@entries) {
      $leaf =~ /\A[A-Za-z0-9][A-Za-z0-9._-]*\z/ or die "unsafe leaf\n";
      my $path = "$root/$leaf";
      sysopen(my $file, $path, O_RDONLY | O_NOFOLLOW) or die "open $leaf: $!\n";
      my @st = Time::HiRes::stat($file);
      @st && S_ISREG($st[2]) or die "non-regular file\n";
      (($st[2] & 07777) == 0600 && $st[3] == 1
        && $st[4] == $owner_uid && $st[5] == $owner_gid)
        or die "file metadata mismatch: $leaf\n";
      $fh{$leaf} = $file;
      $identity{$leaf} = [@st];
    }
    exists($fh{$inventory_name}) && exists($fh{$manifest_name})
      or die "inventory or manifest missing\n";

    sub read_descriptor {
      my ($file) = @_;
      sysseek($file, 0, 0) == 0 or die "seek: $!\n";
      my $content = "";
      while (1) {
        my $read = sysread($file, my $chunk, 65536);
        defined($read) or die "read: $!\n";
        last if $read == 0;
        $content .= $chunk;
      }
      return $content;
    }
    my $inventory = read_descriptor($fh{$inventory_name});
    $inventory =~ /\n\z/ or die "inventory missing final newline\n";
    my @inventory = split(/\n/, $inventory, -1);
    pop @inventory;
    @inventory or die "empty inventory\n";
    my @sorted_inventory = sort @inventory;
    join("\n", @inventory) eq join("\n", @sorted_inventory)
      or die "inventory not sorted\n";
    my %inventory_seen;
    for my $leaf (@inventory) {
      $leaf =~ /\A[A-Za-z0-9][A-Za-z0-9._-]*\z/ or die "unsafe inventory leaf\n";
      !$inventory_seen{$leaf}++ or die "duplicate inventory leaf\n";
      $leaf ne $manifest_name or die "self-referential manifest\n";
    }
    $inventory_seen{$inventory_name} or die "inventory omits itself\n";
    my @actual = grep { $_ ne $manifest_name } @entries;
    join("\n", @inventory) eq join("\n", @actual)
      or die "inventory coverage mismatch\n";

    my $manifest = read_descriptor($fh{$manifest_name});
    $manifest =~ /\n\z/ or die "manifest missing final newline\n";
    my @manifest = split(/\n/, $manifest, -1);
    pop @manifest;
    @manifest == @inventory or die "manifest cardinality mismatch\n";
    my (%expected_hash, @manifest_leaves);
    for my $line (@manifest) {
      $line =~ /\A([0-9a-f]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)\z/
        or die "unsafe manifest record\n";
      my ($hash, $leaf) = ($1, $2);
      !exists($expected_hash{$leaf}) or die "duplicate manifest leaf\n";
      $expected_hash{$leaf} = $hash;
      push @manifest_leaves, $leaf;
    }
    join("\n", @manifest_leaves) eq join("\n", @inventory)
      or die "manifest coverage mismatch\n";

    sub stable_hash {
      my ($leaf) = @_;
      my $file = $fh{$leaf};
      my @before = Time::HiRes::stat($file);
      seek($file, 0, 0) or die "seek $leaf: $!\n";
      my $sha = Digest::SHA->new(256);
      $sha->addfile($file);
      my $digest = $sha->hexdigest;
      my @after = Time::HiRes::stat($file);
      for my $index (0, 1, 2, 3, 4, 5, 7, 9, 10) {
        $before[$index] eq $after[$index] or die "changed while hashing: $leaf\n";
        $after[$index] eq $identity{$leaf}->[$index]
          or die "identity or metadata drift: $leaf\n";
      }
      return $digest;
    }

    my %first_digest;
    for my $pass (1 .. 3) {
      my @now = directory_entries();
      join("\n", @now) eq join("\n", @entries) or die "directory entries changed\n";
      for my $leaf (@entries) {
        my $digest = stable_hash($leaf);
        if ($leaf ne $manifest_name) {
          $digest eq $expected_hash{$leaf} or die "manifest mismatch: $leaf\n";
        }
        if ($pass == 1) {
          $first_digest{$leaf} = $digest;
        } else {
          $digest eq $first_digest{$leaf} or die "content changed across passes: $leaf\n";
        }
        my @path_stat = Time::HiRes::lstat("$root/$leaf");
        @path_stat && S_ISREG($path_stat[2]) or die "path changed: $leaf\n";
        for my $index (0, 1, 2, 3, 4, 5, 7, 9, 10) {
          $path_stat[$index] eq $identity{$leaf}->[$index]
            or die "path identity or metadata changed: $leaf\n";
        }
      }
      if ($pass == 1 && length($test_marker)) {
        sysopen(my $marker, $test_marker, O_WRONLY | O_CREAT | O_EXCL, 0600)
          or die "test marker: $!\n";
        print {$marker} "first-pass-complete\n" or die "test marker write: $!\n";
        close($marker) or die "test marker close: $!\n";
        select(undef, undef, undef, 0.30);
      }
    }

    # Immediate final identity/metadata and directory pass after the last hash.
    for my $leaf (@entries) {
      my @fd_stat = Time::HiRes::stat($fh{$leaf});
      my @path_stat = Time::HiRes::lstat("$root/$leaf");
      for my $index (0, 1, 2, 3, 4, 5, 7, 9, 10) {
        $fd_stat[$index] eq $identity{$leaf}->[$index]
          or die "final descriptor drift: $leaf\n";
        $path_stat[$index] eq $identity{$leaf}->[$index]
          or die "final path drift: $leaf\n";
      }
    }
    my @final_entries = directory_entries();
    join("\n", @final_entries) eq join("\n", @entries)
      or die "final directory drift\n";
    my @root_final = Time::HiRes::stat($root_fh);
    for my $index (0, 1, 2, 4, 5) {
      $root_final[$index] eq $root_identity[$index]
        or die "final directory identity drift\n";
    }
  ' -- "$EVIDENCE_DIR" "$inventory_leaf" "$manifest_leaf" "$test_marker" || {
    gatec_error "race-resistant seal validation failed"
    return 1
  }
}
