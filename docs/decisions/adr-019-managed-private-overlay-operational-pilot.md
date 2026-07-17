# ADR-019: Managed Private Overlay For The Operational Pilot

Date: 2026-07-17

Status: Accepted

Category: Infrastructure/security architecture

## Decision

NAM Dashboard will use a managed private overlay network, with Tailscale as the
implementation reference, as the access boundary for the controlled real-data
pilot.

Only approved devices or identities may reach a tailnet-only HTTPS service that
forwards to the existing application binding at `127.0.0.1:3000`. The public
unauthenticated `dev.alemany.me` application route must be removed, and public
HTTP/HTTPS ingress must be closed for IPv4 and IPv6, before the Access Gate can
pass.

Tailscale provides network access control. It does not provide NAM application
authorization, per-record permissions, workforce identity, or an application
audit trail.

## Context

The current development deployment publishes the application only on host
loopback and keeps PostgreSQL private to Docker, but host-level Caddy exposes
`https://dev.alemany.me` publicly without authentication. That public route is
acceptable only for non-sensitive development data and does not satisfy the
Operational Pilot Runbook's Access Gate.

The pilot needs practical access from a Windows desktop, iPad, iPhone, approved
personal devices, and a corporate Android device when company policy permits.
Those devices may connect from mine-site cellular networks, home networks, and
carrier-grade NAT. The pilot has one initial administrator and primary operator
and does not yet require multi-user application authentication.

The host has both public IPv4 and IPv6 connectivity. Removing only a public DNS
`A` record would not remove direct IPv6 or hostname-routed exposure. The access
boundary therefore must close the public route at Caddy and the host firewall
and must verify both address families externally.

## Security Boundary

The approved boundary has these properties:

- The VPS and every approved user device are enrolled in one administratively
  controlled tailnet.
- Administrator MFA and device approval are enabled before pilot access.
- The default allow-all policy is removed. Explicit grants produce an effective
  deny-by-default policy and permit only approved pilot devices or identities
  to reach the NAM private HTTPS service on its required port.
- Broad all-device, all-destination, or all-port grants are prohibited.
- An unapproved tailnet member cannot reach NAM.
- Removed devices require administrator approval before they can re-enroll.
- Tailscale Funnel and every other public-sharing capability remain disabled.
- The Next.js application remains published only on `127.0.0.1:3000`.
- PostgreSQL remains unpublished and reachable only through the existing private
  Docker network.
- Loss of the private data-plane path or local private HTTPS service fails
  closed: NAM becomes unavailable to pilot devices rather than becoming public.
- A Tailscale coordination or control-plane outage must never create a public
  NAM fallback. Existing approved devices may continue communicating through
  established paths by using locally cached keys and access policies. That
  continuity depends on cached state, key validity, network conditions, and an
  available direct or relay path. New enrollment, key changes, policy updates,
  and centralized revocation may be unavailable or delayed until coordination
  returns, so a control-plane outage must not be treated as automatically
  terminating all existing private access.

Network membership is not sufficient evidence of application authorization.
Future application authentication may add user, session, and module-level
authorization inside this boundary without replacing it.

## Public Endpoint Strategy

`dev.alemany.me` is reserved for a future explicitly authenticated public
deployment. It must not remain as an unauthenticated pilot path.

The controlled access implementation must:

1. Establish and verify the private path before removing the current public
   development path.
2. Remove the NAM site from the live public Caddy configuration.
3. Remove public DNS reachability for `dev.alemany.me`.
4. Close public TCP `80` and `443` and UDP `443` for IPv4 and IPv6.
5. Verify externally that direct IP, hostname, Caddy, IPv4, and IPv6 requests do
   not provide an alternate public path.

DNS removal alone is not an access control. A public route and a private route
may overlap only during pre-pilot implementation testing while real data remains
prohibited. They must not coexist when the Access Gate is signed off.

## Private HTTPS And Naming

The pilot uses a non-sensitive private overlay hostname and tailnet-only HTTPS
forwarding to `127.0.0.1:3000`.

The selected hostname must not disclose a mine, customer, worker, or other
sensitive operational identity. Public certificate-transparency visibility of
the private HTTPS certificate name must be considered during naming. Direct IP
bookmarks that produce browser certificate warnings are not the normal mobile
workflow.

Host-level Caddy may remain installed for future use, but it must not expose NAM
publicly or provide an alternate path during the pilot. The private overlay
service, not public Caddy, is the pilot ingress boundary.

## Device Enrollment And Revocation

- Enroll only administrator-approved pilot devices.
- Record device owner, platform, approval date, and intended pilot use without
  recording reusable credentials or private keys.
- A corporate Android device is excluded unless company policy permits the
  managed overlay client.
- Require administrator approval for new and returning devices.
- Remove a lost, replaced, or untrusted device immediately.
- Verify that removal terminates access and that re-enrollment cannot occur
  without fresh approval.
- Keep grants narrow enough that compromise of one pilot device does not grant
  SSH, PostgreSQL, unrelated host, or broad tailnet access.

## Administrator Recovery

The independent recovery path is key-only SSH to the VPS public address through
a non-root administrator account.

Before public web access is disabled, implementation must verify:

- The non-root account can connect with the intended recovery key.
- Password authentication is disabled in the effective SSH configuration.
- The recovery key is stored on a separate administrator-controlled device.
- Recovery does not depend on Tailscale, Caddy, DNS, Docker, or the application
  database.
