#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly PUBLIC_HOST="dev.alemany.me"
readonly EXPECTED_BRANCH="main"
readonly LIVE_CADDYFILE="/etc/caddy/Caddyfile"
readonly BACKUP_PARENT="/home/alain/backups/nam"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
readonly EXPECTED_CADDYFILE="$REPO_ROOT/infrastructure/server-config/caddy/Caddyfile.dev.example"
readonly CANDIDATE_CADDYFILE="$REPO_ROOT/infrastructure/server-config/caddy/Caddyfile.gate-d"

BACKUP_DIR=""
MUTATION_STARTED=0
CADDY_MUTATED=0
FIREWALL_MUTATED=0
COMPLETED=0

log() {
  printf '[Gate D] %s\n' "$*"
}

fail() {
  printf '[Gate D] ERROR: %s\n' "$*" >&2
  return 1
}

usage() {
  printf 'Usage: sudo %s <authorized-40-character-git-revision>\n' "$0" >&2
}

git_repo() {
  git -c "safe.directory=$REPO_ROOT" -C "$REPO_ROOT" "$@"
}

local_health() {
  curl --noproxy '*' --fail --silent --show-error --max-time 10 \
    http://127.0.0.1:3000/api/health >/dev/null
}

capture_ufw_status() {
  UFW_STATUS="$(ufw status)"
}

ufw_rule_exists() {
  local service="$1" family="$2" public_only="${3:-no}"
  awk -v service="$service" -v family="$family" -v public_only="$public_only" '
    BEGIN { found=0 }
    {
      line=$0
      sub(/[[:space:]]+#.*/, "", line)
      upper=toupper(line)
      is_v6=(upper ~ /\(V6\)/)
      if ((family == "v6" && !is_v6) || (family == "v4" && is_v6)) next
      if (upper !~ /(^|[[:space:]])ALLOW([[:space:]]+IN)?([[:space:]]|$)/) next
      if (public_only == "yes" && upper !~ /(^|[[:space:]])ANYWHERE([[:space:]]|$)/) next
      if (service == "ssh" && upper ~ /^[[:space:]]*(OPENSSH|22(\/TCP)?)([[:space:]]|$)/) found=1
      if (service == "80" && upper ~ /^[[:space:]]*80(\/TCP)?([[:space:]]|$)/) found=1
      if (service == "443" && upper ~ /^[[:space:]]*443(\/TCP)?([[:space:]]|$)/) found=1
      if (service == "443udp" && upper ~ /^[[:space:]]*443\/UDP([[:space:]]|$)/) found=1
    }
    END { exit(found ? 0 : 1) }
  ' <<< "$UFW_STATUS"
}

require_public_allow() {
  local service="$1" family="$2"
  ufw_rule_exists "$service" "$family" yes ||
    fail "UFW lacks the expected public $service allow for $family."
}

require_no_allow() {
  local service="$1" family="$2"
  if ufw_rule_exists "$service" "$family" no; then
    fail "UFW still contains an allow for $service on $family."
  fi
}

restore_file_atomically() {
  local backup="$1" target="$2" temporary="${target}.gate-d-restore-$$"
  test ! -e "$temporary" || return 1
  cp --archive -- "$backup" "$temporary" || return 1
  mv --force -- "$temporary" "$target"
}

rollback() {
  local rollback_ok=1
  set +e
  trap - EXIT INT TERM
  log "Failure occurred after mutation began; starting automatic rollback."

  if (( CADDY_MUTATED )); then
    if restore_file_atomically "$BACKUP_DIR/Caddyfile" "$LIVE_CADDYFILE" &&
      caddy validate --config "$LIVE_CADDYFILE" --adapter caddyfile >/dev/null &&
      systemctl reload caddy &&
      systemctl is-active --quiet caddy; then
      log "Caddy configuration restored and reloaded."
    else
      rollback_ok=0
      log "Caddy rollback failed."
    fi
  fi

  if (( FIREWALL_MUTATED )); then
    if restore_file_atomically "$BACKUP_DIR/user.rules" /etc/ufw/user.rules &&
      restore_file_atomically "$BACKUP_DIR/user6.rules" /etc/ufw/user6.rules &&
      ufw reload >/dev/null && capture_ufw_status &&
      [[ "$UFW_STATUS" =~ Status:[[:space:]]+active ]] &&
      ufw_rule_exists ssh v4 yes && ufw_rule_exists ssh v6 yes; then
      log "UFW rule files restored and reloaded; public SSH remains allowed."
    else
      rollback_ok=0
      log "UFW rollback failed or SSH allow verification failed."
    fi
  fi

  if ! caddy validate --config "$LIVE_CADDYFILE" --adapter caddyfile >/dev/null ||
    ! systemctl is-active --quiet caddy || ! local_health; then
    rollback_ok=0
    log "Post-rollback Caddy or local application verification failed."
  fi

  if (( rollback_ok )); then
    log "FINAL VERDICT: CUTOVER FAILED; ROLLBACK SUCCEEDED."
    log "Backup retained at: $BACKUP_DIR"
    exit 1
  fi

  log "FINAL VERDICT: CUTOVER FAILED; ROLLBACK INCOMPLETE."
  log "Manual recovery material: $BACKUP_DIR"
  exit 70
}

on_exit() {
  local status=$?
  if (( status != 0 && MUTATION_STARTED && !COMPLETED )); then
    rollback
  fi
  if (( status != 0 && !MUTATION_STARTED )); then
    log "FINAL VERDICT: PRECHECK FAILED; NO CUTOVER MUTATION OCCURRED."
  fi
  exit "$status"
}

public_request_must_fail() {
  local scheme="$1" result
  set +e
  curl --noproxy '*' --silent --show-error --output /dev/null \
    --connect-timeout 5 --max-time 15 "$scheme://$PUBLIC_HOST/api/health"
  result=$?
  set -e
  case "$result" in
    7|28) return 0 ;;
    0) fail "$scheme://$PUBLIC_HOST still returned an HTTP response." ;;
    *) fail "$scheme://$PUBLIC_HOST failed with curl exit $result, not a reviewed connection refusal or timeout." ;;
  esac
}

