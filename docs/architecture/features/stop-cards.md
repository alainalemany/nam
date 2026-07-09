# STOP Cards Architecture

Status: Draft

Product Phase: Product Roadmap Phase 2 Shift And Safety Records planned
expansion

Primary Feature: STOP Cards

Depends On:

- Day View selected-workday composition for Day View participation
- Operations reference data where equipment, mine, or location context is used
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Related Documents:

- `docs/product-vision.md`
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`
- `docs/engineering-quality-standards.md`
- `docs/architecture/features/day-view.md`
- `docs/architecture/features/daily-work-logs.md`

Last Reviewed: 2026-07-08

## 1. Purpose

STOP Cards are the safety observation and corrective-action records for NAM
Dashboard.

This feature architecture defines how STOP Cards should be implemented as an
independent feature module while participating in Day View as date-aware safety
records.

STOP Cards should help the operator answer:

> What safety observation was recorded, when did it happen, what corrective
> action was noted, and what is its current status?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data model definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

STOP Cards are responsible for:

- Creating manual STOP Card records.
- Capturing the observation date.
- Capturing a category, location, description, corrective action, and status.
- Capturing enough optional context to make the safety observation useful in
  history and Day View.
- Showing list, create, edit, and detail workflows for STOP Cards when the
  feature is implemented.
- Validating persisted STOP Card input at the server boundary.
- Exposing date-aware STOP Card records for Day View composition.
- Remaining independent from Daily Work Logs while allowing future links
  between related records.

Implemented foundation:

- No dedicated STOP Cards route, form, data model, or persistence exists yet.
- Day View currently shows STOP Cards as a "module not implemented"
  placeholder.

Planned V1 expansion:

- STOP Card create/edit/list/detail workflow.
- Manual safety observation and corrective-action fields.
- Date-aware STOP Card participation in Day View.
- Basic status tracking appropriate for personal recordkeeping.

## 3. Non-Responsibilities

STOP Cards do not own:

- Day View composition.
- Daily Work Log narrative workflow.
- Daily Inspection forms.
- Work Authorization workflow or permit completion logic.
- Shift Report structure.
- Defect lifecycle.
- Attachment storage or photo upload until attachment architecture is approved.
- Authentication, authorization, or multi-user workflow.
- Analytics, safety statistics, or reporting beyond record review.
- Global search architecture.

STOP Cards may link to Daily Logs, inspections, defects, or other modules when
those modules exist, but STOP Cards should not duplicate those modules'
structured records as STOP Card-only fields.

## 4. User Workflow

The V1 STOP Cards workflow should stay simple and manual:

1. The operator opens the STOP Cards area.
2. The operator creates a STOP Card for a safety observation.
3. The operator selects or enters the observation date.
4. The operator records category, location, description, corrective action, and
   status.
5. The operator saves the STOP Card.
6. The operator can review the STOP Card later from the STOP Cards area.
7. The operator can see STOP Cards for a selected date in Day View.
8. The operator can edit a STOP Card if the record needs correction.

Future links to Daily Logs should connect related records without requiring a
STOP Card to be created inside a Daily Log.

## 5. Module Boundaries

STOP Cards should be implemented as a feature-owned vertical slice under:

```text
src/features/stop-cards/
```

The App Router should own route composition under:

```text
src/app/stop-cards/
```

STOP Cards own their form behavior, validation, server actions, constants,
feature-specific types, data helpers, and contribution behavior for Day View.

Day View owns only the selected-workday composition surface. Day View may render
STOP Card records returned by the STOP Cards feature, but it should not own STOP
Card validation, persistence, status rules, or corrective-action behavior.

Daily Work Logs remain independent from STOP Cards. A Daily Log may reference a
STOP Card in a future milestone, and a STOP Card may link back to related Daily
Log context, but neither feature owns the other.

Shared behavior should move out of `src/features/stop-cards/` only when another
implemented feature has a real reuse need.

## 6. Data Flow

STOP Cards should use server-owned persisted state.

Expected V1 data flow:

1. Route-level pages load STOP Card data and any needed reference options.
2. The form submits user input to Server Actions.
3. Server Actions parse and validate `FormData` with Zod.
4. Validated data is normalized for optional values and date-only persistence.
5. Prisma writes the STOP Card record.
6. Mutations revalidate affected STOP Card routes and Day View routes when
   needed.
7. Successful writes redirect to the relevant STOP Card list or detail view.

Day View participation should use a read-only query or feature-owned helper from
the STOP Cards feature. Day View should not write or normalize STOP Card data.

## 7. UI Composition

STOP Cards UI should stay work-focused and predictable.

Expected V1 UI surfaces:

- STOP Cards list page.
- Create page.
- Detail page.
- Edit workflow through the STOP Card form.
- Loading and error route states for the STOP Cards area.
- STOP Cards section in Day View when records exist for the selected date.

The STOP Card detail view should make the safety record readable:

- Observation date.
- Category and status.
- Location.
- Description.
- Corrective action.
- Optional context when approved by the data model.

The V1 UI should not include analytics dashboards, photo management, approval
workflow, or a full safety-reporting system.

## 8. Validation And Error Handling

STOP Cards should validate persisted user input at the server boundary.

Expected V1 validation responsibilities:

- Require an observation date.
- Require a category.
- Require a description.
- Require a status.
- Require or clearly handle corrective action based on the approved V1 data
  model.
- Normalize empty optional text fields.
- Enforce field length limits.

Server Actions should return structured form errors for invalid input and should
redirect only after successful persistence.

Persistence failures should return plain user-facing error states without
exposing internal database details.

Client-side form behavior can improve ergonomics, but server-side validation is
the required boundary for saved STOP Card records.

## 9. Testing Strategy

STOP Cards testing should follow `docs/testing-strategy.md` and grow
proportionally with behavior risk.

Appropriate test targets:

- Validation schemas for required fields, enum values, and optional field
  normalization.
- Pure date and formatting helpers.
- Server Action parsing behavior where it can be tested without brittle
  framework coupling.
- Day View contribution behavior once STOP Cards participate in Day View.
- Component behavior for stable form or record summary interactions when the UI
  stabilizes.
- Persistence integration tests when database-backed integration testing is
  expanded.

Avoid:

- Broad snapshots of forms or pages.
- Tests tied to future attachment or analytics behavior.
- End-to-end tests before the project introduces Playwright coverage.
- Heavy mocking abstractions before repeated test needs exist.

Manual verification should cover create, edit, list, detail, validation
feedback, Day View participation, and empty states until automated coverage
matures.

## 10. Day View Participation

STOP Cards should participate in Day View as date-aware safety records.

Day View responsibilities:

- Select the workday date.
- Ask the STOP Cards feature for records that belong to that date.
- Render a STOP Cards section or empty state.
- Link to the owning STOP Card record.

STOP Cards responsibilities:

- Define the STOP Card date field and date semantics.
- Query STOP Card records for a selected date.
- Provide display-ready record summaries or source-record links for Day View.
- Preserve STOP Card validation and persistence inside the STOP Cards feature.

Day View should not create, edit, validate, close, or otherwise mutate STOP
Cards.

## 11. Future Evolution

Future STOP Cards growth should stay aligned with `docs/product-roadmap.md` and
`docs/roadmap.md`.

Planned evolution:

- Link STOP Cards to related Daily Logs when a real related-record need exists.
- Link STOP Cards to inspections, defects, or Shift Reports when those modules
  exist and the relationship is approved.
- Participate in broader historical lookup once global search architecture is
  approved.

Candidate future evolution:

- Photo or attachment support after attachment architecture exists.
- Safety statistics or analytics after enough reliable records exist.
- Approval or review workflow if multi-user behavior is approved.
- Export or report generation after V1 manual records prove useful.

Future evolution should not:

- Move Daily Log narrative behavior into STOP Cards.
- Move STOP Card business rules into Day View.
- Add attachments, analytics, approvals, or multi-user workflow under the V1
  STOP Cards milestone.
- Add shared abstractions before multiple implemented modules need them.

## 12. Success Criteria

STOP Cards architecture is successful when:

- STOP Cards own their own business logic, validation, data flow, and UI.
- Users can create, edit, list, and review manual STOP Card records.
- STOP Cards appear in Day View for the selected date without Day View owning
  STOP Card behavior.
- STOP Cards remain independent from Daily Work Logs.
- Related-record links can be added later without making either feature own the
  other.
- Empty, validation, loading, and persistence error states are understandable.
- Future attachment, analytics, approval, and global search capabilities remain
  deferred until explicitly approved.
- The feature continues to follow repository-wide delivery, dependency,
  feature, state, UI, testing, and quality standards.
