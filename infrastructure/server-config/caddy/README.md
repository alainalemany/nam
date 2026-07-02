# Caddy Configuration

This directory stores repository-owned Caddy configuration examples for NAM
Dashboard host-level reverse proxying.

## Development Access

The development hostname is:

```text
dev.alemany.me
```

The live host Caddyfile should be installed at:

```text
/etc/caddy/Caddyfile
```

Use:

```text
Caddyfile.dev.example
```

Approved route:

```caddyfile
dev.alemany.me {
  reverse_proxy 127.0.0.1:3000
}
```

The Docker application service must stay bound to `127.0.0.1:3000`. Do not
publish port `3000` publicly.

## Production Reservation

`nam.alemany.me` is reserved for a future production deployment. Do not add it
to the development Caddyfile.

## Verification

After installing or changing the live Caddyfile:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl is-active caddy
curl -I https://dev.alemany.me
```
