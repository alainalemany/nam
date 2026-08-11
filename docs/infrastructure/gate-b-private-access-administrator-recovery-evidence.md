# Gate B Private Access And Administrator Recovery Evidence

## Verdict

**PASS** — Gate B is formally complete. Two approved independent client
devices have accepted private HTTPS evidence, Tailscale Serve remains
tailnet-only with Funnel disabled, and a separate Windows recovery key has
proven key-only public SSH access to the non-root `alain` sudo administrator.
Current read-only server state does not materially contradict that accepted
evidence, and no operational mutation is required to satisfy the defined Gate
B boundary.

This is Gate B evidence for the unnumbered Controlled Pilot Readiness Security
and Deployment Re-baseline. Phase 29 has not been assigned. Gate B proves
private NAM access and independent administrator recovery; it does not remove
public exposure, authorize Gate D, authorize confidential operational use, or
authorize any later gate.

## Scope And Evidence Basis

Formal closure used repository revision
`efdea5402401437d9e962b3aa8421a49931e6189`. This task reused the previously
accepted external-client, tailnet-administration, and recovery exercises and
performed only focused read-only server revalidation. It did not repeat those
client or administration-console exercises and did not change Tailscale, SSH,
Fail2ban, UFW, Caddy, DNS, Docker, the application, or a database.

## Prior Accepted Private-Client Evidence

These results are prior accepted verification, not fresh checks from the VPS:

| Client | Accepted evidence | Result |
| --- | --- | --- |
| Windows `darnassus` | MagicDNS, Tailscale connectivity, private HTTPS with valid TLS, `/api/health`, and `/day-view` | PASS |
| iPad `ipad174` | Tailscale connectivity, private HTTPS without a certificate warning, `/api/health`, the root NAM page, and `/day-view` | PASS |

The two devices independently prove that approved desktop and mobile clients
can use the private route. A request originating from the VPS was not used as a
substitute for this evidence.

## Tailscale Boundary

Prior accepted tailnet-administration evidence established:

- identity-provider MFA is enabled;
- Device Approval is enabled;
- `ops-console` has `tag:nam-pilot`; and
- the explicit access rule permits the approved owner identity to reach
  `tag:nam-pilot` on TCP `443`.

Fresh read-only server inspection observed Tailscale `1.98.9`, backend state
`Running`, node `ops-console.tailf57e61.ts.net`, online state, and
`tag:nam-pilot`. The current Serve configuration is HTTPS on TCP `443` with `/`
proxied to `http://127.0.0.1:3000`. `AllowFunnel` is null, and CLI status labels
the endpoint `tailnet only`.

The VPS still cannot resolve its own MagicDNS hostname, so a VPS-originated
private GET was unavailable. This is a server-local self-resolution limitation,
not a contradiction of the accepted Windows and iPad HTTPS results and not a
reason to replace those independent tests.

## Independent Administrator Recovery

Prior accepted recovery verification established that:

- the dedicated Windows key `nam-recovery-ed25519` matched the authorized VPS
  fingerprint `SHA256:NU46B1iXfV4kM2yInwhyiWNeUVIGdi6pduyXH2yd++I`;
- Windows authenticated through the normal public SSH path, independently of
  Tailscale;
- the server recorded successful public-key authentication for `alain`;
- `alain` is a non-root sudo administrator;
- effective SSH policy enables public-key authentication, requires
  `publickey`, disables password and keyboard-interactive authentication, and
  disables root login; and
- the Fail2ban SSH jail was active and functioning.

Fresh read-only inspection found `alain` at UID `1000` with `sudo` membership,
two authorized ED25519 keys, `.ssh` mode `0700`, `authorized_keys` mode `0600`,
and both `ssh.socket` and `ssh.service` active. Current readable configuration
still declares `PasswordAuthentication no`,
`KbdInteractiveAuthentication no`, `PubkeyAuthentication yes`,
`AuthenticationMethods publickey`, and `PermitRootLogin no`. Non-interactive
privileged access was unavailable to rerun `sshd -T`; the accepted effective
policy evidence therefore remains the authority rather than being represented
as freshly repeated.

Fail2ban remains active. Current jail counters required privileged socket
access and were not reread; the prior accepted jail verification remains the
jail-level evidence.

Private application access and public administrator recovery are intentionally
different paths. Tailscale Serve is the private NAM application path. Public
TCP `22` is the independent break-glass path and must remain available when a
later task removes public NAM web exposure.

## Firewall, Listener, And Container Revalidation

- UFW remains active. Its readable defaults retain `IPV6=yes` and
  `DEFAULT_INPUT_POLICY="DROP"`. Detailed active rule enumeration required
  privileged access and was not repeated.
