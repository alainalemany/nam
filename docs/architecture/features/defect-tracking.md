# Defect Tracking Architecture

Status: Approved

Product Phase: Product Roadmap Phase 2 Shift And Safety Records foundation,
feature-owned list filtering, and Day View participation implemented

Primary Feature: Defect Tracking

Depends On:

- Operations reference data for equipment and mine context
- Date-aware Day View composition
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
- `docs/architecture/features/daily-inspections.md`
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/stop-cards.md`
- `docs/architecture/features/shift-reports.md`
- `docs/architecture/features/work-authorizations.md`

Last Reviewed: 2026-07-11

## 1. Purpose

Defect Tracking preserves equipment issues from initial reporting through
resolution and closure.

This feature architecture defines how Defect Tracking should operate as an
independent feature while accepting optional context from inspections, safety
records, shift records, authorized work, and workday narratives.

Defect Tracking should help the operator answer:

> What equipment issue was identified, how serious was it, what corrective work
> occurred, what is its current state, and how was it resolved?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Defect Tracking is responsible for:

- Creating manual defect records for equipment issues.
- Identifying the affected equipment and reported date.
- Capturing a clear defect description and useful operational context.
- Owning defect priority, severity, status, mutable corrective information,
  resolution, and closure.
- Preserving the distinction between an unresolved issue, a resolved issue, and
  a closed historical record.
- Showing list, create, edit, and detail workflows.
- Validating persisted defect input at the server boundary.
- Exposing date-aware defect records for Day View composition.
- Accepting optional links from neighboring modules without transferring defect
  lifecycle ownership to those modules.

Implemented V1 foundation:

- Manual create, edit, list, and detail workflow.
- Required equipment and reported-date context.
- Required priority and severity classifications with distinct meanings.
- Controlled lifecycle transitions and mutable corrective-action and resolution
  context.
- Feature-owned persistence, validation, data helpers, and Server Actions.
- Date-aware Day View participation.
- Clear empty, loading, validation, not-found, and persistence-error states.
- Practical feature-owned list filtering by date range, equipment, status,
  severity, priority, and text.

## 3. Non-Responsibilities

Defect Tracking does not own:

- Daily Inspection observations, condition logic, or inspection completion.
- STOP Card safety-observation or corrective-action workflow.
- Shift Report summaries or coordination records.
- Work Authorization permits, lockout rules, completion checks, or lifecycle.
- Daily Work Log narrative activities.
- Equipment reference-data management.
- Day View composition.
- Maintenance work-order planning or technician dispatch.
- Attachment or photo storage.
- Approval or review workflow.
- Immutable audit history.
- Notifications or background processing.
- Analytics, reporting, exports, or global search.
- Authentication, authorization, or multi-user workflow.

Neighboring modules may reference a defect, but they should not update defect
priority, severity, status, corrective information, resolution, or closure
outside the Defect Tracking mutation boundary.

## 4. User Workflow

The V1 workflow should remain manual and focused:

1. The operator identifies an equipment issue directly or from another module.
2. The operator creates a defect with equipment, reported date, description,
   priority, severity, and optional operational context.
3. Creation establishes the defect record with persisted status `OPEN`.
4. The defect remains Open while newly reported and awaiting corrective work.
5. The operator moves the defect to `IN_PROGRESS` when corrective work begins
   and records useful corrective context.
6. The operator moves the defect to `RESOLVED` when the physical or operational
   issue has been corrected and records a resolution summary.
7. If the fix fails before closure, the operator may return a Resolved defect to
   `IN_PROGRESS`.
8. The operator moves the defect to `CLOSED` when the lifecycle is complete and
   no additional work is expected.
9. The operator can review the defect later from Defect Tracking or Day View.

The V1 lifecycle is intentionally simple:

```text
create -> OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
                                  |
                                  +-> IN_PROGRESS
