# Checkpoint D Existing-Candidate Recovery

> **Historical Checkpoint D evidence:** This one-time path is bound to the
> `76cdba9` application and unchanged 16-migration deployment generation. It is
> not executable authority for repository HEAD `4eba24f` or migrations 17
> through 20. Preserve the fixed identities and results below. Current
> readiness status and sequencing are governed by the
> [Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).

This one-time operator path bridges the already validated candidate to corrected
D4 without rebuilding or rerunning D1 or D2. The authoritative procedure remains
[Checkpoint D Application Deployment Correction](checkpoint-d-application-deployment-correction.md).

This is not a reusable framework. Stop on any missing, duplicate, or unexpected
value. Do not rebuild, retag, replace a container, alter PostgreSQL, or change
existing evidence during R1–R5. Run each logical command separately and stop on
a nonzero status or unexpected output.

## Fixed Identities

| Item | Required value |
| --- | --- |
| Pre-correction commit | `9f09083c79513d52a2368aaf386eceba316f0ac1` |
| Application source | `76cdba9530e49334e775009a811ae5ae74305c65` |
| Candidate tag | `nam-app:checkpoint-d-git-76cdba9530e49334e775009a811ae5ae74305c65` |
| Candidate OCI index | `sha256:c7a00e60735fe8d54e64886226cfeaaec799765efa62028d8b541b3628fa3092` |
| Candidate `linux/amd64` manifest | `sha256:bd1beb1b164945c74a75c2fe289fb150b2a183d26d92b6e1e46a0df9d1a6a780` |
| Candidate configuration | `sha256:270cea507f6d073cb8ca3e5ee9b252c7545709e77c9ca80e0cbc914314f5a312` |
| Original D1 application container | `f500902546bdad63adb180118dab379b630be9618a11f5fe58f0ee63f42495f2` |
| Original D1 application configuration | `sha256:03d0301ad1ca9bc2060fcb41676e08faa721ea6ef6108a5edc4db742fba211b4` |
| Original D1 PostgreSQL container | `0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1` |
| Rollback tag | `nam-app:rollback-runtime-8cba9cb2122f-d3734e4ceddd4809ce573b5d92f64631628f387a60856409447331d8977d4ac1` |
| Rollback OCI index | `sha256:8cba9cb2122f9010ff815d56056866b7fe910d958f70d3a3bb6ca74d3a82ef95` |
| Audit export SHA-256 | `40d43f58cdb5fdf4c3f678122add911d4422170955490cc1c6dc3ca776fb456b` |

## R1 — New Runbook Control Commit

After both documents are reviewed, committed, and pushed, the operator must type
the new full commit identity; do not derive it from `HEAD`.

```bash
RUNBOOK_CONTROL_COMMIT='<full approved commit SHA containing both recovery documents>'
[[ "$RUNBOOK_CONTROL_COMMIT" =~ ^[0-9a-f]{40}$ ]]
export RUNBOOK_CONTROL_COMMIT
```

Run each check separately:

```bash
test "$(git branch --show-current)" = 'main'
test "$(git rev-parse HEAD)" = "$RUNBOOK_CONTROL_COMMIT"
test "$(git rev-parse refs/heads/main)" = "$RUNBOOK_CONTROL_COMMIT"
test "$(git rev-parse refs/remotes/origin/main)" = "$RUNBOOK_CONTROL_COMMIT"
git ls-remote --exit-code --heads origin refs/heads/main
git status --porcelain=v1 --untracked-files=all
```

Expected: the remote command prints one matching row and status prints nothing.
A mismatch or additional remote row stops recovery.

## R2 — Documentation-Only Transition

```bash
git merge-base --is-ancestor 9f09083c79513d52a2368aaf386eceba316f0ac1 "$RUNBOOK_CONTROL_COMMIT"
```

Expected: exit zero and no output.

```bash
git diff --name-status 9f09083c79513d52a2368aaf386eceba316f0ac1 "$RUNBOOK_CONTROL_COMMIT"
git diff 9f09083c79513d52a2368aaf386eceba316f0ac1 "$RUNBOOK_CONTROL_COMMIT" -- docs/infrastructure/checkpoint-d-application-deployment-correction.md docs/infrastructure/checkpoint-d-existing-candidate-recovery.md
```

Expected: only these two paths, both under `docs/`:

```text
docs/infrastructure/checkpoint-d-application-deployment-correction.md
docs/infrastructure/checkpoint-d-existing-candidate-recovery.md
```

An independent reviewer runs:

