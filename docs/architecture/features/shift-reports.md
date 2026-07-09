# Shift Reports Architecture

Status: Draft

Product Phase: Product Roadmap Phase 2 Shift And Safety Records planned
expansion

Primary Feature: Shift Reports

Depends On:

- Operations reference data where equipment, mine, or location context is used
- Date-aware workday context from Daily Work Logs and Day View
- Future Work Authorizations parent relationship
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
- `docs/architecture/features/work-authorizations.md`

Last Reviewed: 2026-07-09

## 1. Purpose

Shift Reports are the operational coordination and shift-summary records for
NAM Dashboard.

This feature architecture defines how Shift Reports should be implemented as an
independent feature that can connect shift activity, inspections, safety
records, defects, and work authorizations without taking ownership of those
neighboring modules.

Shift Reports should help the operator answer:

> What happened during this shift, which records were associated with it, and
> which module owns each supporting record?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data model definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Shift Reports are responsible for:

- Creating one operational report for a shift or workday context when the
  approved V1 data model defines the exact uniqueness rule.
- Capturing shift-level summary information.
- Capturing date, shift, equipment, mine, and location context when those fields
  are part of the approved V1 data model.
- Providing the parent context required by Work Authorizations.
- Connecting or linking to related module-owned records when those relationships
  are implemented.
- Showing list, create, edit, and detail workflows when the feature is
  implemented.
- Validating persisted Shift Report input at the server boundary.
- Owning Shift Report status or lifecycle logic if status is included in V1.
- Exposing date-aware Shift Report records for future Day View composition.

Implemented foundation:

- No dedicated Shift Reports route, form, data model, or persistence exists yet.
- Work Authorizations are architected to depend on Shift Reports, but neither
  feature is implemented.
- Day View does not yet compose Shift Report records.

Planned V1 expansion:

- Shift Report create/edit/list/detail workflow.
- Shift-level summary and operational context.
- Parent relationship surface for Work Authorizations.
- Date-aware records that can later appear in Day View.
- Links to related records only where those modules already exist or the V1 data
  model explicitly includes the relationship.

## 3. Non-Responsibilities

Shift Reports do not own:

- Daily Work Log narrative workflow, activities, validation, or persistence.
- STOP Card safety observation workflow, status, validation, or persistence.
- Daily Inspection findings, condition logic, validation, or persistence.
- Work Authorization permit rules, completion checklist, validation, or
  lifecycle logic.
- Defect lifecycle.
- Work Schedule, Timesheet, Fuel Log, Work Truck Log, Knowledge Base, or Payslip
  workflows.
- Day View composition.
- Attachment storage or photo upload until attachment architecture is approved.
- Authentication, authorization, or multi-user workflow.
- Analytics, compliance dashboards, reports, or exports beyond record review.
- Global search architecture.

Shift Reports may link to neighboring module records when those modules exist
and a real related-record need is approved, but Shift Reports should not
duplicate their structured records as shift-only fields.

## 4. User Workflow

The V1 Shift Reports workflow should stay focused on manual shift coordination:

1. The operator opens the Shift Reports area.
2. The operator creates a Shift Report for the relevant date and shift context.
3. The operator records shift-level summary information and operational context.
4. The operator associates equipment, mine, or location context when available
   and supported by the data model.
5. The operator saves the Shift Report.
6. The operator can review the Shift Report detail page later.
7. The operator can edit the Shift Report if the shift summary needs
   correction.
8. When Work Authorizations exist, the operator creates Work Authorizations from
   the correct Shift Report context.

Future Day View participation should show Shift Reports associated with the
selected workday without allowing Day View to create, edit, validate, or close
Shift Reports.

## 5. Module Boundaries

Shift Reports should be implemented as a feature-owned vertical slice under:

```text
src/features/shift-reports/
```

The App Router should own route composition under:

```text
src/app/shift-reports/
```

Shift Reports own their form behavior, validation, server actions, constants,
feature-specific types, data helpers, summary behavior, and status or lifecycle
rules when those rules are part of the approved V1 data model.

Work Authorizations depend on Shift Reports for parent context. Shift Reports
may provide route context and relationship anchors, but Work Authorizations own
their own authorization fields, permit selections, technicians, completion
checklist, validation, and lifecycle.

Daily Work Logs, STOP Cards, and Daily Inspections remain independent from
Shift Reports. These features may appear on the same workday and may eventually
link to a Shift Report, but none of these features own each other.

Day View will eventually own only the selected-workday composition surface. Day
View may render Shift Report records returned by the Shift Reports feature, but
it should not own Shift Report validation, persistence, summary rules, or
lifecycle transitions.

Shared behavior should move out of `src/features/shift-reports/` only when
another implemented feature has a real reuse need.

## 6. Data Flow

Shift Reports should use server-owned persisted state.

Expected V1 data flow:

1. Route-level pages load Shift Report data and any needed reference options.
2. The form submits user input to feature-owned Server Actions.
3. Server Actions parse and validate `FormData` with Zod.
4. Validated data is normalized for optional values and date-only or shift
   fields where applicable.
5. Prisma writes the Shift Report record and any approved relationship rows.
6. Mutations revalidate affected Shift Report routes and dependent routes when
   needed.
7. Successful writes redirect to the relevant Shift Report list or detail
   surface.

