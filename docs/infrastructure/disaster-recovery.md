# Server Identity Disaster Recovery

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | NAM Dashboard server identity must be recoverable from GitHub. |
| Confirmed | `/etc/nam/environment` and the NAM MOTD are required identity assets for a rebuilt server. |
| Recommended | Keep reusable host configuration under `infrastructure/server-config/`, bootstrap entry points under `infrastructure/bootstrap/`, verification scripts under `infrastructure/checks/`, and operational runbooks under `docs/infrastructure/`. |
| Open Question | Full production restore procedures are not confirmed because production does not exist yet. |

## Scenario

Assume the current VPS provider disappears and a brand new VPS must be created.
The operator should be able to recreate the NAM Dashboard development server
identity from GitHub without relying on chat history.

This document covers the recovery philosophy for server identity and host
customization. A server is not considered recoverable simply because the
application source code exists. Its identity, reusable configuration, bootstrap
path, verification checks, and operational documentation must also be recoverable
from GitHub.

Application data recovery, PostgreSQL restore, object storage restore, and
production deployment restore require separate runbooks as those systems mature.

## Minimum Recovery Inputs

Required:

- GitHub repository access.
- SSH access to a new Ubuntu VPS.
- A user account with sudo privileges.
- The intended environment, usually `development` for the current VPS.

Optional but recommended:

- Latest PostgreSQL backup from off-server storage.
- Any saved `.env` secrets from the operator's password manager.
- DNS records if rebuilding a public staging or production host.

## Rebuild Steps

Install base packages:

```bash
sudo apt-get update
sudo apt-get install -y git figlet
```

Clone the repository:

```bash
mkdir -p /home/alain/projects
git clone https://github.com/<owner>/<repo>.git /home/alain/projects/nam
cd /home/alain/projects/nam
```

Install the NAM MOTD and development identity:

```bash
sudo infrastructure/bootstrap/development.sh
```

Verify the active MOTD script:

```bash
run-parts --test /etc/update-motd.d
```

Render the MOTD:

```bash
run-parts /etc/update-motd.d
```

Confirm the environment file:

```bash
cat /etc/nam/environment
```

Expected development values:

```text
NAM_ENVIRONMENT=development
NAM_ENVIRONMENT_ROLE=development-vps
NAM_PROJECT_ROOT=/home/alain/projects/nam
NAM_PROJECT_NAME="NAM Dashboard"
```

Run repository-defined verification:

```bash
infrastructure/checks/verify-server.sh
```

## Recovering Other Server Configuration

Review:

```text
infrastructure/server-config/
infrastructure/bootstrap/
infrastructure/checks/
docs/infrastructure/
docs/infrastructure.md
```

Install only assets that are confirmed for the target environment. Do not install
future production, Caddy, fail2ban, cron, or systemd assets simply because they
exist in the repository.

## Data Recovery Boundary

This runbook does not restore live application data.

For PostgreSQL development backups, current documentation points to:

```text
/home/alain/backups/nam/postgres/
```

Those backup payloads are intentionally outside Git. A complete future disaster
recovery plan should include off-server backup storage, restore testing, and
documented secret recovery.

ADR-018 adds a planned media recovery boundary for Operational Safety
Checklist photos. After Phase 23.5 implementation, a recoverable set must pair
the PostgreSQL backup with the matching archive and checksum manifest from:

```text
/home/alain/backups/nam/media/
```

Photo mutations must be paused while that set is created. Restore PostgreSQL
first and media second while the application is stopped, then reconcile
checksums, missing files, and orphans before service resumes. A missing media
file must not make the completed checklist unreadable. Named-volume persistence
alone is not disaster recovery, and this runbook does not claim atomic
consistency between PostgreSQL and the filesystem.

## Verification Checklist

- `/etc/nam/environment` exists.
- `run-parts --test /etc/update-motd.d` shows `99-alain-server-dashboard`.
- `run-parts /etc/update-motd.d` renders the correct environment banner.
- Hostname matches the intended environment naming convention or is documented
  as an exception.
- Repository is cloned at the path declared by `NAM_PROJECT_ROOT`.
- No secrets or backup payloads were committed to Git.
