# Server Configuration

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | Reusable server configuration belongs in Git when it is safe to store. |
| Confirmed | Secrets, private keys, certificates, database dumps, and generated runtime state do not belong in Git. |
| Confirmed | The reusable host-configuration directory is `infrastructure/server-config/`. |
| Recommended | Add templates before installing new host-level services so rebuild instructions stay close to the configuration. |
| Idea | Future production may promote selected templates into stronger provisioning automation. |

## Purpose

NAM Dashboard is not only application code. It also includes the server identity,
operating conventions, host-level configuration templates, recovery procedures,
and operational knowledge needed to rebuild a NAM server.

`infrastructure/server-config/` is the home for reusable host-level
configuration that is not already represented by Docker Compose, application
source code, or dedicated infrastructure modules such as MOTD.

## Why `server-config`

The previous name, `server-assets`, was intentionally replaced. In a web
application repository, "assets" usually suggests images, fonts, or frontend
resources. `server-config` is clearer because the directory stores host
configuration templates and operational fragments.

## What Belongs Here

Examples:

- shell aliases and profile fragments
- Caddyfile templates and reverse proxy snippets
- Docker host conventions outside application Compose files
- systemd units and timers
- fail2ban jails and filters
- cron definitions
- deployment helper scripts
- backup and restore helper scripts

## What Does Not Belong Here

Never commit:

- real `.env` files containing passwords
- private SSH keys
- TLS private keys or live certificate material
- database dumps
- generated logs
- provider credentials
- sensitive production data

Use examples, templates, placeholders, and runbooks instead.

## Relationship To Other Infrastructure Directories

```text
infrastructure/bootstrap/      Commands that provision a fresh server.
infrastructure/checks/         Read-only validation.
infrastructure/environment/    Example host identity files.
infrastructure/motd/           Canonical NAM MOTD asset.
infrastructure/server-config/  Reusable host-level configuration templates.
```

If a configuration item has its own lifecycle and documentation needs, it may
graduate from `server-config/` into a dedicated directory later. The goal is
clarity, not forcing every file into one bucket forever.