Future Work Authorization creation should receive parent Shift Report context
from the route or explicit relationship input. Work Authorization writes should
remain inside the Work Authorizations feature.

Future Day View participation should use a read-only query or feature-owned
helper from the Shift Reports feature. Day View should not write or normalize
Shift Report data.

## 7. UI Composition

Shift Reports UI should stay work-focused and predictable.

Expected V1 UI surfaces:

- Shift Reports list page.
- Create page.
- Detail page.
- Edit workflow through the Shift Report form.
- Related-record area for module-owned links when those relationships exist.
- Loading and error route states for the Shift Reports area.

The Shift Report detail view should make the shift record readable:

- Date and shift context.
- Equipment, mine, or location context when recorded.
- Shift-level summary.
- Related Work Authorizations when that module exists.
- Links to related Daily Logs, STOP Cards, Daily Inspections, or defects only
  when relationships are explicitly implemented.

The V1 UI should not include analytics dashboards, exports, approval workflow,
attachment management, or cross-module editing.

## 8. Validation And Error Handling

Shift Reports should validate persisted user input at the server boundary.

Expected V1 validation responsibilities:

- Require the shift date or workday date.
- Require shift context when the approved V1 data model includes it.
- Require the shift-level summary or required operational fields defined by the
  approved V1 data model.
- Validate equipment, mine, or location references when provided.
- Validate status values from approved constants or enums if status is included.
- Normalize empty optional text fields.
- Enforce field length limits.

Server Actions should return structured form errors for invalid input and should
redirect only after successful persistence.

Persistence failures should return plain user-facing error states without
exposing internal database details.

Client-side form behavior can improve ergonomics, but server-side validation is
the required boundary for saved Shift Report records.

## 9. Testing Strategy

Shift Reports testing should follow `docs/testing-strategy.md` and grow with
the implementation.

Appropriate V1 test targets:

- Zod validation for required fields, status values, and reference IDs.
- Optional field normalization.
- Feature-owned constants and enum option behavior.
- Server Action behavior for invalid input once actions exist.
- Feature-owned data helpers for list/detail and future Day View participation.
- Relationship behavior for future Work Authorization parent context once both
  features are implemented.

Avoid:

- Broad snapshots of Shift Report forms.
- Playwright coverage before the project introduces E2E infrastructure.
- Mock-heavy tests that hide Prisma relationship behavior.
- Generic related-record frameworks before repeated module need exists.

Manual verification should cover create, edit, detail, validation feedback,
related-record visibility, Work Authorization parent context when implemented,
and empty states until automated coverage matures.

## 10. Future Day View Participation

Shift Reports should eventually participate in Day View as shift-level
operational records.

Day View responsibilities:

- Own the selected date.
- Ask the Shift Reports feature for records that belong to the selected
  workday.
- Render a Shift Reports section or empty state.
- Link to the owning Shift Report detail or edit route when available.

Shift Reports responsibilities:

- Decide which Shift Reports belong to the selected date.
- Query Shift Report records through feature-owned data helpers.
- Provide display-ready record summaries or source-record links for Day View.
- Preserve Shift Report validation, persistence, summary behavior, and
  lifecycle logic inside the Shift Reports feature.

Day View should not create, edit, validate, close, approve, export, or otherwise
mutate Shift Reports.

Day View participation should wait until Shift Reports have a stable date model
and basic read surfaces.

## 11. Future Evolution

Future Shift Reports growth should stay aligned with `docs/product-roadmap.md`
and `docs/roadmap.md`.

Planned evolution:

- Provide parent context for Work Authorizations.
- Link Shift Reports to related Daily Logs when a real related-record need
  exists.
- Link Shift Reports to STOP Cards, Daily Inspections, defects, Work Schedule,
  Timesheets, or other modules when those modules need explicit relationship
  records.
- Add Day View participation after records exist and date ownership is clear.

Candidate future evolution:

- Shift-level exports or reports.
- Audit history.
- Approval workflow after multi-user behavior is approved.
- Deeper cross-module summaries after several related modules exist.

Future evolution should not:

- Move Daily Work Log narrative behavior into Shift Reports.
- Move STOP Card safety observation workflow into Shift Reports.
- Move Daily Inspection condition logic into Shift Reports.
- Move Work Authorization permit rules or completion checklist behavior into
  Shift Reports.
- Move Shift Report business rules into Day View.
- Add exports, approvals, attachments, analytics, or global search under the V1
  Shift Reports milestone.

## 12. Success Criteria

Shift Reports architecture is successful when:

- Shift Reports own their own records, validation, persistence, summary
  behavior, and status or lifecycle logic.
- Shift Reports provide operational coordination without owning neighboring
  module business logic.
- Work Authorizations can use Shift Reports as parent context without moving
  authorization logic into Shift Reports.
- Daily Work Logs, STOP Cards, Daily Inspections, and Work Authorizations remain
  independent feature modules.
- Users can create, review, and edit Shift Reports without crossing feature
  ownership boundaries.
- Future Day View participation can compose Shift Report records without Day
  View owning Shift Report logic.
- Future links to neighboring modules can be added without duplicating their
  structured records.
- The feature remains V1-focused and does not become exports, approvals,
  analytics, attachments, global search, or a cross-module edit form.
- The feature continues to follow repository-wide delivery, dependency,
  feature, state, UI, testing, and quality standards.