trap on_exit EXIT
trap 'exit 130' INT TERM

if (( EUID != 0 )); then
  usage
  fail "Run this script once with sudo."
fi
if (( $# != 1 )); then
  usage
  fail "Exactly one authorized revision argument is required."
fi
readonly AUTHORIZED_REVISION="$1"
[[ "$AUTHORIZED_REVISION" =~ ^[0-9a-f]{40}$ ]] ||
  fail "The authorized revision must be a full lowercase 40-character Git SHA."

log "Running prechecks; no cutover mutation has begun."
[[ "$(git_repo branch --show-current)" == "$EXPECTED_BRANCH" ]] ||
  fail "The repository must be on $EXPECTED_BRANCH."
[[ "$(git_repo rev-parse HEAD)" == "$AUTHORIZED_REVISION" ]] ||
  fail "HEAD does not match the explicitly authorized revision."
[[ -z "$(git_repo status --porcelain=v1 --untracked-files=normal)" ]] ||
  fail "The repository worktree or index is not clean."

if [[ ! -t 0 ]]; then
  fail "Interactive confirmation requires a terminal on standard input."
fi
printf 'Type SECOND SESSION OPEN to confirm a separate public-key SSH session is open and idle: '
IFS= read -r SECOND_SESSION_CONFIRMATION
[[ "$SECOND_SESSION_CONFIRMATION" == "SECOND SESSION OPEN" ]] ||
  fail "Second-session confirmation was not provided."

systemctl is-active --quiet caddy || fail "Caddy is not active."
systemctl is-active --quiet ssh || fail "SSH is not active."
caddy validate --config "$LIVE_CADDYFILE" --adapter caddyfile >/dev/null ||
  fail "The current Caddy configuration does not validate."

CURRENT_CADDY_JSON="$(caddy adapt --config "$LIVE_CADDYFILE" --adapter caddyfile 2>/dev/null)" ||
  fail "The live Caddyfile could not be adapted for comparison."
EXPECTED_CADDY_JSON="$(caddy adapt --config "$EXPECTED_CADDYFILE" --adapter caddyfile 2>/dev/null)" ||
  fail "The repository development Caddyfile could not be adapted."
[[ "$CURRENT_CADDY_JSON" == "$EXPECTED_CADDY_JSON" ]] ||
  fail "The live Caddy configuration is not the sole expected NAM route."

CANDIDATE_CADDY_JSON="$(caddy adapt --config "$CANDIDATE_CADDYFILE" --adapter caddyfile 2>/dev/null)" ||
  fail "The proposed Gate D Caddyfile could not be adapted."
[[ "$CANDIDATE_CADDY_JSON" != *'"apps"'* ]] ||
  fail "The proposed Gate D Caddyfile unexpectedly defines a server application."
caddy validate --config "$CANDIDATE_CADDYFILE" --adapter caddyfile >/dev/null ||
  fail "The proposed Gate D Caddy configuration does not validate."
local_health || fail "The application health endpoint is not responding locally."

capture_ufw_status
[[ "$UFW_STATUS" =~ Status:[[:space:]]+active ]] || fail "UFW is not active."
require_public_allow ssh v4
require_public_allow ssh v6
require_public_allow 80 v4
require_public_allow 80 v6
require_public_allow 443 v4
require_public_allow 443 v6
require_no_allow 443udp v4
require_no_allow 443udp v6

DNS_A="$(dig +time=5 +tries=1 +short A "$PUBLIC_HOST")" ||
  fail "The public A-record lookup failed."
[[ -n "$DNS_A" ]] || fail "$PUBLIC_HOST has no public A record."
LOCAL_IPV4_ADDRESSES="$(ip -o -4 address show scope global)" ||
  fail "Local IPv4 addresses could not be inspected."
while IFS= read -r address; do
  [[ "$address" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] ||
    fail "$PUBLIC_HOST returned a non-IPv4 A-record answer."
  [[ "$LOCAL_IPV4_ADDRESSES" == *" inet $address/"* ]] ||
    fail "$PUBLIC_HOST does not resolve to an IPv4 address assigned to this VPS."
done <<< "$DNS_A"
DNS_AAAA="$(dig +time=5 +tries=1 +short AAAA "$PUBLIC_HOST")" ||
  fail "The public AAAA-record lookup failed."
[[ -z "$DNS_AAAA" ]] || fail "$PUBLIC_HOST has an unexpected AAAA record."
DNS_CNAME="$(dig +time=5 +tries=1 +short CNAME "$PUBLIC_HOST")" ||
  fail "The public CNAME lookup failed."
[[ -z "$DNS_CNAME" ]] || fail "$PUBLIC_HOST has an unexpected CNAME."

test -d "$BACKUP_PARENT" || fail "Backup parent $BACKUP_PARENT does not exist."
test -f /etc/ufw/user.rules && test -f /etc/ufw/user6.rules ||
  fail "Required UFW rule files are missing."
log "All prechecks passed."

RUN_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$(mktemp -d "$BACKUP_PARENT/gate-d-${RUN_STAMP}-XXXXXX")"
chmod 0700 "$BACKUP_DIR"
cp --archive -- "$LIVE_CADDYFILE" "$BACKUP_DIR/Caddyfile"
cp --archive -- /etc/ufw/user.rules "$BACKUP_DIR/user.rules"
cp --archive -- /etc/ufw/user6.rules "$BACKUP_DIR/user6.rules"
log "Private rollback backup created: $BACKUP_DIR"

MUTATION_STARTED=1
CADDY_MUTATED=1
CADDY_UID="$(stat -c %u "$LIVE_CADDYFILE")"
CADDY_GID="$(stat -c %g "$LIVE_CADDYFILE")"
CADDY_MODE="$(stat -c %a "$LIVE_CADDYFILE")"
CADDY_TEMP="/etc/caddy/.Caddyfile.gate-d-$$"
test ! -e "$CADDY_TEMP" || fail "Temporary Caddy path already exists."
install --owner="$CADDY_UID" --group="$CADDY_GID" --mode="$CADDY_MODE" \
  "$CANDIDATE_CADDYFILE" "$CADDY_TEMP"
caddy validate --config "$CADDY_TEMP" --adapter caddyfile >/dev/null
mv --force -- "$CADDY_TEMP" "$LIVE_CADDYFILE"
systemctl reload caddy
systemctl is-active --quiet caddy
log "Caddy public NAM route removed with a graceful reload."

FIREWALL_MUTATED=1
ufw --force delete allow 80/tcp >/dev/null
ufw --force delete allow 443/tcp >/dev/null
capture_ufw_status
[[ "$UFW_STATUS" =~ Status:[[:space:]]+active ]]
require_public_allow ssh v4
require_public_allow ssh v6
require_no_allow 80 v4
require_no_allow 80 v6
require_no_allow 443 v4
require_no_allow 443 v6
require_no_allow 443udp v4
require_no_allow 443udp v6
log "Public TCP 80/443 allows removed; SSH/TCP 22 remains allowed."

caddy validate --config "$LIVE_CADDYFILE" --adapter caddyfile >/dev/null
systemctl is-active --quiet caddy
local_health
public_request_must_fail http
public_request_must_fail https

COMPLETED=1
log "FINAL VERDICT: CUTOVER SUCCEEDED."
log "Public HTTP/HTTPS are refused or filtered; local application health remains good."
log "Backup retained at: $BACKUP_DIR"
