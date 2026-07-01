# ADR-011: Phase 2B Application Platform Foundation

Date: 2026-06-30

Status: Accepted

Category: Infrastructure/application platform

## Decision

Phase 2B establishes the application platform foundation with Next.js,
TypeScript, Prisma, pnpm, and a Docker Compose `app` service bound only to
localhost.

## Reason

Phase 2A validated the private PostgreSQL foundation. The next approved
platform step is to introduce the application runtime without starting
feature-module implementation, public ingress, authentication, or production
deployment work. A minimal Next.js foundation gives the project a real
application build target, Prisma Client generation path, and app-to-database
connectivity check while preserving the documentation-first product workflow.

## Phase 2B Scope

- Initialize a minimal Next.js application foundation.
- Use TypeScript.
- Use pnpm as the package manager.
- Configure Prisma with PostgreSQL as the datasource.
- Generate the initial Prisma Client.
- Add a Dockerfile for the Next.js application.
- Add the `app` service to Docker Compose.
- Attach `app` and `postgres` to `nam-network`.
- Keep PostgreSQL private with no published database port.
- Publish the application only on `127.0.0.1:3000`.
- Keep the Compose structure extensible for future services.

## Out Of Scope

- Authentication, authorization, and user management.
- Feature modules and business logic.
- Production deployment.
- Caddy, HTTPS, public ingress, and firewall changes.
- Monitoring and background workers.

## Consequences

- The repository now contains application source files, but product modules
  remain unimplemented until approved requirements are ready.
- Local development should use pnpm commands documented in
  `docs/development.md`.
- Docker Compose remains the development platform entry point.
- The application can reach PostgreSQL through Docker networking without
  exposing PostgreSQL to the host or Internet.
- Public access remains deferred to the later reverse proxy and HTTPS phase.
