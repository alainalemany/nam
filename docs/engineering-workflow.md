# Engineering Workflow

This document defines the proven engineering workflow for NAM Dashboard feature
delivery.

It explains how a feature moves from roadmap selection to architecture,
implementation, review, verification, capability assessment, and closure.

It does not replace product planning, delivery architecture, feature
architecture, quality standards, testing policy, executable commands, or
feature-specific architecture documents. Those remain the authoritative sources
for their own topics.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | This workflow reflects the delivery process proven by implemented features. |
| Recommended | Suggested workflow improvements that still need approval. |
| Open Question | Workflow details that need future definition. |

## Documentation Graph Fit

Engineering workflow sits in this path:

```text
docs/product-roadmap.md
-> docs/delivery-architecture.md
-> docs/engineering-workflow.md
-> docs/engineering-quality-standards.md
-> docs/development.md
-> implementation files and tests
```

Related authorities:

- Product priority and deferred scope live in `docs/product-roadmap.md`.
- Delivery lifecycle and milestone design live in
  `docs/delivery-architecture.md`.
- Dependency reasoning lives in `docs/dependency-architecture.md`.
- Definition of Done and quality gates live in
  `docs/engineering-quality-standards.md`.
- Feature module standards live in `docs/feature-architecture.md`.
- Feature-specific architecture conventions live in
  `docs/architecture/features/README.md`.
- State and mutation boundaries live in
  `docs/application-state-and-data-flow.md`.
- UI standards live in `docs/ui-architecture.md`.
- Testing policy lives in `docs/testing-strategy.md`.
- Executable commands live in `docs/development.md`.

## 1. Purpose

The purpose of this document is to capture the practical feature delivery
workflow that has already worked for:

- Daily Work Logs.
- STOP Cards.
- Daily Inspections.

The workflow should keep feature delivery:

- Documentation-led.
- Small enough to review.
- Architecture-aligned.
- Verified before closure.
- Free of unrelated scope expansion.

## 2. When This Workflow Applies

Use this workflow for feature or module work that changes product behavior,
data models, routes, validation, persistence, or Day View participation.

This workflow is especially relevant when a feature:

- Is selected from `docs/product-roadmap.md` or `docs/roadmap.md`.
- Needs a feature-specific architecture document.
- Adds Prisma models or migrations.
- Adds create/edit/list/detail workflows.
- Adds Day View participation.
- Introduces meaningful validation, UI, or testing behavior.

Not every tiny change requires the full workflow.

Small fixes can follow the relevant subset:

- Inspect current state.
- Make the smallest scoped change.
- Run appropriate verification.
- Report results.

A small bug fix, wording correction, or local UI adjustment usually does not
need a new feature architecture document.

## 3. Standard Feature Delivery Lifecycle

Feature delivery follows this lifecycle:

```text
Product Roadmap selection
-> feature architecture, when warranted
-> architecture review
-> implementation authorization
-> implementation
-> review-only diff audit
-> commit and push after approval
-> capability assessment
-> closure or next focused slice
```

### Product Roadmap Selection

Start with approved product direction from `docs/product-roadmap.md` and
implementation sequencing from `docs/roadmap.md`.

Before work starts, confirm:

- The feature is in approved or explicitly requested scope.
- The work does not promote deferred capabilities.
- Dependencies are understood.

### Feature Architecture

Create a feature-specific architecture document only when the feature warrants
durable implementation guidance.

Use `docs/architecture/features/README.md` to decide whether a feature
architecture document is required.

Daily Work Logs, STOP Cards, Daily Inspections, and Day View warranted feature
architecture because they define module boundaries, data flow, UI surfaces,
validation rules, future evolution, and Day View participation.

### Architecture Review

Before implementation, review the feature architecture against:

- Product roadmap and implementation roadmap.
- Delivery and dependency architecture.
- Feature architecture standards.
- State, UI, testing, and quality standards.
- Neighboring feature architecture documents.

Implementation should not begin until the architecture is approved or the user
explicitly authorizes implementation from the current architecture.

### Implementation Authorization

Codex should implement production code only after the user explicitly approves
implementation.

The implementation request should identify:

- Primary architecture source.
- Related architecture sources.
- Scope.
- Constraints.
- Required verification.
- Commit expectations.

### Implementation

Implementation should be the smallest coherent vertical slice that satisfies the
approved milestone.

For feature foundations, this usually means:

- Prisma model and migration, when needed.
- Feature-owned constants, validation, types, data helpers, Server Actions, and
  forms.
- App Router list, create, edit, and detail routes.
- Loading and error states where appropriate.
- Operations Reference Data integration when the feature uses mine or equipment
  context.
- Proportional tests.
- Documentation updates only where behavior or data model changes require them.

Implementation should not include deferred capabilities unless the user
explicitly reopens and approves them.

### Review-Only Diff Audit

Before committing, perform a review-only audit when requested.

Review-only means:

- Do not edit files.
- Do not create files.
- Do not delete files.
- Do not stage changes.
- Do not commit.

The audit should inspect the diff, evaluate architecture compliance, run the
requested verification commands, and recommend whether to accept, accept with
minor fixes, defer, or reject.

### Commit And Push

Commit only after the user asks for staging and committing.

Use focused commit messages that describe the milestone, such as:

- `Add stop cards architecture`
- `Add stop cards v1 foundation`
- `Add stop card filters and day view participation`

Push only when the user asks.

