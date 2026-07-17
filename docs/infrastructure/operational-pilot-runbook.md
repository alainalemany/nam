# Operational Pilot Runbook

This runbook is the canonical preparation and execution procedure for the first
controlled NAM Dashboard real-data pilot.

It coordinates access authorization, deployment verification, reference-data
preparation, PostgreSQL recovery evidence, pilot entry order, and the pilot exit
review. General infrastructure commands remain in
[Infrastructure Operations](../infrastructure.md), development commands remain
in the [Development Guide](../development.md), and actual disaster recovery
remains governed by [Server Identity Disaster Recovery](disaster-recovery.md).

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | The gates and procedures in this runbook are approved pilot requirements. |
| Recommended | A later operator choice that remains subject to an explicit decision. |
| Open Question | A matter that blocks pilot authorization until resolved. |

## Current Baseline

The Phase 24.2 assessment established this baseline:

- Repository commit `3753168` is clean and synchronized with `origin/main`.
- PostgreSQL is healthy, private to the Docker network, and has all 16 current
  migrations applied with matching checksums.
- The application container is bound to `127.0.0.1:3000`, but host-level Caddy
  exposes `https://dev.alemany.me` publicly without authentication.
- The running application image predates `3753168` and its Day View shows eight
  contributors; the repository implementation has ten.
- City, Mine, Equipment, Timesheet reference, and Fuel Service Person tables
  have no operational reference records.
- Existing product records are one Phase 3.2 Daily Log smoke record and its one
  activity. `phase2a_persistence_check` contains one infrastructure row.
- Existing backup archives contain only the old Phase 2A persistence-check
  schema and are not current recovery evidence.
- Photo evidence is unavailable and remains blocked by ADR-018.

This document defines procedures only. None of these gates is considered
passed until a later authorized milestone executes and records the evidence.

## Pilot Authorization Gates

Real operational data must not be entered unless every row below is explicitly
signed off. A skipped, unknown, or partially verified gate is a failed gate.

| Gate | Required evidence | Status before execution |
| --- | --- | --- |
| Access | Approved private boundary active; public bypass denied; approved devices work; PostgreSQL remains unpublished. | Blocked |
| Deployment | Intended clean commit deployed; health and migrations pass; Day View has ten contributors; no temporary containers remain. | Blocked |
| Reference data | Minimum location, Equipment, Timesheet, fuel, and snapshot-name context reviewed and signed off. | Blocked |
| Recovery | Current-schema archive validated and restored successfully into a disposable database without touching live data. | Blocked |
| Pilot scope | First-shift modules, entry order, date rules, and event-driven exclusions understood. | Blocked |

The operator must record the approver, date, evidence location, and pass/fail
result for each gate before authorizing the first shift.

### Access Gate

ADR-019 approves a managed private overlay network, with Tailscale as the
implementation reference, for the controlled pilot. Independent administrator
recovery remains key-only SSH to the VPS public address through a non-root
account.

The current public unauthenticated Caddy endpoint does not qualify. TLS, hidden
navigation, unpredictable URLs, `robots.txt`, and obscurity do not provide
authorization.

Verification must prove all of the following:

- The public route is disabled or protected by the approved access boundary.
- An unauthorized request from outside that boundary cannot reach any
  application page, health route, static application asset, or mutation path.
- Approved iPad, iPhone, and permitted corporate Android devices can reach the
  application through the selected boundary when those devices are in scope.
- Administrative recovery access remains available if the user-facing boundary
  fails.
- `docker compose ps` still shows the application published only on
  `127.0.0.1:3000`.
- PostgreSQL has no host-published port.
- Access can be disabled quickly without deleting application data.

Architecture approval does not pass the Access Gate. The later implementation
must execute the sequence below, preserve evidence, and receive independent
acceptance. Tailscale controls network reachability only; it does not authorize
users or records inside NAM Dashboard.

#### Access Policy Requirements

The future tailnet policy must:

- Remove the default allow-all policy and deny access by default.
- Grant only approved pilot devices or approved identities.
- Grant only the NAM private HTTPS service and its required port.
- Avoid all-device, all-destination, and all-port grants.
- Prevent unapproved tailnet members from reaching NAM.
- Support immediate device removal and require approval before re-enrollment.
- Keep SSH recovery outside the NAM application path.
- Keep Tailscale Funnel and every public-sharing capability disabled.

Do not record reusable auth keys, private keys, recovery codes, or real
credential values in this repository or in pilot evidence.

#### Controlled Implementation Sequence

Execute these steps only in a separately authorized infrastructure milestone:

1. Capture the current privileged UFW rules and effective SSH configuration.
2. Verify independent key-only SSH recovery through the non-root administrator
   account.
3. Create and secure the Tailscale administrative account.
4. Enable administrator MFA and device approval.
5. Install and enroll the VPS.
6. Enroll approved Windows and mobile devices.
7. Remove the default allow-all policy and configure explicit deny-by-default
   grants for the NAM HTTPS service only.
8. Configure tailnet-only private HTTPS forwarding to `127.0.0.1:3000`.
9. Confirm Tailscale Funnel and every public-sharing capability are disabled.
10. Verify private access from each approved device class in pilot scope.
11. Verify denial from an unapproved overlay device.
12. Remove the public Caddy application route.
13. Remove public DNS reachability for `dev.alemany.me`.
14. Close public TCP `80` and `443` and UDP `443` over IPv4 and IPv6.
15. Verify no direct IP, hostname, Caddy, IPv4, IPv6, or other public bypass
    exists.
16. Verify private-only access persists across VPS reboot and Docker restart.
17. Verify device removal revokes access and re-enrollment requires approval.
18. Record the Access Gate evidence and independent review result.

Do not enter real operational data during this transition. Removing only the
public DNS `A` record is insufficient. Public Caddy routing and public firewall
ingress must both be removed or blocked, and both address families must be
tested.

The pilot uses a non-sensitive private overlay hostname with HTTPS and no
browser warning. Consider certificate-transparency visibility when selecting
the hostname. Direct IP bookmarks with certificate warnings are not the normal
mobile workflow. `dev.alemany.me` remains reserved for a future explicitly
authenticated public deployment.

#### Administrator Recovery Evidence

Before public web access is disabled, verify and record that:

- A non-root administrator can connect by SSH key through the VPS public
  address.
- Password authentication is disabled in the effective SSH configuration.
- A recovery key exists on a separate administrator-controlled device.
- Recovery does not depend on Tailscale, Caddy, DNS, Docker, or the application
  database.
- The administrator can disable private serving or revoke devices without
  exposing private keys or access-policy secrets.

Failure of the private path after public removal must leave NAM unavailable.
Do not restore unauthenticated public Caddy access as an automatic fallback.

#### Access Gate Verification Evidence

The implementation record must prove:

- Public unauthenticated IPv4 and IPv6 access fail.
- Approved Windows access and at least one approved mobile-device path succeed.
- An unapproved overlay device cannot reach NAM.
- Private HTTPS produces no browser warning.
- Port `3000` remains loopback-only and PostgreSQL remains unpublished.
- No Caddy, direct IP, DNS, Funnel, or other public bypass remains.
- Application health, required routes, and all ten Day View contributors work
  through the private service.
- Device removal revokes access and re-enrollment requires approval.
- VPS reboot and Docker restart preserve private-only access.
- Key-only SSH recovery works independently.
- Access can be disabled rapidly without modifying application data.

The durable boundary and rollback rules are recorded in
[ADR-019](../decisions/adr-019-managed-private-overlay-operational-pilot.md).

### Deployment Gate

Run these steps only in a separately authorized deployment milestone.

Run this complete block from the repository root. Do not execute only selected
lines. It verifies the repository before any build, binds the recreated
container to the image produced by that build, and rolls back only the
application service if a post-recreation assertion fails. It never recreates
PostgreSQL and never removes `postgres-data`.

