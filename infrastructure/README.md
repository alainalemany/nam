# NAM Infrastructure Assets

This directory stores reusable infrastructure assets for NAM Dashboard servers.

The goal is to make GitHub the source of truth for server identity, MOTD behavior,
environment classification, and reusable host configuration patterns.

## Layout

```text
infrastructure/
  environment/       Example /etc/nam/environment files by environment.
  motd/              Installable NAM Dashboard MOTD script and MOTD docs.
  server-assets/     Parking area for reusable host-level configuration assets.
```

## Source Of Truth

- Repository assets live here.
- Installed host configuration lives under `/etc`, systemd, cron, Docker, or other
  host-owned paths as appropriate.
- Secrets, database dumps, private keys, and live certificates must not be stored
  in this repository.

## Asset Policy

Reusable configuration belongs in Git when it is useful for rebuilding a NAM
server. Environment-specific secrets and generated runtime state stay outside
Git and are documented with placeholders or examples.
