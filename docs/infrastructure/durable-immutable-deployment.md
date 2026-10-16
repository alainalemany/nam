# Durable Immutable Deployment Configuration

Status: Confirmed configuration; deployment not authorized

Last Reviewed: 2026-10-16

This runbook is the canonical operational reference for selecting the approved
NAM Dashboard application image without depending on a temporary file. It
defines configuration and future commands only. It does not authorize an
application restart, container recreation, deployment, image pull, image build,
database migration, or database restore.

General infrastructure behavior remains in
[Infrastructure Operations](../infrastructure.md). Recovery requirements remain
in [Server Identity Disaster Recovery](disaster-recovery.md). The controlled
pilot remains governed separately by the
[Operational Pilot Runbook](operational-pilot-runbook.md).

## Approved Baseline

| Item | Approved identity |
| --- | --- |
| Release revision | `4bcc998038bb9983a56646ee2abe9508cadd374c` |
| Application image ID | `sha256:4e41f290122b0984da795eb4bc1f9769f635c1bc73c367ccc1438805ce0605b9` |
| Previous image retained for coordinated recovery only | `sha256:50c43e4db2fc42a216249452d4d4b89a94d0fe958358624b7b24e673315d0663` |
| Database migration ledger | 37 successful, 0 incomplete, 0 rolled back |
| Base Compose file | `compose.yaml` |
| Durable image override | `infrastructure/server-config/docker/production-image.override.yaml` |

The temporary `/tmp/nam-gate5-candidate.override.yaml` is retained as Gate 5
operational evidence until the owner accepts this replacement. It is not part
of the durable command path.

## Configuration Design

Always provide the Compose files in this order:

1. `compose.yaml`
2. `infrastructure/server-config/docker/production-image.override.yaml`

The base file remains the canonical source for service definitions, loopback
publishing, private networking, PostgreSQL storage, environment-variable
forwarding, health checks, restart policies, and service dependencies. The
override changes only application image selection:

- `image` is the exact approved Docker image ID, not `latest` or another tag.
- `build: !reset null` removes the base `app.build` mapping after Compose
  merge. An `image` entry alone would leave the build definition present.
- `pull_policy: never` prevents registry resolution or pulling when the local
  image is absent.

The future mutation command also requires `--no-build --pull never`. These CLI
flags are an independent operator guard; they do not replace the override.

The override intentionally contains no environment block, secret, Employee ID,
credential, port, volume, network, restart policy, health check, or dependency
definition. Those values continue to come from the base file and the protected
`.env` file.

## Safe Configuration Inspection

Run from the repository root. Never capture unfiltered `docker compose config`
output because the rendered environment contains secrets.

View only the non-sensitive deployment structure:

```bash
docker compose \
  --env-file .env \
  -f compose.yaml \
  -f infrastructure/server-config/docker/production-image.override.yaml \
  config --format json \
  | jq '{
      name,
      services: {
        app: (.services.app | {
          image, build, pull_policy, restart, ports, networks, depends_on
        }),
        postgres: (.services.postgres | {
          image, restart, ports, networks, volumes, healthcheck
        })
      },
      networks,
      volumes
    }'
```

List only the resolved image selectors:

```bash
docker compose \
  --env-file .env \
  -f compose.yaml \
  -f infrastructure/server-config/docker/production-image.override.yaml \
  config --images
```

Verify the protected Payroll configuration without printing any value:

```bash
docker compose \
  --env-file .env \
  -f compose.yaml \
  -f infrastructure/server-config/docker/production-image.override.yaml \
  config --format json \
  | jq -e '
      .services.app.environment as $environment
      | ($environment.NAM_PAYROLL_OWNER_EMPLOYEE_ID | length) > 0
        and ($environment.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID | length) > 0
        and $environment.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID
          == $environment.NAM_PAYROLL_OWNER_EMPLOYEE_ID
        and ($environment.NAM_PAYROLL_ACCESS_KEY | length) >= 32
        and ($environment.NAM_PAYROLL_SESSION_SECRET | length) >= 32
    ' >/dev/null
```

Run the secret-free regression check:

```bash
bash tests/infrastructure/durable-production-compose-config.sh
```

## Image Identity Checks

Before any separately authorized operation, prove the approved local image is
present and carries the approved release revision:

```bash
docker image inspect \
  --format 'image={{.Id}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}' \
  sha256:4e41f290122b0984da795eb4bc1f9769f635c1bc73c367ccc1438805ce0605b9
```

Expected values are the image ID and release revision in the Approved Baseline
table. Absence or mismatch is a stop condition. Do not retag, rebuild, or pull a
substitute.

## Future Authorized Compose Operation

The required file set and safety flags for a future separately authorized
application operation are:

```bash
docker compose \
  --env-file .env \
  -f compose.yaml \
  -f infrastructure/server-config/docker/production-image.override.yaml \
  ps postgres

docker compose \
  --env-file .env \
  -f compose.yaml \
  -f infrastructure/server-config/docker/production-image.override.yaml \
  up -d --no-deps --no-build --pull never app
```

Do not run the base file by itself for a production operation. Do not add
`--build`, omit `--no-build`, change `--pull never`, or substitute a mutable
tag. `--no-deps app` scopes this application-image operation away from the
existing PostgreSQL container; verify PostgreSQL is already healthy before a
separately authorized use. The command above is documented for future use and
is not authorized by this runbook or by the presence of the configuration
file.

After an authorized operation, verify the running identity without printing
environment values:

```bash
docker inspect \
  --format 'image={{.Image}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}' \
  nam-app
curl -fsS http://127.0.0.1:3000/api/health >/dev/null
docker inspect nam-app --format '{{json .HostConfig.PortBindings}}'
docker inspect nam-postgres --format '{{json .HostConfig.PortBindings}}'
```

The application image and revision must equal the Approved Baseline, the app
must remain bound only to `127.0.0.1:3000`, and PostgreSQL must remain
unpublished.

## Future Image Upgrade

A future upgrade requires a new explicit approval naming an exact release
revision and immutable image ID. Before changing this repository file:

1. Build and validate the candidate under its separately approved procedure.
2. Verify its exact image ID and embedded OCI revision label.
3. Confirm migration and rollback compatibility with the live database.
4. Change only the override's `image` value to the newly approved full image
   ID; never use `latest` or a mutable tag.
5. Run the regression check and the safe production render checks.
6. Review and selectively commit the configuration change.
7. Obtain separate authorization before running the guarded Compose command.

The image ID is an immutable selector in the current host's local Docker image
store. `pull_policy: never` deliberately fails closed after image loss. Host-loss
recovery therefore also requires a separately preserved and verified image
artifact or a newly approved immutable registry reference; this file alone is
not an image backup.

## Recovery And Retention

Retain all of the following until a later owner-approved retention decision:

- The current running `nam-app` container.
- The approved application image ID.
- The previous image ID.
- The Gate 5 frozen pre-migrations 35--37 database backup, checksum, TOC,
  manifest, and cutover-verification record.
- The temporary Gate 5 override until this durable configuration is reviewed
  and accepted.

Reverting this configuration file is only a configuration rollback. It does
not make an older application compatible with the current database. The
previous image predates migrations 35--37 and must never be run against the
migration-37 database. Any return to that image requires one coordinated,
separately authorized database-and-image recovery using the matching frozen
pre-migration backup. Do not improvise a partial rollback.