```bash
set -euo pipefail
set -E

nam_deployment_fail() {
  printf 'DEPLOYMENT GATE: FAIL - %s\n' "$1" >&2
  return 1
}

NAM_APP_RECREATION_ATTEMPTED=0
NAM_ROLLBACK_TAG=""

nam_deployment_error() {
  local exit_code=$?
  local failed_line=$1
  local failed_command=$2
  trap - ERR
  printf 'DEPLOYMENT GATE: FAIL - line %s: %s\n' \
    "$failed_line" "$failed_command" >&2

  if [[ "$NAM_APP_RECREATION_ATTEMPTED" -eq 1 && -n "$NAM_ROLLBACK_TAG" ]]; then
    printf 'Attempting application-only rollback with %s.\n' \
      "$NAM_ROLLBACK_TAG" >&2
    if docker image tag "$NAM_ROLLBACK_TAG" nam-app \
      && docker compose up -d --no-deps --force-recreate app \
      && curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
      printf 'Application rollback completed; Deployment Gate remains failed.\n' >&2
    else
      printf 'MANUAL ROLLBACK REQUIRED: preserve PostgreSQL and restore app image %s.\n' \
        "$NAM_ROLLBACK_TAG" >&2
    fi
  fi

  exit "$exit_code"
}

trap 'nam_deployment_error "$LINENO" "$BASH_COMMAND"' ERR

NAM_EXPECTED_BRANCH=main
NAM_ACTUAL_BRANCH="$(git symbolic-ref --quiet --short HEAD)"
[[ "$NAM_ACTUAL_BRANCH" == "$NAM_EXPECTED_BRANCH" ]] \
  || nam_deployment_fail "current branch is $NAM_ACTUAL_BRANCH, expected main"

git diff --quiet HEAD -- \
  || nam_deployment_fail "tracked files differ from HEAD"
git diff --cached --quiet -- \
  || nam_deployment_fail "staged changes are present"
git diff --quiet -- \
  || nam_deployment_fail "unstaged changes are present"
NAM_UNTRACKED_FILES="$(git ls-files --others --exclude-standard)"
[[ -z "$NAM_UNTRACKED_FILES" ]] \
  || nam_deployment_fail "untracked files are present: $NAM_UNTRACKED_FILES"

git fetch --quiet origin main
NAM_LOCAL_HEAD="$(git rev-parse --verify HEAD)"
NAM_ORIGIN_MAIN="$(git rev-parse --verify refs/remotes/origin/main)"
[[ "$NAM_LOCAL_HEAD" == "$NAM_ORIGIN_MAIN" ]] \
  || nam_deployment_fail "local HEAD $NAM_LOCAL_HEAD does not equal origin/main $NAM_ORIGIN_MAIN"
NAM_DEPLOY_COMMIT="$NAM_LOCAL_HEAD"
[[ "$NAM_DEPLOY_COMMIT" =~ ^[0-9a-f]{40}$ ]] \
  || nam_deployment_fail "intended commit SHA is malformed"

NAM_PREVIOUS_APP_IMAGE="$(docker inspect nam-app --format '{{.Image}}')"
[[ "$NAM_PREVIOUS_APP_IMAGE" =~ ^sha256:[0-9a-f]{64}$ ]] \
  || nam_deployment_fail "current application image identity is unavailable"
NAM_ROLLBACK_TAG="nam-app:pilot-rollback-$(date -u +%Y%m%dT%H%M%S%NZ)-${NAM_DEPLOY_COMMIT:0:12}"
if docker image inspect "$NAM_ROLLBACK_TAG" >/dev/null 2>&1; then
  nam_deployment_fail "rollback tag already exists: $NAM_ROLLBACK_TAG"
fi
docker image tag "$NAM_PREVIOUS_APP_IMAGE" "$NAM_ROLLBACK_TAG"

NAM_POSTGRES_HEALTH="$(docker inspect nam-postgres --format '{{.State.Health.Status}}')"
[[ "$NAM_POSTGRES_HEALTH" == "healthy" ]] \
  || nam_deployment_fail "PostgreSQL is not healthy before deployment"

docker compose build app
NAM_BUILT_IMAGE="$(docker image inspect nam-app --format '{{.Id}}')"
[[ "$NAM_BUILT_IMAGE" =~ ^sha256:[0-9a-f]{64}$ ]] \
  || nam_deployment_fail "built application image identity is unavailable"

NAM_APP_RECREATION_ATTEMPTED=1
docker compose up -d --no-deps --force-recreate app

NAM_DEPLOYED_IMAGE="$(docker inspect nam-app --format '{{.Image}}')"
[[ "$NAM_DEPLOYED_IMAGE" == "$NAM_BUILT_IMAGE" ]] \
  || nam_deployment_fail "deployed image $NAM_DEPLOYED_IMAGE does not match built image $NAM_BUILT_IMAGE"
[[ "$(docker inspect nam-app --format '{{.State.Status}}')" == "running" ]] \
  || nam_deployment_fail "application container is not running"
[[ "$(docker inspect nam-postgres --format '{{.State.Health.Status}}')" == "healthy" ]] \
  || nam_deployment_fail "PostgreSQL is not healthy after deployment"
[[ "$(docker inspect nam-postgres --format '{{json .NetworkSettings.Ports}}')" == '{"5432/tcp":null}' ]] \
  || nam_deployment_fail "PostgreSQL has an unexpected published port"
[[ "$(docker inspect nam-app --format '{{json .NetworkSettings.Ports}}')" == *'"HostIp":"127.0.0.1"'* ]] \
  || nam_deployment_fail "application is not bound to host loopback"
curl -fsS http://127.0.0.1:3000/api/health >/dev/null \
  || nam_deployment_fail "application health endpoint failed"

NAM_REPOSITORY_MIGRATIONS="$({
  for migration_file in prisma/migrations/*/migration.sql; do
    migration_name="$(basename "$(dirname "$migration_file")")"
    migration_checksum="$(sha256sum "$migration_file" | awk '{print $1}')"
    printf '%s|%s\n' "$migration_name" "$migration_checksum"
  done
} | sort)"
NAM_DATABASE_MIGRATIONS="$(docker compose exec -T postgres sh -c \
  'psql -X -At -F "|" -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT migration_name, checksum FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;"' \
  | tr -d '\r')"
NAM_PROBLEM_MIGRATION_COUNT="$(docker compose exec -T postgres sh -c \
  'psql -X -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;"' \
  | tr -d '\r')"
[[ -n "$NAM_REPOSITORY_MIGRATIONS" ]] \
  || nam_deployment_fail "repository migration inventory is empty"
[[ "$NAM_DATABASE_MIGRATIONS" == "$NAM_REPOSITORY_MIGRATIONS" ]] \
  || nam_deployment_fail "database migration names or checksums do not match the repository"
[[ "$NAM_PROBLEM_MIGRATION_COUNT" == "0" ]] \
  || nam_deployment_fail "database contains failed, unfinished, or rolled-back migration rows"

NAM_DAY_VIEW_HTML="$(curl -fsS http://127.0.0.1:3000/day-view)"
NAM_DAY_VIEW_COUNT="$(printf '%s' "$NAM_DAY_VIEW_HTML" | awk '
  BEGIN { count = 0 }
  {
    text = $0
    while (match(text, /class="panel table-panel"/)) {
      count++
      text = substr(text, RSTART + RLENGTH)
    }
  }
  END { print count }
')"
[[ "$NAM_DAY_VIEW_COUNT" == "10" ]] \
  || nam_deployment_fail "Day View has $NAM_DAY_VIEW_COUNT contributors, expected 10"

for label in \
  "Work Schedule" "Timesheet" "Daily Logs" "STOP Cards" \
  "Daily Inspections" "Operational Safety Checklists" "Shift Reports" \
  "Work Authorizations" "Defects" "Equipment Fuel Events"
do
  if ! grep -Fq ">$label<" <<< "$NAM_DAY_VIEW_HTML"; then
    nam_deployment_fail "Day View contributor label is missing: $label"
  fi
done

for path in \
  /day-view /equipment /equipment/new \
  /work-schedule /work-schedule/new \
  /operational-safety-checklists /operational-safety-checklists/new \
  /daily-logs /daily-logs/new /timesheets /timesheets/new \
  /stop-cards /stop-cards/new \
  /daily-inspections /daily-inspections/new \
  /defect-tracking /defect-tracking/new \
  /equipment-fuel-events /equipment-fuel-events/new \
  /shift-reports /shift-reports/new \
  /work-authorizations /work-authorizations/new
do
  if ! route_status="$(curl -sS -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:3000$path")"; then
    nam_deployment_fail "route request failed: $path"
  fi
  [[ "$route_status" == "200" ]] \
    || nam_deployment_fail "route $path returned HTTP $route_status, expected 200"
done

NAM_COMPOSE_CONTAINERS="$(docker ps -a \
  --filter label=com.docker.compose.project=nam \
  --format '{{.Names}}')"
NAM_UNEXPECTED_CONTAINERS="$(printf '%s\n' "$NAM_COMPOSE_CONTAINERS" \
  | awk '$0 != "" && $0 != "nam-app" && $0 != "nam-postgres"')"
[[ -z "$NAM_UNEXPECTED_CONTAINERS" ]] \
  || nam_deployment_fail "unexpected NAM Compose containers remain: $NAM_UNEXPECTED_CONTAINERS"

NAM_DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
trap - ERR
printf 'DEPLOYMENT GATE: PASS - commit=%s image=%s previous_image=%s rollback_tag=%s deployed_at=%s contributors=10\n' \
  "$NAM_DEPLOY_COMMIT" "$NAM_DEPLOYED_IMAGE" "$NAM_PREVIOUS_APP_IMAGE" \
  "$NAM_ROLLBACK_TAG" "$NAM_DEPLOYED_AT"
```

The PASS line is the machine-visible deployment result. Preserve it with the
operator, reviewer, route result, migration result, and image identities. Do
not delete the rollback tag until deployment and pilot preparation are
accepted. Any rollback leaves the Deployment Gate failed even when the prior
application is healthy.

### Reference-Data Gate

No real shift starts until this checklist is complete.

