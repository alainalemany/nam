# Daily Work Logs Architecture

Status: Approved

Product Phase: Product Roadmap Phase 0 foundation and Phase 1 workday-history
capabilities implemented; future cross-module history expansion planned

Primary Feature: Daily Work Logs

Depends On:

- Operations reference data for mines and equipment
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
- `docs/architecture/features/equipment-fuel-events.md`

Last Reviewed: 2026-07-15

## 1. Purpose

Daily Work Logs are the narrative workday record for NAM Dashboard.

This feature architecture defines how the Daily Work Logs subsystem should
remain structured as it moves from the implemented foundation toward the planned
MVP workday-history capability.

It should guide implementation decisions for Daily Work Logs without replacing
the product requirements in `docs/prd.md`, module behavior in `docs/modules.md`,
data model definitions in `docs/database.md`, or repository-wide implementation
standards in `docs/feature-architecture.md`.

## 2. Responsibilities

Daily Work Logs are responsible for:

- Creating one workday log for a date and shift.
- Capturing a summary, weather context, general notes, mine, and primary
  equipment when available.
- Capturing multiple manual activity entries within the log.
- Preserving activity sequence and optional start/end time context.
- Linking the log and activities to existing mine and equipment records.
- Showing list, create, edit, and detail workflows for Daily Logs.
- Showing a log summary and activity timeline on the detail view.
- Acting as the narrative layer for workday events that may later connect to
  structured modules.

Implemented foundation:

- `/daily-logs` list route.
- `/daily-logs/new` create route.
- `/daily-logs/[id]` detail route.
- Daily Log create/edit form.
- Server Actions for create and update.
- Zod validation for persisted user input.
- Prisma persistence for `DailyLog` and `DailyLogActivity`.
- Mine and equipment references from existing operations reference data.
- Feature-owned list filtering by text, date range, mine, equipment, shift, and
  activity type.
- Previous-day, next-day, and today date navigation on the list page.
- Date-aware participation in Day View through a Daily Logs-owned read helper.

Remaining evolution:

- Richer related-record links as neighboring modules are implemented.
- Future global cross-module search remains separate from Daily Logs list
  filtering.

## 3. Non-Responsibilities

Daily Work Logs do not own:

- Shift Report structure.
- Work Authorization workflow or permit completion logic.
- Daily Inspection forms.
- Defect lifecycle.
- Knowledge Base article management.
- Work Schedule, Timesheet, Operational Safety Checklist, Equipment Fuel Event,
  Supply Request, Work Truck Log, or Payslip workflows.
- Global search architecture.
- Calendar or Day View architecture beyond exposing date-aware Daily Log data.
- Attachment storage.
- Authentication, authorization, or multi-user workflow.
- Analytics or reporting beyond workday review.

Daily Work Logs may link to other modules when those modules exist, but should
not duplicate their structured data as Daily Log-only fields.

## 4. User Workflow

The V1 Daily Work Logs workflow should remain simple and manual:

1. The operator opens the Daily Logs area.
2. The operator creates a Daily Log for the workday.
3. The operator selects the date, shift, mine, and primary equipment when known.
4. The operator writes a workday summary and optional context.
5. The operator adds one or more activity entries.
6. Each activity can capture type, title, time context, description, equipment,
   location, contractor/company, person, and notes.
7. The operator saves the log.
8. The operator can review the Daily Log detail page as a workday summary and
   activity timeline.
9. The operator can edit the Daily Log if the workday record needs correction.

Historical lookup and Day View workflows use Daily Logs as date-aware records,
not as a replacement for structured modules. Day View
composition boundaries are defined in `docs/architecture/features/day-view.md`.

## 5. Module Boundaries

Daily Work Logs should remain a feature-owned implementation slice under:

```text
src/features/daily-logs/
```

The App Router should own route composition under:

```text
src/app/daily-logs/
```

Daily Work Logs own their form behavior, validation, server actions, activity
constants, feature-specific types, and data helpers.

Shared behavior should move out of `src/features/daily-logs/` only when another
implemented feature has a real reuse need.

Daily Work Logs should treat related modules as external owners:

- Shift Reports own structured shift records.
- Work Authorizations own permit and completion workflow.
- Defects own defect lifecycle.
- Knowledge Base owns reusable operational knowledge.
- Equipment Fuel Events own structured operational fueling records.
  A Fuel Event may own one optional unique reference to a matching
  `FUEL_SERVICE` activity; the activity does not own the Fuel Event, and its
  deletion only clears that optional link.
- Future Fleet or Work Truck capabilities own vehicle assignment and purchase
  evidence.
- Supply Requests own operator-originated requests; warehouse pickup for an
  order placed by someone else remains Daily Work Log narrative activity.

The Daily Log should provide workday narrative context and links, not become a
large cross-module form.

