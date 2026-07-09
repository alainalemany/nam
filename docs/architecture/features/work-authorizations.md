# Work Authorizations Architecture

Status: Draft

Product Phase: Product Roadmap Phase 2 Shift And Safety Records planned
expansion

Primary Feature: Work Authorizations

Depends On:

- Shift Reports as the required parent workflow
- Operations reference data where equipment, mine, or location context is used
- Future Day View selected-workday composition
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
- `docs/architecture/features/daily-inspections.md`
- `docs/architecture/features/shift-reports.md`

Last Reviewed: 2026-07-09

## 1. Purpose

Work Authorizations are the safety and maintenance work records for technician
work performed during a shift.

This feature architecture defines how Work Authorizations should be implemented
as an independent feature module while preserving the approved parent
relationship to Shift Reports. Shift Report ownership is defined in
`docs/architecture/features/shift-reports.md`.

Work Authorizations should help the operator answer:

> What work was authorized during the shift, which permits or paperwork were
> required, who was involved, and what completion checks were recorded before
> the work was closed?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data model definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Work Authorizations are responsible for:

- Creating manual Work Authorization records from the correct Shift Report
  context.
- Capturing core work authorization fields for maintenance, electrical,
  mechanical, PM, breakdown, hot work, working at heights, lockout, and related
  technician work.
- Capturing technician or crew context entered by the operator.
- Capturing required and optional permit or paperwork selections.
- Applying the Lockout Permit rule defined in `docs/modules.md`.
- Capturing completion checklist status before a Work Authorization is closed.
- Showing list, create, edit, and detail workflows when the feature is
  implemented.
- Validating persisted Work Authorization input at the server boundary.
- Owning authorization status and lifecycle logic.
- Remaining independent from Daily Work Logs, STOP Cards, and Daily
  Inspections while allowing future related-record links.

Implemented foundation:

- No dedicated Work Authorizations route, form, data model, or persistence
  exists yet.
- Shift Reports are not implemented yet, so the required parent context does
  not currently exist.
- Day View does not yet compose Work Authorization records.

Planned V1 expansion:

- Work Authorization create/edit/list/detail workflow.
- Required relationship to a Shift Report.
- Core work authorization fields grounded in `docs/prd.md` and
  `docs/modules.md`.
- Permit or paperwork selection.
- Lockout Permit default and reason rule.
- Completion checklist before closing.

## 3. Non-Responsibilities

Work Authorizations do not own:

- Shift Report creation, editing, validation, or persistence.
- Day View composition.
- Daily Work Log narrative workflow.
- STOP Card safety observation workflow.
- Daily Inspection forms or condition logic.
- Defect lifecycle.
- Technician-owned paperwork outside NAM Dashboard.
- Paper-style PDF export until export behavior is explicitly approved.
- Attachment storage or photo upload until attachment architecture is approved.
- Authentication, authorization, or multi-user workflow.
- Analytics, compliance dashboards, or reporting beyond record review.
- Global search architecture.

Work Authorizations may link to Daily Logs, STOP Cards, Daily Inspections,
defects, or other records when those modules exist and a real related-record
need is approved, but Work Authorizations should not duplicate those modules'
structured records as authorization-only fields.

## 4. User Workflow

The V1 Work Authorizations workflow should stay focused on manual recordkeeping
inside the shift where the work occurred:

1. The operator opens a Shift Report.
2. The operator creates a Work Authorization from that Shift Report.
3. The operator records the work description, dragline or equipment context,
   location, timing, crew or technician context, and person in charge when
   available.
4. The operator selects required permits or paperwork.
5. Lockout Permit Required defaults to Yes.
6. If Lockout Permit Required is set to No, the operator must provide a reason.
7. The operator saves the Work Authorization.
8. The operator can review or edit the Work Authorization from its owning
   module surface.
9. Before closing the Work Authorization, the operator completes the required
   completion checklist.

Future Day View participation should show Work Authorizations associated with
the selected workday without allowing Day View to create, edit, validate, or
close authorization records.

## 5. Module Boundaries

Work Authorizations should be implemented as a feature-owned vertical slice
under:

```text
src/features/work-authorizations/
```

The App Router should own route composition under:

```text
src/app/work-authorizations/
```

Work Authorizations own their form behavior, validation, server actions,
constants, feature-specific types, data helpers, permit rules, completion
checklist behavior, and status or lifecycle rules.

Shift Reports own the parent shift record and relationship anchor, as defined
in `docs/architecture/features/shift-reports.md`. Work Authorizations depend on
Shift Reports for parent context, but Work Authorizations should own their own
authorization fields, permit selections, technicians, completion checklist, and
status transitions.

Day View will eventually own only the selected-workday composition surface. Day
View may render Work Authorization records returned by the Work Authorizations
feature, but it should not own authorization validation, persistence, permit
rules, completion checklist logic, or lifecycle transitions.

Daily Work Logs, STOP Cards, and Daily Inspections remain independent from Work
Authorizations. These features may appear on the same workday and may
eventually link to related authorization context, but none of these features
own each other.

Shared behavior should move out of `src/features/work-authorizations/` only
when another implemented feature has a real reuse need.

## 6. Data Flow

Work Authorizations should use server-owned persisted state.

Expected V1 data flow:

1. A Shift Report route or Work Authorization route provides the required parent
   Shift Report context.
2. Route-level pages load Work Authorization data and any needed reference
   options.
3. The form submits user input to feature-owned Server Actions.
4. Server Actions parse and validate `FormData` with Zod.
5. Validated data is normalized for optional values and date-only or time
   fields where applicable.
6. Prisma writes the Work Authorization record and related child rows, such as
   permits, technicians, or checklist items, when those relationships are part
   of the approved V1 data model.
