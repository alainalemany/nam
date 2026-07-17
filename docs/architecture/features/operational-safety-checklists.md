# Operational Safety Checklists Architecture

Status: Approved

Product Phase: Product Roadmap Phase 2 Shift And Safety Records

Primary Feature: Operational Safety Checklists

Bounded Context: Daily Inspections

Depends On:

- Operations reference data for Equipment, Mine, and City context
- Existing Daily Inspections and Defect Tracking ownership boundaries
- `docs/architecture/equipment-operations.md`
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Related Documents:

- `docs/product-vision.md`
- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/architecture/features/README.md`
- `docs/architecture/features/daily-inspections.md`
- `docs/architecture/features/defect-tracking.md`
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/day-view.md`
- `docs/reference/checklists/dragline-checklist-v1.md`
- `docs/reference/checklists/mobile-checklist-v1.md`
- `docs/decisions/adr-017-supersede-standalone-work-truck-log.md`
- `docs/decisions/adr-018-private-operational-safety-checklist-photo-storage.md`
- `docs/decisions/adr-019-managed-private-overlay-operational-pilot.md`

Last Reviewed: 2026-07-17

Implementation Status: The V1 foundation is implemented with canonical
Dragline and Mobile code-owned templates, complete-only submission, explicit
completed-record correction, feature-owned history filtering, historical
snapshots, and PostgreSQL-backed persistence. The implementation and its
corrections have completed independent review with no remaining findings.
Phase 24.1 implements a feature-owned selected-date Day View contribution.
Equipment Activity Timeline, Defect linkage, Planner Review, and the other
deferred capabilities remain unimplemented. ADR-017 confirms that this
feature owns shift-start Mobile inspections for work trucks, tractors,
forklifts, and other supported mobile Equipment. Phase 23.4 implements explicit
`HOURS`/`MILES` meter units, editable category suggestions, server-validated
mismatch confirmation, signed NAM-only save results, and Create Another. Photo
implementation and real photo use remain blocked. ADR-019 approves the managed
private-overlay architecture for ADR-018's access requirement, but that
boundary is not implemented and the remaining processing, storage, backup, and
recovery prerequisites also remain open.

## 1. Purpose

Operational Safety Checklists preserve start-of-shift inspections for a
specific Equipment record.

They should help the operator answer:

> Was this Equipment inspected before operation, what was the condition of each
> required checklist item, and which problems were new or already known?

This is different from the implemented area-oriented Daily Inspection summary,
which answers what conditions were observed in an operational area and what
actions were taken. Both belong to the broader Daily Inspections bounded
context, but they must remain distinct business records and workflows.

This document defines the approved V1 architecture. Phase 21.3.1 resolved the
workflow, identity, uniqueness, lifecycle, correction, deletion, template,
Equipment compatibility, and problem-context decisions. Phase 21.3.2 verified
the canonical Dragline and Mobile V1 catalogs against the source forms. Phase
21.3.3 confirmed integer-only Hour Meter values and the V1 validation range,
closing the final implementation-blocking product decision.

## 2. Responsibilities

Operational Safety Checklists own:

- Start-of-shift checklist records for one Equipment subject.
- One independent checklist for every piece of Equipment inspected at shift
  start.
- Dragline and Mobile template definitions and version identity.
- Checklist item identifiers, labels, ordering, required markers, and allowed
  response sets.
- Record metadata, meter context, operator and supervisor display snapshots,
  problem context, and item responses.
- Optional checklist-level photo evidence, captions, ordering, normalization,
  storage metadata, and private serving after the approved access gate exists.
- Complete-on-submit and explicit correction behavior.
- Feature-owned validation, queries, mutations, UI, filters, and tests.
- Historical template, item, response, person-name, and Equipment display
  snapshots.
- A display-ready selected-date contribution to Day View and a future
  Equipment Activity Timeline contribution when separately approved.

## 3. Non-Responsibilities

Operational Safety Checklists do not own:

- The existing area-oriented Daily Inspection record or its summary condition
  workflow.
- Defect severity, priority, lifecycle, corrective work, resolution, or closure.
- Planner Review, planner identity, approval, or sign-off.
- Daily Work Log narrative activities.
- Equipment reference-data management.
- Work Schedule planning or Timesheet worked-time accounting.
- Day View or Equipment Activity Timeline composition.
- Employee, User, Supervisor, authentication, authorization, or workforce
  management.
- A database-admin checklist builder or generic survey platform.
- A generic attachment platform or photos attached to individual checklist
  responses.
- Analytics, exports, notifications, global search, or external form
  submission in V1.

## 4. User Workflow

The implemented V1 workflow is:

1. The operator starts a checklist at the beginning of the operational shift.
2. The operator selects the actual Equipment inspected.
3. The feature suggests the compatible Dragline or Mobile template and rejects
   incompatible combinations.
4. The operator records date, shift, starting meter context, operator name,
   supervisor name, and any overall problem context.
5. The operator reviews every required item and records an allowed response.
6. The operator adds an overall Problem Description when Needs Repair is
   selected or when other checklist-level context is useful.
7. The operator submits the checklist only after every required item and
   completion invariant passes. Incomplete client form state is not persisted.
8. The operator reviews the checklist later from feature-owned history or
   detail surfaces.
9. A completed checklist may be corrected through an explicit correction
   action that revalidates the complete record; no planner approval is implied.

## 5. Feature Ownership And Repository Organization

The feature should use a sibling feature slice:

```text
src/features/operational-safety-checklists/
```

and a distinct App Router surface:

```text
src/app/operational-safety-checklists/
```

This organization follows the repository's flat feature convention and keeps
the record type explicit. It does not create a new inspection platform or make
Operational Safety Checklists unrelated to Daily Inspections.

The existing `src/features/daily-inspections/` module should remain responsible
for the implemented summary record. The two feature slices may use existing
neutral Equipment or date helpers when appropriate, but should not share form,
validation, lifecycle, or persistence code merely because both are inspections.

No shared inspection framework is justified until implemented behavior proves
a stable reusable boundary.

## 6. Conceptual Domain Model

One Operational Safety Checklist conceptually represents:

- One operational shift-start date stored as `inspectionDate`.
- One shift.
- One actual Equipment record.
- One approved template key and version.
- One operator display-name snapshot.
- One required supervisor display-name snapshot.
- One starting-meter context.
- One overall problem description or notes field.
- One response for every required item in the selected template.

One checklist owns many ordered item responses. Item responses have no
independent lifecycle.