- SSH listens on public IPv4 and IPv6 TCP `22`.
- Caddy still listens publicly on TCP `80` and `443` and UDP `443`; the public
  NAM HTTPS endpoint returned HTTP `200` during revalidation.
- NAM remains bound only to `127.0.0.1:3000`.
- The PostgreSQL container remains running with no host-published port.
- Tailscale, SSH, Fail2ban, UFW, and Caddy services remain active.

Public NAM web exposure is deliberately unchanged. Its presence prevents pilot
access acceptance, but it does not invalidate Gate B's proof that the private
path and independent recovery path are ready for the separately authorized
Gate D cutover.

## Deferred Device Exercises

The owner intentionally declined creating a fourth disposable device solely to
exercise unapproved-device denial, revocation, re-enrollment, and emergency
disablement. These are accepted deferred exercises, not Gate B failures. No
device was approved, revoked, removed, re-enrolled, or disabled during formal
closure.

## Historical Finding As Originally Recorded

At Gate B closure, this document recorded the following finding:

> `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf` remains owned by
> `root:root` with mode `0777`. It is an outbound OpenSSH client fragment, not
> an inbound `sshd` authentication source, and it did not affect the
> independently proven Windows recovery login. Its correction remains a
> separately authorized host hardening action; this report neither fixes it
> nor claims it is resolved.

### 2026-08-11 Erratum — interpretation finding closed

Read-only host inspection established that the referenced path is a root-owned
symbolic link with mode `0777`, not a world-writable regular file. It points to
`/usr/lib/systemd/ssh_config.d/20-systemd-ssh-proxy.conf`, a root-owned regular
file with mode `0644`. Relevant parent directories on both paths are root-owned
with mode `0755`. On this system, the symlink permission bits do not make the
target world-writable.

No operational vulnerability requiring host remediation was found. The earlier
finding is closed as a documentation and interpretation correction; no host
file was modified. The successful Git push is not evidence for this security
conclusion. The evidence is the read-only inspection of the symlink, resolved
target, and parent-directory ownership and modes.

## Current Readiness Carry-Forward — 2026-08-11

This correction does not freshly revalidate Gate B or weaken its separate open
limitations:

- unapproved-device denial testing remains deferred;
- device revocation and re-enrollment exercises remain deferred;
- emergency-disablement exercises remain deferred; and
- current privileged UFW, Tailscale, effective `sshd`, and Fail2ban outputs
  were not fully refreshed during the deployment-readiness assessment because
  non-interactive sudo was unavailable.

The deployment-readiness authority classified these limitations as temporarily
acceptable for consideration of a narrowly bounded application-only deployment.
They remain prerequisites for separate revalidation before confidential
operational use or controlled-pilot authorization. The broader pilot recovery
gate remains open. Older pilot and disaster-recovery material must not be
treated as current deployment authority.

## State Protection

Sanitized pre-state and post-state were identical for:

- Tailscale node, tag, backend, Serve frontend/backend, and Funnel state;
- Tailscale, SSH, Fail2ban, UFW, and Caddy service states;
- TCP `22`/`80`/`443`/`3000` and UDP `443` listener bindings;
- SSH key-storage and client-fragment ownership and modes;
- the live `nam-app` container ID, image ID, running state, start time, restart
  count, and loopback port binding; and
- the PostgreSQL container ID, image ID, running state, and empty host-port
  bindings.

Only this evidence document and the minimal readiness-authority status update
were created or modified. No host, access, application, database, deployment,
or other repository mutation occurred.

## Gate D Boundary At Gate B Closure

At the time of Gate B closure, Gate D was the next unresolved readiness gate
and remained unauthorized. A later
separately approved task must preserve public TCP `22` recovery while removing
only public NAM application exposure through Caddy, DNS, TCP `80`/`443`, and
UDP `443` across IPv4 and IPv6. It must prove public NAM paths fail without
changing the private Serve path, deploying the Gate C image, migrating the
database, or entering operational data unless those actions receive their own
later authorization.

Gate B completion does not authorize Gate D, and Gate D completion would not
implicitly authorize Gate E or any later gate.

Subsequent preserved historical evidence records Gate D execution and PASS.
The 2026-08-11 deployment-readiness assessment found that historical evidence
sufficient for consideration of the application-only `8a6c652` candidate
because it changes no infrastructure or access surface. No new Gate D execution
is currently required, but immediate public/private binding checks and
approved-client verification would still be required after any future
separately authorized deployment. This status update neither authorizes
deployment nor controlled-pilot or confidential operational use.
