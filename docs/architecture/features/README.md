# Feature Implementation Architecture Documents

This document defines the standard convention for feature-specific
implementation architecture documents in NAM Dashboard.

Feature implementation architecture documents are Level 2 architecture
documents: more specific than repository-wide architecture, but more durable
than transient implementation notes.

They should explain how an approved product feature is expected to be delivered
inside the application without replacing product requirements, module
definitions, database design, delivery architecture, or test policy.

## Purpose

The purpose of feature implementation architecture documents is to give complex
features a stable implementation blueprint before or during delivery.

They should answer:

- What is this feature responsible for?
- What is intentionally outside the feature boundary?
- How does the user workflow move through the feature?
- Which modules, data flows, UI surfaces, and validation boundaries matter?
- What dependencies must be understood before implementation?
- How should this feature evolve without breaking current architecture?

## When A Feature Architecture Document Is Required

A feature implementation architecture document is required when a feature:

- Crosses multiple modules or workflows.
- Introduces meaningful data-flow, validation, or UI complexity.
- Depends on another feature or shared operational concept.
- Needs durable implementation guidance beyond `docs/modules.md`.
- Is likely to be implemented across more than one milestone.
- Has enough risk that future contributors need an explicit architecture record.

A feature implementation architecture document is not required for every small
vertical slice.

Small feature work can rely on:

- `docs/delivery-architecture.md` for delivery lifecycle.
- `docs/dependency-architecture.md` for dependency reasoning.
- `docs/engineering-workflow.md` for the proven feature delivery workflow.
- `docs/feature-architecture.md` for feature module implementation standards.
- `docs/engineering-quality-standards.md` for Definition of Done.

## Standard Location

Feature implementation architecture documents live under:

```text
docs/architecture/features/
```

This README defines the convention. Individual feature documents should be added
only when a feature actually needs durable implementation architecture guidance.

Do not move existing architecture documents into this directory unless a future
documentation architecture milestone explicitly approves that reorganization.

## Current Feature Documents

| Feature | Document | Status |
| --- | --- | --- |
| Daily Work Logs | [Daily Work Logs Architecture](daily-work-logs.md) | Approved; V1 foundation, filtering, date navigation, and Day View participation implemented |
| Day View | [Day View Architecture](day-view.md) | Approved; V1 composition implemented |
| STOP Cards | [STOP Cards Architecture](stop-cards.md) | Approved; V1 foundation, filtering, and Day View participation implemented |
| Daily Inspections | [Daily Inspections Architecture](daily-inspections.md) | Approved; V1 foundation, current-schema filtering, and Day View participation implemented |
| Shift Reports | [Shift Reports Architecture](shift-reports.md) | Approved; V1 foundation, filtering, and Day View participation implemented |
| Work Authorizations | [Work Authorizations Architecture](work-authorizations.md) | Approved; V1 foundation, filtering, and Day View participation implemented |
| Defect Tracking | [Defect Tracking Architecture](defect-tracking.md) | Approved; V1 foundation, filtering, and Day View participation implemented |
| Work Schedule | [Work Schedule Architecture](work-schedule.md) | Approved; V1 foundation and Day View participation implemented |
| Timesheet | [Timesheet Architecture](timesheets.md) | Approved; V1 foundation and Day View participation implemented |

## Standard Metadata Block

Each feature implementation architecture document should begin with a metadata
block after the title.

Use this format:

```markdown
# Feature Name Architecture

Status: Draft | Proposed | Approved | Superseded

Product Phase: Phase number or roadmap phase

Primary Feature: Feature or module name

Depends On:

- Dependency name or document

Related Documents:

- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`