V1 permits exactly one checklist per Equipment, operational date, and shift.
The Equipment determines the template, so template identity must not create a
second uniqueness path. Multiple shifts may inspect the same Equipment on the
same calendar date. A correction updates the existing checklist; it does not
create a same-shift reinspection record.

`inspectionDate` is the date on which the operational shift began. An overnight
inspection retains that shift-start date even when submission occurs after
midnight. A later correction retains the original shift-start date unless the
operator intentionally corrects a date that was entered incorrectly. The
feature uses an explicit date-only value and does not derive operational
ownership through UTC or timezone conversion. This follows the platform's
Work Schedule, Timesheet, and Daily Work Log work-date boundaries.

Each actual Equipment inspected at shift start receives its own record. A shift
using Dragline 133, one work truck, and one tractor therefore produces one
Dragline checklist and two independent Mobile checklists. A mid-shift Equipment
replacement does not create another corporate inspection; it belongs in Daily
Work Logs as operational narrative or an appropriate existing activity.

## 7. Template Strategy

V1 should use two approved, feature-owned template definitions:

- Dragline Inspection.
- Mobile Inspection.

Template definitions should initially live in feature code because:

- Only two approved templates exist.
- Users do not manage checklist definitions.
- Code review and tests provide controlled changes.
- A persistence-backed template administrator would add unapproved workflow and
  generic form-engine complexity.

Each template version should define:

- Stable template key.
- Stable version identifier.
- Display name.
- Compatible Equipment categories.
- Ordered groups and items.
- Stable item key for each item.
- Item label.
- Required marker.
- Approved response-set key.

Template versions should be append-only. Changing a label, required marker,
response set, or ordering creates a new version rather than mutating the old
definition. Older versions remain available for validation and correction of
historical records.

Persisted checklist records and responses should snapshot the template and item
display facts needed for historical rendering. This preserves history even if
application definitions later change.

V1 should not persist editable template-definition tables and should not expose
template-management routes.

## 8. Canonical V1 Template Catalogs

The authoritative source forms are preserved in `source-forms/`. Phase 21.3.2
visually verified every page and established these canonical references:

- [Dragline Inspection V1](../../reference/checklists/dragline-checklist-v1.md)
- [Mobile Inspection V1](../../reference/checklists/mobile-checklist-v1.md)

The catalogs own exact visible wording, source ordering, stable item keys,
response options, visible `*` and `**` markers, metadata placement, and the
source-only Planner Review field. They replace the former provisional lists in
this architecture.

The Dragline catalog contains 24 ordered inspection items. Its first 23 use
OK, Needs Repair, Previously Noted, and N/A; `Two Life Jackets In Cabin` uses
Yes and No.

The Mobile catalog contains Rental metadata followed by 22 ordered inspection
items. The five `*` items use OK, Needs Repair, and N/A. The six `**` items and
the unmarked condition items use OK, Needs Repair, Previously Noted, and N/A.
`Fuel Card` uses Present, Not Present, and N/A. The source provides no visible
legend for `*` and `**`, so the catalogs preserve the symbols without inventing
their meaning. All listed V1 inspection items still require one response before
submission.

## 9. Response Model

V1 should use a small set of explicit response semantics rather than arbitrary
question types.

Canonical response sets:

| Response set | Allowed values | Intended use |
| --- | --- | --- |
| Condition Four | OK, Needs Repair, Previously Noted, N/A | Dragline condition items and Mobile `**` or unmarked condition items |
| Condition Three | OK, Needs Repair, N/A | Mobile `*` items |
| Yes/No | Yes, No | Mobile Rental metadata and Dragline life-jacket item |
| Presence Three | Present, Not Present, N/A | Mobile Fuel Card item |

Each persisted response should preserve conceptually:

- Stable item key.
- Historical item-label snapshot.
- Historical item-order snapshot.
- Approved response-set identity.
- Selected response code and display-label snapshot.

Responses should be relational child records rather than an unstructured JSON
blob. This supports uniqueness, required-item validation, ordered history,
condition filtering, and future explicit Defect links without introducing a
generic checklist engine.

Exactly one response may exist for each item in one checklist. Completion
requires a response for every required item and rejects unknown, duplicate, or
template-incompatible item keys.

## 10. Equipment And Template Compatibility

Equipment is required at creation. Users select the actual Equipment inspected,
including a temporary replacement or rental unit. Temporary or rental Equipment
must still be represented by an Equipment record; a free-text machine name is
not a substitute for the reference.

Users do not independently select Mine or City. Current context is derived
through `Equipment -> Mine -> City`.

Initial compatibility should use an explicit feature-owned mapping:

- Dragline template: `DRAGLINE`.
- Mobile template: `WORK_TRUCK`, `TRACTOR`, and `FORKLIFT`.

Pickup trucks use the existing `WORK_TRUCK` category. Other or future mobile
categories should be added deliberately to the Mobile mapping. The feature
must not assume that every non-Dragline category is Mobile.

The operator does not manually choose a template. Equipment selection resolves
the one compatible template, and the server remains authoritative. Equipment
classified as `OTHER` or a future category is ineligible until the feature's
mapping explicitly classifies it as Mobile or Dragline.

Rental status and Fuel Card presence are observations for the selected shift.
They belong to the Mobile checklist item set, not permanent Equipment reference
attributes.

## 11. Equipment Meter Reading

The checklist needs a narrow meter concept rather than a field that assumes all
Equipment uses odometer mileage.

The implemented schema has a required `OperationalSafetyChecklistMeterKind`
with `HOURS` and `MILES` and a required integer `startingMeter`. Phase 23.4
extended the existing enum without introducing a second unit field or an
Equipment-level preferred-unit field.

Every checklist will preserve an explicit event-level meter-kind snapshot and
one whole-number starting value. Both `HOURS` and `MILES` accept integers from
`0` through `999999` inclusive. The upper bound is a validation guard rather
than a business limit. Decimal, floating-point, missing, and malformed values
are invalid. V1 does not calculate distance, record ending mileage, or enforce
continuity across checklists.

New-entry defaults are editable suggestions:

- `DRAGLINE` suggests `HOURS`.
- `WORK_TRUCK` suggests `MILES`.
- `TRACTOR` and `FORKLIFT` do not suggest a unit; the operator must select one.

Known-category mismatches use a warn-but-accept policy. A Dragline with
`MILES`, or a Work Truck with `HOURS`, requires explicit operator confirmation
for a new or changed value, but the server does not reject it solely because it
differs from the default. This catches likely entry mistakes while preserving
the confirmed rule that category defaults are not immutable Equipment truth.
The transient confirmation is validated server-side and is not historical
domain data. An unchanged stored value during correction does not require a new
confirmation.