### Capability Assessment

After a feature reaches a coherent state, perform a capability assessment before
starting the next major feature.

The assessment should classify each relevant capability as:

- Complete.
- Minor Gap.
- Major Gap.
- Deferred by Design.

If Major Gaps remain, complete those before moving to the next major feature.

If only Minor Gaps remain, decide whether they block the next module or can wait
as follow-up slices.

### Closure Or Next Focused Slice

A feature is ready for closure when:

- V1 workflow is usable.
- Architecture boundaries are respected.
- Verification has passed or failures are plainly explained.
- Major gaps are resolved.
- Deferred capabilities remain deferred.
- The user has accepted the capability assessment.

If a focused follow-up remains, such as search/filtering or Day View
participation, complete that as a separate slice instead of broadening the
foundation milestone.

## 4. Architecture-First Rule

Architecture comes before implementation when a feature affects durable module
boundaries, data flow, validation, Day View participation, or future evolution.

Feature-specific architecture documents should:

- Define responsibilities and non-responsibilities.
- Preserve ownership boundaries.
- Identify Day View participation when relevant.
- Keep V1 focused.
- Defer future capabilities clearly.
- Link only from useful documentation graph locations.

Architecture documents should not become implementation notes or chat summaries.

## 5. Implementation Rules

Implementation should follow existing project patterns unless a documented
reason exists to change them.

Feature implementation defaults:

- Keep feature-specific code under `src/features/<feature-name>/`.
- Keep route composition under `src/app/`.
- Use Server Actions for form-driven create/edit workflows.
- Use Zod for persisted input validation.
- Use Prisma migrations for database changes.
- Keep Day View composition-only.
- Keep neighboring features independent unless a relationship is explicitly
  approved.
- Add tests proportional to behavior risk.

Avoid:

- Repository or service layers before repeated need exists.
- Global search under feature-level search milestones.
- Attachments, analytics, approvals, exports, or integrations unless approved.
- Broad refactors during feature milestones.

## 6. Review-Only Audit Rule

A review-only audit is an inspection, not an implementation pass.

During review-only audits, Codex should:

- Run the requested status, diff, and verification commands.
- Inspect untracked files directly when `git diff` cannot show them.
- Evaluate architecture compliance and testing quality.
- Identify risks and recommended disposition.

During review-only audits, Codex should not:

- Edit files.
- Stage files.
- Commit.
- Install packages.
- Add tests.
- "Fix while reviewing."

This rule protects the project from accidental scope changes after an
implementation milestone is ready for review.

## 7. Verification Requirements

Verification should match the change type.

For documentation-only changes:

```bash
git diff --check
```

For application changes:

```bash
git diff --check
corepack pnpm prisma:generate
corepack pnpm lint
corepack pnpm test:run
corepack pnpm build
git status -sb
```

For database changes, run migration status when PostgreSQL is available:

```bash
corepack pnpm prisma migrate status
```

If a command fails because a dependency is unavailable, such as PostgreSQL not
running, report the command, failure, and likely cause.

Executable command details live in `docs/development.md`. Testing policy lives
in `docs/testing-strategy.md`.

## 8. Capability Assessment

Capability assessment determines whether a feature is complete enough to move
on.

Assessments should inspect:

- Existing capability.
- Architecture compliance.
- Testing maturity.
- Major gaps.
- Minor gaps.
- Deferred-by-design capabilities.
- Final recommendation.

For each capability area, classify the result as:

- Complete.
- Minor Gap.
- Major Gap.
- Deferred by Design.

Major Gaps should block the next major feature.

Minor Gaps can wait when the V1 workflow is usable and architecture boundaries
are intact.

Deferred-by-design items should remain deferred unless the user explicitly
reopens scope.

## 9. Feature Closure

A feature can be considered closed for V1 when:

- The core user workflow is implemented.
- Records persist through approved mutation boundaries.
- List, create, edit, and detail surfaces exist when required.
- Validation and errors are understandable.
- Empty states are useful.
- Tests are proportional to the current testing foundation.
- Verification commands pass or unavailable dependencies are reported.
- The feature remains independent from neighboring modules.
- Day View participation is either complete or explicitly deferred for a future
  focused slice.
- Capability assessment finds no Major Gaps.

Closure does not mean the feature will never change. It means the feature is
stable enough to begin the next module without carrying unresolved V1 risk.

## 10. Relationship To Other Documentation

| Document | Relationship |
| --- | --- |
| `docs/product-roadmap.md` | Selects and prioritizes product capabilities. |
| `docs/roadmap.md` | Sequences module implementation work. |
| `docs/delivery-architecture.md` | Defines delivery lifecycle and milestone design. |
| `docs/dependency-architecture.md` | Defines dependency reasoning. |
| `docs/engineering-quality-standards.md` | Defines Definition of Done, quality gates, and implementation expectations. |
| `docs/feature-architecture.md` | Defines feature module organization and vertical-slice standards. |
| `docs/architecture/features/README.md` | Defines when and how feature-specific architecture documents are created. |
| `docs/application-state-and-data-flow.md` | Defines state ownership, mutation boundaries, validation, and revalidation. |
| `docs/ui-architecture.md` | Defines UI composition and interaction standards. |
| `docs/testing-strategy.md` | Defines testing layers and quality gates. |
| `docs/development.md` | Defines executable commands. |
| `docs/database.md` | Defines data model rules and implemented entities. |

