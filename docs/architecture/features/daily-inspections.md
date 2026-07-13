# Daily Inspections Architecture

Status: Approved

Product Phase: Product Roadmap Phase 2 Shift And Safety Records foundation,
current-schema feature-owned list filtering, and Day View participation
implemented; future expansion planned

Primary Feature: Daily Inspections

Depends On:

- Operations reference data where equipment, mine, or location context is used
- Day View selected-workday composition for Day View participation
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
- `docs/architecture/features/stop-cards.md`

Last Reviewed: 2026-07-10

## 1. Purpose

Daily Inspections are the equipment and work-area inspection records for NAM
Dashboard.

This feature architecture defines how Daily Inspections should be implemented
as an independent feature module while participating in Day View as date-aware
inspection records.

Daily Inspections should help the operator answer:

> What was inspected on this workday, what condition was found, were defects or
> findings identified, and what follow-up context should be preserved?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data model definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Daily Inspections are responsible for:

- Creating manual Daily Inspection records.
- Capturing the inspection date.
- Capturing shift context when useful for the inspection record.
- Capturing inspected equipment and optional mine or location context.
- Capturing equipment hours when they are part of the inspection record.
- Capturing inspection findings, condition, notes, and whether defects were
  identified.
- Showing list, create, edit, and detail workflows for Daily Inspections when
  the feature is implemented.
- Validating persisted Daily Inspection input at the server boundary.
- Exposing date-aware Daily Inspection records for Day View composition.
- Remaining independent from Daily Work Logs and STOP Cards while allowing
  future links between related records.

Implemented foundation:

- Daily Inspection create/edit/list/detail workflow.
- Manual inspection fields grounded in `docs/prd.md`.
- Equipment and date context.
- Basic condition or status tracking appropriate for personal recordkeeping.
- Prisma persistence with feature-owned Server Actions and Zod validation.
- Operations reference data links for mine and equipment context.
- Date-aware Daily Inspection participation in Day View.
- Feature-owned Daily Inspection list filtering by date range, equipment,
  status, and text.
- Future global cross-module search remains a separate deferred capability.

Remaining filtering dependency:

- Inspector-specific filtering requires an approved inspector field or
  relationship. The V1 Daily Inspection record currently has no inspector
  field, and the feature should not invent one inside list filtering.

## 3. Non-Responsibilities

Daily Inspections do not own:

- Day View composition.
- Daily Work Log narrative workflow.
- STOP Card safety observation workflow.
- Defect lifecycle beyond noting that a defect was identified.
- Work Authorization workflow or permit completion logic.
- Shift Report structure.
- Attachment storage or photo upload until attachment architecture is approved.
- Authentication, authorization, or multi-user workflow.
- Analytics, inspection statistics, or reporting beyond record review.
- Global search architecture.

Daily Inspections may link to Daily Logs, STOP Cards, defects, Shift Reports, or
other modules when those modules exist and a real related-record need is
approved, but Daily Inspections should not duplicate those modules' structured
records as inspection-only fields.

## 4. User Workflow

The V1 Daily Inspections workflow should stay simple and manual:

1. The operator opens the Daily Inspections area.
2. The operator creates an inspection for a selected date.
3. The operator selects the inspected equipment and optional mine or location
   context.
4. The operator records shift, equipment hours, findings, condition, notes, and
   whether defects were identified when those fields are part of the approved V1
   data model.
5. The operator saves the Daily Inspection.
6. The operator can review the inspection later from the Daily Inspections area.
7. The operator can see Daily Inspections for a selected date in Day View.
8. The operator can edit a Daily Inspection if the record needs correction.

Future links to Daily Logs or STOP Cards should connect related records without
requiring a Daily Inspection to be created inside either feature.

## 5. Module Boundaries

Daily Inspections should be implemented as a feature-owned vertical slice under:

```text
src/features/daily-inspections/
```

The App Router should own route composition under:

```text
src/app/daily-inspections/
```

Daily Inspections own their form behavior, validation, server actions,
constants, feature-specific types, data helpers, inspection condition logic, and
contribution behavior for Day View.

Day View owns only the selected-workday composition surface. Day View may render
Daily Inspection records returned by the Daily Inspections feature, but it
should not own inspection validation, persistence, condition rules, defect
indicators, or follow-up behavior.

Daily Work Logs and STOP Cards remain independent from Daily Inspections. These
features may appear on the same workday and may eventually link to related
inspection context, but none of these features own each other.

Shared behavior should move out of `src/features/daily-inspections/` only when
another implemented feature has a real reuse need.

## 6. Data Flow

Daily Inspections should use server-owned persisted state.

Expected V1 data flow:

1. Route-level pages load Daily Inspection data and any needed reference
   options.
2. The form submits user input to Server Actions.
3. Server Actions parse and validate `FormData` with Zod.
4. Validated data is normalized for optional values and date-only persistence.
5. Prisma writes the Daily Inspection record.
6. Mutations revalidate affected Daily Inspection routes and Day View routes
   when needed.
7. Successful writes redirect to the relevant Daily Inspection list or detail
   view.