Equipment selection changes reset the meter kind and reading with all other
machine-specific form state. The applicable editable default is then suggested
again. Inactive or deleted Equipment history remains readable from the stored
meter kind and reading; no current category lookup may rewrite that snapshot.
Any unit beyond `HOURS` and `MILES` requires separate operational evidence and
architecture approval.

The selector and stored explicit unit are NAM Dashboard metadata. They do
not alter the exact source-form wording preserved by the canonical Dragline and
Mobile catalogs or the source PDFs.

## 12. Person Identity

The repository has no Employee, User, or Supervisor identity model. V1 should
use checklist-owned display-name snapshots:

- Operator display name.
- Supervisor display name.

These fields do not imply authentication, assignment ownership, workforce
management, or supervisor participation in the application.

Both display names are required, trimmed snapshots. No normalized operator key
is required for record uniqueness. Operator and supervisor history filters may
use normalized, case-insensitive input without introducing person-reference
models.

## 13. Historical Integrity

Historical checklist display must not depend on current mutable reference data.

The checklist should retain a live Equipment reference for current navigation
and snapshot only:

- Equipment display name.
- Equipment number.
- Equipment category.
- Mine name.
- City name.
- City state.

The live relation should be required when the checklist is created and may
become null if Equipment deletion is later permitted. The historical snapshots
must remain readable after Equipment rename, transfer, deactivation, category
change, or deletion.

The checklist also snapshots:

- Template key, name, and version.
- Item keys, labels, ordering, and response-set identity.
- Selected response labels.
- Operator and supervisor display names.
- Meter kind and entered value.
- Photo captions, order, dimensions, normalized format, byte size, checksum,
  and upload timestamp after photo evidence is implemented.

Snapshots are generated or verified server-side. Client-submitted Equipment,
template, item, and response labels are never authoritative. Complete Equipment,
Mine, City, or person records must not be duplicated.

## 14. Needs Repair, Previously Noted, And Problem Context

`Needs Repair` means the inspected condition requires attention. It does not
mean a Defect exists.

`Previously Noted` means the issue was already known or reported. It does not
create a new issue, infer a matching Defect, or require the operator to invent
new damage wording.

The overall Problem Description remains available for checklist-level context.
The structured responses already identify every affected item, so V1 does not
add a separate note field to each response. The overall field follows the
confirmed external workflow and may describe one or several new conditions.

Approved V1 rule:

- An OK or N/A response requires no problem text.
- Any checklist containing one or more Needs Repair responses requires a
  nonblank overall Problem Description.
- Previously Noted requires no repeated text and does not require a Defect.
- The overall Problem Description is otherwise optional.

The feature may show the previous checklist's responses and problem context as
read-only assistance. For the same Equipment and template, an explicit operator
action may copy prior problem wording into the current overall Problem
Description for editing. That action copies text only; it never copies or
preselects a response.

## 15. Defect Tracking Boundary

V1 does not automatically create, update, reopen, resolve, close, or infer a
Defect from any checklist answer or text.

The initial checklist foundation should not require a Defect relationship.
Defects may be reviewed independently from the same Equipment record.

A future milestone may add an explicit operator-controlled relationship from a
checklist response to:

- An existing Defect.
- A newly created Defect.

The checklist would retain its historical answer and overall problem context.
Defect Tracking would retain all lifecycle ownership. A future relationship
should target a specific response rather than relying only on the
checklist-level Problem Description.

## 16. Completion And Corrections

The real workflow is immediate submission, so V1 does not persist Draft,
Submitted, Reviewed, Approved, or Planner Review states. A persisted checklist
is Completed. Incomplete answers remain transient form state and cannot create
a checklist record.

Correction rules:

- A deliberate `Correct Checklist` command opens the existing completed record
  for correction.
- Saving a correction validates the entire approved historical template version
  and keeps the record Completed.
- Correction updates the same Equipment/date/shift record rather than creating
  a duplicate or a Draft/Reopen transition.
- Equipment, date, or shift may be corrected when originally entered
  incorrectly. The server must recheck uniqueness and Equipment compatibility.
  Unchanged Equipment preserves its historical template, responses, and
  snapshots while the operator edits. Any intentional Equipment identity change
  clears the prior meter reading, responses, and Problem Description, refreshes
  Equipment and location snapshots, resolves the compatible current template,
  and requires a complete new response set even when both Equipment records use
  the same template family.
- A checklist with photo evidence cannot change Equipment until the operator
  explicitly removes every photo. Photos must never silently carry to a
  different machine, and Equipment correction must not perform an implicit
  bulk evidence deletion.
- A mid-shift replacement is not a checklist correction and does not change the
  original shift-start inspection. Daily Work Logs own that later operational
  event without cross-feature mutation.
- If Equipment deletion has set the live relation to null, historical detail
  remains readable from snapshots. Correction must explain that the original
  Equipment is unavailable and cannot be submitted until the operator
  intentionally selects valid replacement Equipment and completes the full
  replacement checklist.
- Completed checklists cannot be deleted in V1. Incorrect data must be corrected
  in place so permanent safety history is not silently removed.
- Full immutable revision history remains deferred; standard timestamps still
  identify later correction activity.
- Planner or supervisor approval is not implied.

## 17. Repetitive Workflow Safety

Efficiency must not weaken the meaning of a safety inspection.

Safe V1 conveniences may include:

- Defaulting the operational date to today without timezone conversion.
- Remembering or suggesting the most recently used shift, Equipment, operator
  name, and supervisor name as editable form defaults.
- Selecting the compatible template after Equipment selection.
- Showing previous checklist problem context read-only and offering an explicit
  text-only reuse action.
- Showing completion progress and unanswered required items.

Responses must start unanswered for a new checklist. The feature must not copy
or preselect yesterday's condition answers.

V1 does not include `Mark all OK`, copied answers, or preselected prior
responses. Any later bulk response action requires separate safety review and
must remain an explicit conscious confirmation.

## 18. Data Flow And State Architecture

Operational Safety Checklists should use server-owned persisted state.

Expected flow:

1. A server-rendered route loads active Equipment options and approved template
   definitions.
2. Temporary grouped-item interaction state remains local to the checklist
   form.
3. The form submits one checklist payload to a feature-owned Server Action.
4. Zod validates metadata, template compatibility, item completeness,
   response sets, overall problem context, and duplicate item keys.
5. The server reloads Equipment and template definitions and creates trusted
   snapshots.
6. Parent and response writes occur in one Prisma transaction.
7. Successful mutations revalidate checklist list/detail routes and later Day
   View routes only after participation exists.