```

The persisted V1 statuses are `OPEN`, `IN_PROGRESS`, `RESOLVED`, and `CLOSED`.
Creation always establishes `OPEN`. The only allowed transitions are:

- `OPEN` to `IN_PROGRESS`.
- `IN_PROGRESS` to `RESOLVED`.
- `RESOLVED` to `CLOSED`.
- `RESOLVED` to `IN_PROGRESS` when a fix fails before closure.

Status is not freely editable. `CLOSED` is terminal in V1. No approval,
supervisor sign-off, or audit workflow is implied by closure. A later recurrence
is recorded as a new defect.

## 5. Module Boundaries And Ownership

Defect Tracking should be implemented as a feature-owned vertical slice under:

```text
src/features/defect-tracking/
```

The App Router should own route composition under:

```text
src/app/defect-tracking/
```

Defect Tracking owns:

- Defect form behavior.
- Feature-specific constants and option labels.
- Validation and field normalization.
- Server Actions and mutation flow.
- Feature-specific types and data helpers.
- Priority, severity, and lifecycle rules.
- Mutable corrective-action and resolution fields, lifecycle timestamps, and
  closure behavior.
- Selected-date query behavior for Day View.

Neighboring features own only their source records and optional references to a
defect. Shared behavior should move out of the Defect Tracking feature only when
another implemented feature proves a real reusable boundary.

## 6. Relationships

Relationships should preserve feature independence and use explicit record
references. They should not rely on inferred date matches as ownership links.

| Related area | Relationship | Classification | Ownership rule |
| --- | --- | --- | --- |
| Equipment | Every defect identifies the affected Equipment record. | Required | Equipment owns reference data; Defect Tracking owns the issue. |
| Mine | Mine context is derived through the required Equipment relationship; V1 does not persist `mineId` on Defect. | Derived in V1 | Mine and Equipment do not own defect lifecycle. Historical mine-at-reporting-time storage is deferred. |
| Daily Inspection | One Daily Inspection may originate zero or many defects; each defect may reference zero or one source Daily Inspection. Defects may also be created directly. | Optional in V1 | The inspection owns findings and condition; Defect Tracking owns lifecycle, resolution, and closure. |
| Daily Work Log | A defect may later link to a specific Daily Log or Daily Log activity for narrative context. | Future | Use an explicit record reference. Do not assume one Daily Log exists for a date and shift. |
| STOP Card | A safety observation may later reference a related defect. | Future | STOP Cards retain safety-observation ownership. |
| Shift Report | A Shift Report may later reference defects handled during that shift. | Future | Shift Reports retain coordination and summary ownership. |
| Work Authorization | Authorized corrective work may later reference a defect. | Future | Work Authorizations retain permit and authorization ownership. |

V1 should not require neighboring module records in order to create a defect.
Daily Inspection context may improve traceability, but a directly observed issue
must still be recordable without first creating another record.

The unresolved Daily Log identity rule does not block Defect Tracking. Any
future Daily Log relationship must target an explicit Daily Log or activity ID
and must not locate a supposedly unique log by date and shift.

## 7. Data Flow

Defect Tracking should use server-owned persisted state.

### Creation

1. A route loads equipment and any approved optional context.
2. The form submits to a Defect Tracking-owned Server Action.
3. The Server Action validates and normalizes input with Zod.
4. Prisma creates the defect with status `OPEN`.
5. A successful write revalidates affected Defect Tracking and Day View routes
   and redirects to the owning detail view.

### Updates And Corrective Information

- Edits remain inside Defect Tracking.
- Priority, severity, status, corrective action, and resolution summary are
  validated together when cross-field rules apply.
- V1 stores mutable `correctiveAction` and `resolutionSummary` fields directly
  on the Defect record, together with `resolvedAt` and `closedAt` timestamps.
- Corrective-history child records, repair-attempt tables, and immutable audit
  history are not part of V1.
- When a Resolved defect returns to In Progress, prior corrective and resolution
  text may remain visible, but V1 does not promise immutable preservation of
  every repair attempt.

### Resolution And Closure

- Entering `RESOLVED` is allowed only from `IN_PROGRESS`, requires a non-empty
  `resolutionSummary`, and records `resolvedAt`.
- Entering `CLOSED` is allowed only from `RESOLVED` and records `closedAt`.
- `RESOLVED` may return to `IN_PROGRESS`; `CLOSED` is terminal.
- Closure means no additional work is expected. Verification notes, a reviewer,
  approval, and sign-off are not required in V1.

### Retrieval

- Defect Tracking owns list and detail queries.
- V1 retrieval should support practical history by date, equipment, status,
  priority, severity, and text where the approved data model supports it.
- Future global cross-module search must not be introduced through the defect
  list.

### Day View Participation

- Defect Tracking owns the query that determines which defects belong to a
  selected date.
- Day View requests and renders defect summaries without querying defect tables
  directly or owning lifecycle logic.
- The reported date is the initial V1 Day View date anchor. Future display of
  unresolved defects across multiple dates requires a separate approved product
  rule.

## 8. UI Composition

Defect Tracking should provide these V1 surfaces:

- List view for reviewing and filtering defect history.
- Create view for recording an equipment issue.
- Detail view for understanding the issue, current state, corrective context,
  resolution, and related source context.
- Edit view for correcting fields and progressing the lifecycle.
- Defects section in Day View for the selected reported date.

The UI should make status, priority, severity, equipment, reported date, and
issue description easy to scan. Resolved and Closed must remain distinguishable.
Lifecycle controls should expose only transitions valid from the current status
rather than presenting status as a freely editable field.

V1 should not include inline cross-module editing, a maintenance dashboard,
attachment galleries, approval controls, notification controls, or reporting
surfaces.

## 9. Validation And Error Handling

Feature-owned server validation should cover at least:

- Required affected equipment.
- Required reported date.
- Required defect description or title as confirmed by the data model.
- Required severity using `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. Severity means
  potential or actual impact.
