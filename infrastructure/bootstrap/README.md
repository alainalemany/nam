# Bootstrap Scripts

Bootstrap scripts are the first commands used after a fresh server is created
and the repository is cloned.

They are intentionally small. NAM Dashboard does not need a full configuration
management framework yet, but it does need repeatable entry points that show a
future operator or AI assistant how a server is brought into shape.

## Philosophy

- Keep bootstrap scripts boring, readable, and idempotent where practical.
- Prefer one script per infrastructure concern.
- Do not hide destructive behavior behind bootstrap commands.
- Do not store secrets in bootstrap scripts.
- Let bootstrap install reusable configuration from this repository rather than
  inventing host-local state.

## Scripts

| Script | Purpose |
| --- | --- |
| `ubuntu-base.sh` | Install base packages expected on a NAM Ubuntu server. |
| `docker.sh` | Prepare Docker using Ubuntu package names. |
| `motd.sh` | Install the NAM MOTD and selected environment file. |
| `development.sh` | Bootstrap the current development server platform and identity. |
| `production.sh` | Placeholder guardrail until production is formally defined. |

## Fresh Development Server Shape

After cloning the repository:

```bash
cd /home/alain/projects/nam
sudo infrastructure/bootstrap/development.sh
infrastructure/checks/verify-server.sh
```

Production should not be bootstrapped by habit. It needs an approved production
environment definition, domain, backup policy, secrets plan, and restore test
before a production bootstrap script becomes active.