8. The action redirects to durable server-rendered detail state with a one-time
   NAM save-result marker.
9. Photo evidence, once enabled, uses separate checklist-owned actions after
   the completed checklist exists; it does not extend the checklist transaction
   or introduce Draft state.

No global state, API layer, generic mutation service, or client-owned business
validation is required.

## 19. Feature-Owned Queries

Expected reads:

- Checklist history with feature-owned filters.
- Checklist detail with ordered historical responses.
- Checklist correction data using the record's historical template version.
- Active Equipment options with Mine and City context.
- Compatible current template definition for new entry.
- Historical template version for correction.
- Previous checklist context for the same Equipment and template.
- Count and summary helpers for Needs Repair and Previously Noted responses.

Implemented reads include a display-ready selected-date contribution for Day
View.

Future reads:

- Equipment-history contribution for a derived timeline.
- Active Defect context through a Defect Tracking-owned query if a later
  product milestone approves that assistance.

Operational Safety Checklists should not query or mutate Defect persistence
directly.

## 20. Feature-Owned Mutations

Expected Server Actions:

- Submit one complete checklist and its responses atomically.
- Correct one existing completed checklist and its responses atomically.

Mutations must:

- Scope writes to one checklist and its owned responses.
- Reject incomplete submissions, duplicate same-shift records, and deletion.
- Verify Equipment existence and template compatibility server-side.
- Reject unknown, missing, or duplicate item keys.
- Preserve historical snapshots during correction unless the associated source
  selection intentionally changes.
- Recheck uniqueness and require the complete compatible response set when an
  identity correction changes Equipment, date, shift, or template family.
- Return structured field, item, completion, and correction errors without
  exposing Prisma details.

After photo evidence is enabled, separate feature-owned actions may add one
normalized photo, update a caption, reorder photos, or remove one photo. These
actions must enforce checklist ownership, count and sequence constraints,
access controls, and filesystem/database compensation. They may not mutate
Defects, Daily Work Logs, Equipment, or another feature.

No mutation may update Daily Inspections, Defects, Equipment, Daily Work Logs,
Day View, or person identity records.

## 21. Filtering And Retrieval

The history list should support feature-owned URL filters for:

- Date range.
- Equipment.
- Template type.
- Shift.
- Operator display name.
- Supervisor display name.
- Response condition, especially Needs Repair and Previously Noted.

Structured filter groups combine with AND. A response-condition filter may use
the feature-owned child-response relationship without exposing checklist query
logic to routes or Day View.

Global cross-module search, saved filters, and a generic query builder remain
outside V1.

## 22. UI Architecture

Expected feature surfaces:

- Checklist history list.
- New checklist workflow.
- Detail view.
- Explicit completed-record correction workflow.
- Loading, empty, not-found, validation, and persistence-error states.

The checklist form should provide:

- Compact metadata and Equipment context at the top.
- Searchable Equipment selection.
- Suggested or constrained template selection.
- Meter kind and starting value together.
- A visible explicit `HOURS`/`MILES` selector next to Starting Meter Reading.
- Grouped checklist items in stable template order.
- Clear radio or segmented response controls with accessible labels.
- Visible overall problem context.
- Progress and unanswered-item feedback.
- One clear Submit Checklist command that remains unavailable until the form is
  complete.

On narrow screens, item groups should stack into stable sections or rows with
touch-usable response controls. The UI should not reproduce the external form's
poor mobile layout or present the disabled Planner Review controls.

List and detail views should remain dense and scannable. They should show date,
shift, Equipment snapshot, template/version, completion, meter context, and
Needs Repair or Previously Noted counts without reproducing the full form.
After the access gate and photo implementation exist, detail may also show the
ordered checklist-level evidence gallery and its feature-owned management
commands.

## 23. Day View And Equipment Timeline Boundaries

Day View participation is implemented in Phase 24.1 through a feature-owned,
bounded selected-date helper.

The feature-owned date helper returns a display-ready summary with:

- Equipment historical identity.
- Template name.
- Lifecycle or completion state.
- Meter context.
- Needs Repair count.
- Previously Noted count.
- Detail link.

Day View may render and order that result. It must not interpret item response
codes, count conditions, validate completion, or query checklist tables.

A future Equipment Activity Timeline should consume a separate feature-owned
Equipment-history query. It must not store duplicate checklist events or use a
generic contribution registry until implemented contributors prove that need.

## 24. Validation And Error Handling

Server validation should enforce:

- A valid date-only `inspectionDate` representing the operational shift-start
  date, including overnight work submitted after midnight.
- A valid shift.
- Required existing Equipment at creation.
- An approved template key/version compatible with Equipment category.
- Required `HOURS` or `MILES` meter kind and a required integer starting value
  from `0` through `999999` inclusive.
- Explicit server-validated mismatch confirmation when a new or changed meter
  kind differs from a known category default.
- Required, nonblank operator and supervisor display-name snapshots.
- One response for each required item before persistence.
- No unknown or duplicate item responses.
- The allowed response set for every item.
- Needs Repair overall-description and Previously Noted no-repeat rules.
- Complete-only persistence, explicit correction, and no-deletion rules.
- One-record-per-Equipment/date/shift uniqueness.

Correction preserves the original shift-start date unless the operator
intentionally submits a corrected date. A mid-shift Equipment replacement does
not create a second checklist or change the original checklist date; Daily Work
Logs own that later operational context.

Snapshot validation should reload and trust server-owned Equipment and template
data. Client-submitted labels, ordering, categories, Mine/City names, and
response labels must not become authoritative.

Validation errors should preserve aggregate guidance and map to metadata,
meter, overall problem context, and the exact checklist item where practical.
Persistence and uniqueness failures should return user-safe messages.

## 25. Testing Strategy

Implementation testing should follow `docs/testing-strategy.md`.

### Unit Tests

- Template keys, versions, item keys, labels, ordering, and response sets.
- Dragline versus Mobile Equipment compatibility.
- Required-item and duplicate-response validation.
- Item-specific response-set validation.
- Integer-only Hour Meter validation at `0` and `999999`, with rejection of
  negative, decimal, and greater-than-maximum values.
- Needs Repair and Previously Noted context rules.
- Date-only and shift handling.
- Overnight submission and correction retaining the explicit shift-start date.
- Complete-only submission and full correction validation.
- Snapshot and display transformations.
- Filter parsing and query-condition construction.

### Mutation And Persistence Tests

- Atomic parent and response creation/update.
- Rejection of incomplete or invalid submissions without parent creation.
- Explicit correction of the same completed record.
- Identity correction uniqueness, Equipment snapshot refresh, and template
  replacement only after an intentional Equipment change.