- Required priority using `LOW`, `MEDIUM`, `HIGH`, or `URGENT`. Priority means
  urgency of addressing the defect and may differ from severity.
- Persisted status using `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `CLOSED`.
- Valid optional related-record references when provided.
- Field length and optional-value normalization.
- A non-empty resolution summary and `resolvedAt` when entering `RESOLVED`.
- A current status of `RESOLVED` and `closedAt` when entering `CLOSED`.
- Only the approved status transitions; arbitrary status changes and changes
  from `CLOSED` are rejected.

Validation failures should return structured field errors. Persistence and
not-found failures should use plain user-facing states without exposing database
details.

## 10. Testing Strategy

Testing should follow `docs/testing-strategy.md` and remain proportional to
behavior risk.

Initial automated coverage should prioritize:

- Required fields and optional normalization.
- Independent priority and severity enum behavior.
- Allowed and rejected lifecycle transitions.
- Resolution-summary and timestamp requirements for resolution and closure.
- Feature-owned filter parsing and Prisma where-clause construction.
- Pure selected-date helper behavior for Day View participation.

PostgreSQL integration coverage should later verify:

- Required Equipment relationships.
- Optional source relationships when implemented.
- Lifecycle persistence and database constraints.
- Delete behavior for related reference and source records.

Route and E2E coverage should remain separate testing-maturity work. Avoid broad
snapshots and mock-heavy repository abstractions.

Manual verification should cover create, edit, list, detail, lifecycle changes,
filtering, empty states, validation feedback, and Day View participation until
deeper automated coverage exists.

## 11. Future Evolution

Potential future growth must remain separately approved:

- Attachments and photos after attachment/storage architecture exists.
- Approval or review workflow after authentication and actor identity exist.
- Immutable audit history after change-history requirements are confirmed.
- Analytics and defect trend reporting after enough reliable data exists.
- Notifications after event and background-processing architecture exists.
- Global cross-module search after search architecture is approved.
- Automated defect creation, escalation, assignment, or permit suggestions only
  after manual workflows prove reliable.
- Explicit operator-controlled links from implemented Operational Safety
  Checklists only if future traceability is approved. Checklist findings and
  repeated problem text do not automatically create Defects; Defect Tracking
  retains independent lifecycle ownership.
- Deeper links to STOP Cards, Shift Reports, Work Authorizations, Daily Logs,
  work orders, or Knowledge Base records when a concrete workflow requires them.

Future evolution should not:

- Move inspection, safety, shift, authorization, or narrative behavior into
  Defect Tracking.
- Make Defect Tracking a generic maintenance work-order system.
- Introduce a shared event, repository, approval, attachment, or notification
  framework under the V1 milestone.
- Treat optional neighboring records as prerequisites for defect creation.

## 12. Success Criteria

Defect Tracking V1 is complete when:

- The operator can create, list, review, and edit manual defect records.
- Every defect identifies affected equipment and a reported date.
- Priority, severity, status, mutable corrective information, resolution, and
  closure remain owned by Defect Tracking.
- Creation always persists `OPEN`, and the server boundary permits only
  `OPEN -> IN_PROGRESS`, `IN_PROGRESS -> RESOLVED`, `RESOLVED -> CLOSED`, and
  `RESOLVED -> IN_PROGRESS`.
- Resolution requires a non-empty resolution summary and records `resolvedAt`;
  closure is allowed only from Resolved, records `closedAt`, and is terminal.
- Severity and priority are required, independently validated classifications
  using their approved V1 values.
- A defect requires Equipment, derives current Mine context through Equipment,
  and does not persist a V1 `mineId`.
- A defect may reference zero or one source Daily Inspection, and an inspection
  may originate zero or many defects; direct defect creation remains valid.
- Daily Inspections, STOP Cards, Shift Reports, Work Authorizations, and Daily
  Work Logs retain ownership of their own records.
- Defects appear in Day View for the selected reported date through a
  feature-owned read helper.
- Empty, loading, validation, not-found, and persistence-error states are clear.
- Proportional validation, filter, date-helper, and later integration tests
  protect the implemented behavior.
- Attachments, photos, approvals, audit history, analytics, reporting,
  notifications, global search, automation, authentication, authorization, and
  multi-user behavior remain deferred.