```bash
git diff 9f09083c79513d52a2368aaf386eceba316f0ac1 "$RUNBOOK_CONTROL_COMMIT" -- \
  Dockerfile compose.yaml .dockerignore package.json pnpm-lock.yaml \
  pnpm-workspace.yaml next.config.ts tsconfig.json next-env.d.ts \
  prisma/ src/ public/
```

Expected: no output. Stop unless the complete transition is solely the reviewed
documentation correction.

## R3 — Existing Evidence Preservation

Verify the historical inputs read-only:

```bash
test -d /home/alain/nam-deployment-evidence/checkpoint-d-76cdba9530e4-pVkSpxsf
test -d /home/alain/nam-deployment-evidence/checkpoint-d-76cdba9530e4-fmnYopZR
test -d /home/alain/nam-deployment-evidence/checkpoint-d-d3-identity-audit-g4FcBBfy
AUDIT_EXPORT='/home/alain/nam-deployment-evidence/checkpoint-d-d3-identity-audit-g4FcBBfy/candidate-oci-export.tar'
export AUDIT_EXPORT
```

After R1 and R2 pass, create only new private evidence:

```bash
umask 077
NAM_D_RECOVERY_EVIDENCE_DIR="$(
  mktemp -d /home/alain/nam-deployment-evidence/checkpoint-d-candidate-recovery-XXXXXXXX
)"
chmod 0700 "$NAM_D_RECOVERY_EVIDENCE_DIR"
test "$(stat -Lc '%a' "$NAM_D_RECOVERY_EVIDENCE_DIR")" = '700'
export NAM_D_RECOVERY_EVIDENCE_DIR
```

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r3-audit-export.sha256"
sha256sum "$AUDIT_EXPORT" \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r3-audit-export.sha256"
test "$(cut -d ' ' -f1 "$NAM_D_RECOVERY_EVIDENCE_DIR/r3-audit-export.sha256")" = \
  '40d43f58cdb5fdf4c3f678122add911d4422170955490cc1c6dc3ca776fb456b'
```

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r3-preservation.txt"
printf '%s\n' \
  'R1=PASS' 'R2=PASS' \
  'SUCCESSFUL_CHECKPOINT_EVIDENCE=PRESERVED' \
  'FAILED_D1_EVIDENCE=PRESERVED' \
  'INDEPENDENT_AUDIT_EVIDENCE=PRESERVED' \
  'INDEPENDENT_AUDIT_EXPORT_SHA256=40d43f58cdb5fdf4c3f678122add911d4422170955490cc1c6dc3ca776fb456b' \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r3-preservation.txt"
```

Do not overwrite, rename, chmod, or delete any historical evidence. Do not
snapshot every inode.

## R4 — Candidate And Runtime Reconfirmation

```bash
CANDIDATE='nam-app:checkpoint-d-git-76cdba9530e49334e775009a811ae5ae74305c65'
CANDIDATE_INDEX='sha256:c7a00e60735fe8d54e64886226cfeaaec799765efa62028d8b541b3628fa3092'
CANDIDATE_MANIFEST='sha256:bd1beb1b164945c74a75c2fe289fb150b2a183d26d92b6e1e46a0df9d1a6a780'
CANDIDATE_CONFIG='sha256:270cea507f6d073cb8ca3e5ee9b252c7545709e77c9ca80e0cbc914314f5a312'
```

Capture the exact candidate reference once and require one result:

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-index.json"
docker image inspect "$CANDIDATE" \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-index.json" >/dev/null
test "$(jq -r 'length' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-index.json")" = '1'
test "$(jq -r '.[0].Id' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-index.json")" = "$CANDIDATE_INDEX"
```

Capture the selected platform manifest and required labels:

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-platform.json"
docker image inspect --platform linux/amd64 "$CANDIDATE" \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-platform.json" >/dev/null
test "$(jq -r 'length' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-platform.json")" = '1'
test "$(jq -r '.[0].Id' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-platform.json")" = "$CANDIDATE_MANIFEST"
test "$(jq -r '.[0].Config.Labels["org.opencontainers.image.revision"]' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-platform.json")" = '76cdba9530e49334e775009a811ae5ae74305c65'
test "$(jq -r '.[0].Config.Labels["io.nam.checkpoint"]' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-platform.json")" = 'checkpoint-d-application-deployment-correction'
```

Read only the selected manifest's configuration descriptor:

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-config.txt"
tar -xOf "$AUDIT_EXPORT" "blobs/sha256/${CANDIDATE_MANIFEST#sha256:}" \
  | jq -er '.config.digest' \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-config.txt"