#### Locations

- [ ] City spelling verified.
- [ ] State value verified.
- [ ] Mine spelling verified.
- [ ] Mine type entered only when known.
- [ ] Existing City and Mine rows reviewed before creating similarly named
  records.

#### Equipment

For every expected pilot machine, verify:

- [ ] Display name.
- [ ] Unique Equipment number.
- [ ] Category.
- [ ] Power type when known.
- [ ] Instrumentation type when known.
- [ ] Mine and City relationship.
- [ ] Active status.
- [ ] Dragline or Mobile checklist eligibility.
- [ ] Expected meter-unit suggestion: Dragline suggests `HOURS`, Work Truck
  suggests `MILES`, and Tractor/Forklift require explicit selection.
- [ ] Fuel compatibility when the machine may receive a Fuel Event.

The likely first-shift set should explicitly consider Dragline 133, the assigned
work truck, the assigned tractor, and only other Equipment actually expected.
Do not fabricate unknown details. Verify required facts before entry and leave
optional facts unset only where the implemented schema permits it.

#### Timesheet References

- [ ] Active Work Codes cover expected work allocations.
- [ ] Work Orders exist only for real, known orders.
- [ ] Support Personnel exist only for real, known people and roles.
- [ ] Inactive records are not selected for new work.

#### Fuel References

- [ ] Fuel Service Personnel are created only when needed.
- [ ] Display-name spelling and normalized duplicate handling are reviewed.
- [ ] Equipment power type supports the fuel type that may be entered.

#### Snapshot Names

Record and reuse the verified display spelling for:

- Operator.
- Supervisor.
- Partner.
- Assigned By.
- Schedule source description.
- Support Personnel.

These are historical display snapshots, not authentication identities.

#### Duplicate And Status Review

- [ ] City, Mine, and Equipment names reviewed case-insensitively.
- [ ] Leading, trailing, and repeated internal whitespace reviewed.
- [ ] Equipment numbers reviewed for duplicates across all Mines.
- [ ] Similar Equipment display names reviewed in their Mine context.
- [ ] Active, inactive, and archived states reviewed.
- [ ] A second person signs off the final Stage A list or the sole operator
  records a deliberate self-review date.

### Recovery Gate

The gate passes only after a current-schema baseline backup is created,
structurally validated, checksummed, and restored successfully into a
disposable database using the procedures below. Listing an archive does not
prove that it can be restored.

### Pilot-Scope Gate

Before the first shift, the operator must confirm:

- The first-shift feature list and entry order below are understood.
- Operational dates use the date on which the shift starts.
- Event-driven features are not filled with invented records.
- Completed-record correction and Timesheet reopen behavior are understood.
- The external corporate website is not updated or verified by NAM Dashboard.
- Optional relationships remain null when no verified relationship exists.
- Photo evidence is unavailable.

## Smoke-Test Data Disposition

Known pre-pilot records are:

- One Phase 3.2 Daily Log smoke record.
- Its associated Daily Log activity.
- One `phase2a_persistence_check` infrastructure row.

`phase2a_persistence_check` is not product data.

### Option A: Preserve And Classify

Record the exact IDs and dates in the pilot authorization evidence, label them
as synthetic/infrastructure state, and exclude them from pilot counts,
retrieval conclusions, and data-quality findings.

### Option B: Approved Administrative Cleanup

Cleanup may occur only after the exact IDs and relationships are verified, a
current backup exists, deletion effects are understood, and the user explicitly
authorizes the database change. Cleanup is not part of normal feature behavior.

Option A is recommended for the first pilot. It avoids an unnecessary database
mutation during preparation, preserves known verification evidence, and is safe
because the records are identifiable and predate the pilot. Reconsider cleanup
only if they materially confuse real retrieval.

## PostgreSQL Backup Procedure

The authoritative backup directory is:

```text
/home/alain/backups/nam/postgres/
```

The baseline backup must occur after private access, current deployment,
reference-data review, and smoke-data disposition are recorded. Phase 23.5 is
unimplemented, so no media archive is part of this backup set.

Before running the block, export nonempty values for
`NAM_ACCESS_GATE_EVIDENCE`, `NAM_DEPLOYMENT_GATE_EVIDENCE`,
`NAM_REFERENCE_GATE_EVIDENCE`, `NAM_SMOKE_DISPOSITION`,
`NAM_SMOKE_DAILY_LOG_ID`, `NAM_SMOKE_ACTIVITY_ID`, and
`NAM_BACKUP_OPERATOR`. Evidence values must be single-line identifiers, not
secrets. Run the complete block from the clean deployed repository checkout;
do not copy only its manifest or publication portion.

