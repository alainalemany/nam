# Infrastructure Checks

Checks are read-only validation scripts. They report whether a server matches
the repository-defined infrastructure expectations, but they never modify the
system.

## Philosophy

The checks exist because future server recovery should be observable. A future
operator or AI assistant should be able to clone the repository, run one command,
and see whether the host identity, MOTD, Docker baseline, and project root are
consistent.

Checks should:

- read files and command output only
- avoid package installation or service changes
- return non-zero when required infrastructure is missing or inconsistent
- print warnings for future conventions that are not enforceable yet
- remain useful on development, staging, production, testing, and lab hosts

## Scripts

| Script | Purpose |
| --- | --- |
| `verify-environment.sh` | Validate `/etc/nam/environment`, naming, hostname convention, and project root. |
| `verify-motd.sh` | Validate the installed MOTD script and active dynamic MOTD list. |
| `verify-docker.sh` | Validate Docker availability and future label consistency when Docker exists. |
| `verify-server.sh` | Run all checks as a single server verification command. |
