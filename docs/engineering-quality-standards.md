# Engineering Quality Standards

This document defines the engineering process standards for NAM Dashboard.

It explains what "done" means, which verification steps are expected, when
documentation must change, and how AI assistants should participate in
implementation work. It does not replace product requirements, architecture
documents, testing policy, development commands, or ADRs.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | These engineering quality standards are approved project direction. |
| Recommended | Suggested quality improvements that still need approval. |
| Open Question | Quality standards that need future definition. |

## Documentation Graph Fit

Engineering quality standards sit in this path:

```text
docs/philosophy.md
-> docs/engineering-principles.md
-> docs/engineering-quality-standards.md
-> docs/development.md
-> implementation files and tests
```

Related authorities:

- Stable project principles live in `docs/philosophy.md`.
- Enduring engineering defaults live in `docs/engineering-principles.md`.
- Feature implementation standards live in `docs/feature-architecture.md`.
- Application state and mutation flow live in
  `docs/application-state-and-data-flow.md`.
- UI standards live in `docs/ui-architecture.md`.
- Testing policy lives in `docs/testing-strategy.md`.
- Executable commands live in `docs/development.md`.
- Durable decisions live in `docs/decisions/`.
- Product scope lives in `docs/prd.md`.
- Module behavior lives in `docs/modules.md`.
- Data model rules live in `docs/database.md`.

## Purpose

The purpose of engineering quality standards is to keep implementation work
small, reviewable, verified, and aligned with the documented architecture.

This document defines process. It should answer:

- What must be true before work is considered complete?
- Which checks should be run?
- When must documentation be updated?
- When does a decision need an ADR?
- How should future humans and AI assistants move from documentation to code?

It should not duplicate command details from `docs/development.md`, test layer
policy from `docs/testing-strategy.md`, or feature structure from
`docs/feature-architecture.md`.

## Engineering Principles

Engineering quality follows the existing project principles:

- Documentation-first work and canonical documentation homes are defined in
  `docs/engineering-principles.md`.
- Vertical-slice implementation and feature ownership are defined in
  `docs/feature-architecture.md`.
- Server-owned persisted state, mutation flow, validation boundaries, and
  revalidation are defined in `docs/application-state-and-data-flow.md`.
- Testing layers and quality gates are defined in `docs/testing-strategy.md`.
- Local commands and runtime verification steps are defined in
  `docs/development.md`.

When these documents disagree, identify the conflict and resolve the
non-authoritative copy before building on the assumption.

## Definition Of Done

A change is done only when it satisfies the approved scope and has been verified
at the level appropriate to its risk.

For documentation-only changes:

- The new or changed documentation has a clear canonical home.
- The documentation graph remains connected.
- No orphan Markdown files are introduced.
- Related index or reading-path documents are updated when needed.
- `git diff --check` passes.

For application changes:

- Product or module behavior is approved or intentionally limited.
- Feature ownership follows `docs/feature-architecture.md`.
- State and mutation flow follows `docs/application-state-and-data-flow.md`.
- UI behavior follows `docs/ui-architecture.md`.
- Validation exists at the server boundary for persisted data.
- Database changes use Prisma schema and committed migrations.
- Tests are added or updated when the change affects validation, helpers, API
  route behavior, stable UI behavior, or persistence.
- Required verification commands pass, or failures are reported plainly.
- Documentation is updated only in the relevant canonical homes.

For infrastructure changes:

- Current server or Docker state is inspected first.
- The user explicitly approves system-level changes before they are made.
- Repository-owned examples, runbooks, or recovery notes are updated when the
  infrastructure behavior changes.
- Public traffic continues to flow through Caddy unless a future ADR changes
  that boundary.

## Required Verification Commands

Current local quality gates are documented in `docs/development.md`.

For most application or testing changes, run:

```bash
pnpm lint
pnpm test:run
pnpm build
git diff --check
```

For documentation-only changes, run:

```bash
git diff --check
```

For database changes, also verify Prisma generation and migration state using
the commands and Docker constraints documented in `docs/development.md`.

For infrastructure changes, run the relevant Docker, Caddy, health, and network
checks documented in `docs/development.md` and `docs/infrastructure.md`.

If a command cannot be run, or if it fails, report the exact command, result,
and likely cause. Do not hide failed verification.

## Documentation Update Rules

Documentation updates should preserve the "one concept, one canonical home"
rule.

Use these destinations:

