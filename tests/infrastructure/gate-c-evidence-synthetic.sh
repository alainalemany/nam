#!/usr/bin/env bash

set -u -o pipefail
umask 077

readonly REPOSITORY_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
readonly HELPER="$REPOSITORY_ROOT/infrastructure/server-config/scripts/gate-c-evidence.sh"
readonly TEST_ROOT=$(mktemp -d /tmp/nam-gate-c-evidence-test.XXXXXXXXXX)

# shellcheck source=../../infrastructure/server-config/scripts/gate-c-evidence.sh
source "$HELPER"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'FAIL %s\n' "$1" >&2
}

expect_success() {
  local label=$1
  shift
  if "$@"; then pass "$label"; else fail "$label"; fi
}

expect_failure() {
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then fail "$label"; else pass "$label"; fi
}

run_parallel_success_tests() {
  local -a labels=() pids=()
  local label command pid index
  while test "$#" -gt 0; do
    label=$1
    command=$2
    shift 2
    labels+=("$label")
    ( "$command" ) >/dev/null 2>&1 &
    pids+=("$!")
  done
  for index in "${!pids[@]}"; do
    pid=${pids[$index]}
    if wait "$pid"; then pass "${labels[$index]}"; else fail "${labels[$index]}"; fi
  done
}

use_new_evidence_directory() {
  EVIDENCE_PARENT=$TEST_ROOT
  EVIDENCE_DIR=$(gatec_create_evidence_directory "$EVIDENCE_PARENT" synthetic) || return 1
  EVIDENCE_DIR_ID=$(stat -c '%d:%i' -- "$EVIDENCE_DIR") || return 1
  export EVIDENCE_PARENT EVIDENCE_DIR EVIDENCE_DIR_ID
}

validate_test_checkpoint() {
  gatec_validate_checkpoint_pair checkpoint-state.txt checkpoint-state.sha256 \
    app_container_id checkpoint_version deadline_epoch execution_state mutation_epoch
}

create_test_checkpoint() {
  gatec_create_checkpoint checkpoint-state.txt checkpoint-state.sha256 \
    'checkpoint_version=1' \
    'execution_state=AWAITING_CLIENT_EVIDENCE' \
    'app_container_id=container-a' \
    'mutation_epoch=1000' \
    'deadline_epoch=1900'
}

test_empty_capture() {
  use_new_evidence_directory || return 1
  gatec_capture empty.txt bash -c 'exit 0' || return 1
  test -f "$EVIDENCE_DIR/empty.txt" && test ! -s "$EVIDENCE_DIR/empty.txt"
}

test_failing_capture() {
  local status
  use_new_evidence_directory || return 1
  gatec_capture failing.txt bash -c 'printf "failure output\n"; exit 23'
  status=$?
  test "$status" -eq 23 || return 1
  test "$(cat -- "$EVIDENCE_DIR/failing.txt")" = 'failure output'
}

test_empty_sorted_capture() {
  use_new_evidence_directory || return 1
  gatec_capture_sorted empty-sorted.txt bash -c 'exit 0' || return 1
  test -f "$EVIDENCE_DIR/empty-sorted.txt" && test ! -s "$EVIDENCE_DIR/empty-sorted.txt"
}

test_failing_sorted_capture() {
  local status
  use_new_evidence_directory || return 1
  gatec_capture_sorted failing-sorted.txt \
    bash -c 'printf "zeta\nalpha\n"; exit 19'
  status=$?
  test "$status" -eq 19 || return 1
  test "$(cat -- "$EVIDENCE_DIR/failing-sorted.txt")" = $'alpha\nzeta'
}

test_leaf_reuse_rejection() {
  use_new_evidence_directory || return 1
  gatec_note once.txt original || return 1
  ! gatec_note once.txt replacement >/dev/null 2>&1 || return 1
  test "$(cat -- "$EVIDENCE_DIR/once.txt")" = original
}

test_dangling_symlink_rejection() {
  use_new_evidence_directory || return 1
  ln -s "$EVIDENCE_DIR/missing" "$EVIDENCE_DIR/blocked.txt"
  ! gatec_note blocked.txt replacement >/dev/null 2>&1
}

test_mandatory_file_contract() {
  use_new_evidence_directory || return 1
  gatec_note present.txt evidence || return 1
  gatec_require_files present.txt || return 1
  ! gatec_require_files present.txt missing.txt >/dev/null 2>&1
}