- Direct update and deletion rejection outside the correction command.
- Uniqueness and concurrent first-save behavior.
- Snapshot preservation when Equipment and templates are unchanged.
- Snapshot refresh only after intentional source changes.
- No Defect mutation from checklist responses.

### PostgreSQL Integration Priorities

- Parent/response ownership and cascade behavior.
- One-response-per-item constraints.
- Equipment/date/shift uniqueness across template identity.
- Equipment delete behavior with historical snapshots.
- Transaction rollback on response failure.
- Template/version and response ordering persistence.
- Migration application and status through the Docker network.

### Route And Component Tests

- History, new, detail, and correction route rendering.
- Dragline and Mobile grouped item rendering.
- Accessible response controls and field/item validation feedback.
- Incomplete transient form state and complete submission presentation.
- Explicit completed-record correction presentation.
- Previous checklist context without copied responses.
- Narrow-screen grouped layout where practical.
- No Planner Review controls.

Focused E2E coverage may be added later for the critical submit/correct
workflow after the repository has an approved E2E database strategy.

## 26. Security And Privacy

Checklist records contain personnel names and safety-related Equipment
conditions. V1 remains a personal application without authentication or role
enforcement, but implementation should:

- Avoid exposing records outside the intended deployment boundary.
- Treat operator and supervisor names as operational snapshots, not user
  accounts.
- Keep Planner Review and approval out of V1.
- Avoid presenting personal notes as official planner or employer decisions.
- Return user-safe errors without internal database or infrastructure details.
- Do not expose photo upload, management, or serving to real Internet-reachable
  use until the access gate defined by ADR-018 is satisfied.
- Treat generated media keys as storage identifiers, not authorization tokens.
- Strip device metadata, including GPS, before final photo persistence.

Future multi-user access requires separate authentication, authorization,
privacy, and retention decisions.

## 27. Deferred Scope

Deferred capabilities include:

- Planner Review, planner identity, approval, and sign-off.
- Authentication, authorization, and workforce identity.
- User-configurable templates or a generic form builder.
- Automatic Defect creation or lifecycle mutation.
- Explicit response-to-Defect links until separately approved.
- Photo implementation and real photo use until the ADR-018 access gate,
  runtime image-processing support, private volume, and backup procedures are
  implemented and verified.
- Analytics, compliance dashboards, exports, and notifications.
- Global cross-module search.
- External NACCO form submission or synchronization.
- Stored Equipment Activity Timeline events.
- Additional template families beyond verified Dragline and Mobile templates.
- Draft, reopen, deletion, copied answers, and bulk all-OK behavior.

## 28. Product Decisions

### Resolved By Operational Evidence

- One checklist is completed once at the beginning of each shift after an
  actual inspection.
- Dragline and Mobile are the two V1 templates.
- The workflows share date, shift, Equipment, starting meter, operator,
  supervisor, and problem context.
- Most condition items use OK, Needs Repair, Previously Noted, and N/A.
- Some approved items may use narrower Yes/No or Presence response sets.
- Planner Review is excluded from V1.
- Rental status and Fuel Card presence are shift-start observations.
- Exactly one actual Equipment is selected, including temporary replacement and
  rental units.
- Equipment determines Dragline or Mobile; Mine and City are derived.
- Dragline defaults to Hours and Work Truck defaults to Miles. These are
  editable suggestions; Tractor and Forklift have no confirmed default.
- V1 Hour Meter readings use whole integers from `0` through `999999`; the
  maximum is a validation guard rather than a business rule.
- Needs Repair does not create a Defect.
- Previously Noted does not require repeated problem wording or a Defect.
- Prior answers must not be copied or preselected.
- The external workflow persists only a completed submission and has no Draft
  state.

### Resolved Through Repository Architecture

- The feature is a sibling vertical slice inside the Daily Inspections bounded
  context.
- The existing Daily Inspection summary record remains unchanged.
- Equipment is the required reference anchor; Mine and City are derived.
- Operator and supervisor are required display-name snapshots rather than
  person-reference models.
- Templates are fixed, versioned, and feature-owned rather than configurable.
- Canonical V1 catalogs preserve exact source wording, ordering, visible
  markers, and item-specific response sets.
- Responses are relational child facts with historical snapshots, not JSON.
- V1 permits one record per Equipment, operational date, and shift; template
  identity cannot bypass that uniqueness.
- Every persisted checklist is Completed. Correction is an explicit full-record
  edit of the same checklist; Draft, Reopen, and deletion are excluded.
- Phase 23.3 approves required checklist-level `HOURS`/`MILES` snapshots,
  editable known-category defaults, explicit mismatch confirmation, and no
  Equipment-level preferred-unit field.
- Needs Repair requires overall problem context; Previously Noted requires no
  repeated text, and an explicit text-only reuse action may reduce typing.
- Unknown and future Equipment categories require explicit architecture
  approval and feature-owned template eligibility before selection. The
  Phase 23.3 enhancement stores an explicit unit on the checklist; no Equipment
  preferred-unit field is approved.
- Optional photo evidence remains checklist-owned and does not create a Defect
  or Daily Work Log record.
- No automatic Defect mutation exists in V1.
- Day View participation is feature-owned and implemented; Equipment timeline
  participation remains feature-owned and deferred.

### Still Unresolved

No product decision blocks Phase 23.4. Phase 23.5 remains implementation-gated
by an approved access-control boundary and by proving the selected image
processor's HEIC/HEIF support in the actual application container. These are
technical and security prerequisites, not unresolved checklist workflow.

## 29. Implementation Sequence

The architecture is Approved and the V1 foundation is implemented.

Recommended later sequence:

1. Data-model, V1 foundation, PostgreSQL validation, and feature-owned history
   filtering. (Implemented in Phase 21.4.)
2. Independent implementation audit, correction review, and repository
   acceptance. (Completed in Phase 21.)
3. Supersede the invalid standalone Work Truck Log premise and correct roadmap
   ownership. (Completed in Phase 23.2; see ADR-017.)
4. Amend this architecture for explicit meter units, optional checklist-level
   image evidence, and NAM save confirmation. (Completed in Phase 23.3.)
5. Implement explicit meter units and NAM save confirmation as Phase 23.4.
   (Completed.)
6. Implement photo storage and evidence management as Phase 23.5 only after its
   access and runtime prerequisites are satisfied.
7. Add the feature-owned Day View contribution without moving checklist
   interpretation into Day View. (Completed in Phase 24.1.)
8. Optional Defect traceability only after separate approval.

## 30. Success Criteria

