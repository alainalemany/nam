# Day View Architecture

Status: Draft

Product Phase: Product Roadmap Phase 1 MVP Workday History planned expansion

Primary Feature: Day View

Depends On:

- Date-aware records from participating modules
- Daily Work Logs foundation
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
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/stop-cards.md`
- `docs/architecture/features/daily-inspections.md`
- `docs/architecture/features/work-authorizations.md`

Last Reviewed: 2026-07-08

## 1. Purpose

Day View is the shared date-centered workday composition surface for NAM
Dashboard.

This feature architecture defines how Day View should organize records for a
selected workday without taking ownership of the business logic, validation, or
persistence rules of participating modules.

Day View should help the operator answer:

> What records exist for this workday, which module owns them, and where should
> I go to inspect or edit the source record?

This document does not replace product requirements in `docs/prd.md`, module
behavior in `docs/modules.md`, data model definitions in `docs/database.md`, or
repository-wide implementation standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Day View is responsible for:

- Providing a selected-workday route or screen.
- Rendering a date-centered summary of records contributed by participating
  modules.
- Organizing module contributions into predictable sections.
- Linking users to the owning module's detail, create, edit, or list surfaces
  when those routes exist.
- Showing empty, loading, and error states for the workday composition surface.
- Preserving the distinction between exact-date records and containing-period
  records when modules expose both concepts.
- Providing a simple navigation target for date-aware product workflows.

Implemented foundation:

- No dedicated Day View route or composition surface exists yet.
- Daily Work Logs already expose date-aware records and date navigation on the
  Daily Logs list page.

Planned MVP expansion:

- Day View route or screen for a selected workday.
- Daily Work Logs participation as the workday narrative layer.
- STOP Cards participation as date-aware safety observations.
- Daily Inspections participation as date-aware inspection records.
- Work Authorizations participation after Shift Reports and authorization
  records exist.
- Work Schedule participation when schedule records exist.
- Additional module participation as modules are implemented.

## 3. Non-Responsibilities

Day View does not own:

- Daily Work Log creation, editing, validation, or persistence.
- Work Schedule creation, editing, validation, or persistence.
- Shift Report, Work Authorization, Inspection, Defect, Fuel Log, Work Truck
  Log, Timesheet, Knowledge Base, or Payslip business rules.
- Global search architecture.
- A full calendar component.
- Cross-module analytics or reporting.
- Attachment storage.
- Authentication, authorization, or multi-user workflow.
- A generic repository layer or shared service layer.

Day View should compose module-owned records. It should not duplicate module
fields into Day View-only records or become a large cross-module form.

## 4. User Workflow

The V1 Day View workflow should stay simple:

1. The operator navigates to a selected workday.
2. Day View loads records that participating modules expose for that date.
3. The operator reviews the workday sections in a predictable order.
4. The operator opens the owning module when a record needs full inspection or
   correction.
5. If no records exist for the selected date, Day View shows a useful empty
   state and links to relevant creation paths when those paths exist.

The initial Day View should support the selected date as the primary context.
It should not require a global calendar, global search, or every future module
to exist before it becomes useful.

## 5. Module Boundaries

Day View is a shared product capability, but participating modules own their own
data and behavior.

Expected ownership model:

| Area | Owner |
| --- | --- |
| Workday composition, selected date, section ordering, and links | Day View |
| Daily Log records, activity timeline, validation, and persistence | Daily Work Logs |
| STOP Card records, safety observation fields, corrective actions, and status | STOP Cards |
| Daily Inspection records, findings, condition logic, and persistence | Daily Inspections |
| Work Authorization records, permit selections, completion checklist, and lifecycle | Work Authorizations |
| Work Schedule records and schedule-change semantics | Work Schedule |
| Shift paperwork and related safety records | Shift Reports and related modules |
| Fuel, truck, timesheet, and payslip records | Their owning modules |

Day View should depend on module-owned query helpers or contribution functions
only after those modules exist and their ownership boundaries are clear.

Shared behavior should be introduced only when at least two implemented modules
need the same contribution contract. Until then, Day View should use explicit
module integration points instead of broad abstractions.

## 6. Data Flow

Day View uses server-owned persisted state.

Expected V1 data flow:

1. The route receives or derives the selected workday date.
2. Day View validates and normalizes the selected date.
3. Day View requests date-aware contributions from implemented modules.
4. Participating modules query their own records and return display-ready
   contribution data or source-record links.
5. Day View renders the composed workday sections.

Day View should not write module records. Mutations should remain inside the
owning feature modules through their approved Server Actions or future approved
mutation boundaries.

Date-only behavior should stay consistent with the current Daily Work Logs
foundation. If future operator-local timezone requirements change date
semantics, that should be addressed deliberately because it affects multiple
date-aware modules.

## 7. UI Composition

Day View should be work-focused and scannable.

Expected V1 UI surfaces:

- A selected date header.
- Previous day, today, and next day navigation.
- A Daily Work Logs section when records exist for the date.
- A Work Schedule section when schedule records exist.
- Empty states for sections with no records.
- Links to owning module views.

Day View should organize module contributions without hiding ownership. Users
should be able to tell whether a record is a Daily Log, schedule item, shift
record, inspection, fuel record, or other module-owned item.

Day View should not become a dashboard of analytics, a full calendar, or a
global timeline in V1.

## 8. Validation And Error Handling

Day View validation is limited to composition inputs:

- Validate the selected date format.
- Normalize invalid or missing dates to a documented default, such as today.
- Preserve plain user-facing error states when the composed view cannot load.
- Let individual module links or sections show absent data without failing the
  entire page when practical.

Participating modules remain responsible for validating their own persisted
records.

Day View should not expose database errors or module internals in user-facing
messages.

## 9. Testing Strategy

Day View testing should follow `docs/testing-strategy.md` and grow with the
number of participating modules.

Appropriate test targets:

- Date parsing and navigation helpers.
- Composition ordering and empty-state behavior.
- Daily Work Logs contribution behavior when Day View first integrates it.
- Route-level rendering for stable Day View sections when component patterns
  stabilize.
- Integration tests later when multiple modules contribute records from a real
  PostgreSQL database.

Avoid:

- Broad snapshots of the full Day View page.
- Playwright coverage before the project introduces E2E infrastructure.
- A generic contribution framework before multiple implemented modules prove
  the shape.

Manual verification should cover date navigation, empty dates, dates with Daily
Logs, and links back to owning module records until automated coverage matures.

## 10. Future Evolution

Future Day View growth should stay aligned with `docs/product-roadmap.md` and
`docs/roadmap.md`.

Planned evolution:

- Daily Work Logs participation as the workday narrative layer.
- STOP Cards participation as date-aware safety records.
- Daily Inspections participation as date-aware inspection records.
- Work Authorizations participation after Shift Reports and Work
  Authorizations exist.
- Work Schedule context for the selected date or containing week.
- Additional module sections as Shift Reports, Work Authorizations,
  Inspections, Defects, Timesheets, Fuel Logs, Work Truck Logs, and other
  records are implemented.

Candidate future evolution:

- Full historical timeline view for selected dates.
- Global search result grouping by date.
- Calendar component integration.
- Richer cross-module summaries after multiple modules exist.

Future evolution should not:

- Move module business rules into Day View.
- Add global search or calendar infrastructure under the Day View milestone
  unless explicitly approved.
- Require every future module before Day View can provide V1 value.
- Add shared abstractions before multiple implemented modules need them.

## 11. Success Criteria

Day View architecture is successful when:

- Day View provides a useful selected-workday composition surface.
- Participating modules own their own data, validation, and persistence.
- Daily Work Logs can appear as the workday narrative layer without duplicating
  Daily Log behavior.
- Future modules can participate without handing business logic to Day View.
- Users can navigate dates and open source records in their owning modules.
- Empty and partial workdays are understandable.
- The feature remains V1-focused and does not become global search, a full
  calendar, analytics, or a cross-module edit form.
- The feature continues to follow repository-wide delivery, dependency,
  feature, state, UI, testing, and quality standards.