test_cross_process_checkpoint() {
  use_new_evidence_directory || return 1
  create_test_checkpoint || return 1
  env EVIDENCE_PARENT="$EVIDENCE_PARENT" EVIDENCE_DIR="$EVIDENCE_DIR" \
    EVIDENCE_DIR_ID="$EVIDENCE_DIR_ID" HELPER="$HELPER" \
    bash -c 'source "$HELPER"; gatec_validate_checkpoint_pair checkpoint-state.txt checkpoint-state.sha256 app_container_id checkpoint_version deadline_epoch execution_state mutation_epoch; gatec_checkpoint_expect checkpoint-state.txt execution_state AWAITING_CLIENT_EVIDENCE'
}

test_checkpoint_tampering() {
  use_new_evidence_directory || return 1
  create_test_checkpoint || return 1
  printf 'tampered=yes\n' >> "$EVIDENCE_DIR/checkpoint-state.txt"
  ! validate_test_checkpoint >/dev/null 2>&1
}

test_duplicate_checkpoint_key() {
  use_new_evidence_directory || return 1
  ! gatec_create_checkpoint checkpoint-state.txt checkpoint-state.sha256 \
    'checkpoint_version=1' 'checkpoint_version=2' >/dev/null 2>&1
}

test_runtime_drift() {
  use_new_evidence_directory || return 1
  create_test_checkpoint || return 1
  validate_test_checkpoint || return 1
  ! gatec_checkpoint_expect checkpoint-state.txt app_container_id container-b >/dev/null 2>&1
}

test_late_client_evidence() {
  ! gatec_validate_deadline 1000 1900 1901 1901 >/dev/null 2>&1
}

seal_fixture() {
  use_new_evidence_directory || return 1
  gatec_note b.txt beta || return 1
  gatec_note a.txt alpha || return 1
  gatec_create_inventory evidence-files.txt SHA256SUMS || return 1
  gatec_create_manifest evidence-files.txt SHA256SUMS || return 1
  gatec_validate_seal evidence-files.txt SHA256SUMS
}

test_deterministic_seals() {
  local first_dir first_inventory first_manifest second_dir
  seal_fixture || return 1
  first_dir=$EVIDENCE_DIR
  first_inventory=$(cat -- "$first_dir/evidence-files.txt")
  first_manifest=$(cat -- "$first_dir/SHA256SUMS")
  seal_fixture || return 1
  second_dir=$EVIDENCE_DIR
  test "$first_inventory" = "$(cat -- "$second_dir/evidence-files.txt")" || return 1
  test "$first_manifest" = "$(cat -- "$second_dir/SHA256SUMS")"
}

test_complete_manifest_coverage() {
  local expected listed
  seal_fixture || return 1
  expected=$(find -P "$EVIDENCE_DIR" -mindepth 1 -maxdepth 1 -type f \
    ! -name SHA256SUMS -printf '%f\n' | LC_ALL=C sort)
  listed=$(awk '{print $2}' "$EVIDENCE_DIR/SHA256SUMS")
  test "$listed" = "$expected" || return 1
  ! grep -Fq 'SHA256SUMS' "$EVIDENCE_DIR/SHA256SUMS"
}