## 6. Data Flow

Daily Work Logs use server-owned persisted state.

Current data flow:

1. Route-level pages load Daily Log data and form options.
2. Feature data helpers read mine and equipment options through Prisma.
3. The form submits user input to Server Actions.
4. Server Actions parse and validate `FormData` with Zod.
5. Validated data is normalized for optional values and date-only persistence.
6. Prisma writes the parent `DailyLog` and child `DailyLogActivity` records.
7. Mutations revalidate affected routes and redirect after successful writes.

The parent `DailyLog.logDate` is the primary workday date. Activity records
inherit that date by default in the current write flow so users do not need to
enter the same date repeatedly for each activity.

Current update behavior replaces child activity rows inside a transaction. That
is acceptable for the foundation because activity rows are edited as part of one
Daily Log form. If future activity rows gain independent lifecycle, attachments,
or external links, this replacement strategy should be revisited before those
dependencies are introduced.

## 7. UI Composition

Daily Work Logs UI should stay work-focused and predictable.

Current UI surfaces:

- List page for Daily Logs.
- Create page.
- Detail page with log summary and activity timeline.
- Edit workflow through the Daily Log form.
- Loading and error route states for the Daily Logs area.

The form should support multiple manual activity entries without requiring
repeated date entry for each activity.

The detail page should make the Daily Log readable as a workday record:

- Date and shift context.
- Mine and equipment context.
- Summary and notes.
- Activity timeline in sequence order.

Filtering, date navigation, and Day View UI should reference the Daily Log as a
date-aware record and preserve the activity timeline as the narrative view.

## 8. Validation And Error Handling

Daily Work Logs should validate persisted user input at the server boundary.

Current validation responsibilities:

- Require a log date.
- Require a shift value.
- Require a Daily Log summary.
- Require at least one activity.
- Require each saved activity to have a title.
- Restrict activity type to approved values.
- Normalize empty optional text fields.
- Enforce field length limits.

Server Actions should return structured form errors for invalid input and should
redirect only after successful persistence.

Persistence failures should return plain user-facing error states without
exposing internal database details.

Client-side form behavior can improve ergonomics, but server-side validation is
the required boundary for saved Daily Log records.

## 9. Testing Strategy

Daily Work Logs testing should follow `docs/testing-strategy.md` and grow
proportionally with behavior risk.

Appropriate test targets:

- Validation schemas for required fields, activity rows, enum values, and
  optional field normalization.
- Pure formatting helpers for date display and form date values.
- Server Action parsing behavior where it can be tested without brittle
  framework coupling.
- Component behavior for stable form or timeline interactions when the UI
  stabilizes.
- Persistence integration tests for parent/child Daily Log writes when database
  integration testing is expanded.

Avoid:

- Broad snapshots of forms or pages.
- Tests tied to vendor layout internals.
- End-to-end tests before the project introduces Playwright coverage.
- Heavy mocking abstractions before repeated test needs exist.

Manual verification should continue to cover create, edit, list, detail, linked
mine/equipment selection, multiple activities, and route revalidation until
automated coverage matures.

## 10. Future Evolution

Future Daily Work Logs growth should stay aligned with `docs/product-roadmap.md`
and `docs/roadmap.md`.

Implemented evolution:

- Search Daily Logs by date, text, equipment, activity type, contractor, or
  company.
- Add calendar navigation for historical Daily Log records.
- Participate in Day View as the workday narrative layer.

Remaining evolution:

- Link activities to available related records as structured modules are
  implemented.
- Add global cross-module search only as a separately approved capability.

Candidate future evolution:

- Richer cross-module global search.
- Full historical timeline view for selected dates.
- Work Order module integration.
- Advanced analytics from Daily Log activities.
- Equipment-specific templates after flexible manual activity entry proves
  reliable.

Future evolution should not:

- Promote deferred automation into V1 without explicit approval.
- Replace structured module records with Daily Log-only text fields.
- Add shared abstractions before at least one other feature proves the need.
- Add attachments, authentication, or analytics under the Daily Work Logs
  architecture without a confirmed milestone.

## 11. Success Criteria

Daily Work Logs architecture is successful when:

- The Daily Log remains the operator's workday narrative layer.
- Users can create, edit, list, and review workday records without repeated
  activity-date entry.
- Multiple activities can be captured and reviewed in stable sequence.
- Mine and equipment relationships use existing reference records.
- Validation protects persisted Daily Log data at the server boundary.
- Daily Logs participate in feature-owned filtering, date navigation, and Day
  View without transferring ownership of Daily Log behavior.
- Related module links can be added later without turning Daily Logs into a
  duplicate owner of structured module data.
- The feature continues to follow repository-wide delivery, dependency, feature,
  state, UI, testing, and quality standards.