```bash
set -euo pipefail
set -E
umask 077

nam_backup_fail() {
  printf 'RECOVERY GATE BACKUP: FAIL - %s\n' "$1" >&2
  return 1
}

nam_backup_error() {
  local exit_code=$?
  trap - ERR
  printf 'RECOVERY GATE BACKUP: FAIL - line %s: %s\n' "$1" "$2" >&2
  exit "$exit_code"
}

NAM_BACKUP_TEMP_FILES=()
NAM_BACKUP_COMPLETE=0

nam_backup_cleanup() {
  local original_status=$?
  local cleanup_status=0
  local temporary_path
  for temporary_path in "${NAM_BACKUP_TEMP_FILES[@]}"; do
    if [[ -n "$temporary_path" && -e "$temporary_path" ]]; then
      rm -f -- "$temporary_path" || cleanup_status=1
    fi
  done
  if [[ "$NAM_BACKUP_COMPLETE" -ne 1 ]]; then
    printf 'RECOVERY GATE BACKUP: FAIL - no backup success was recorded.\n' >&2
  fi
  if [[ "$cleanup_status" -ne 0 ]]; then
    printf 'RECOVERY GATE BACKUP: FAIL - temporary artifact cleanup failed.\n' >&2
    return 1
  fi
  return "$original_status"
}

nam_require_single_line() {
  local variable_name=$1
  local variable_value=$2
  [[ -n "$variable_value" ]] \
    || nam_backup_fail "$variable_name is required and cannot be empty"
  [[ "$variable_value" != *$'\n'* && "$variable_value" != *$'\r'* ]] \
    || nam_backup_fail "$variable_name must be a single-line value"
}

nam_psql() {
  local database_name=$1
  local sql_text=$2
  if [[ -z "$database_name" || -z "$sql_text" ]]; then
    nam_backup_fail "database name and SQL text are required"
    return 1
  fi
  docker compose exec -T postgres sh -c \
    'test -n "$1" && test -n "$2" && exec psql -X -At -F "|" \
      -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "$2"' \
    sh "$database_name" "$sql_text" | tr -d '\r'
}

nam_publish_without_replace() {
  local source_path=$1
  local target_path=$2
  local source_identity
  [[ -f "$source_path" ]] || nam_backup_fail "publish source is missing: $source_path"
  [[ ! -e "$target_path" ]] || nam_backup_fail "refusing to replace existing artifact: $target_path"
  source_identity="$(stat -Lc '%d:%i' "$source_path")"
  mv --no-clobber --no-target-directory -- "$source_path" "$target_path"
  [[ ! -e "$source_path" ]] \
    || nam_backup_fail "non-overwriting move did not publish $target_path"
  [[ -f "$target_path" && "$(stat -Lc '%d:%i' "$target_path")" == "$source_identity" ]] \
    || nam_backup_fail "published artifact identity is incorrect: $target_path"
}

trap 'nam_backup_error "$LINENO" "$BASH_COMMAND"' ERR
trap nam_backup_cleanup EXIT

: "${NAM_ACCESS_GATE_EVIDENCE:?Export NAM_ACCESS_GATE_EVIDENCE before running.}"
: "${NAM_DEPLOYMENT_GATE_EVIDENCE:?Export NAM_DEPLOYMENT_GATE_EVIDENCE before running.}"
: "${NAM_REFERENCE_GATE_EVIDENCE:?Export NAM_REFERENCE_GATE_EVIDENCE before running.}"
: "${NAM_SMOKE_DISPOSITION:?Export NAM_SMOKE_DISPOSITION before running.}"
: "${NAM_SMOKE_DAILY_LOG_ID:?Export NAM_SMOKE_DAILY_LOG_ID before running.}"
: "${NAM_SMOKE_ACTIVITY_ID:?Export NAM_SMOKE_ACTIVITY_ID before running.}"
: "${NAM_BACKUP_OPERATOR:?Export NAM_BACKUP_OPERATOR before running.}"

for required_name in \
  NAM_ACCESS_GATE_EVIDENCE NAM_DEPLOYMENT_GATE_EVIDENCE \
  NAM_REFERENCE_GATE_EVIDENCE NAM_SMOKE_DISPOSITION \
  NAM_SMOKE_DAILY_LOG_ID NAM_SMOKE_ACTIVITY_ID NAM_BACKUP_OPERATOR
do
  nam_require_single_line "$required_name" "${!required_name}"
done
[[ "$NAM_SMOKE_DAILY_LOG_ID" =~ ^[A-Za-z0-9_-]{1,100}$ ]] \
  || nam_backup_fail "NAM_SMOKE_DAILY_LOG_ID is malformed"
[[ "$NAM_SMOKE_ACTIVITY_ID" =~ ^[A-Za-z0-9_-]{1,100}$ ]] \
  || nam_backup_fail "NAM_SMOKE_ACTIVITY_ID is malformed"

NAM_EXPECTED_DATABASE=nam_dashboard
NAM_LIVE_DATABASE="$(docker compose exec -T postgres sh -c \
  'test -n "$POSTGRES_DB" && printf "%s" "$POSTGRES_DB"')"
nam_require_single_line NAM_LIVE_DATABASE "$NAM_LIVE_DATABASE"
[[ "$NAM_LIVE_DATABASE" == "$NAM_EXPECTED_DATABASE" ]] \
  || nam_backup_fail "database target is $NAM_LIVE_DATABASE, expected $NAM_EXPECTED_DATABASE"
[[ "$(nam_psql "$NAM_LIVE_DATABASE" 'SELECT current_database();')" == "$NAM_LIVE_DATABASE" ]] \
  || nam_backup_fail "database connection did not reach $NAM_LIVE_DATABASE"

NAM_COUNT_SQL='SELECT '\''City'\'', count(*) FROM "City" UNION ALL SELECT '\''Mine'\'', count(*) FROM "Mine" UNION ALL SELECT '\''Equipment'\'', count(*) FROM "Equipment" UNION ALL SELECT '\''TimesheetWorkCode'\'', count(*) FROM "TimesheetWorkCode" UNION ALL SELECT '\''TimesheetWorkOrder'\'', count(*) FROM "TimesheetWorkOrder" UNION ALL SELECT '\''TimesheetSupportPerson'\'', count(*) FROM "TimesheetSupportPerson" UNION ALL SELECT '\''FuelServicePerson'\'', count(*) FROM "FuelServicePerson" UNION ALL SELECT '\''DailyLog'\'', count(*) FROM "DailyLog" UNION ALL SELECT '\''DailyLogActivity'\'', count(*) FROM "DailyLogActivity" UNION ALL SELECT '\''StopCard'\'', count(*) FROM "StopCard" UNION ALL SELECT '\''DailyInspection'\'', count(*) FROM "DailyInspection" UNION ALL SELECT '\''OperationalSafetyChecklist'\'', count(*) FROM "OperationalSafetyChecklist" UNION ALL SELECT '\''ShiftReport'\'', count(*) FROM "ShiftReport" UNION ALL SELECT '\''WorkAuthorization'\'', count(*) FROM "WorkAuthorization" UNION ALL SELECT '\''Defect'\'', count(*) FROM "Defect" UNION ALL SELECT '\''WeeklySchedule'\'', count(*) FROM "WeeklySchedule" UNION ALL SELECT '\''WeeklyTimesheet'\'', count(*) FROM "WeeklyTimesheet" UNION ALL SELECT '\''EquipmentFuelEvent'\'', count(*) FROM "EquipmentFuelEvent" ORDER BY 1;'
NAM_MIGRATION_SQL='SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;'
NAM_DATABASE_COUNTS="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_COUNT_SQL")"
NAM_DATABASE_MIGRATIONS="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_MIGRATION_SQL")"
NAM_PROBLEM_MIGRATION_COUNT="$(nam_psql "$NAM_LIVE_DATABASE" \
  'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;')"
[[ -n "$NAM_DATABASE_COUNTS" && -n "$NAM_DATABASE_MIGRATIONS" ]] \
  || nam_backup_fail "database evidence is empty"
[[ "$NAM_PROBLEM_MIGRATION_COUNT" == "0" ]] \
  || nam_backup_fail "database contains failed, unfinished, or rolled-back migration rows"

NAM_REPOSITORY_MIGRATIONS="$({
  for migration_file in prisma/migrations/*/migration.sql; do
    printf '%s|%s\n' \
      "$(basename "$(dirname "$migration_file")")" \
      "$(sha256sum "$migration_file" | awk '{print $1}')"
  done
} | sort)"
[[ "$NAM_DATABASE_MIGRATIONS" == "$NAM_REPOSITORY_MIGRATIONS" ]] \
  || nam_backup_fail "database migrations do not match repository migrations"
NAM_MIGRATION_COUNT="$(printf '%s\n' "$NAM_DATABASE_MIGRATIONS" | wc -l | tr -d ' ')"
[[ "$NAM_MIGRATION_COUNT" =~ ^[1-9][0-9]*$ ]] \
  || nam_backup_fail "migration count is invalid"

for required_reference in City Mine Equipment TimesheetWorkCode; do
  required_count="$(printf '%s\n' "$NAM_DATABASE_COUNTS" \
    | awk -F '|' -v name="$required_reference" '$1 == name { print $2 }')"
  [[ "$required_count" =~ ^[1-9][0-9]*$ ]] \
    || nam_backup_fail "required reference $required_reference has no records"
done

NAM_BACKUP_DIR=/home/alain/backups/nam/postgres
install -d -m 0700 "$NAM_BACKUP_DIR"
[[ -d "$NAM_BACKUP_DIR" && -O "$NAM_BACKUP_DIR" ]] \
  || nam_backup_fail "backup directory is missing or not owned by the operator"
[[ "$(stat -Lc '%a' "$NAM_BACKUP_DIR")" == "700" ]] \
  || nam_backup_fail "backup directory permissions are not 0700"

NAM_DATABASE_SIZE_BYTES="$(nam_psql "$NAM_LIVE_DATABASE" \
  'SELECT pg_database_size(current_database());')"
NAM_AVAILABLE_KIB="$(df -Pk "$NAM_BACKUP_DIR" | awk 'NR == 2 { print $4 }')"
[[ "$NAM_DATABASE_SIZE_BYTES" =~ ^[1-9][0-9]*$ && "$NAM_AVAILABLE_KIB" =~ ^[1-9][0-9]*$ ]] \
  || nam_backup_fail "database size or available-space evidence is invalid"
NAM_REQUIRED_BYTES=$((NAM_DATABASE_SIZE_BYTES * 2))
(( NAM_REQUIRED_BYTES >= 1073741824 )) || NAM_REQUIRED_BYTES=1073741824
NAM_AVAILABLE_BYTES=$((NAM_AVAILABLE_KIB * 1024))
(( NAM_AVAILABLE_BYTES >= NAM_REQUIRED_BYTES )) \
  || nam_backup_fail "insufficient backup space: available=$NAM_AVAILABLE_BYTES required=$NAM_REQUIRED_BYTES"

NAM_BACKUP_TIMESTAMP="$(date -u +%Y%m%dT%H%M%S%NZ)"
NAM_BACKUP_COMMIT="$(git rev-parse --verify HEAD)"
[[ "$NAM_BACKUP_COMMIT" =~ ^[0-9a-f]{40}$ ]] \
  || nam_backup_fail "Git commit is unavailable"
NAM_BACKUP_BASE="nam_${NAM_BACKUP_TIMESTAMP}_${NAM_BACKUP_COMMIT:0:12}_m${NAM_MIGRATION_COUNT}_p${BASHPID}"
NAM_BACKUP_FILE="${NAM_BACKUP_DIR}/${NAM_BACKUP_BASE}.dump"
NAM_BACKUP_TOC="${NAM_BACKUP_FILE}.toc"
NAM_BACKUP_CHECKSUM="${NAM_BACKUP_FILE}.sha256"
NAM_BACKUP_MANIFEST="${NAM_BACKUP_DIR}/${NAM_BACKUP_BASE}.manifest.txt"

for final_path in \
  "$NAM_BACKUP_FILE" "$NAM_BACKUP_TOC" \
  "$NAM_BACKUP_CHECKSUM" "$NAM_BACKUP_MANIFEST"
do
  [[ ! -e "$final_path" ]] \
    || nam_backup_fail "retained artifact already exists: $final_path"
done

NAM_TEMP_DUMP="$(mktemp --tmpdir="$NAM_BACKUP_DIR" ".${NAM_BACKUP_BASE}.dump.partial.XXXXXX")"
NAM_BACKUP_TEMP_FILES+=("$NAM_TEMP_DUMP")
NAM_TEMP_TOC="$(mktemp --tmpdir="$NAM_BACKUP_DIR" ".${NAM_BACKUP_BASE}.toc.partial.XXXXXX")"
NAM_BACKUP_TEMP_FILES+=("$NAM_TEMP_TOC")
NAM_TEMP_CHECKSUM="$(mktemp --tmpdir="$NAM_BACKUP_DIR" ".${NAM_BACKUP_BASE}.sha256.partial.XXXXXX")"
NAM_BACKUP_TEMP_FILES+=("$NAM_TEMP_CHECKSUM")
NAM_TEMP_MANIFEST="$(mktemp --tmpdir="$NAM_BACKUP_DIR" ".${NAM_BACKUP_BASE}.manifest.partial.XXXXXX")"
NAM_BACKUP_TEMP_FILES+=("$NAM_TEMP_MANIFEST")
chmod 0600 "${NAM_BACKUP_TEMP_FILES[@]}"

docker compose exec -T postgres sh -c \
  'test -n "$POSTGRES_DB" && pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --format=custom --compress=6 --no-owner --no-privileges' \
  > "$NAM_TEMP_DUMP"
[[ -s "$NAM_TEMP_DUMP" ]] || nam_backup_fail "pg_dump produced an empty archive"
docker compose exec -T postgres pg_restore -l \
  < "$NAM_TEMP_DUMP" > "$NAM_TEMP_TOC"
[[ -s "$NAM_TEMP_TOC" ]] || nam_backup_fail "pg_restore archive listing is empty"

nam_publish_without_replace "$NAM_TEMP_DUMP" "$NAM_BACKUP_FILE"
nam_publish_without_replace "$NAM_TEMP_TOC" "$NAM_BACKUP_TOC"

sha256sum "$NAM_BACKUP_FILE" > "$NAM_TEMP_CHECKSUM"
sha256sum --check "$NAM_TEMP_CHECKSUM" >/dev/null
nam_publish_without_replace "$NAM_TEMP_CHECKSUM" "$NAM_BACKUP_CHECKSUM"
NAM_BACKUP_SHA256="$(awk '{print $1}' "$NAM_BACKUP_CHECKSUM")"
[[ "$NAM_BACKUP_SHA256" =~ ^[0-9a-f]{64}$ ]] \
  || nam_backup_fail "backup SHA-256 is malformed"

NAM_APP_IMAGE="$(docker inspect nam-app --format '{{.Image}}')"
NAM_POSTGRES_IMAGE="$(docker inspect nam-postgres --format '{{.Config.Image}}')"
NAM_POSTGRES_VERSION="$(docker compose exec -T postgres postgres --version | tr -d '\r')"
nam_require_single_line NAM_BACKUP_FILE "$NAM_BACKUP_FILE"
nam_require_single_line NAM_BACKUP_SHA256 "$NAM_BACKUP_SHA256"
nam_require_single_line NAM_BACKUP_TIMESTAMP "$NAM_BACKUP_TIMESTAMP"
nam_require_single_line NAM_BACKUP_COMMIT "$NAM_BACKUP_COMMIT"
nam_require_single_line NAM_APP_IMAGE "$NAM_APP_IMAGE"
nam_require_single_line NAM_POSTGRES_IMAGE "$NAM_POSTGRES_IMAGE"
nam_require_single_line NAM_POSTGRES_VERSION "$NAM_POSTGRES_VERSION"
nam_require_single_line NAM_LIVE_DATABASE "$NAM_LIVE_DATABASE"
nam_require_single_line NAM_MIGRATION_COUNT "$NAM_MIGRATION_COUNT"

{
  printf 'manifest_version=1\n'
  printf 'backup_file=%s\n' "$NAM_BACKUP_FILE"
  printf 'backup_sha256=%s\n' "$NAM_BACKUP_SHA256"
  printf 'created_utc=%s\n' "$NAM_BACKUP_TIMESTAMP"
  printf 'git_commit=%s\n' "$NAM_BACKUP_COMMIT"
  printf 'app_image=%s\n' "$NAM_APP_IMAGE"
  printf 'postgres_image=%s\n' "$NAM_POSTGRES_IMAGE"
  printf 'postgres_version=%s\n' "$NAM_POSTGRES_VERSION"
  printf 'database_name=%s\n' "$NAM_LIVE_DATABASE"
  printf 'migration_count=%s\n' "$NAM_MIGRATION_COUNT"
  while IFS='|' read -r migration_name migration_checksum; do
    printf 'migration.%s=%s\n' "$migration_name" "$migration_checksum"
  done <<< "$NAM_DATABASE_MIGRATIONS"
  while IFS='|' read -r table_name table_count; do
    [[ "$table_name" =~ ^[A-Za-z][A-Za-z0-9]*$ && "$table_count" =~ ^[0-9]+$ ]] \
      || nam_backup_fail "invalid manifest count: $table_name=$table_count"
    printf 'count.%s=%s\n' "$table_name" "$table_count"
  done <<< "$NAM_DATABASE_COUNTS"
  printf 'sample.DailyLog=%s\n' "$NAM_SMOKE_DAILY_LOG_ID"
  printf 'sample.DailyLogActivity=%s\n' "$NAM_SMOKE_ACTIVITY_ID"
  printf 'evidence.access=%s\n' "$NAM_ACCESS_GATE_EVIDENCE"
  printf 'evidence.deployment=%s\n' "$NAM_DEPLOYMENT_GATE_EVIDENCE"
  printf 'evidence.reference=%s\n' "$NAM_REFERENCE_GATE_EVIDENCE"
  printf 'evidence.smoke_disposition=%s\n' "$NAM_SMOKE_DISPOSITION"
  printf 'operator=%s\n' "$NAM_BACKUP_OPERATOR"
} > "$NAM_TEMP_MANIFEST"
[[ -s "$NAM_TEMP_MANIFEST" ]] || nam_backup_fail "backup manifest is empty"
nam_publish_without_replace "$NAM_TEMP_MANIFEST" "$NAM_BACKUP_MANIFEST"

for completed_path in \
  "$NAM_BACKUP_FILE" "$NAM_BACKUP_TOC" \
  "$NAM_BACKUP_CHECKSUM" "$NAM_BACKUP_MANIFEST"
do
  [[ -s "$completed_path" ]] \
    || nam_backup_fail "required backup artifact is missing or empty: $completed_path"
done
sha256sum --check "$NAM_BACKUP_CHECKSUM" >/dev/null

NAM_BACKUP_COMPLETE=1
nam_backup_cleanup
trap - EXIT ERR
printf 'RECOVERY GATE BACKUP: PASS - archive=%s manifest=%s sha256=%s database=%s migrations=%s\n' \
  "$NAM_BACKUP_FILE" "$NAM_BACKUP_MANIFEST" "$NAM_BACKUP_SHA256" \
  "$NAM_LIVE_DATABASE" "$NAM_MIGRATION_COUNT"
```