The accepted V1 implementation satisfies the approved architecture because:

- Area-oriented Daily Inspections and Equipment pre-shift checklists remain
  distinct records inside one bounded context.
- The canonical Dragline and Mobile V1 catalogs remain versioned source
  references for implementation.
- Equipment/category mapping and meter rules are deterministic.
- Complete-only persistence, uniqueness, correction, no-deletion, and
  problem-context rules are explicit and testable.
- Historical Equipment, template, item, response, and person-name display facts
  are preserved without duplicating complete reference records.
- The feature can work without Defect automation, Planner Review,
  authentication, or a generic checklist platform.
- Queries, mutations, UI, validation, and tests remain feature-owned.
- Day View and Equipment Activity Timeline boundaries remain composition-only.

## 31. Meter UI And Correction Architecture

The form labels should be `Starting Meter Reading` and `Starting Meter Unit`.
Because the unit set contains two short mutually exclusive values, an accessible
segmented control or radio group is preferred over a select. Each option must
expose the full visible label `Hours` or `Miles`; color alone cannot communicate
selection.

The reading uses a numeric input with whole-number stepping, numeric mobile
keyboard hints, and visible `0` through `999999` guidance. Client interaction
may suggest a default and show immediate validation, but Zod and the Server
Action remain authoritative for unit membership, integer/range checks, and
mismatch confirmation.

For Tractor, Forklift, and any future eligible category without confirmed
evidence, neither unit is preselected. The user must make the explicit choice.
Known-category mismatch guidance should name the expected default and require a
separate confirmation control before save. It must remain usable by keyboard
and screen readers and must not rely on a transient toast.

Correction may change the meter value or unit. A changed known-category
mismatch requires confirmation; an unchanged historical mismatch does not.
Changing Equipment clears the unit, reading, answers, and Problem Description,
then reapplies only the safe editable default for the replacement Equipment.

## 32. Meter Migration Architecture

Phase 23.4 uses one additive migration that appends `MILES` to the
existing PostgreSQL `OperationalSafetyChecklistMeterKind` enum. The existing
required `meterKind` and integer `startingMeter` columns remain in place. No
backfill statement and no Equipment-category rewrite are required: every
existing row already represents the historical `HOURS` value entered under the
Phase 21 architecture and must remain `HOURS`.

The reviewed development database contained zero checklist rows on 2026-07-16,
but migration correctness does not depend on that count. Other environments may
contain historical rows, and the additive enum change preserves them without a
table rewrite. Phase 23.4 regenerated Prisma Client and applied the additive
meter migration.
PostgreSQL enum-value removal is not a safe routine rollback after `MILES` data
exists; recovery should use a pre-migration backup or a forward correction.

Phase 23.4.2 adds a separate additive migration for required internal
`recordVersion Int @default(1)` metadata. Existing and new rows begin at version
one. Every successful correction atomically increments the parent version in
the same transaction as response replacement and the rest of the aggregate
write. Failed corrections do not increment it. This field is not editable and
is not an audit log; it provides monotonic supersession for short-lived save
result markers.

## 33. Photo Evidence Domain Model

Phase 23.5 may add one feature-owned child concept,
`OperationalSafetyChecklistPhoto`. It is not a generic attachment model.

Required conceptual fields:

- Durable photo ID and required checklist parent ID.
- Opaque unique normalized-image storage key and unique thumbnail storage key.
- Sanitized original filename snapshot for display only, maximum 255
  characters.
- Detected source MIME type, source byte size, normalized stored MIME type, and
  normalized full-image byte size.
- Thumbnail byte size.
- Normalized pixel width and pixel height.
- Optional caption, maximum 500 characters.
- Deterministic display sequence beginning at one.
- SHA-256 checksum of normalized image bytes.
- Created/uploaded timestamp.

The normalized image key is the primary storage key; a separate original-file
or normalized-file key is unnecessary because original device bytes are not
retained. The parent owns photo metadata. Parent plus sequence and parent plus
checksum should be unique, storage keys should be globally unique, and the
parent/sequence lookup should be indexed. Parent deletion may cascade to owned
metadata for administrative cleanup, but normal checklist deletion remains
unavailable and filesystem cleanup still requires compensation.

Historical detail renders photos by stored sequence. Caption updates, reorder,
and removal are explicit checklist-owned operations. A missing file must render
an unavailable-evidence state without making the checklist or its responses
unreadable.

## 34. Photo Limits And Image Normalization

Approved V1 guards are:

- Maximum 6 photos per checklist.
- Maximum 15 MiB source file per photo and 60 MiB aggregate accepted source
  bytes per checklist.
- Maximum 5 MiB per normalized full image and 30 MiB aggregate normalized
  full-image bytes per checklist.
- Thumbnails are excluded from the full-image aggregate. Each thumbnail is at
  most 512 KiB, and thumbnail bytes total at most 3 MiB for six photos.
- Caption maximum 500 characters.
- JPEG, PNG, WebP, HEIC, and HEIF source formats only.
- Maximum 16,384 pixels on either dimension and 50 megapixels decoded area.
- Decode and preserve only the primary still image. Auxiliary images, embedded
  thumbnails, depth maps, gain maps, and other non-primary auxiliary content
  are ignored and stripped. True image sequences, animations, and timed or
  multi-frame media are rejected.
- SVG and every non-image format are rejected.

Every per-file and aggregate source, normalized full-image, and thumbnail limit
is enforced server-side. Client checks are interaction guidance only.

Declared MIME type and extension are hints only. The server must inspect magic
bytes, successfully decode the image with bounded resources, and normalize the
detected MIME type. Original filenames are display metadata only: path
components and control characters are removed, and the value never becomes a
filesystem path.

The server processing pipeline should:

1. Decode the primary still image, including HEIC/HEIF on the server rather
   than assuming device or browser conversion.
2. Apply embedded orientation.
3. Ignore and strip auxiliary images and reject true sequences or timed media.
4. Convert color output to sRGB.
5. Strip all EXIF and other device metadata, including GPS.
6. Resize the full image to a maximum 2,560-pixel long edge while preserving
   aspect ratio and sufficient operational detail.
7. Encode a nonanimated WebP full image at quality 88.
8. Encode a WebP thumbnail with a maximum 480-pixel long edge.
9. Verify source, full-image, thumbnail, and aggregate byte limits separately,
   then compute SHA-256 before final persistence.

