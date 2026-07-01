# ADR-013: Bootstrap Scripts, Verification Checks, And Server Config

Date: 2026-06-30

Status: Accepted

Category: Infrastructure/recovery

## Decision

NAM Dashboard infrastructure will use repository-owned bootstrap scripts,
read-only verification checks, and a `server-config` directory for reusable host
configuration templates.

## Reason

The Git repository should be the single source of truth for the entire NAM
infrastructure where safe and practical. Application code alone is not enough to
rebuild a server. A future operator or AI assistant also needs the server
bootstrap path, environment identity, MOTD installation, host configuration
templates, verification checks, and recovery philosophy.

## Structure

- `infrastructure/bootstrap/` contains small provisioning entry points.
- `infrastructure/checks/` contains read-only validation scripts.
- `infrastructure/server-config/` contains reusable host-level configuration
  templates.
- `docs/infrastructure/` contains the architectural and operational reasoning.

## Tradeoffs

- Shell scripts are simpler and easier to audit than introducing Ansible,
  Terraform, Pulumi, or cloud-init before the infrastructure surface justifies
  them.
- Shell scripts provide less state tracking than a full configuration-management
  tool, so verification scripts are required to detect drift.
- Production bootstrap remains disabled until production requirements, backup
  policy, secrets handling, reverse proxy, TLS, deployment, and rollback
  procedures are approved.

## Consequences

- Fresh server provisioning can start from GitHub instead of chat history.
- Future infrastructure changes should include both install/rebuild guidance and
  verification checks when practical.
- Verification scripts must remain read-only.
- Reusable server configuration should use the clearer `server-config` naming
  rather than `server-assets`, which could be confused with frontend assets.