`pg_dump` custom format supplies compression. Do not wrap the archive in an
additional untracked format. The PASS line is the only successful backup
result. A dump without its validated checksum, TOC, manifest, and PASS record
does not satisfy the Recovery Gate.

## Disposable Restore Procedure

Archive listing proves readability of the backup container, not recoverability.
This procedure restores into a generated database whose name begins with
`nam_restore_validation_`; it must never target the live database. Before
running the block, export the exact `NAM_BACKUP_FILE`, `NAM_BACKUP_CHECKSUM`,
and `NAM_BACKUP_MANIFEST` paths emitted by the accepted backup PASS line. Run
the complete block in one shell. Do not copy only the restore or cleanup lines.

```bash
set -euo pipefail
set -E

nam_restore_fail() {
  printf 'RECOVERY GATE RESTORE: FAIL - %s\n' "$1" >&2
  return 1
}

nam_restore_error() {
  local exit_code=$?
  printf 'RECOVERY GATE RESTORE: FAIL - line %s: %s\n' "$1" "$2" >&2
  return "$exit_code"
}

nam_restore_manual_cleanup_warning() {
  printf 'MANUAL CLEANUP REQUIRED: disposable database %s may remain.\n' \
    "$NAM_RESTORE_DATABASE" >&2
  printf 'Run only the read-only diagnostic commands documented below before any manual cleanup.\n' >&2
}

nam_psql() {
  local database_name=$1
  local sql_text=$2
  if [[ -z "$database_name" || -z "$sql_text" ]]; then
    nam_restore_fail "database name and SQL text are required"
    return 1
  fi
  docker compose exec -T postgres sh -c \
    'test -n "$1" && test -n "$2" && exec psql -X -At -F "|" \
      -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "$2"' \
    sh "$database_name" "$sql_text" | tr -d '\r'
}

nam_manifest_value() {
  local manifest_key=$1
  local match_count
  local manifest_value
  if [[ -z "$manifest_key" ]]; then
    nam_restore_fail "manifest key is required"
    return 1
  fi
  match_count="$(awk -F '=' -v key="$manifest_key" \
    '$1 == key { count++ } END { print count + 0 }' "$NAM_BACKUP_MANIFEST")"
  if [[ "$match_count" != "1" ]]; then
    nam_restore_fail "manifest key $manifest_key occurs $match_count times"
    return 1
  fi
  manifest_value="$(awk -F '=' -v key="$manifest_key" \
    '$1 == key { sub(/^[^=]*=/, ""); print }' "$NAM_BACKUP_MANIFEST")"
  if [[ -z "$manifest_value" ]]; then
    nam_restore_fail "manifest key $manifest_key is empty"
    return 1
  fi
  printf '%s' "$manifest_value"
}

NAM_RESTORE_CREATED=0

nam_cleanup_disposable_database() {
  local database_list
  [[ "$NAM_RESTORE_CREATED" -eq 1 ]] || return 0
  [[ "$NAM_RESTORE_DATABASE" =~ ^nam_restore_validation_[0-9]+_[0-9]+$ ]] \
    || { nam_restore_manual_cleanup_warning; return 1; }
  [[ "$NAM_RESTORE_DATABASE" != "$NAM_LIVE_DATABASE" \
      && "$NAM_RESTORE_DATABASE" != "nam_dashboard" ]] \
    || { nam_restore_manual_cleanup_warning; return 1; }

  if ! docker compose exec -T postgres sh -c \
    'test -n "$1" \
      && test "$1" != "$POSTGRES_DB" \
      && case "$1" in nam_restore_validation_[0-9]*_[0-9]*) ;; *) exit 64 ;; esac \
      && dropdb -U "$POSTGRES_USER" --if-exists --force "$1"' \
    sh "$NAM_RESTORE_DATABASE"; then
    nam_restore_manual_cleanup_warning
    return 1
  fi

  if ! database_list="$(nam_psql "$NAM_LIVE_DATABASE" \
    'SELECT datname FROM pg_database ORDER BY datname;')"; then
    nam_restore_manual_cleanup_warning
    return 1
  fi
  if grep -Fxq -- "$NAM_RESTORE_DATABASE" <<< "$database_list"; then
    nam_restore_manual_cleanup_warning
    return 1
  fi
  NAM_RESTORE_CREATED=0
}

nam_restore_exit_cleanup() {
  local original_status=$?
  if [[ "$NAM_RESTORE_CREATED" -eq 1 ]]; then
    if ! nam_cleanup_disposable_database; then
      nam_restore_manual_cleanup_warning
      return 1
    fi
  fi
  return "$original_status"
}

trap 'nam_restore_error "$LINENO" "$BASH_COMMAND"' ERR

: "${NAM_BACKUP_FILE:?Export NAM_BACKUP_FILE before running.}"
: "${NAM_BACKUP_CHECKSUM:?Export NAM_BACKUP_CHECKSUM before running.}"
: "${NAM_BACKUP_MANIFEST:?Export NAM_BACKUP_MANIFEST before running.}"
for required_path in \
  "$NAM_BACKUP_FILE" "$NAM_BACKUP_CHECKSUM" "$NAM_BACKUP_MANIFEST"
do
  [[ -n "$required_path" && "$required_path" != *$'\n'* && "$required_path" != *$'\r'* ]] \
    || nam_restore_fail "backup artifact path is empty or malformed"
  [[ -f "$required_path" && -s "$required_path" ]] \
    || nam_restore_fail "backup artifact is missing or empty: $required_path"
done
[[ "$NAM_BACKUP_FILE" == /home/alain/backups/nam/postgres/*.dump ]] \
  || nam_restore_fail "backup file is outside the canonical backup directory"
[[ "$NAM_BACKUP_CHECKSUM" == "${NAM_BACKUP_FILE}.sha256" ]] \
  || nam_restore_fail "checksum path does not belong to the selected backup"
[[ "$NAM_BACKUP_MANIFEST" == "${NAM_BACKUP_FILE%.dump}.manifest.txt" ]] \
  || nam_restore_fail "manifest path does not belong to the selected backup"
NAM_BACKUP_TOC="${NAM_BACKUP_FILE}.toc"
[[ -s "$NAM_BACKUP_TOC" ]] \
  || nam_restore_fail "archive TOC is missing or empty: $NAM_BACKUP_TOC"

NAM_CHECKSUM_LINE_COUNT="$(wc -l < "$NAM_BACKUP_CHECKSUM" | tr -d ' ')"
read -r NAM_CHECKSUM_VALUE NAM_CHECKSUM_PATH NAM_CHECKSUM_EXTRA \
  < "$NAM_BACKUP_CHECKSUM"
[[ "$NAM_CHECKSUM_LINE_COUNT" == "1" \
    && "$NAM_CHECKSUM_VALUE" =~ ^[0-9a-f]{64}$ \
    && "$NAM_CHECKSUM_PATH" == "$NAM_BACKUP_FILE" \
    && -z "${NAM_CHECKSUM_EXTRA:-}" ]] \
  || nam_restore_fail "checksum file does not identify exactly the selected backup"
[[ "$(sha256sum "$NAM_BACKUP_FILE" | awk '{print $1}')" == "$NAM_CHECKSUM_VALUE" ]] \
  || nam_restore_fail "backup checksum validation failed"
docker compose exec -T postgres pg_restore -l \
  < "$NAM_BACKUP_FILE" >/dev/null \
  || nam_restore_fail "backup archive structural validation failed"

[[ "$(nam_manifest_value manifest_version)" == "1" ]] \
  || nam_restore_fail "unsupported backup manifest version"
[[ "$(nam_manifest_value backup_file)" == "$NAM_BACKUP_FILE" ]] \
  || nam_restore_fail "manifest backup path does not match selected archive"
NAM_MANIFEST_SHA256="$(nam_manifest_value backup_sha256)"
NAM_ACTUAL_SHA256="$(sha256sum "$NAM_BACKUP_FILE" | awk '{print $1}')"
[[ "$NAM_MANIFEST_SHA256" == "$NAM_ACTUAL_SHA256" ]] \
  || nam_restore_fail "manifest SHA-256 does not match selected archive"

NAM_EXPECTED_DATABASE="$(nam_manifest_value database_name)"
[[ "$NAM_EXPECTED_DATABASE" == "nam_dashboard" ]] \
  || nam_restore_fail "manifest database is $NAM_EXPECTED_DATABASE, expected nam_dashboard"
NAM_LIVE_DATABASE="$(docker compose exec -T postgres sh -c \
  'test -n "$POSTGRES_DB" && printf "%s" "$POSTGRES_DB"')"
[[ -n "$NAM_LIVE_DATABASE" && "$NAM_LIVE_DATABASE" == "$NAM_EXPECTED_DATABASE" ]] \
  || nam_restore_fail "active database does not match the manifest database"
[[ "$(nam_psql "$NAM_LIVE_DATABASE" 'SELECT current_database();')" == "$NAM_LIVE_DATABASE" ]] \
  || nam_restore_fail "live-database connection evidence is inconsistent"

NAM_COUNT_SQL='SELECT '\''City'\'', count(*) FROM "City" UNION ALL SELECT '\''Mine'\'', count(*) FROM "Mine" UNION ALL SELECT '\''Equipment'\'', count(*) FROM "Equipment" UNION ALL SELECT '\''TimesheetWorkCode'\'', count(*) FROM "TimesheetWorkCode" UNION ALL SELECT '\''TimesheetWorkOrder'\'', count(*) FROM "TimesheetWorkOrder" UNION ALL SELECT '\''TimesheetSupportPerson'\'', count(*) FROM "TimesheetSupportPerson" UNION ALL SELECT '\''FuelServicePerson'\'', count(*) FROM "FuelServicePerson" UNION ALL SELECT '\''DailyLog'\'', count(*) FROM "DailyLog" UNION ALL SELECT '\''DailyLogActivity'\'', count(*) FROM "DailyLogActivity" UNION ALL SELECT '\''StopCard'\'', count(*) FROM "StopCard" UNION ALL SELECT '\''DailyInspection'\'', count(*) FROM "DailyInspection" UNION ALL SELECT '\''OperationalSafetyChecklist'\'', count(*) FROM "OperationalSafetyChecklist" UNION ALL SELECT '\''ShiftReport'\'', count(*) FROM "ShiftReport" UNION ALL SELECT '\''WorkAuthorization'\'', count(*) FROM "WorkAuthorization" UNION ALL SELECT '\''Defect'\'', count(*) FROM "Defect" UNION ALL SELECT '\''WeeklySchedule'\'', count(*) FROM "WeeklySchedule" UNION ALL SELECT '\''WeeklyTimesheet'\'', count(*) FROM "WeeklyTimesheet" UNION ALL SELECT '\''EquipmentFuelEvent'\'', count(*) FROM "EquipmentFuelEvent" ORDER BY 1;'
NAM_MIGRATION_SQL='SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;'
NAM_DATABASE_LIST_SQL='SELECT datname FROM pg_database ORDER BY datname;'

NAM_EXPECTED_COUNTS="$(awk -F '=' '
  /^count\./ {
    name = substr($1, 7)
    value = substr($0, index($0, "=") + 1)
    print name "|" value
  }
' "$NAM_BACKUP_MANIFEST" | sort)"
NAM_EXPECTED_MIGRATIONS="$(awk -F '=' '
  /^migration\./ {
    name = substr($1, 11)
    value = substr($0, index($0, "=") + 1)
    print name "|" value
  }
' "$NAM_BACKUP_MANIFEST" | sort)"
[[ -n "$NAM_EXPECTED_COUNTS" && -n "$NAM_EXPECTED_MIGRATIONS" ]] \
  || nam_restore_fail "manifest count or migration evidence is empty"
while IFS='|' read -r expected_name expected_count; do
  [[ "$expected_name" =~ ^[A-Za-z][A-Za-z0-9]*$ && "$expected_count" =~ ^[0-9]+$ ]] \
    || nam_restore_fail "manifest count is malformed: $expected_name=$expected_count"
done <<< "$NAM_EXPECTED_COUNTS"
NAM_MANIFEST_MIGRATION_COUNT="$(nam_manifest_value migration_count)"
[[ "$NAM_MANIFEST_MIGRATION_COUNT" =~ ^[1-9][0-9]*$ ]] \
  || nam_restore_fail "manifest migration count is malformed"
[[ "$(printf '%s\n' "$NAM_EXPECTED_MIGRATIONS" | wc -l | tr -d ' ')" == "$NAM_MANIFEST_MIGRATION_COUNT" ]] \
  || nam_restore_fail "manifest migration count does not match migration entries"

NAM_SAMPLE_DAILY_LOG="$(nam_manifest_value sample.DailyLog)"
NAM_SAMPLE_ACTIVITY="$(nam_manifest_value sample.DailyLogActivity)"
[[ "$NAM_SAMPLE_DAILY_LOG" =~ ^[A-Za-z0-9_-]{1,100}$ ]] \
  || nam_restore_fail "Daily Log sample ID is malformed"
[[ "$NAM_SAMPLE_ACTIVITY" =~ ^[A-Za-z0-9_-]{1,100}$ ]] \
  || nam_restore_fail "Daily Log activity sample ID is malformed"

NAM_LIVE_COUNTS_BEFORE="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_COUNT_SQL")"
NAM_LIVE_MIGRATIONS_BEFORE="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_MIGRATION_SQL")"
NAM_LIVE_EVIDENCE_BEFORE="$(printf 'database=%s\ncounts=%s\nmigrations=%s\n' \
  "$NAM_LIVE_DATABASE" "$NAM_LIVE_COUNTS_BEFORE" "$NAM_LIVE_MIGRATIONS_BEFORE")"
NAM_LIVE_EVIDENCE_BEFORE_SHA256="$(printf '%s' "$NAM_LIVE_EVIDENCE_BEFORE" \
  | sha256sum | awk '{print $1}')"

NAM_RESTORE_DATABASE="nam_restore_validation_$(date -u +%Y%m%d%H%M%S%N)_${BASHPID}"
[[ "$NAM_RESTORE_DATABASE" =~ ^nam_restore_validation_[0-9]+_[0-9]+$ ]] \
  || nam_restore_fail "disposable database name is malformed"
[[ "$NAM_RESTORE_DATABASE" != "nam_dashboard" \
    && "$NAM_RESTORE_DATABASE" != "$NAM_LIVE_DATABASE" ]] \
  || nam_restore_fail "disposable database name equals the live database"
NAM_DATABASE_LIST_BEFORE="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_DATABASE_LIST_SQL")"
if grep -Fxq -- "$NAM_RESTORE_DATABASE" <<< "$NAM_DATABASE_LIST_BEFORE"; then
  nam_restore_fail "disposable database already exists: $NAM_RESTORE_DATABASE"
fi

docker compose exec -T postgres sh -c \
  'test -n "$1" \
    && test "$1" != "$POSTGRES_DB" \
    && case "$1" in nam_restore_validation_[0-9]*_[0-9]*) ;; *) exit 64 ;; esac \
    && createdb -U "$POSTGRES_USER" "$1"' \
  sh "$NAM_RESTORE_DATABASE"
NAM_RESTORE_CREATED=1
trap nam_restore_exit_cleanup EXIT

NAM_DATABASE_LIST_AFTER_CREATE="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_DATABASE_LIST_SQL")"
grep -Fxq -- "$NAM_RESTORE_DATABASE" <<< "$NAM_DATABASE_LIST_AFTER_CREATE" \
  || nam_restore_fail "disposable database was not created"

docker compose exec -T postgres sh -c \
  'test -n "$1" \
    && test "$1" != "$POSTGRES_DB" \
    && case "$1" in nam_restore_validation_[0-9]*_[0-9]*) ;; *) exit 64 ;; esac \
    && pg_restore -U "$POSTGRES_USER" -d "$1" \
      --no-owner --no-privileges --exit-on-error' \
  sh "$NAM_RESTORE_DATABASE" < "$NAM_BACKUP_FILE"

NAM_RESTORED_COUNTS="$(nam_psql "$NAM_RESTORE_DATABASE" "$NAM_COUNT_SQL")"
NAM_RESTORED_MIGRATIONS="$(nam_psql "$NAM_RESTORE_DATABASE" "$NAM_MIGRATION_SQL")"
NAM_RESTORED_PROBLEM_MIGRATIONS="$(nam_psql "$NAM_RESTORE_DATABASE" \
  'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;')"
[[ "$NAM_RESTORED_COUNTS" == "$NAM_EXPECTED_COUNTS" ]] \
  || nam_restore_fail "restored reference or operational counts do not match the manifest"
[[ "$NAM_RESTORED_MIGRATIONS" == "$NAM_EXPECTED_MIGRATIONS" ]] \
  || nam_restore_fail "restored migration names or checksums do not match the manifest"
[[ "$NAM_RESTORED_PROBLEM_MIGRATIONS" == "0" ]] \
  || nam_restore_fail "restored database contains failed, unfinished, or rolled-back migrations"

if ! nam_psql "$NAM_RESTORE_DATABASE" 'SELECT id FROM "DailyLog" ORDER BY id;' \
  | grep -Fxq -- "$NAM_SAMPLE_DAILY_LOG"; then
  nam_restore_fail "manifest Daily Log sample is not readable after restore"
fi
if ! nam_psql "$NAM_RESTORE_DATABASE" 'SELECT id FROM "DailyLogActivity" ORDER BY id;' \
  | grep -Fxq -- "$NAM_SAMPLE_ACTIVITY"; then
  nam_restore_fail "manifest Daily Log activity sample is not readable after restore"
fi

NAM_RESTORED_ENUMS="$(nam_psql "$NAM_RESTORE_DATABASE" \
  'SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname IN ('\''OperationalSafetyChecklistMeterKind'\'', '\''EquipmentFuelType'\'') ORDER BY t.typname, e.enumsortorder;')"
NAM_EXPECTED_ENUMS=$'EquipmentFuelType|DIESEL\nEquipmentFuelType|OFF_ROAD_DIESEL\nEquipmentFuelType|GASOLINE\nOperationalSafetyChecklistMeterKind|HOURS\nOperationalSafetyChecklistMeterKind|MILES'
[[ "$NAM_RESTORED_ENUMS" == "$NAM_EXPECTED_ENUMS" ]] \
  || nam_restore_fail "required meter or fuel enum values are missing"

NAM_RESTORED_CONSTRAINTS="$(nam_psql "$NAM_RESTORE_DATABASE" \
  'SELECT conname FROM pg_constraint WHERE connamespace = '\''public'\''::regnamespace UNION SELECT indexname FROM pg_indexes WHERE schemaname = '\''public'\'' ORDER BY 1;')"
for required_constraint in \
  SafetyChecklist_equipment_fkey \
  SafetyChecklistResponse_parent_fkey \
  SafetyChecklist_equipment_date_shift_key \
  SafetyChecklistResponse_parent_item_key \
  FuelEvent_equipment_fkey \
  FuelEvent_servicePerson_fkey \
  FuelEvent_dailyLogActivity_fkey \
  FuelEvent_dailyLogActivity_key \
  FuelTankFill_event_fkey \
  FuelTankFill_event_sequence_key \
  FuelTankFill_event_label_key
do
  if ! grep -Fxq -- "$required_constraint" <<< "$NAM_RESTORED_CONSTRAINTS"; then
    nam_restore_fail "required constraint or unique index is missing: $required_constraint"
  fi
done
[[ "$(nam_psql "$NAM_RESTORE_DATABASE" \
  'SELECT is_nullable || '\''|'\'' || column_default FROM information_schema.columns WHERE table_schema = '\''public'\'' AND table_name = '\''OperationalSafetyChecklist'\'' AND column_name = '\''recordVersion'\'';')" == "NO|1" ]] \
  || nam_restore_fail "OperationalSafetyChecklist.recordVersion metadata is incorrect"

if ! nam_cleanup_disposable_database; then
  nam_restore_manual_cleanup_warning
  nam_restore_fail "disposable database cleanup failed"
fi
[[ "$NAM_RESTORE_CREATED" -eq 0 ]] \
  || nam_restore_fail "disposable database cleanup was not confirmed"

NAM_LIVE_COUNTS_AFTER="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_COUNT_SQL")"
NAM_LIVE_MIGRATIONS_AFTER="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_MIGRATION_SQL")"
NAM_LIVE_EVIDENCE_AFTER="$(printf 'database=%s\ncounts=%s\nmigrations=%s\n' \
  "$NAM_LIVE_DATABASE" "$NAM_LIVE_COUNTS_AFTER" "$NAM_LIVE_MIGRATIONS_AFTER")"
NAM_LIVE_EVIDENCE_AFTER_SHA256="$(printf '%s' "$NAM_LIVE_EVIDENCE_AFTER" \
  | sha256sum | awk '{print $1}')"
[[ "$NAM_LIVE_EVIDENCE_AFTER" == "$NAM_LIVE_EVIDENCE_BEFORE" ]] \
  || nam_restore_fail "live-database evidence changed during disposable restore validation"

NAM_FINAL_DATABASE_LIST="$(nam_psql "$NAM_LIVE_DATABASE" "$NAM_DATABASE_LIST_SQL")"
if grep -Fxq -- "$NAM_RESTORE_DATABASE" <<< "$NAM_FINAL_DATABASE_LIST"; then
  nam_restore_manual_cleanup_warning
  nam_restore_fail "disposable database still exists after cleanup"
fi

trap - EXIT ERR
printf 'RECOVERY GATE RESTORE: PASS - archive=%s disposable=%s live_before=%s live_after=%s cleanup=confirmed\n' \
  "$NAM_BACKUP_FILE" "$NAM_RESTORE_DATABASE" \
  "$NAM_LIVE_EVIDENCE_BEFORE_SHA256" "$NAM_LIVE_EVIDENCE_AFTER_SHA256"
```

