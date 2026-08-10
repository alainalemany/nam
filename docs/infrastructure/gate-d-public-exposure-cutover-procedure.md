# Gate D Public Exposure Cutover Procedure

## Status And Authority

**Prepared and validated, not executed. Gate D is not authorized.** A future
authorization must name the exact committed revision containing this runbook,
the cutover script, and its Caddy candidate. Earlier Gate D authorization does
not apply to this replacement.

This procedure implements only the host-side public-exposure cutover defined by
the [Controlled Pilot Readiness Re-baseline](controlled-pilot-readiness-rebaseline.md).
It does not deploy the application, change DNS or Tailscale, accept Gate D, or
authorize any later gate.

## Prerequisites

Before the maintenance window:

- use a clean `main` worktree at the newly authorized committed revision;
- keep one operator SSH session and a second public-key SSH session open, idle,
  and independently usable;
- confirm `dev.alemany.me` has the expected VPS `A` record and no `AAAA` or
  `CNAME`; DNS records are checked but never changed by this script;
- confirm the existing private Tailscale route works from an approved client;
- ensure `/home/alain/backups/nam` is the existing private backup parent; the
  script creates a new child and never discovers or changes an earlier partial
  recovery directory; and
- obtain a new explicit authorization for this exact committed revision.

The script stops before cutover mutation unless Caddy and SSH are active, the
live Caddyfile is semantically the sole repository-defined NAM route, both live
and proposed Caddy configurations validate, local application health succeeds,
UFW is active, public SSH remains allowed over IPv4 and IPv6, simple public TCP
80/443 allows exist over both families, and no UDP 443 allow exists. UFW
matching tolerates normal spacing, comments, and `OpenSSH` labels.

## Execution

From the repository root, run exactly once after the new authorization:

```bash
sudo scripts/infrastructure/gate-d-cutover.sh <AUTHORIZED_COMMITTED_REVISION>
```

Enter `SECOND SESSION OPEN` only after verifying that the independent
public-key SSH session is still open and idle.

## What The Script Changes

The script installs the validated no-site Gate D Caddyfile while preserving the
live Caddyfile owner, group, and mode, then gracefully reloads Caddy. It removes
only the existing UFW public allows for TCP 80 and TCP 443. It never references
or changes TCP 22 and does not change UDP 443 because the approved baseline has
no UDP 443 allow.

It does not modify Docker resources, the application, PostgreSQL, uploads,
backups of application data, SSH, Tailscale, DNS records, certificates, or any
other infrastructure.

## Success Criteria

The script reports success only when:

- Caddy remains active with a valid configuration and no HTTP servers;
- UFW remains active, TCP 80/443 have no allow rules over IPv4 or IPv6, and
  public SSH remains allowed over both families;
- `http://dev.alemany.me/api/health` and
  `https://dev.alemany.me/api/health` produce only a connection refusal or
  timeout, not an HTTP response, DNS failure, or TLS-only failure; and
- `http://127.0.0.1:3000/api/health` remains healthy.

Successful script execution is host-cutover evidence only. DNS cleanup, fresh
approved-client private-access confirmation, independent public denial checks,
and Gate D acceptance remain separately governed by the re-baseline.

## Backup And Automatic Rollback

After every precheck passes and immediately before the first cutover mutation,
the script creates one private directory:

```text
/home/alain/backups/nam/gate-d-<UTC_TIMESTAMP>-<RANDOM_SUFFIX>/
```

It contains only the prior Caddyfile and the IPv4/IPv6 UFW user rule files
needed for rollback. Earlier backup and partial recovery directories are never
touched.

Any command failure, interruption, or failed validation after mutation begins
automatically restores the backed-up Caddyfile and any UFW state the script may
have changed. It reloads Caddy and UFW as applicable, then verifies Caddy,
public SSH allowance, and local application health. The final verdict states
whether rollback succeeded and prints the exact retained backup directory.

If rollback is reported incomplete, keep both SSH sessions open and recover
from that exact directory. Do not rerun the cutover or select another backup
directory automatically.