The concrete processor must be pinned and proven against JPEG, PNG, WebP,
HEIC, and HEIF in the actual Docker image before Phase 23.5 is enabled. That
proof must cover primary-image selection, auxiliary-content handling, sequence
rejection, codec availability, and processor licensing and redistribution
compatibility. Decode timeouts, bounded concurrency, pixel limits, and
request-size limits protect against decompression and processing denial of
service. A duplicate normalized checksum within one checklist is rejected or
safely returns the existing photo.

## 35. Private Storage Architecture

ADR-018 approves a private persistent Docker volume for the current single-node
deployment. The future application mount is `/var/lib/nam/media`; implementation
must provision it for the non-root application runtime user.

Feature-owned storage uses these conceptual paths beneath that mount:

```text
staging/<upload-id>/
operational-safety-checklists/<checklist-id>/<photo-id>/image.webp
operational-safety-checklists/<checklist-id>/<photo-id>/thumbnail.webp
trash/<removal-id>/
```

All path components are server-generated IDs. Staging and final files remain on
the same volume to permit atomic rename. The application uses a narrow
checklist-photo storage adapter so a future migration can copy and checksum
objects into private object storage without changing the checklist domain.
There is no Tank-style catalog, public static directory, or generic attachment
repository.

Staging uploads older than 24 hours are eligible for cleanup. Removed files and
unclassified orphans remain quarantined for 7 days before deletion. An orphan
reconciliation command is required. Reconciliation
must distinguish database rows missing files, files missing rows, active
staging uploads, and removal trash before deleting anything. PostgreSQL binary
storage is rejected because it would inflate the operational database and its
backups. Private object storage remains a future scale/durability option rather
than a Phase 23.5 prerequisite.

## 36. Security And Access Gate

Photo architecture and metadata may be approved now, but real workplace-photo
upload or serving must not be enabled until one of these boundaries protects
every read and mutation:

1. Application authentication plus authorization that verifies access to the
   parent checklist; or
2. A separately documented and approved deny-by-default network or
   reverse-proxy boundary that limits the application to trusted users and
   devices, such as a private VPN or authenticated proxy.

ADR-019 selects the second boundary for the controlled pilot, with Tailscale as
the managed private-overlay implementation reference. Architecture approval is
not gate completion. Real photo routes remain disabled until the overlay is
implemented, deny-by-default grants and device approval are verified, and no
public Caddy, DNS, IPv4, IPv6, Funnel, or other bypass remains. Tailscale
controls network reachability; it does not provide checklist-level application
authorization.

TLS, an Internet-facing Caddy hostname, client-side hiding, `robots.txt`, and
unpredictable media URLs do not satisfy this gate. Loopback-only development
with synthetic, non-sensitive fixtures is permitted. Photo routes may be built
behind a disabled capability flag, but they must fail closed in deployments
that do not meet the gate.

Media must be served through application-owned routes after parent-access
validation. Routes never accept raw storage paths. Responses use the detected
normalized `image/webp` type, `X-Content-Type-Options: nosniff`, sanitized
inline `Content-Disposition`, and an initially private/no-store cache policy.
Uploads need body-size limits, processing concurrency and time bounds, count and
quota checks, user-safe errors, and logs that omit image bytes, original paths,
GPS data, and access secrets. Random identifiers are defense in depth, not
authorization.

## 37. Upload, Correction, And Cleanup Workflow

Checklist creation remains completed-only:

1. Save the completed checklist.
2. Redirect to detail with the NAM success confirmation.
3. Offer `Add Photo Evidence` only when the photo capability and access gate are
   enabled.
4. Upload and manage photos through dedicated checklist-owned actions.

One photo is normalized and committed atomically from the user's perspective;
a multi-photo UI may queue those operations and show each result independently.
The client should show per-file pending/progress, success, retry, and error
states and upload one file at a time by default for mobile reliability. A failed
file does not roll back an earlier successful file, and the operator can retry
without resubmitting the completed checklist.
The server writes the bounded source to staging, validates and normalizes it,
locks/revalidates the parent and count, places normalized files using atomic
rename, inserts metadata in a PostgreSQL transaction, and removes staging.
Database failure removes newly placed files. Final-move failure rolls back
metadata. Crash leftovers are handled by age-aware staging and orphan
reconciliation. Retry is idempotent through parent/checksum uniqueness.

Concurrent uploads must serialize count and next-sequence allocation for one
checklist. Reordering persists a complete contiguous sequence. Removal requires
explicit confirmation, moves files to trash, deletes metadata transactionally,
restores files if the database operation fails, and finalizes deletion after
commit. There is no silent bulk removal and no Draft lifecycle.

Meter value/unit, date, shift, responses, Problem Description, captions, order,
and individual photos may be corrected while the checklist remains Completed.
Photos may remain through corrections that keep the same Equipment. An
Equipment identity change is blocked until the operator manually removes all
photos; after removal, the existing Equipment-change reset and snapshot rules
apply. This is safer and simpler than carrying evidence to another machine or
performing an implicit compensating bulk delete.

## 38. NAM Save Confirmation And Create Another

Create and correction use Post/Redirect/Get to the server-rendered detail page
with a short-lived, server-signed presentation marker. Its signed payload binds
the supported result (`created` or `corrected`) to the checklist ID, persisted
`recordVersion`, issuance time, and expiration no more than five minutes after
issuance. `updatedAt` remains ordinary record metadata and is not the marker
supersession authority. Only a successful Server Action persistence
transaction may produce the marker. Failed mutations remain on the form with
validation or persistence feedback and never redirect with a success marker.
Every successful correction increments `recordVersion` atomically, so a marker
from an earlier correction no longer verifies against current persisted state.

The detail route validates the signature, checklist binding, current persisted
version, expiration, and exact supported result before rendering either message:

- `Checklist saved in NAM Dashboard.`
- `Checklist correction saved in NAM Dashboard.`

Unknown, malformed, manually invented, expired, unsupported, incorrectly bound,
or superseded markers render no success banner. The marker is presentation
evidence that NAM persistence completed; it is neither authorization evidence
nor proof of corporate website submission.

The banner uses an accessible status role and visible success treatment. Any
animation is lightweight, nonessential, and disabled by reduced-motion
preferences. After the server-rendered banner is established, a minimal client
enhancement marks that page state consumed, removes the marker from the visible
URL with `history.replaceState`, and hides the banner on a consumed BFCache
restoration. Refresh after URL replacement and later back navigation therefore
cannot recreate the banner from an already-consumed URL. No session, flash
message, cookie, or authentication system is introduced solely for this flow;
the signing material is server-only configuration used only to validate the
short-lived presentation marker.