If cleanup cannot be confirmed, the block retains its EXIT trap, prints
`MANUAL CLEANUP REQUIRED`, and cannot reach the PASS line. Investigate with
read-only commands before any separately authorized manual cleanup:

```bash
docker compose exec -T postgres sh -c \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT datname FROM pg_database WHERE datname LIKE '\''nam_restore_validation_%'\'' ORDER BY datname;"'
docker compose exec -T postgres sh -c \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT datname, pid, usename, state FROM pg_stat_activity WHERE datname LIKE '\''nam_restore_validation_%'\'' ORDER BY datname, pid;"'
```

Do not improvise a cleanup target. Re-run only the guarded cleanup logic after
the exact disposable name, active sessions, live database name, and explicit
cleanup authorization are confirmed.

If restore or verification fails, preserve the archive and manifest, capture
the failing command, and leave the Recovery Gate failed. Do not retry against
the live database.

This is a disposable restore test. Actual disaster recovery may stop services,
replace or clean the live database, restore secrets, and recover host state; it
requires separate explicit authorization and the disaster-recovery runbook.

## Pilot Backup Schedule

| Point | Required action |
| --- | --- |
| Baseline | After private access, current deployment, reference review, and smoke disposition; create, list, checksum, manifest, and disposable-restore the archive before the first real shift. |
| Each pilot day | Create a new timestamped archive after the day's entries and structurally validate it with `pg_restore -l` and SHA-256. |
| End of one-week pilot | Create and validate a final archive and preserve the exit-review evidence with it. |
| Post-pilot restore | Repeat disposable restore verification if material schema, deployment, or workflow changes occurred, or if any backup anomaly was observed. |

