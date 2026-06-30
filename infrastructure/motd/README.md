# NAM MOTD Asset

`99-alain-server-dashboard` is the canonical NAM Dashboard dynamic MOTD script.

It is intentionally environment-aware and reusable across development, staging,
production, testing, and lab servers. The script should stay generic; the server
identity comes from `/etc/nam/environment`.

## Installed Location

```text
/etc/update-motd.d/99-alain-server-dashboard
```

## Environment File

```text
/etc/nam/environment
```

Example files live in:

```text
infrastructure/environment/
```

## Install

Use the documented runbook in:

```text
docs/infrastructure/motd.md
```

or run the helper script after reviewing it:

```bash
sudo infrastructure/motd/install.sh infrastructure/environment/development.example
```
