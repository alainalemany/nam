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