7. Mutations revalidate affected Work Authorization and Shift Report routes.
8. Successful writes redirect to the relevant Work Authorization or parent
   Shift Report surface.

Future Day View participation should use a read-only query or feature-owned
helper from the Work Authorizations feature. Day View should not write or
normalize Work Authorization data.

## 7. UI Composition

Work Authorizations UI should stay work-focused and predictable.

Expected V1 UI surfaces:

- Work Authorizations list page or Shift Report-scoped list surface.
- Create page or Shift Report-scoped create surface.
- Detail page.
- Edit workflow through the Work Authorization form.
- Completion checklist section before closure.
- Loading and error route states for the Work Authorizations area.

The Work Authorization detail view should make the authorization record
readable:

- Parent Shift Report context.
- Work description.
- Equipment or dragline context.
- Location.
- Timing context.
- Crew or technician context.
- Required permits or paperwork.
- Lockout Permit status and reason when not required.
- Completion checklist status.
- Current authorization status.

The V1 UI should not include PDF exports, attachment management, approval
workflow, analytics, or a full compliance-reporting system.

## 8. Validation And Error Handling

Work Authorizations should validate persisted user input at the server
boundary.

Expected V1 validation responsibilities:

- Require a parent Shift Report.
- Require core work description or work scope fields defined by the approved V1
  data model.
- Require equipment or dragline context when the approved V1 data model
  includes it.
- Require status values from approved constants or enums.
- Validate permit or paperwork selections against approved values.
- Default Lockout Permit Required to Yes.
- Require a reason when Lockout Permit Required is No.
- Require completion checklist fields before closing a Work Authorization.
- Normalize empty optional text fields.
- Enforce field length limits.

Server Actions should return structured form errors for invalid input and should
redirect only after successful persistence.

Persistence failures should return plain user-facing error states without
exposing internal database details.

Client-side form behavior can improve ergonomics, but server-side validation is
the required boundary for saved Work Authorization records.

## 9. Testing Strategy

Work Authorizations testing should follow `docs/testing-strategy.md` and grow
with the implementation.

Appropriate V1 test targets:

- Zod validation for required fields, status values, permit values, Lockout
  Permit reason rules, and completion checklist closure rules.
- Feature-owned constants and enum option behavior.
- Optional field normalization.
- Server Action behavior for invalid input once actions exist.
- Feature-owned data helpers for list/detail and future Day View participation.
- Route-level rendering for stable empty states when component patterns mature.

Avoid:

- Broad snapshots of authorization forms.
- Playwright coverage before the project introduces E2E infrastructure.
- Mock-heavy tests that hide Prisma relationship behavior.
- Generic permit or checklist frameworks before repeated module need exists.

Manual verification should cover create, edit, detail, validation feedback,
completion checklist behavior, parent Shift Report context, and empty states
until automated coverage matures.

## 10. Future Day View Participation

Work Authorizations should eventually participate in Day View as shift-scoped
work records.

Day View responsibilities:

- Own the selected date.
- Ask the Work Authorizations feature for records that belong to the selected
  workday or parent Shift Report context.
- Render a Work Authorizations section or empty state.
- Link to the owning Work Authorization detail or edit route when available.

Work Authorizations responsibilities:

- Decide which authorization records belong to the selected date.
- Query authorization records through feature-owned data helpers.
- Provide display-ready record summaries or source-record links for Day View.
- Preserve Work Authorization validation, persistence, permit rules, completion
  checklist behavior, and lifecycle logic inside the Work Authorizations
  feature.

Day View should not create, edit, validate, close, approve, export, or otherwise
mutate Work Authorizations.

Because Work Authorizations depend on Shift Reports, Day View participation
should wait until both the parent Shift Report context and Work Authorization
records exist.

## 11. Future Evolution

Future Work Authorizations growth should stay aligned with
`docs/product-roadmap.md` and `docs/roadmap.md`.

Planned evolution:

- Implement Work Authorizations after Shift Reports provide parent context.
- Link Work Authorizations to related Daily Logs when a real related-record need
  exists.
- Link Work Authorizations to STOP Cards, Daily Inspections, or Defects when
  those modules need explicit relationship records.
- Add Day View participation after records exist and date ownership is clear.

Candidate future evolution:

- Paper-style PDF exports matching reviewed source forms.
- Audit history.
- Approval workflow after multi-user behavior is approved.
- Reusable permit templates.
- Automatic permit suggestions based on work type.

Future evolution should not:

- Allow standalone Work Authorizations without a Shift Report unless the product
  requirement is explicitly changed.
- Move Shift Report business rules into Work Authorizations.
- Move Daily Log, STOP Card, or Daily Inspection behavior into Work
  Authorizations.
- Move Work Authorization business rules into Day View.
- Add exports, approvals, attachments, analytics, or global search under the V1
  Work Authorizations milestone.

## 12. Success Criteria

Work Authorizations architecture is successful when:

- Work Authorizations own their own records, validation, persistence, permit
  rules, completion checklist behavior, and status or lifecycle logic.
- Every Work Authorization belongs to a Shift Report.
- Work Authorizations remain independent from Daily Work Logs, STOP Cards, and
  Daily Inspections.
- Users can create, review, edit, and close Work Authorizations without
  crossing feature ownership boundaries.
- Lockout Permit rules and completion checklist expectations are enforced at
  the server boundary.
- Future Day View participation can compose Work Authorization records without
  Day View owning authorization logic.
- Future links to neighboring modules can be added without duplicating their
  structured records.
- The feature remains V1-focused and does not become exports, approvals,
  analytics, attachments, or global search.
- The feature continues to follow repository-wide delivery, dependency,
  feature, state, UI, testing, and quality standards.