Checklist persistence is authoritative once its database transaction commits.
Path revalidation and marker creation are nonessential post-commit presentation
work. If either fails, including because the signing secret is missing or
invalid, the action logs a safe server-side diagnostic and redirects to the
saved checklist detail without a marker or banner. It must not report the
completed database mutation as failed, encourage resubmission, or emit an
unsigned marker. Actual validation and persistence failures still remain on the
form and do not redirect as successful work.

Submission controls disable while pending, while server validation and the
database uniqueness rule remain the duplicate-submission authority. The detail
page provides `View inspection`, `Create another inspection`, and, only when
enabled, `Add photo evidence`. None of the wording claims that the corporate
website received, accepted, or changed a submission.

`Create another inspection` should reference the saved checklist by ID and let
the server prefill only operational date, shift, operator, and supervisor.
Equipment and derived Mine, meter kind, reading, answers, Problem Description,
and photos start empty. This supports a Dragline-plus-truck-plus-tractor shift
without carrying machine-specific inspection facts forward.

## 39. Backup And Recovery Boundary

Photo backup is a coordinated database-and-media maintenance set, not an atomic
cross-system transaction. While photo mutations are paused, operations should:

1. Record a backup-set identifier and current migration state.
2. Create the PostgreSQL backup.
3. Archive the read-only media volume with a manifest of storage keys, sizes,
   and SHA-256 checksums.
4. Store both artifacts outside the repository under the documented backup
   root and verify them before resuming mutations.

Restore occurs with the application stopped: restore PostgreSQL first, restore
the matching media archive second, run checksum and missing/orphan
reconciliation, and then enable the application. Missing files render an
unavailable-evidence state and integrity warning rather than breaking the
checklist. Orphans are quarantined and removed only after a grace period.

The media backup location should be `/home/alain/backups/nam/media/`, alongside
the existing PostgreSQL backup root. Database and media artifacts should share
retention identifiers. Named volumes survive container replacement but not
explicit volume deletion or host loss. Future production use requires
encrypted off-host copies, retention policy, and regular restore testing.
Live evidence has no automatic age-based expiry and remains with its checklist
until explicit removal. Backup sets must not expire database and media halves
independently; automated backup retention remains an infrastructure decision
that Phase 23.5 must document before production enablement.

## 40. Enhancement Testing Architecture

Phase 23.4 and the Phase 23.4.2 acceptance corrections implement:

- Unit tests for `HOURS`/`MILES`, integer/range validation, defaults, unknown
  categories, mismatch confirmation, Equipment reset, legacy `HOURS`, no
  continuity rule, and overnight operational date.
- Component and route tests for the accessible unit control, warning and
  confirmation behavior, valid create and correction markers, invalid,
  expired, unsupported, and directly constructed markers, marker consumption,
  BFCache `pageshow` handling, and Create Another field clearing. URL cleanup
  and BFCache behavior have component-level coverage; full browser refresh and
  back-navigation E2E remain deferred.
- Server Action and PostgreSQL tests for enum persistence, correction,
  Equipment-change reset, historical snapshots, uniqueness, existing `HOURS`
  compatibility, `recordVersion` defaults and atomic increments, rollback, and
  safe bare-detail fallback after post-commit presentation failure.
- Pending-submit disabling and reduced-motion styling are implemented UI
  behavior. They are not described as full browser-navigation E2E evidence.

Phase 23.5 requires:

- Unit tests for magic-byte/MIME detection, limits, keys, caption and sequence
  validation, checksums, normalization, duplicate detection, EXIF/GPS removal,
  primary-image selection, auxiliary-content stripping, sequence rejection,
  orientation, resizing, and separate full-image/thumbnail accounting.
- Component and route tests for upload queues, per-file errors, captions,
  order, removal confirmation, missing media, access denial, serving headers,
  and blocked Equipment change.
- PostgreSQL tests for parent ownership, sequence/checksum uniqueness, cascade
  metadata cleanup, count enforcement, and transaction rollback.
- Filesystem integration tests for staging, atomic final placement, processor
  and database failures, cleanup, trash restoration, orphan reconciliation,
  and missing files.
- Runtime Docker smoke tests for JPEG, PNG, WebP, HEIC/HEIF decoding,
  primary-image selection, auxiliary-content handling, sequence rejection,
  codec availability and redistribution compatibility, runtime user
  permissions, volume persistence through container recreation, access
  fail-closed behavior, and backup/restore verification.

Broad browser E2E remains deferred unless implementation exposes a concrete
cross-route risk that narrower tests cannot protect.

## 41. Implementation Slices And Gates

### Phase 23.4: Meter Units And NAM Save Confirmation

Phase 23.4 is implemented. It includes one additive enum migration, explicit
unit UI and validation, editable defaults, mismatch confirmation,
correction/reset behavior, signed PRG success banners, safe Create Another
context, and focused tests. It does not include photo metadata, image packages,
storage, Docker media volumes, or media routes.

Phase 23.4.2 adds one separate additive `recordVersion` migration, monotonic
marker supersession, Compose parsing/build behavior that does not require the
runtime signing value, and bare-detail fallback when nonessential post-commit
presentation work fails. The Phase 23.4 meter migration remains unchanged.

### Phase 23.5: Photo Evidence Storage And Management

Phase 23.5 is architecture-approved but implementation-blocked until:

- The ADR-019 deny-by-default boundary is implemented and independently
  verified, satisfying the access portion of ADR-018.
- The selected pinned server image processor proves JPEG, PNG, WebP, HEIC, and
  HEIF primary-image selection, auxiliary-content handling, sequence rejection,
  codec availability, and licensing/redistribution compatibility in the actual
  Docker image within the approved resource bounds.
- The private volume permissions, backup-set procedure, restore verification,
  and orphan-reconciliation operating path are implementation-ready.

Once those gates close, Phase 23.5 may add one photo metadata migration,
processor dependency, private Docker volume, checklist-owned upload/manage/serve
actions and routes, backup documentation, and the tests in Section 40. It must
not become an authentication milestone or generic attachment platform.

## 42. Phase 23.3 Architecture Status

The enhancement architecture remains Approved. Meter units and NAM save
confirmation are implemented in Phase 23.4, with acceptance corrections in
Phase 23.4.2. Photo workflow, limits, metadata,
storage, cleanup, backup, and security policies are approved, but Phase 23.5
implementation and real workplace-photo use remain blocked by the explicit
prerequisites in Section 41. ADR-019 resolves the access architecture choice,
not its implementation or the remaining media prerequisites.

Day View participation is implemented separately in Phase 24.1. Equipment
Activity Timeline, explicit Defect linkage, Planner Review, external corporate
submission, authentication implementation, and a generic attachment system
remain outside this enhancement.