Day View participation should use a read-only query or feature-owned helper from
the Daily Inspections feature. Day View should not write or normalize Daily
Inspection data.

## 7. UI Composition

Daily Inspections UI should stay work-focused and predictable.

Expected V1 UI surfaces:

- Daily Inspections list page.
- Create page.
- Detail page.
- Edit workflow through the Daily Inspection form.
- Loading and error route states for the Daily Inspections area.
- Daily Inspections section in Day View when records exist for the selected
  date.

The Daily Inspection detail view should make the inspection record readable:

- Inspection date.
- Shift context when recorded.
- Equipment and mine or location context.
- Equipment hours when recorded.
- Condition or status.
- Findings.
- Defect indicator.
- Notes.

The V1 UI should not include photo management, inspection analytics, approval
workflow, or a full compliance-reporting system.

## 8. Validation And Error Handling

Daily Inspections should validate persisted user input at the server boundary.

Expected V1 validation responsibilities:

- Require an inspection date.
- Require inspected equipment when the approved V1 data model includes
  equipment context.
- Require enough findings or condition detail for the record to be useful.
- Validate shift, condition, status, or defect indicator values against
  feature-owned constants.
- Normalize empty optional text fields.
- Enforce field length limits.
- Validate equipment hours as a numeric or text field according to the approved
  V1 data model.

Server Actions should return structured form errors for invalid input and should
redirect only after successful persistence.

Persistence failures should return plain user-facing error states without
exposing internal database details.

Client-side form behavior can improve ergonomics, but server-side validation is
the required boundary for saved Daily Inspection records.

## 9. Testing Strategy

Daily Inspections testing should follow `docs/testing-strategy.md` and grow
proportionally with behavior risk.

Appropriate test targets:

- Validation schemas for required fields, enum values, numeric fields, and
  optional field normalization.
- Pure date and formatting helpers.
- Feature-owned filter helpers.
- Server Action parsing behavior where it can be tested without brittle
  framework coupling.
- Day View contribution behavior for the implemented selected-date integration.
- Component behavior for stable form or record summary interactions when the UI
  stabilizes.
- Persistence integration tests when database-backed integration testing is
  expanded.

Avoid:

- Broad snapshots of forms or pages.
- Tests tied to future attachment, analytics, approval, or reporting behavior.
- End-to-end tests before the project introduces Playwright coverage.
- Heavy mocking abstractions before repeated test needs exist.

Manual verification should cover create, edit, list, detail, validation
feedback, Day View participation, and empty states until automated coverage
matures.

## 10. Day View Participation

Daily Inspections participate in Day View as date-aware inspection
records.

Day View responsibilities:

- Select the workday date.
- Ask the Daily Inspections feature for records that belong to that date.
- Render a Daily Inspections section or empty state.
- Link to the owning Daily Inspection record.

Daily Inspections responsibilities:

- Define the Daily Inspection date field and date semantics.
- Query Daily Inspection records for a selected date.
- Provide display-ready record summaries or source-record links for Day View.
- Preserve Daily Inspection validation and persistence inside the Daily
  Inspections feature.

Day View should not create, edit, validate, close, approve, or otherwise mutate
Daily Inspections.

## 11. Future Evolution

Future Daily Inspections growth should stay aligned with
`docs/product-roadmap.md` and `docs/roadmap.md`.

Planned evolution:

- Link Daily Inspections to related Daily Logs when a real related-record need
  exists.
- Allow a Defect record to identify a Daily Inspection as its optional source
  while Daily Inspections retain ownership of findings and condition.
- Link Daily Inspections to STOP Cards or Shift Reports when those modules need
  explicit related-record context.
- Participate in broader historical lookup once global search architecture is
  approved.

Candidate future evolution:

- Photo or attachment support after attachment architecture exists.
- Inspection templates or checklists after source forms are reviewed and V1
  manual records prove the workflow.
- Inspection statistics or analytics after enough reliable records exist.
- Approval or review workflow if multi-user behavior is approved.
- Export or report generation after V1 manual records prove useful.

Future evolution should not:

- Move Daily Log narrative behavior into Daily Inspections.
- Move STOP Card safety observation workflow into Daily Inspections.
- Move Daily Inspection business rules into Day View.
- Add attachments, analytics, approvals, reporting, or multi-user workflow
  under the V1 Daily Inspections milestone.
- Add shared abstractions before multiple implemented modules need them.

## 12. Success Criteria

Daily Inspections architecture is successful when:

- Daily Inspections own their own inspection records, observations, validation,
  persistence, data flow, condition logic, and UI.
- Users can create, edit, list, and review manual Daily Inspection records.
- Daily Inspections appear in Day View for the selected date without Day View
  owning Daily Inspection behavior.
- Daily Inspections remain independent from Daily Work Logs and STOP Cards.
- Related-record links can be added later without making any neighboring
  feature own another feature's records.
- Empty, validation, loading, and persistence error states are understandable.
- Future attachment, analytics, approval, reporting, and global search
  capabilities remain deferred until explicitly approved.
- The feature continues to follow repository-wide delivery, dependency,
  feature, state, UI, testing, and quality standards.
