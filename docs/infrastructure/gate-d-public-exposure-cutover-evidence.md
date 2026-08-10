# Gate D Public Exposure Cutover Evidence

## Verdict

**PASS** — Gate D is complete. NAM's public Caddy route and public UFW TCP
`80`/`443` allowances were removed, independent public HTTP and HTTPS denial
passed, private Tailscale access remained functional, and public-key SSH
recovery remained available.

This evidence closes only Gate D of the unnumbered Controlled Pilot Readiness
Security and Deployment Re-baseline. It does not establish production
readiness, authorize confidential operational use, authorize a later readiness
gate, or assign a new development phase.

## Execution And Rollback

- Gate D was authorized and executed at revision
  `977483f985f26d080ad80d59cfc8c6abed3c122a`.
- All script prechecks passed before mutation, and execution completed
  successfully.
- A separate public-key SSH recovery session remained open and idle.
- The retained private rollback backup is
  `/home/alain/backups/nam/gate-d-20260810T002019Z-9oL76K`.
- Automatic rollback was not required.

## Host Cutover Results

- The public NAM Caddy route was removed through a graceful reload.
- Public UFW TCP `80` and `443` allowances were removed.
- SSH on TCP `22` remained allowed, and SSH access was preserved.
- The application remained healthy at `127.0.0.1:3000`.
- The script did not change Docker, PostgreSQL, uploads, application code, SSH
  configuration, Tailscale configuration, or DNS.

## Independent Validation

From the operator's Windows PC:

| Check | Result |
| --- | --- |
| `http://dev.alemany.me` | Timed out after approximately 10 seconds — PASS |
| `https://dev.alemany.me` | Timed out after approximately 10 seconds — PASS |
| `https://ops-console.tailf57e61.ts.net` | NAM Dashboard loaded through Tailscale — PASS |
| Day View | Worked normally — PASS |
| Private TLS | No certificate warning appeared — PASS |

These results independently prove public HTTP and HTTPS denial while preserving
the approved private access path.

## DNS Cleanup

The `dev.alemany.me` `A` record pointing to `217.76.49.214` was manually
deleted after the host cutover. The unrelated `nam.alemany.me` record was left
untouched.

## Post-Gate Direction

Infrastructure work is paused. Near-term priority returns to developing and
perfecting NAM Dashboard. Additional infrastructure work should occur only
when strictly necessary to unblock development or correct a critical
operational or security problem.

Comprehensive production-style infrastructure hardening and senior security
review are intentionally deferred until the application is substantially
complete. Current access is private and intended only for the sole operator
through the approved Tailscale path; this is not a production deployment.