test "$(sed -n '1p' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-candidate-config.txt")" = "$CANDIDATE_CONFIG"
```

This is not another graph audit; the independent audit remains the complete
graph-validation authority.

Reconfirm the unchanged D1 containers, health, and exposure:

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-app-runtime.txt"
docker inspect nam-app --format \
  '{{.Id}}|{{.State.Status}}|{{json .NetworkSettings.Ports}}' \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-app-runtime.txt"
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-postgres-runtime.txt"
docker inspect nam-postgres --format \
  '{{.Id}}|{{.State.StartedAt}}|{{.RestartCount}}|{{.State.Health.Status}}|{{json .NetworkSettings.Ports}}' \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-postgres-runtime.txt"
test "$(sed -n '1p' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-app-runtime.txt")" = 'f500902546bdad63adb180118dab379b630be9618a11f5fe58f0ee63f42495f2|running|{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3000"}]}'
test "$(sed -n '1p' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-postgres-runtime.txt")" = '0d074cabe133c4b05d97705f21199b583b19a3eeecece28b8acc6322f97d2ce1|2026-06-30T18:17:12.705151191Z|0|healthy|{"5432/tcp":null}'
```

The original D1 application configuration digest
`sha256:03d0301ad1ca9bc2060fcb41676e08faa721ea6ef6108a5edc4db742fba211b4`
remains accepted historical configuration evidence. It was not derived from
container `.Image`, and this recovery does not invent or infer an old OCI index
for that container.

Reconfirm the unchanged V17 rollback tag and index:

```bash
ROLLBACK='nam-app:rollback-runtime-8cba9cb2122f-d3734e4ceddd4809ce573b5d92f64631628f387a60856409447331d8977d4ac1'
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-rollback-index.txt"
docker image inspect "$ROLLBACK" --format '{{.Id}}' \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-rollback-index.txt"
test "$(sed -n '1p' "$NAM_D_RECOVERY_EVIDENCE_DIR/r4-rollback-index.txt")" = 'sha256:8cba9cb2122f9010ff815d56056866b7fe910d958f70d3a3bb6ca74d3a82ef95'
```

## R5 — Recovery Classification

After an operator and independent reviewer manually accept every R1–R4 result,
create the new classification record. Never edit the historical fail-closed D3
report.

```bash
test ! -e "$NAM_D_RECOVERY_EVIDENCE_DIR/r5-classification.txt"
printf '%s\n' \
  'EXISTING_CANDIDATE_RECOVERY=PASS' \
  'D1=ACCEPTED' 'D2=ACCEPTED' 'EXISTING_D3_BUILD=PASS' \
  'D1_RERUN=NOT_REQUIRED' 'D2_RERUN=NOT_REQUIRED' \
  'CANDIDATE_REBUILD=NOT_REQUIRED' 'CORRECTED_D4=MAY_BEGIN' \
  | tee "$NAM_D_RECOVERY_EVIDENCE_DIR/r5-classification.txt"
test "$(find "$NAM_D_RECOVERY_EVIDENCE_DIR" -type f -printf '%m\n' | sort -u)" = '600'
```

`EXISTING_CANDIDATE_RECOVERY=PASS` is prohibited if any expected value,
manual review, file mode, or preservation check is incomplete.

## R6 — Later Gate Requirement

The operator must explicitly supply the directory in every shell that enters
D4–D8. Do not infer it.

```bash
NAM_D_RECOVERY_EVIDENCE_DIR='<exact recovery evidence directory from R3>'
export NAM_D_RECOVERY_EVIDENCE_DIR
```

Run this guard at the start of each of D4, D5, D6, D7, and D8:

```bash
test -n "${NAM_D_RECOVERY_EVIDENCE_DIR:-}"
test -d "$NAM_D_RECOVERY_EVIDENCE_DIR"
test ! -L "$NAM_D_RECOVERY_EVIDENCE_DIR"
test "$(sed -n '1p' "$NAM_D_RECOVERY_EVIDENCE_DIR/r5-classification.txt")" = \
  'EXISTING_CANDIDATE_RECOVERY=PASS'
```

Failure stops that gate. This evidence supplements, but never replaces or
modifies, historical evidence.

## Final Acceptance Checklist

- R1 uses an operator-supplied 40-character commit; all identities match it.
- R2 proves the transition is documentation-only and build inputs are unchanged.
- R3 preserves all historical evidence and creates only a private new directory.
- R4 matches every fixed candidate, runtime, database, exposure, and rollback identity.
- R5 records PASS without changing the historical D3 failure.
- The explicit R6 guard binds the recovered execution to D4–D8.
- No build, rerun, database action, deployment, or cleanup preceded corrected D4.
