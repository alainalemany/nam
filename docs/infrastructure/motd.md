# NAM Server MOTD

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | The MOTD is part of NAM Dashboard infrastructure. |
| Confirmed | The MOTD must preserve the current layout, emojis, colors, and environment-aware messaging. |
| Confirmed | The MOTD reads `/etc/nam/environment` for identity. |
| Recommended | Keep the MOTD script generic and move environment differences into example files under `infrastructure/environment/`. |
| Idea | Add Git, deployment, reverse proxy, TLS, backup, package update, failed service, temperature, and threshold-coloring sections later. |

## Installed Asset

Repository source:

```text
infrastructure/motd/99-alain-server-dashboard
```

Installed location:

```text
/etc/update-motd.d/99-alain-server-dashboard
```

The script is intentionally reusable across:

- Development
- Staging
- Production
- Testing
- Lab

Only `/etc/nam/environment` should differ between environments.

## Discovery Flow

1. PAM executes Ubuntu dynamic MOTD scripts from `/etc/update-motd.d`.
2. `99-alain-server-dashboard` runs late so it can act as the final NAM banner.
3. The script sources `/etc/nam/environment` if it exists.
4. `NAM_ENVIRONMENT` selects the label, color, and tip text.
5. `NAM_PROJECT_NAME` and `NAM_PROJECT_ROOT` customize project display.
6. If the file is missing, the script falls back to development-oriented defaults.

## Current Sections

The current script displays:

- Environment banner.
- Environment color.
- Project name.
- Server information.
- System resources.
- Docker information.
- Service status.
- Environment-specific tip.

Do not redesign the visual layout unless the operator explicitly approves it.

## Installation Guide

Install required package:

```bash
sudo apt-get update
sudo apt-get install -y figlet
```

Create configuration directory:

```bash
sudo mkdir -p /etc/nam
```

Install an environment file:

```bash
sudo install -m 0644 infrastructure/environment/development.example /etc/nam/environment
```

Review and edit the installed file if needed:

```bash
sudo nano /etc/nam/environment
```

Install the MOTD script:

```bash
sudo install -m 0755 infrastructure/motd/99-alain-server-dashboard /etc/update-motd.d/99-alain-server-dashboard
```

Disable default Ubuntu or provider MOTD scripts by removing executable bits from
the other scripts:

```bash
sudo find /etc/update-motd.d -maxdepth 1 -type f ! -name "99-alain-server-dashboard" -exec chmod -x {} +
```

Verify the only active dynamic MOTD script:

```bash
run-parts --test /etc/update-motd.d
```

Expected result:

```text
/etc/update-motd.d/99-alain-server-dashboard
```

Render the MOTD manually:

```bash
run-parts /etc/update-motd.d
```

## Helper Installer

A reusable helper is available:

```bash
sudo infrastructure/motd/install.sh infrastructure/environment/development.example
```

The installer:

- Installs `figlet` if missing.
- Creates `/etc/nam`.
- Backs up the existing NAM MOTD script if present.
- Backs up the existing environment file if present.
- Installs the MOTD script.
- Installs the selected environment file.
- Disables executable bits on other default MOTD files.
- Tests the dynamic MOTD with `run-parts`.

## Backup Strategy

Before replacing the MOTD script, copy the current script to:

```text
/etc/update-motd.d/backups/
```

Recommended file format:

```text
99-alain-server-dashboard.YYYY-MM-DD_HH-MM-SS.bak
```

Before replacing `/etc/nam/environment`, copy the current file to:

```text
/etc/nam/environment.YYYY-MM-DD_HH-MM-SS.bak
```

Backups are local server safety copies. The canonical reusable source belongs in
Git under `infrastructure/`.

## Adding A New Environment

1. Add an example file under `infrastructure/environment/`.
2. Use the canonical full environment name in `NAM_ENVIRONMENT`.
3. Choose a clear `NAM_ENVIRONMENT_ROLE`.
4. Set `NAM_PROJECT_ROOT` to the expected path for that host.
5. Install the example to `/etc/nam/environment`.
6. Run `run-parts /etc/update-motd.d`.
7. Confirm the banner, color, and tip match the environment.

If a new environment type is needed, update the `case` block in
`infrastructure/motd/99-alain-server-dashboard` and document the reason.

## Future Improvements

Future MOTD improvements should remain operationally useful and avoid turning
the MOTD into noisy decoration.

Ideas:

- Git branch, commit, and dirty-state section.
- Deployment status section.
- Docker Compose project detection.
- Reverse proxy detection.
- TLS certificate information.
- Backup freshness status.
- Available package update count.
- Failed systemd services.
- CPU temperature.
- Storage threshold coloring.
- Automatic consistency verification between hostname, Docker labels, and
  `/etc/nam/environment`.
