# Server Configuration Preservation Strategy

This directory is the long-term home for reusable host-level configuration that
should survive VPS loss, migration, or rebuild.

The name `server-config` is intentional. These files are not frontend assets and
not generated runtime state. They are configuration templates, fragments, and
small host-level utilities that document how NAM servers should be shaped.

## What Belongs Here

- MOTD assets and related scripts.
- Shell aliases and shell profile fragments.
- Caddyfile templates and reverse proxy snippets.
- Docker Compose files or host-level Docker helper scripts.
- systemd unit files and timers.
- fail2ban jail/filter templates.
- cron job definitions.
- deployment and verification scripts.
- backup and restore helper scripts.

## What Does Not Belong Here

- Secrets.
- `.env` files containing real passwords.
- Database dumps.
- Private SSH keys.
- TLS private keys or live certificate material.
- Generated logs or transient runtime state.

## Subdirectories

```text
shell/      Bash aliases, profile fragments, shell helpers.
caddy/      Caddyfile templates and reusable snippets.
docker/     Host Docker conventions outside application compose files.
systemd/    Unit and timer templates.
fail2ban/   Jail and filter templates.
cron/       Cron definitions.
scripts/    Reusable server operation scripts.
backups/    Backup strategy docs or scripts, not backup payloads.
```

Each asset should include enough comments or nearby documentation for a future
operator to understand where it is installed and how to verify it.

The `docker/` directory also holds evidence-only, digest-pinned Compose
overrides when a readiness gate requires a durable candidate and rollback
identity. These overrides do not authorize execution and must be paired with a
separately approved procedure. The current Gate C artifacts are:

- `docker/gate-c-8a6c652-candidate.compose.yaml`
- `docker/gate-c-8a6c652-rollback.compose.yaml`
- `docker/gate-c-8a6c652-compose.sha256`

The `8a6c652` candidate identity uses these distinct terms:

- local tag: `nam-app:pre-pilot-candidate-git-8a6c652`;
- Docker top-level ID / OCI index digest:
  `sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70`;
- local repository-digest / OCI index reference:
  `nam-app@sha256:258615a34224279016499423a23351a022e6a65f54df0fe8b17b26926696af70`;
- `linux/amd64` manifest digest:
  `sha256:39557fa4c75c2a27993325a3313902d7ccda51eb267e168a21e98c20668126b3`;
- image config digest:
  `sha256:b94d1f372db519ca0bdd73b63b3a078b05c8e0a62aae3e3e6e0d3e7be52faa2b`;
- registry digest: none, because the candidate is unpublished;
- OCI creation label: `2026-08-11T14:31:32Z`; and
- image-config creation timestamp: `2026-08-11T14:35:14.242247139Z`.

The candidate override pins the local repository-digest/OCI index reference;
it does not imply a published registry digest. Runtime outcomes described in
the
[Gate C evidence](../../docs/infrastructure/gate-c-immutable-deployment-candidate-evidence.md)
remain executor-recorded where primary transcripts were not retained. The
immediate sequence is documentation repair, independent read-only re-review and
approval, then a separately controlled commit and push of only the six Gate C
evidence/artifact files. Only after that sequence may a separate
deployment-readiness or deployment-authorization request be considered.