Last Reviewed: YYYY-MM-DD
```

Use `Approved` only after the user has confirmed the feature architecture.

## Required Sections

Each feature implementation architecture document should include these sections.

### 1. Purpose

Define why the feature exists and what implementation question the document
answers.

### 2. Responsibilities

Define what the feature owns.

Examples:

- Routes or screens.
- Server actions or mutation boundaries.
- Feature-specific validation.
- Feature-specific UI composition.
- Data relationships used by the feature.

### 3. Non-Responsibilities

Define what the feature does not own.

This section should prevent accidental scope expansion, shared-abstraction
growth, and cross-module duplication.

### 4. User Workflow

Describe the user-facing workflow at the level needed to guide implementation.

Do not duplicate the full product requirements from `docs/prd.md` or module
definitions from `docs/modules.md`.

### 5. Module Boundaries

Explain how the feature relates to module ownership and neighboring features.

Reference `docs/modules.md`, `docs/feature-architecture.md`, and
`docs/dependency-architecture.md` instead of restating their general rules.

### 6. Data Flow

Describe how data enters, moves through, and leaves the feature.

Reference:

- `docs/database.md` for entities and relationships.
- `docs/application-state-and-data-flow.md` for state ownership, mutation flow,
  validation boundaries, and revalidation.

### 7. UI Composition

Describe the feature's major screens, forms, panels, tables, timelines, or
navigation surfaces.

Reference `docs/ui-architecture.md` for UI standards instead of duplicating
screen composition rules.

### 8. Validation And Error Handling

Describe feature-specific validation and error handling concerns.

Reference:

- `docs/application-state-and-data-flow.md` for validation boundaries.
- `docs/engineering-quality-standards.md` for completion expectations.

### 9. Testing Strategy

Describe what should be tested for this feature and why.

Reference `docs/testing-strategy.md` and `docs/development.md` for test layers
and executable commands.

### 10. Future Evolution

Describe likely future growth points and constraints.

Future evolution should stay grounded in approved product direction or clearly
marked candidate future scope. Do not use this section to promote unapproved
ideas into implementation requirements.

## Non-Responsibilities

Feature implementation architecture documents do not:

- Define product identity or long-term product vision.
- Define product priority or roadmap sequencing.
- Replace module definitions.
- Replace database design.
- Replace feature module implementation standards.
- Replace UI architecture.
- Replace testing strategy.
- Replace Definition of Done.
- Replace ADRs for durable cross-cutting decisions.
- Serve as transient implementation notes or chat summaries.

## Relationship To Other Documentation

| Document | Relationship |
| --- | --- |
| `docs/product-vision.md` | Defines product identity and long-term direction. |
| `docs/product-roadmap.md` | Defines product priority, roadmap phase, and deferred scope. |
| `docs/delivery-architecture.md` | Defines delivery lifecycle and milestone design. |
| `docs/dependency-architecture.md` | Defines dependency types and dependency-management principles. |
| `docs/engineering-workflow.md` | Defines the proven feature delivery workflow and capability assessment process. |
| `docs/prd.md` | Defines confirmed product requirements. |
| `docs/modules.md` | Defines module workflows and boundaries. |
| `docs/database.md` | Defines entities, relationships, enums, and data rules. |
| `docs/feature-architecture.md` | Defines feature module implementation standards. |
| `docs/application-state-and-data-flow.md` | Defines state, mutation, validation, and revalidation rules. |
| `docs/ui-architecture.md` | Defines UI architecture and design-system standards. |
| `docs/testing-strategy.md` | Defines testing policy and quality gates. |
| `docs/engineering-quality-standards.md` | Defines Definition of Done and verification expectations. |
| `docs/decisions/` | Records durable architecture decisions. |

## Review And Approval Workflow

Feature implementation architecture documents should follow this workflow:

1. Confirm the feature belongs to approved or explicitly requested scope.
2. Identify dependencies using `docs/dependency-architecture.md`.
3. Draft the feature architecture document under `docs/architecture/features/`.
4. Link only from the appropriate graph locations when the document is useful.
5. Review against product, module, data, delivery, UI, state, testing, and
   quality standards.
6. Mark the document `Approved` only after user approval.
7. Keep the document aligned as implementation milestones complete.

If the feature architecture introduces a durable cross-cutting decision, create
or update an ADR under `docs/decisions/`.

## Future Feature Document Naming Convention

Use lowercase kebab-case filenames:

```text
docs/architecture/features/<feature-name>.md
```

Examples:

```text
docs/architecture/features/daily-work-log.md
docs/architecture/features/work-authorizations.md
docs/architecture/features/work-schedule.md
```

Do not create example feature documents until the corresponding feature
architecture is actually needed and approved.