test_symlink_rejection() {
  use_new_evidence_directory || return 1
  ln -s /etc/hosts "$EVIDENCE_DIR/link"
  ! gatec_create_inventory evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_duplicate_rejection() {
  seal_fixture || return 1
  printf 'a.txt\n' >> "$EVIDENCE_DIR/evidence-files.txt"
  ! gatec_validate_seal evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_missing_file_rejection() {
  seal_fixture || return 1
  unlink "$EVIDENCE_DIR/a.txt"
  ! gatec_validate_seal evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_content_tamper_rejection() {
  seal_fixture || return 1
  printf 'tamper\n' >> "$EVIDENCE_DIR/a.txt"
  ! gatec_validate_seal evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_mode_rejection() {
  seal_fixture || return 1
  chmod 0644 "$EVIDENCE_DIR/a.txt"
  ! gatec_validate_seal evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_directory_mode_rejection() {
  use_new_evidence_directory || return 1
  chmod 0755 "$EVIDENCE_DIR"
  ! gatec_assert_evidence_directory >/dev/null 2>&1
}

test_subdirectory_rejection() {
  use_new_evidence_directory || return 1
  mkdir "$EVIDENCE_DIR/nested"
  ! gatec_create_inventory evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_hardlink_rejection() {
  use_new_evidence_directory || return 1
  gatec_note original.txt evidence || return 1
  ln "$EVIDENCE_DIR/original.txt" "$EVIDENCE_DIR/alias.txt" || return 1
  gatec_create_inventory evidence-files.txt SHA256SUMS || return 1
  ! gatec_create_manifest evidence-files.txt SHA256SUMS >/dev/null 2>&1
}

test_concurrent_in_place_mutation() {
  local marker status mutator
  seal_fixture || return 1
  marker="$TEST_ROOT/validation-marker.$RANDOM.$RANDOM"
  (
    while test ! -f "$marker"; do sleep 0.01; done
    printf 'concurrent-tamper\n' >> "$EVIDENCE_DIR/a.txt"
  ) &
  mutator=$!
  GATEC_SYNTHETIC_TESTING=1 \
  GATEC_SYNTHETIC_VALIDATION_MARKER=$marker \
    gatec_validate_seal evidence-files.txt SHA256SUMS >/dev/null 2>&1
  status=$?
  wait "$mutator" || return 1
  test "$status" -ne 0 || return 1
  ! (cd "$EVIDENCE_DIR" && sha256sum --status -c SHA256SUMS)
}

create_bound_source_and_runtime() {
  local prefix
  gatec_create_checkpoint source-checkpoint.txt source-checkpoint.sha256 \
    'checkpoint_version=1' \
    'execution_state=AWAITING_CLIENT_EVIDENCE' \
    'mutation_epoch=1000' \
    'verification_deadline_epoch=1900' || return 1
  for prefix in app-identity app-topology local-health network-members \
    network-static postgres-full project-containers project-networks \
    project-volumes volume-static; do
    gatec_note "$prefix.txt" "$prefix=stable" || return 1
  done
  gatec_create_checkpoint decision-runtime.txt decision-runtime.sha256 \
    'runtime_bindings_version=1' \
    'expected_state=FRESH_SHELL_RESUME' \
    'captured_epoch=1400' \
    'source_checkpoint_leaf=source-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 source-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=source-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 source-checkpoint.sha256)" \
    'app_identity_leaf=app-identity.txt' \
    "app_identity_sha256=$(gatec_file_sha256 app-identity.txt)" \
    'app_topology_leaf=app-topology.txt' \
    "app_topology_sha256=$(gatec_file_sha256 app-topology.txt)" \
    'local_health_leaf=local-health.txt' \
    "local_health_sha256=$(gatec_file_sha256 local-health.txt)" \
    'network_members_leaf=network-members.txt' \
    "network_members_sha256=$(gatec_file_sha256 network-members.txt)" \
    'network_static_leaf=network-static.txt' \
    "network_static_sha256=$(gatec_file_sha256 network-static.txt)" \
    'postgres_full_leaf=postgres-full.txt' \
    "postgres_full_sha256=$(gatec_file_sha256 postgres-full.txt)" \
    'project_containers_leaf=project-containers.txt' \
    "project_containers_sha256=$(gatec_file_sha256 project-containers.txt)" \
    'project_networks_leaf=project-networks.txt' \
    "project_networks_sha256=$(gatec_file_sha256 project-networks.txt)" \
    'project_volumes_leaf=project-volumes.txt' \
    "project_volumes_sha256=$(gatec_file_sha256 project-volumes.txt)" \
    'volume_static_leaf=volume-static.txt' \
    "volume_static_sha256=$(gatec_file_sha256 volume-static.txt)" || return 1
  gatec_validate_runtime_bindings decision-runtime.txt decision-runtime.sha256 || return 1
  gatec_create_state_transition resume-state.txt resume-state.sha256 \
    'state_contract_version=1' \
    'execution_state=FRESH_SHELL_RESUME' \
    'predecessor_state=AWAITING_CLIENT_EVIDENCE' \
    'transition_epoch=1450' \
    'source_checkpoint_leaf=source-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 source-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=source-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 source-checkpoint.sha256)" \
    'runtime_bindings_leaf=decision-runtime.txt' \
    "runtime_bindings_sha256=$(gatec_file_sha256 decision-runtime.txt)" \
    'runtime_bindings_checksum_leaf=decision-runtime.sha256' \
    "runtime_bindings_checksum_sha256=$(gatec_file_sha256 decision-runtime.sha256)"
}

create_client_evidence() {
  local received=${1:-1500}
  local private=${2:-PASS}
  local public=${3:-PASS}
  local authentication=${4:-PASS}
  local media=${5:-PASS}
  local equipment=${6:-PASS}
  gatec_create_checkpoint client-evidence.txt client-evidence.sha256 \
    'client_contract_version=1' \
    'client=darnassus' \
    'predecessor_state=FRESH_SHELL_RESUME' \
    "received_epoch=$received" \
    'received_utc=1970-01-01T00:25:00Z' \
    'deadline_epoch=1900' \
    "private_tailscale_health=$private" \
    "public_https_denial=$public" \
    "authentication_boundary=$authentication" \
    "media_photo_boundary=$media" \
    "equipment_new_read_only=$equipment" \
    'source_checkpoint_leaf=source-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 source-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=source-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 source-checkpoint.sha256)" || return 1
  gatec_validate_client_evidence client-evidence.txt client-evidence.sha256
}

terminal_records() {
  local classification=$1
  local reason=$2
  printf '%s\n' \
    'terminal_contract_version=1' \
    "execution_state=$classification" \
    "terminal_classification=$classification" \
    'expected_predecessor=FRESH_SHELL_RESUME' \
    "reason=$reason" \
    'decision_epoch=1600' \
    'predecessor_leaf=resume-state.txt' \
    "predecessor_sha256=$(gatec_file_sha256 resume-state.txt)" \
    'predecessor_checksum_leaf=resume-state.sha256' \
    "predecessor_checksum_sha256=$(gatec_file_sha256 resume-state.sha256)" \
    'source_checkpoint_leaf=source-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 source-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=source-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 source-checkpoint.sha256)" \
    'client_evidence_leaf=client-evidence.txt' \
    "client_evidence_sha256=$(gatec_file_sha256 client-evidence.txt)" \
    'client_evidence_checksum_leaf=client-evidence.sha256' \
    "client_evidence_checksum_sha256=$(gatec_file_sha256 client-evidence.sha256)" \
    'runtime_bindings_leaf=decision-runtime.txt' \
    "runtime_bindings_sha256=$(gatec_file_sha256 decision-runtime.txt)" \
    'runtime_bindings_checksum_leaf=decision-runtime.sha256' \
    "runtime_bindings_checksum_sha256=$(gatec_file_sha256 decision-runtime.sha256)" \
    "client=$(gatec_checkpoint_value client-evidence.txt client)" \
    "receipt_epoch=$(gatec_checkpoint_value client-evidence.txt received_epoch)" \
    "deadline_epoch=$(gatec_checkpoint_value client-evidence.txt deadline_epoch)" \
    "private_tailscale_health=$(gatec_checkpoint_value client-evidence.txt private_tailscale_health)" \
    "public_https_denial=$(gatec_checkpoint_value client-evidence.txt public_https_denial)" \
    "authentication_boundary=$(gatec_checkpoint_value client-evidence.txt authentication_boundary)" \
    "media_photo_boundary=$(gatec_checkpoint_value client-evidence.txt media_photo_boundary)" \
    "equipment_new_read_only=$(gatec_checkpoint_value client-evidence.txt equipment_new_read_only)"
}

create_terminal_fixture() {
  local classification=${1:-CANDIDATE_ACCEPTED}
  local received=${2:-1500}
  local private=${3:-PASS}
  local reason leaf
  use_new_evidence_directory || return 1
  create_bound_source_and_runtime || return 1
  create_client_evidence "$received" "$private" || return 1
  case "$classification" in
    CANDIDATE_ACCEPTED) leaf=candidate-accepted.txt; reason=ALL_MANDATORY_CHECKS_PASS ;;
    ROLLBACK_REQUIRED) leaf=rollback-required.txt; reason=CLIENT_VERIFICATION_FAILURE ;;
    ESCALATION_REQUIRED) leaf=escalation-required.txt; reason=EVIDENCE_UNCERTAINTY ;;
    ROLLBACK_VERIFIED) leaf=rollback-verified.txt; reason=ALL_MANDATORY_CHECKS_PASS ;;
    *) return 1 ;;
  esac
  mapfile -t records < <(terminal_records "$classification" "$reason")
  gatec_create_terminal_decision "$leaf" "${leaf%.txt}.sha256" "${records[@]}"
}

test_valid_terminal_contract() {
  create_terminal_fixture CANDIDATE_ACCEPTED
}

test_altered_client_evidence() {
  create_terminal_fixture CANDIDATE_ACCEPTED || return 1
  printf 'altered=yes\n' >> "$EVIDENCE_DIR/client-evidence.txt"
  ! gatec_validate_terminal_decision candidate-accepted.txt candidate-accepted.sha256 >/dev/null 2>&1
}

test_incomplete_pass_values() {
  ! create_terminal_fixture CANDIDATE_ACCEPTED 1500 FAIL >/dev/null 2>&1
}

test_terminal_late_evidence() {
  ! create_terminal_fixture CANDIDATE_ACCEPTED 1901 PASS >/dev/null 2>&1
}

test_changed_checkpoint_evidence() {
  create_terminal_fixture CANDIDATE_ACCEPTED || return 1
  printf 'altered=yes\n' >> "$EVIDENCE_DIR/source-checkpoint.txt"
  ! gatec_validate_terminal_decision candidate-accepted.txt candidate-accepted.sha256 >/dev/null 2>&1
}

test_changed_runtime_evidence() {
  create_terminal_fixture CANDIDATE_ACCEPTED || return 1
  printf 'altered=yes\n' >> "$EVIDENCE_DIR/app-identity.txt"
  ! gatec_validate_terminal_decision candidate-accepted.txt candidate-accepted.sha256 >/dev/null 2>&1
}

test_missing_terminal_field() {
  local -a records filtered=()
  local record
  use_new_evidence_directory || return 1
  create_bound_source_and_runtime || return 1
  create_client_evidence || return 1
  mapfile -t records < <(terminal_records CANDIDATE_ACCEPTED ALL_MANDATORY_CHECKS_PASS)
  for record in "${records[@]}"; do
    [[ "$record" = reason=* ]] || filtered+=("$record")
  done
  ! gatec_create_terminal_decision candidate-accepted.txt candidate-accepted.sha256 \
    "${filtered[@]}" >/dev/null 2>&1
}

test_duplicate_terminal_field() {
  local -a records
  use_new_evidence_directory || return 1
  create_bound_source_and_runtime || return 1
  create_client_evidence || return 1
  mapfile -t records < <(terminal_records CANDIDATE_ACCEPTED ALL_MANDATORY_CHECKS_PASS)
  ! gatec_create_terminal_decision candidate-accepted.txt candidate-accepted.sha256 \
    "${records[@]}" 'reason=ALL_MANDATORY_CHECKS_PASS' >/dev/null 2>&1
}

test_explicit_invalid_state_predecessor() {
  use_new_evidence_directory || return 1
  gatec_create_checkpoint source-checkpoint.txt source-checkpoint.sha256 \
    'checkpoint_version=1' 'execution_state=AWAITING_CLIENT_EVIDENCE' \
    'mutation_epoch=1000' 'verification_deadline_epoch=1900' || return 1
  for prefix in app-identity app-topology local-health network-members \
    network-static postgres-full project-containers project-networks \
    project-volumes volume-static; do gatec_note "$prefix.txt" stable || return 1; done
  gatec_create_checkpoint decision-runtime.txt decision-runtime.sha256 \
    'runtime_bindings_version=1' 'expected_state=FRESH_SHELL_RESUME' \
    'captured_epoch=1400' 'source_checkpoint_leaf=source-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 source-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=source-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 source-checkpoint.sha256)" \
    'app_identity_leaf=app-identity.txt' "app_identity_sha256=$(gatec_file_sha256 app-identity.txt)" \
    'app_topology_leaf=app-topology.txt' "app_topology_sha256=$(gatec_file_sha256 app-topology.txt)" \
    'local_health_leaf=local-health.txt' "local_health_sha256=$(gatec_file_sha256 local-health.txt)" \
    'network_members_leaf=network-members.txt' "network_members_sha256=$(gatec_file_sha256 network-members.txt)" \
    'network_static_leaf=network-static.txt' "network_static_sha256=$(gatec_file_sha256 network-static.txt)" \
    'postgres_full_leaf=postgres-full.txt' "postgres_full_sha256=$(gatec_file_sha256 postgres-full.txt)" \
    'project_containers_leaf=project-containers.txt' "project_containers_sha256=$(gatec_file_sha256 project-containers.txt)" \
    'project_networks_leaf=project-networks.txt' "project_networks_sha256=$(gatec_file_sha256 project-networks.txt)" \
    'project_volumes_leaf=project-volumes.txt' "project_volumes_sha256=$(gatec_file_sha256 project-volumes.txt)" \
    'volume_static_leaf=volume-static.txt' "volume_static_sha256=$(gatec_file_sha256 volume-static.txt)" || return 1
  ! gatec_create_state_transition resume-state.txt resume-state.sha256 \
    'state_contract_version=1' 'execution_state=FRESH_SHELL_RESUME' \
    'predecessor_state=SERVER_VERIFICATION_COMPLETED' 'transition_epoch=1450' \
    'source_checkpoint_leaf=source-checkpoint.txt' \
    "source_checkpoint_sha256=$(gatec_file_sha256 source-checkpoint.txt)" \
    'source_checkpoint_checksum_leaf=source-checkpoint.sha256' \
    "source_checkpoint_checksum_sha256=$(gatec_file_sha256 source-checkpoint.sha256)" \
    'runtime_bindings_leaf=decision-runtime.txt' \
    "runtime_bindings_sha256=$(gatec_file_sha256 decision-runtime.txt)" \
    'runtime_bindings_checksum_leaf=decision-runtime.sha256' \
    "runtime_bindings_checksum_sha256=$(gatec_file_sha256 decision-runtime.sha256)" >/dev/null 2>&1
}

test_mismatched_terminal_hash() {
  local -a records altered=()
  local record
  use_new_evidence_directory || return 1
  create_bound_source_and_runtime || return 1
  create_client_evidence || return 1
  mapfile -t records < <(terminal_records CANDIDATE_ACCEPTED ALL_MANDATORY_CHECKS_PASS)
  for record in "${records[@]}"; do
    if [[ "$record" = source_checkpoint_sha256=* ]]; then
      altered+=('source_checkpoint_sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    else
      altered+=("$record")
    fi
  done
  ! gatec_create_terminal_decision candidate-accepted.txt candidate-accepted.sha256 \
    "${altered[@]}" >/dev/null 2>&1
}

test_acceptance_after_rollback() {
  local -a records
  create_terminal_fixture ROLLBACK_REQUIRED 1500 FAIL || return 1
  mapfile -t records < <(terminal_records CANDIDATE_ACCEPTED ALL_MANDATORY_CHECKS_PASS)
  ! gatec_create_terminal_decision candidate-accepted.txt candidate-accepted.sha256 \
    "${records[@]}" >/dev/null 2>&1
}

test_acceptance_after_escalation() {
  local -a records
  create_terminal_fixture ESCALATION_REQUIRED || return 1
  mapfile -t records < <(terminal_records CANDIDATE_ACCEPTED ALL_MANDATORY_CHECKS_PASS)
  ! gatec_create_terminal_decision candidate-accepted.txt candidate-accepted.sha256 \
    "${records[@]}" >/dev/null 2>&1
}

test_repeated_classification() {
  local -a records
  create_terminal_fixture CANDIDATE_ACCEPTED || return 1
  mapfile -t records < <(terminal_records CANDIDATE_ACCEPTED ALL_MANDATORY_CHECKS_PASS)
  ! gatec_create_terminal_decision candidate-accepted.txt candidate-accepted.sha256 \
    "${records[@]}" >/dev/null 2>&1
}

test_incompatible_terminal_markers() {
  create_terminal_fixture CANDIDATE_ACCEPTED || return 1
  printf 'terminal_contract_version=1\n' > "$EVIDENCE_DIR/rollback-required.txt"
  chmod 0600 "$EVIDENCE_DIR/rollback-required.txt"
  ! gatec_validate_terminal_decision candidate-accepted.txt candidate-accepted.sha256 >/dev/null 2>&1
}

test_capture_finalization_uncertainty() {
  local status command_status capture_status classification
  use_new_evidence_directory || return 1
  GATEC_SYNTHETIC_TESTING=1 GATEC_SYNTHETIC_FAIL_CAPTURE_FINALIZATION=1 \
    gatec_capture_with_status deployment-output.txt deployment-command-status.txt \
      deployment-capture-status.txt bash -c 'printf "mutation succeeded\n"; exit 0'
  status=$?
  test "$status" -eq 125 || return 1
  gatec_validate_capture_statuses deployment-command-status.txt \
    deployment-capture-status.txt || return 1
  command_status=$(gatec_checkpoint_value deployment-command-status.txt command_exit_status) || return 1
  capture_status=$(gatec_checkpoint_value deployment-capture-status.txt capture_integrity_status) || return 1
  classification=$(gatec_classify_mutation_status "$command_status" "$capture_status") || return 1
  test "$command_status" -eq 0 || return 1
  test "$capture_status" -ne 0 || return 1
  test "$classification" = ESCALATION_REQUIRED
}

expect_success 'successful empty command output is retained' test_empty_capture
expect_success 'failing command status survives captured output' test_failing_capture
expect_success 'successful empty sorted output is retained' test_empty_sorted_capture
expect_success 'failing sorted command status survives output' test_failing_sorted_capture
expect_success 'existing evidence leaf cannot be reused' test_leaf_reuse_rejection
expect_success 'dangling symlink leaf cannot be captured' test_dangling_symlink_rejection
expect_success 'mandatory file contract rejects an omission' test_mandatory_file_contract
expect_success 'checkpoint validates in a separate process' test_cross_process_checkpoint
expect_success 'checkpoint tampering is rejected' test_checkpoint_tampering
expect_success 'duplicate checkpoint key is rejected' test_duplicate_checkpoint_key
expect_success 'runtime identity drift is rejected' test_runtime_drift
expect_success 'late client evidence is rejected' test_late_client_evidence
expect_success 'sorted inventories and manifests are deterministic' test_deterministic_seals
expect_success 'manifest covers every intended file except itself' test_complete_manifest_coverage
expect_failure 'unsafe leaf path is rejected' gatec_validate_leaf '../escape'
expect_success 'symlink evidence is rejected' test_symlink_rejection
expect_success 'duplicate inventory entry is rejected' test_duplicate_rejection
expect_success 'missing evidence file is rejected' test_missing_file_rejection
expect_success 'evidence content tampering is rejected' test_content_tamper_rejection
expect_success 'incorrect evidence-file mode is rejected' test_mode_rejection
expect_success 'incorrect evidence-directory mode is rejected' test_directory_mode_rejection
expect_success 'unexpected evidence subdirectory is rejected' test_subdirectory_rejection
expect_failure 'incorrect ownership metadata is rejected' gatec_assert_file_metadata /etc/hosts
expect_success 'hard-linked evidence is rejected' test_hardlink_rejection
expect_success 'concurrent in-place mutation fails closed' test_concurrent_in_place_mutation
run_parallel_success_tests \
  'exact candidate terminal contract validates' test_valid_terminal_contract \
  'altered client evidence invalidates decision' test_altered_client_evidence \
  'candidate acceptance rejects incomplete PASS values' test_incomplete_pass_values \
  'terminal contract rejects late client evidence' test_terminal_late_evidence \
  'changed source checkpoint invalidates decision' test_changed_checkpoint_evidence \
  'changed runtime evidence invalidates decision' test_changed_runtime_evidence \
  'terminal contract rejects a missing field' test_missing_terminal_field \
  'terminal contract rejects duplicate fields' test_duplicate_terminal_field \
  'state transition rejects invalid predecessor' test_explicit_invalid_state_predecessor \
  'terminal contract rejects mismatched hashes' test_mismatched_terminal_hash \
  'candidate acceptance is impossible after rollback required' test_acceptance_after_rollback \
  'candidate acceptance is impossible after escalation' test_acceptance_after_escalation \
  'terminal classification cannot be repeated' test_repeated_classification \
  'incompatible terminal markers invalidate the decision' test_incompatible_terminal_markers
expect_success 'successful mutation plus capture failure escalates' test_capture_finalization_uncertainty

printf 'RESULT pass=%d fail=%d temp_root=%s\n' "$PASS_COUNT" "$FAIL_COUNT" "$TEST_ROOT"
test "$FAIL_COUNT" -eq 0