| Information type | Destination |
| --- | --- |
| Product requirement | `docs/prd.md` |
| Module workflow or boundary | `docs/modules.md` |
| Entity, field, relationship, enum, or data rule | `docs/database.md` |
| Feature implementation standard | `docs/feature-architecture.md` |
| State or mutation-flow standard | `docs/application-state-and-data-flow.md` |
| UI standard | `docs/ui-architecture.md` |
| Testing policy or quality gate | `docs/testing-strategy.md` |
| Executable command or local workflow | `docs/development.md` |
| Infrastructure runbook | `docs/infrastructure.md` or `docs/infrastructure/` |
| Durable decision | `docs/decisions/` |
| Future idea | `docs/ideas.md` |

Do not create a new documentation file unless its graph location and discovery
path are clear. If a new file is justified, link it from the appropriate index
or reading-path documents.

## ADR Decision Criteria

Create an ADR when a decision is durable, cross-cutting, or likely to affect
future implementation choices.

Good ADR candidates:

- Database technology or persistence strategy.
- Deployment, ingress, or infrastructure boundary.
- Application state or mutation boundary.
- Testing foundation or CI policy.
- Vendor framework integration strategy.
- Security, authentication, authorization, or financial data boundary.
- A decision that intentionally changes a previously documented standard.

An ADR is usually not needed for:

- A small feature implementation that follows existing standards.
- A documentation wording clarification.
- A local command update that belongs in `docs/development.md`.
- A bug fix that does not change architecture or process.

When an ADR is needed, use `docs/decisions/template.md`, add the next sequential
ADR number, and update `docs/decisions/README.md`.

## Feature Implementation Workflow

Feature work should proceed through a narrow vertical slice.

Before implementation:

- Confirm the user-approved scope.
- Read the required documentation path in `AGENTS.md`.
- Identify canonical homes for any documentation changes.
- Confirm whether database, UI, state-flow, testing, or ADR updates are needed.

During implementation:

- Keep feature-specific code under `src/features/<feature-name>/` when the code
  belongs to one feature.
- Keep route composition under `src/app/`.
- Use Server Actions for form-driven create/edit workflows unless another
  boundary is approved.
- Use Zod validation for persisted user input.
- Use Prisma for database-backed state.
- Add tests proportional to risk and existing test conventions.

Before handoff:

- Run the required verification commands.
- Summarize files changed, verification results, and any unresolved risk.
- Do not mix unrelated refactors, infrastructure changes, documentation graph
  changes, and feature work unless they are required for the approved objective.

## AI Collaboration Workflow

AI assistants should follow the repository reading path before implementation:

1. `AGENTS.md`
2. `README.md`
3. `docs/README.md`
4. `docs/ai-context.md`
5. Relevant architecture, feature, testing, data, and development documents

AI assistants should:

- Classify conclusions as Confirmed, Recommended, Idea, or Open Question when
  discussing project direction.
- Inspect existing code before proposing implementation changes.
- Prefer existing project patterns over new abstractions.
- Keep edits scoped to the approved objective.
- Preserve the documentation graph.
- Ask for approval before system-level changes.
- Report verification commands and results.

AI assistants should not:

- Promote unapproved ideas into requirements.
- Create orphan documentation.
- Add broad abstractions before repeated need exists.
- Hide failed checks.
- Modify runtime behavior during documentation-only milestones.

## Quality Gates

Implemented quality gates:

- TypeScript no-emit check through `pnpm lint`.
- Vitest one-shot tests through `pnpm test:run`.
- Production build through `pnpm build`.
- Markdown and whitespace check through `git diff --check`.
- Prisma generation and migration verification when database changes occur.
- Docker, health, Caddy, and persistence smoke checks when runtime or
  infrastructure behavior changes.

Planned future maturity:

- Dedicated ESLint configuration.
- Prisma/PostgreSQL integration test database setup.
- Server Action tests for mutation workflows.
- Playwright E2E tests for critical browser flows.
- CI workflow and branch protection.
- Migration drift checks in CI.
- Accessibility checks when UI surface area grows.

Future maturity work should be added in small milestones rather than bundled
into unrelated feature work.

## Future Engineering Maturity

The project should grow quality controls in response to actual risk.

Near-term maturity should focus on:

- Server Action tests for create/edit workflows.
- PostgreSQL-backed integration tests for persistence behavior.
- Small shared test fixtures only when repeated setup appears.
- CI for `pnpm lint`, `pnpm test:run`, and `pnpm build`.

Later maturity may include:

- Playwright E2E tests after test database seeding and reset rules are
  documented.
- Accessibility automation after UI patterns stabilize.
- Coverage thresholds after the suite is broad enough to make thresholds
  meaningful.
- Security verification after authentication, authorization, and sensitive data
  workflows are approved.

Avoid introducing mature-process ceremony before it protects real project risk.