Retain the baseline, every daily pilot archive, and the final archive until the
pilot is accepted. Keep at least one off-host copy when the records would be
difficult to recreate. Permanent enterprise retention is outside this pilot.

## First-Shift Pilot

The first shift uses only these core surfaces:

1. Work Schedule.
2. Operational Safety Checklist for every Equipment inspected at shift start.
3. Daily Work Log.
4. Timesheet.
5. Day View review.

Use STOP Card, Defect, Equipment Fuel Event, Shift Report, or Work Authorization
only when the corresponding genuine event occurs. Daily Inspections remain
outside the first shift unless the user confirms a distinct real workflow.
The pilot does not require every module to receive a record.

### Daily Entry Order

1. Confirm Work Schedule before the shift.
2. Complete one shift-start checklist for each inspected Equipment.
3. Record event-driven records only when they occur.
4. Maintain Daily Work Log as the operational narrative.
5. Record a mid-shift Equipment replacement in Daily Work Log only; do not
   create another shift-start checklist.
6. Complete Timesheet after clock and allocation facts are known.
7. Review the shift-start operational date in Day View after the shift.

Rules:

- Overnight records use the date on which the shift started.
- Operational date, shift, operator, and supervisor context may be carried
  forward only by an implemented feature flow and must still be verified for
  the new record.
