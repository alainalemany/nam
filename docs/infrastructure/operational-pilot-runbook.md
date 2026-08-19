# Operational Pilot Runbook

This runbook is the canonical source for durable preparation requirements,
pilot scope, support, execution expectations, and exit review for the first
controlled NAM Dashboard real-data pilot. The current deployment and readiness
baseline, remaining gate status, and approved gate order are governed by the
[Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).

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

The accepted read-only re-baseline established the historical snapshot below.
The later [Pre-DDR `0639e4f` Deployment And Recovery Evidence](pre-ddr-0639e4f-deployment-recovery-evidence.md)
supersedes its deployed-revision, migration-count, backup-existence, and
access-verification values. The durable pilot requirements in this runbook are
unchanged.

- Repository `main` is at
  `4eba24fb97abac61c6511258ad4e97aebd4ea6a2`, contains 20 migrations and
  eleven Day View contributors, and implements Supply Requests and Knowledge
  Base V1.
- The healthy deployed application remains the historical Checkpoint D image
  from `76cdba9530e49334e775009a811ae5ae74305c65`. It has Next.js `15.5.19`,
  ten Day View contributors, and no Supply Requests or Knowledge Base.
- Live PostgreSQL `18.4` has 16 successful migrations and no failed
  migrations. The first 16 checksums match the repository; the four Supply
  Request and Knowledge Base migrations are not applied live.
- The application remains bound to `127.0.0.1:3000` and PostgreSQL remains
  unpublished, but Caddy still exposes NAM publicly over TCP `80`/`443` and
  UDP `443`. Both public IPv4 and direct IPv6/SNI paths were observed.
- Tailscale is installed, connected, and configured to Serve the loopback
  application, but private HTTPS and policy/device acceptance remain open.
  ADR-019 is partially implemented, not accepted.
- Cities, Mines, and Equipment have aggregate counts of 3, 3, and 7.
  Timesheet Work Codes, Work Orders, Support Personnel, and Fuel Service
  Personnel each have an aggregate count of 0. No record contents were
  inspected, and the Reference-Data Gate remains open.
- The earlier snapshot found only two historical Phase 2A dumps. A later
  pre-DDR custom-format archive of live `nam_dashboard` was created,
  checksummed, and structurally verified before deploying `0639e4f`. It has not
  been disposable-restored, and no post-DDR current-schema backup with restore
  proof is recorded. The Recovery Gate therefore remains open.
- Photo evidence remains unavailable and blocked by ADR-018 prerequisites.

This runbook does not authorize execution. Its existing mutation procedures
are suspended until they are reconciled with the current 20-migration schema
and approved through a separately reviewed execution authority. Historical
Checkpoint D procedures are evidence only. No Tailscale, Caddy, SSH, firewall,
DNS, deployment, database, backup, restore, or pilot step may begin from this
document alone.

## Pilot Authorization Gates

Real operational data must not be entered unless every row below is explicitly
signed off. A skipped, unknown, or partially verified gate is a failed gate.

| Gate | Required evidence | Status before execution |
| --- | --- | --- |
| Access | Approved private boundary active; public bypass denied; approved devices work; PostgreSQL remains unpublished. | Blocked |
| Deployment | Immutable image for exact current revision deployed after a separately authorized migration transition; live database has all 20 migrations; Supply Requests, Knowledge Base, and eleven Day View contributors verified. | Blocked |
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

The current approved order is maintained in the
[Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).
In summary, private HTTPS, policy/device controls, and independent administrator
recovery must pass before public NAM exposure is removed. Public exposure must
then be removed and independently disproven before the live database and
application transition. Pre-migration recovery proof must also pass before any
live migration. Each security-sensitive mutation requires separate approval;
no item in this runbook implicitly authorizes the next.

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
- Application health, required routes, and all eleven Day View contributors,
  including Supply Requests, work through the private service.
- Device removal revokes access and re-enrollment requires approval.
- VPS reboot and Docker restart preserve private-only access.
- Key-only SSH recovery works independently.
- Access can be disabled rapidly without modifying application data.

The durable boundary and rollback rules are recorded in
[ADR-019](../decisions/adr-019-managed-private-overlay-operational-pilot.md).

### Deployment Gate

The Checkpoint D application-image correction is historical evidence bound to
the `76cdba9`/16-migration deployment generation. It is not executable authority
for repository HEAD `4eba24f` and does not close the current Deployment Gate.

Current deployment requires a fresh immutable image built from exact revision
`4eba24f` with embedded identity, accepted rollback compatibility, and a
separately authorized transition of live migrations 17 through 20. The gate
must verify Supply Requests, Knowledge Base, and all eleven Day View
contributors. Public NAM exposure must already be removed under the accepted
private boundary, and a current 16-migration backup and disposable restore must
already have passed, before the live database/application transition begins.

The complete current sequence and authorization boundaries are in the
[Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).

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

**Suspended current procedure:** the commands below predate Supply Requests and
Knowledge Base and do not represent the current 20-migration data model. They
are retained for review context only and must not be executed against the live
database. A separately authorized execution procedure must refresh the model
inventory, immutable identities, manifest, and rollback boundary before the
Pre-migration Recovery Gate can run.

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

**Suspended current procedure:** this procedure is paired with the stale backup
inventory above. It is not current execution authority and must not be run
until a separately reviewed 16-migration pre-migration recovery procedure is
approved. A later 20-migration current-schema recovery procedure requires its
own authorization after deployment parity.

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
| Eleven-contributor Day View, including Supply Requests |  |
| Migration verification |  |
| Reference-data sign-off |  |
| Smoke-data disposition |  |
| Baseline backup and SHA-256 |  |
| Disposable restore result |  |
| First-shift scope acknowledgment |  |
| Pilot authorized by and date |  |