- The administrator can disable private serving or revoke pilot devices without
  exposing private keys or access-policy secrets.

During a coordination-service outage, centralized revocation may be unavailable
or delayed. Emergency shutdown must instead use this independent SSH path to
stop or disable NAM private serving, stop the local Tailscale service when
necessary, or otherwise block NAM access locally. The public Caddy route and
public web ingress remain closed, and disabling access must not modify
application data.

Public SSH remains a break-glass administrative path, not an application access
path and not a substitute for future SSH-hardening work.

## Reboot And Persistence

The overlay daemon and private HTTPS service must recover after a VPS reboot.
Application-only Docker recreation or restart must preserve the private access
path without recreating PostgreSQL or changing its publication boundary.

Verification must prove that reboot and Docker restart restore private access
for approved devices only. A startup or dependency failure must not re-enable
the public Caddy route or public-sharing capability.

## Options Considered

### Loopback Plus SSH Tunnel

This is a strong administrator recovery path but creates repeated tunnel and
reconnect work on mobile devices. It is not the primary pilot boundary.

### Managed Private Overlay Network

This supports approved-device enrollment, roaming mobile networks, NAT
traversal, private naming, revocation, and future multi-device use without
changing the application data model. It is selected.

### Self-Managed WireGuard-Style VPN

This avoids a managed control plane but adds manual key distribution, routing,
DNS, revocation, endpoint, and mobile-roaming operations that are not justified
for the first pilot.

### Authenticated Reverse Proxy

This can provide browser-only access but introduces an identity provider,
session and recovery behavior, and a public ingress whose origin-bypass rules
must be maintained. It is not selected for this pilot.

### Full Application Authentication And Authorization

This is the long-term application identity solution but requires user lifecycle,
session, authorization, recovery, audit, schema, application, and test work that
is disproportionate for the initial single-operator pilot.

## Consequences

- A later infrastructure milestone may install and configure Tailscale, enroll
  approved devices, define grants, establish private HTTPS, remove public Caddy
  routing, update DNS, and close public firewall ingress.
- The implementation introduces a managed control-plane dependency. A
  coordination outage may leave existing approved connections operating from
  cached keys and policy while preventing timely enrollment, policy changes,
  key changes, or centralized revocation. It must never create a public
  fallback; independent SSH provides the local emergency-disable path.
- Approved devices require a Tailscale client and administrator enrollment.
- Corporate devices that cannot run the client are outside pilot scope.
- Overlay configuration, device inventory, policy intent, emergency disablement,
  and recovery procedures must be documented without committing secrets.
- The real-data pilot remains unauthorized until implementation is independently
  verified and every remaining Operational Pilot Runbook gate passes.
- ADR-018's network access prerequisite is architecturally resolved but not
  operationally satisfied until this boundary is implemented and verified.
- Phase 23.5 photo evidence remains blocked by HEIC/HEIF processing, private
  media storage, cleanup, backup, and restore prerequisites in addition to the
  unimplemented access boundary.

## Implementation Verification Requirements

Implementation acceptance must prove:

- Public unauthenticated IPv4 and IPv6 access fails.
- Approved Windows access and at least one approved mobile-device path succeed.
- An unapproved overlay device cannot reach NAM.
- Private HTTPS produces no browser certificate warning.
- Port `3000` remains loopback-only and PostgreSQL remains unpublished.
- No public Caddy, direct IP, DNS, Funnel, or other sharing bypass remains.
- Application health, expected routes, and all ten Day View contributors work
  through the private service.
- Device removal revokes access and re-enrollment requires approval.
- VPS reboot and Docker restart preserve private-only access.
- Key-only SSH recovery succeeds independently.
- Pilot access can be disabled rapidly without changing or deleting application
  data.
- The emergency local-disable procedure is tested or documented and
  independently reviewed for a coordination-outage scenario: independent SSH
  stops private serving, the local Tailscale service when necessary, or access
  locally while public Caddy routing and public ingress remain closed.

The canonical ordered implementation and evidence procedure is the
[Operational Pilot Runbook](../infrastructure/operational-pilot-runbook.md).

## Rollback And Emergency Disablement

If private access fails before public removal, keep the Access Gate failed and
repair the private path while no real data is entered.

After public removal, failure of the private path must leave NAM unavailable to
remote pilot devices. Do not restore unauthenticated Caddy access as an
automatic rollback. Use independent key-only SSH to disable private serving,
revoke devices or grants, inspect service state, and recover the private path.

If the coordination service is unavailable, do not assume centralized device or
grant revocation has taken effect. Use independent key-only SSH to disable the
tailnet-only service, stop the local Tailscale service when necessary, or block
NAM access locally. Emergency pilot shutdown must leave the public Caddy route
and public ingress closed and must not modify PostgreSQL or application data.

## Related Documents

- [Operational Pilot Runbook](../infrastructure/operational-pilot-runbook.md)
- [Infrastructure Operations](../infrastructure.md)
- [Development Guide](../development.md)
- [Server Identity Disaster Recovery](../infrastructure/disaster-recovery.md)
- [Delivery Architecture](../delivery-architecture.md)
- [Dependency Architecture](../dependency-architecture.md)
- [ADR-008: Docker Compose Deployment Baseline](adr-008-docker-compose-deployment-baseline.md)
- [ADR-018: Private Operational Safety Checklist Photo Storage](adr-018-private-operational-safety-checklist-photo-storage.md)
