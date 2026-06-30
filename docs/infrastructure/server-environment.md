# Server Environment Identity

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | NAM server identity is host-level infrastructure and belongs in `/etc/nam/environment`. |
| Confirmed | Shell variables are not canonical for environment identity. |
| Confirmed | The current VPS is the `development` environment. |
| Recommended | Future servers should use environment-specific hostnames and Docker labels that can be checked against `/etc/nam/environment`. |
| Idea | Add automated consistency verification across hostname, Docker labels, and `/etc/nam/environment`. |
| Open Question | Exact staging and production hostnames are not yet confirmed. |

## Purpose

NAM Dashboard servers need a durable identity that survives shell sessions,
login methods, user accounts, Docker containers, and deployment tooling.

The canonical server identity file is:

```text
/etc/nam/environment
```

Current development environment:

```text
NAM_ENVIRONMENT=development
NAM_ENVIRONMENT_ROLE=development-vps
NAM_PROJECT_ROOT=/home/alain/projects/nam
NAM_PROJECT_NAME="NAM Dashboard"
```

## Why `/etc/nam/environment`

`/etc/nam/environment` is a host-level configuration file. It describes the
server itself, not one user session and not one application process.

This is preferable because:

- SSH login shells, cron, systemd, Docker, and maintenance scripts do not all
  share the same shell environment.
- Shell variables can disappear, be overridden, or differ between users.
- Docker containers have their own environment and should not be the authority
  for the VPS identity.
- The MOTD needs to work before any project-specific application process starts.
- Disaster recovery needs one small, explicit file that can be recreated from
  GitHub.

## Why Shell Variables Are Not Canonical

Shell variables are useful for process configuration, but they are not reliable
as the source of truth for server classification.

Problems with shell variables:

- They are session-scoped unless exported through another mechanism.
- They can be different for `root`, `alain`, cron, and systemd.
- They can be accidentally inherited from a local terminal or automation tool.
- They are invisible to future operators unless documented elsewhere.

NAM Dashboard may still use process environment variables for application
runtime configuration. That is separate from the host identity file.

## Environment Names

Supported names:

| Name | Purpose |
| --- | --- |
| `development` | Current working VPS and project foundation. |
| `staging` | Future validation environment before production. |
| `production` | Future live environment. |
| `testing` | Controlled checks or automated test hosts. |
| `lab` | Disposable experiments. |

Accepted aliases may be handled by scripts, such as `dev` for `development` and
`prod` for `production`, but the file should use the full canonical name.

## Naming Conventions

Recommended variable names:

| Variable | Purpose |
| --- | --- |
| `NAM_ENVIRONMENT` | Canonical environment name. |
| `NAM_ENVIRONMENT_ROLE` | Human-readable server role, such as `development-vps`. |
| `NAM_PROJECT_ROOT` | Expected project root on that host. |
| `NAM_PROJECT_NAME` | Display name for MOTD and tooling. |

Recommended hostname convention:

```text
nam-dev
nam-staging
nam-prod
nam-test
nam-lab
```

The current hostname is `nam`, which is acceptable for the current single
development VPS. If multiple NAM servers are introduced, hostnames should become
environment-specific to reduce operator error.

## Future Docker Labels

Future Docker Compose services should include labels that mirror the host
identity when appropriate:

```yaml
labels:
  com.nam.project: "NAM Dashboard"
  com.nam.environment: "development"
  com.nam.environment_role: "development-vps"
```

These labels should not replace `/etc/nam/environment`. They are secondary
metadata for inspection and automated consistency checks.

## Future Environment Verification

A future verification command should compare:

- `/etc/nam/environment`
- hostname
- Docker Compose project labels
- running container labels
- project root path
- reverse proxy site labels or Caddy comments

The goal is to detect drift before deployments or maintenance work.
