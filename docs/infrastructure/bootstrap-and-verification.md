# Bootstrap And Verification

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | Bootstrap scripts are repository-owned entry points for rebuilding NAM servers. |
| Confirmed | Verification scripts are read-only checks and must not modify the system. |
| Recommended | Keep bootstrap scripts small instead of introducing a full configuration-management framework before it is needed. |
| Recommended | Use verification scripts after rebuilds, migrations, and infrastructure changes. |
| Open Question | Production bootstrap remains disabled until production environment requirements are approved. |

## Why Bootstrap Exists

Server rebuilds should not depend on memory, chat history, or provider-specific
manual steps. After a fresh VPS is created and the repository is cloned, the
operator should have obvious commands that establish the NAM baseline.

Bootstrap scripts are not meant to hide complexity. They are meant to make the
first steps repeatable:

- install base packages
- install Docker when appropriate
- install the NAM MOTD
- install the correct `/etc/nam/environment` file
- leave the server ready for verification

The scripts live in:

```text
infrastructure/bootstrap/
```

## Why Not Full Configuration Management Yet

Tools such as Ansible, Terraform, Pulumi, or cloud-init may become useful later.
They are not required for the current development VPS foundation.

The current project benefits more from transparent shell scripts because:

- the infrastructure surface is still small
- the current host is development, not production
- every command remains easy for a future AI assistant to inspect
- the repository can evolve toward stronger tooling later without a premature
  abstraction layer

## Bootstrap Boundaries

Bootstrap scripts may modify a server. They must therefore stay conservative:

- no destructive data operations
- no secret creation inside Git-tracked files
- no production enablement without explicit requirements
- no hidden provider-specific assumptions
- no public exposure unless the target environment requires and documents it

Production bootstrap is intentionally disabled until production has approved
requirements for hostname, domain, reverse proxy, TLS, secrets, backups,
restore testing, deployment workflow, and rollback.

## Why Verification Exists

Rebuild confidence comes from observable checks, not just installation commands.
Verification scripts answer:

```text
Does this server actually match the repository-defined NAM infrastructure?
```

The scripts live in:

```text
infrastructure/checks/
```

They are read-only by design. They may inspect files, command output, Docker
metadata, and service state, but they must not install packages, edit files,
start services, or change permissions.

## Verification Scope

Current checks cover:

- `/etc/nam/environment`
- canonical environment names
- project root existence
- hostname convention
- installed MOTD script
- active dynamic MOTD list
- `figlet`
- Docker CLI
- Docker Compose plugin
- Docker daemon access
- future Docker environment-label consistency

Docker verification may require root or docker-group access because reading the
Docker daemon uses `/var/run/docker.sock`.

## Operating Pattern

Fresh development server:

```bash
sudo infrastructure/bootstrap/development.sh
infrastructure/checks/verify-server.sh
```

Development bootstrap includes the base Ubuntu package set, Docker, and the NAM
MOTD/environment identity.

If Docker access is expected but fails, rerun the Docker check with appropriate
host permissions:

```bash
sudo infrastructure/checks/verify-docker.sh
```

Failures should be treated as either real drift or a documented exception. Do
not make checks pass by weakening the convention unless the convention itself is
wrong.