- Confirm the checklist meter unit explicitly.
- Verify Equipment identity and meter facts independently.
- Do not copy, infer, or estimate fuel quantities.
- Verify clock times and Work Allocation minutes independently.
- Checklist answers, Problem Description, Equipment identity, meter readings,
  event times, fuel facts, Timesheet clock facts, and allocations must not be
  copied from another feature merely to reduce entry effort.
- Leave optional relationships null when their source is unverified.
- Use Unknown Partner only when the identity is genuinely unknown.
- Do not invent Equipment, people, relationships, quantities, times, answers,
  or completion facts to satisfy validation.
- Corrections use each feature's explicit correction or Timesheet reopen flow;
  they do not silently delete completed history.

## One-Week Pilot

The repeated-use pilot should collect evidence for:

- Overnight operational-date consistency.
- Multiple Equipment inspections on the same shift.
- Repeated Work Schedule use.
- Planned-versus-actual schedule changes and reasons.
- Weekly Timesheet accumulation, completion, and reopen/correction.
- Correction workflows across the five core surfaces.
- Day View retrieval of prior operational dates.
- Genuine STOP Cards, Defects, and Fuel Events when they occur.
- Mobile and tablet layout and connectivity.
- Delayed entry that still records actual occurrence facts.
- Completion and verification of every scheduled backup.

Deletion, inactive-reference, null-reference, and broken-reference exercises
remain synthetic. Do not manipulate real records merely to test edge cases.

## Manual Pilot Log

Use one row per observation. This manual log is sufficient; no analytics
infrastructure is required.

| Date | Feature | Source record ID | Device | Action | Completion time | Validation issue | Correction required | Duplicate-entry friction | Confusing field | Missing reference | Layout/connectivity problem | Workaround | Retrieval difficulty | Day View usefulness | Requested report/filter/export | Severity | Follow-up decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | Blocking / Significant / Minor / Future |  |

Do not place passwords, access tokens, private keys, or unnecessary sensitive
details in the pilot log.

## Success And Failure Classification

### Blocking Failure

- Unauthorized public exposure or a private-boundary bypass.
- Stale or unverified deployed commit.
- Backup cannot be restored.
- Required reference data is missing or wrong.
- Operational date ownership is incorrect.
- A required pilot record cannot be completed.
- Data loss, corruption, or an unrecoverable error occurs.

A blocking failure pauses real-data entry until a correction is independently
verified.

### Significant Usability Issue

- Duplicate creation.
- Timesheet reconciliation failure.
- Unclear or unsafe correction workflow.
- Required selector value is unavailable.
- Mobile entry is operationally unusable.
- Day View shows missing, wrong-date, or misleading content.

Significant issues may allow the pilot to continue only when no data-integrity
or security risk exists and a documented workaround is acceptable.

### Minor Improvement

- Wording.
- Spacing.
- Optional default behavior.
- Nonblocking navigation friction.

### Future Enhancement

- Reports or exports.
- Equipment Activity Timeline.
- Automation.
- Photo evidence.
- Analytics.

Classification determines the next milestone. Frequency, operational impact,
and repeated workarounds matter more than theoretical platform value.

## Pilot Exit Review

The pilot is not complete until the review records:

- Pilot start and end dates.
- Records entered per feature, excluding classified smoke data.
- Corrections by feature and reason.
- Unresolved validation or data-quality issues.
- Baseline, daily, and final backup artifact names and checksums.
- Disposable restore result, database name, date, and reviewer.
- Access-boundary verification and any observed bypass attempt.
- Device-specific usability findings.
- Approximate entry effort by core workflow.
- Repeated workarounds and duplicate-entry friction.
- Requested reports, filters, or exports.
- Day View usefulness and retrieval time.
- Blocking, significant, minor, and future finding counts.
- Recommended next milestone with evidence.

Possible next milestones remain evidence-driven:

- Supply Requests discovery when repeated operator-originated needs exist.
- Access control or authentication when broader secure access is the main
  operational constraint.
- Phase 23.5 prerequisites only after its access, processing, storage, and
  recovery gates are independently ready.
- Timesheet refinement after repeated reconciliation or lifecycle friction.
- Reporting or export discovery after a specific recurring output is requested.
- Day View refinement after observed composition or retrieval problems.
- Equipment Activity Timeline discovery after repeated Equipment-centered
  cross-feature retrieval needs.

The exit review may also conclude that no implementation milestone is yet
justified.

## Pilot Authorization Record

Complete this record in the later execution milestone:

| Item | Evidence |
| --- | --- |
| Approved access boundary |  |
| Unauthorized external test |  |
| Approved device tests |  |
| Deployed commit and image |  |
| Ten-contributor Day View |  |
| Migration verification |  |
| Reference-data sign-off |  |
| Smoke-data disposition |  |
| Baseline backup and SHA-256 |  |
| Disposable restore result |  |
| First-shift scope acknowledgment |  |
| Pilot authorized by and date |  |
