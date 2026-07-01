# Project Philosophy

This document is the canonical home for stable NAM Dashboard principles.

These principles should change slowly. Detailed requirements, implementation
commands, and module-specific rules belong in their own canonical documents.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | These principles are approved project direction. |
| Recommended | Suggested principles that still need approval before becoming policy. |
| Open Question | Philosophy areas that need future definition. |

## Confirmed Principles

### Documentation First

Documentation is the source of truth while the project is in requirements,
architecture, and platform-foundation work. Code should not outrun confirmed
requirements.

### Git Is The Durable Source Of Truth

Important project knowledge should live in the repository, not in chat history,
local memory, or unmanaged server state.

### Every Concept Has One Canonical Home

Each important topic should have one authoritative location. Other documents
should reference that location instead of duplicating the same content.

### Explain Why, Not Only How

Runbooks can explain commands. Architecture and decision documents must explain
the reasoning, tradeoffs, and consequences behind the chosen direction.

### Prefer Simple, Reproducible Systems

Use the simplest architecture that satisfies current requirements while keeping
future growth possible. Avoid adding automation, services, or frameworks before
they solve a real problem.

### Infrastructure Is Project Knowledge

Server identity, bootstrap scripts, verification checks, and recovery procedures
are part of the project when they are safe to store. Secrets, private keys,
certificates, database dumps, and generated runtime state do not belong in Git.

### AI Assistants Are First-Class Collaborators

The repository should be readable by AI assistants as well as humans. Context
should be deterministic, indexed, and explicit so future assistants can quickly
identify authoritative information.

### Manual Reliability Comes Before Automation

Version 1 should favor manual entry, clear workflows, and reliable historical
records over brittle integrations, scraping, parsing, or premature automation.

### Preserve Operational History

Date, date range, equipment, mine, module, shift, attachments, and related
records are first-class concepts because the core product value is historical
lookup.

### Separate Sensitive Financial Context

Payslip and compensation data has different privacy, retention, extraction, and
visibility requirements than operational mining records.

## Recommended Future Principles

Recommended:

- Define a testing philosophy before broad feature implementation.
- Define a security philosophy before authentication, authorization, payslip
  storage, or public deployment.
- Define a UI philosophy document once Metronic integration begins.

## Open Questions

- What level of encryption, redaction, and export control is required for
  financial records?
- What testing baseline is required before V1 module implementation?
- What documentation review process should be used as the repository grows?
