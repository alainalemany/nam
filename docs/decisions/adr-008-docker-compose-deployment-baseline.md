# ADR-008: Docker Compose Deployment Baseline

Date: 2026-06-29

Status: Accepted

Category: Infrastructure/deployment

## Decision

NAM Dashboard will use Docker Compose as the standard deployment method, with
the Next.js application and PostgreSQL running in Docker containers and Caddy
installed directly on the VPS host as the public reverse proxy.

## Reason

This keeps the platform simple to operate, production-ready, reproducible, and
easy to extend without adding unnecessary infrastructure before it is needed.
Docker Compose provides clear service boundaries for the application and
database, while host-level Caddy keeps TLS termination and public HTTP routing
simple and independent of application container rebuilds.

## Deployment Baseline

- Docker Compose is the standard deployment method.
- The Next.js application runs inside Docker.
- PostgreSQL runs inside Docker using persistent named volumes.
- Database storage must not rely on the container filesystem.
- Regular PostgreSQL backups must be written outside the database container.
- Caddy is installed directly on the VPS host, not inside Docker.
- Caddy terminates TLS, automatically manages HTTPS certificates, and reverse
  proxies requests to the Next.js container.
- Only Caddy should be exposed directly to the Internet.

## Initial Docker Services

- `app`
- `postgres`

Future services, added only when justified by real requirements:

- `redis`
- background workers
- object storage
- monitoring
- logging

## Network Flow

```text
Internet
Caddy on the VPS host
Docker network
Next.js app container
PostgreSQL container with persistent storage
```

## Consequences

- Containers should be replaceable without data loss.
- Infrastructure should remain reproducible through Docker Compose.
- PostgreSQL backup and restore procedures are required platform work, not
  optional polish.
- Caddy configuration becomes the authoritative public ingress layer for the
  dashboard.
- Additional infrastructure components should be deferred until they solve a
  specific problem.
- This deployment model is the baseline for future infrastructure decisions
  unless a specific requirement justifies changing it.
