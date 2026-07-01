# ADR-012: Server Identity And MOTD Reproducibility

Date: 2026-06-30

Status: Accepted

Category: Infrastructure/recovery

## Decision

NAM Dashboard server identity and MOTD customization are part of the project
infrastructure and must be reproducible from the Git repository.

## Reason

The current VPS is the development platform foundation for NAM Dashboard. If the
VPS is lost, migrated, or rebuilt, its environment identity, operator-facing
MOTD, and server customization philosophy should not depend on chat history,
local memory, or one-off manual changes. The server identity must be explicit,
portable, and inspectable.

## Standards

- `/etc/nam/environment` is the canonical host identity file.
- Shell variables are not the canonical source for environment identity.
- The NAM MOTD script reads `/etc/nam/environment`.
- The MOTD script should remain reusable across development, staging,
  production, testing, and lab servers.
- Environment differences belong in environment files, not in separate MOTD
  implementations.
- Repository infrastructure assets live under `infrastructure/`.
- Long-form infrastructure runbooks live under `docs/infrastructure/`.
- Secrets, private keys, live certificates, database dumps, and generated
  runtime state must not be committed to Git.

## Consequences

- A future server can recreate the NAM Dashboard identity from GitHub.
- MOTD changes should preserve the current environment-aware layout unless an
  approved design decision changes it.
- Future Docker labels, hostnames, reverse proxy configuration, and deployment
  checks should be designed so they can be compared against
  `/etc/nam/environment`.
- Server customization becomes documented infrastructure work rather than
  unmanaged local state.
