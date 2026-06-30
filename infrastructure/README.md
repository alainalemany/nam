# NAM Infrastructure

This directory stores reusable infrastructure for NAM Dashboard servers.

The Git repository is the single source of truth for NAM infrastructure wherever
that is practical. Application code is only one part of the project. Server
identity, reusable configuration, deployment philosophy, recovery procedures,
verification checks, and operational knowledge should live here when they are
safe to store in Git.

## Layout

```text
infrastructure/
  bootstrap/         Small provisioning entry points for fresh servers.
  checks/            Read-only validation scripts.
  environment/       Example /etc/nam/environment files by environment.
  motd/              Installable NAM Dashboard MOTD script and MOTD docs.
  server-config/     Reusable host-level configuration templates.
```

## Source Of Truth

- Repository infrastructure lives here.
- Installed host configuration lives under `/etc`, systemd, cron, Docker, or other
  host-owned paths as appropriate.
- Secrets, database dumps, private keys, and live certificates must not be stored
  in this repository.

## Configuration Policy

Reusable configuration belongs in Git when it is useful for rebuilding a NAM
server. Environment-specific secrets and generated runtime state stay outside
Git and are documented with placeholders or examples.

Bootstrap scripts may modify a host and should be reviewed before running.
Check scripts are read-only and can be used after bootstrap, after migration, or
before maintenance work.
