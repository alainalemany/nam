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

Last Reviewed: 2026-07-16

Implementation Status: The V1 foundation is implemented with canonical
Dragline and Mobile code-owned templates, complete-only submission, explicit
completed-record correction, feature-owned history filtering, historical
snapshots, and PostgreSQL-backed persistence. The implementation and its
corrections have completed independent review with no remaining findings. Day
View, Equipment Activity Timeline, Defect linkage, Planner Review, and the
other deferred capabilities remain unimplemented. ADR-017 confirms that this
feature owns shift-start Mobile inspections for work trucks, tractors,
forklifts, and other supported mobile Equipment. Explicit `HOURS`/`MILES`
meter units, optional checklist-level image evidence with captions, and clear
NAM save confirmation are follow-up architecture work and are not implemented
by the current foundation.

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
- Complete-on-submit and explicit correction behavior.
- Feature-owned validation, queries, mutations, UI, filters, and tests.
- Historical template, item, response, person-name, and Equipment display
  snapshots.
- Future display-ready contributions to Day View and an Equipment Activity
  Timeline when separately approved.

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
- Image storage or serving in the current V1 foundation. Optional
  checklist-level image evidence is confirmed follow-up scope but requires an
  approved storage, privacy, backup, serving, cleanup, and correction
  architecture before implementation.
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

- One operational work date.
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

The implemented V1 catalogs use one meter kind:

- Operating hours.

The implemented foundation follows the canonical source field and currently
uses operating hours for both templates. That describes current persistence,
not a durable rule that every Mobile Equipment category uses Hours.

The checklist preserves an Equipment Meter Reading with the server-derived
meter-kind snapshot and integer starting value. The V1 Hour Meter value is
required, uses whole units only, and must be from `0` through `999999`
inclusive. The upper bound is an implementation validation guard rather than a
business limit. Decimal and floating-point Hour Meter values are invalid.

The two canonical V1 templates define `HOURS` as their feature-owned meter kind,
so Phase 21.4 does not add an Equipment-level meter-classification field. A
confirmed follow-up will add explicit `HOURS` and `MILES` checklist semantics
without changing the source catalogs. Any other unit still requires separate
operational evidence and architecture approval.

Confirmed follow-up architecture will replace the implicit single-unit
assumption with an explicit checklist meter unit of `HOURS` or `MILES`. Work
Truck may default to Miles and Dragline to Hours. Tractor and Forklift must not
receive a forced default until operational evidence confirms one. The selected
unit must remain explicit and historically preserved; no global odometer or
hour-meter continuity is required. This paragraph records product input for the
upcoming amendment and does not describe implemented behavior.

The selector and stored explicit unit will be NAM Dashboard metadata. They do
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
8. The action redirects to durable server-rendered detail state.

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

Future reads:

- Display-ready selected-date contribution for Day View.
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

## 23. Day View And Equipment Timeline Boundaries

Day View participation is deferred from the initial checklist foundation.

A future feature-owned date helper should return a display-ready summary with:

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

- A valid date-only operational date.
- A valid shift.
- Required existing Equipment at creation.
- An approved template key/version compatible with Equipment category.
- Server-derived Hours meter kind and a required integer starting value from
  `0` through `999999` inclusive.
- Required, nonblank operator and supervisor display-name snapshots.
- One response for each required item before persistence.
- No unknown or duplicate item responses.
- The allowed response set for every item.
- Needs Repair overall-description and Previously Noted no-repeat rules.
- Complete-only persistence, explicit correction, and no-deletion rules.
- One-record-per-Equipment/date/shift uniqueness.

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

Future multi-user access requires separate authentication, authorization,
privacy, and retention decisions.

## 27. Deferred Scope

Deferred capabilities include:

- Planner Review, planner identity, approval, and sign-off.
- Authentication, authorization, and workforce identity.
- User-configurable templates or a generic form builder.
- Automatic Defect creation or lifecycle mutation.
- Explicit response-to-Defect links until separately approved.
- Optional checklist-level image evidence with captions until storage, privacy,
  backup, serving, cleanup, and correction architecture is approved and
  implemented.
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
- Draglines use Hours and work trucks use Miles. Tractor and Forklift defaults
  remain unconfirmed and must not be inferred.
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
- The approved V1 Equipment mappings use a server-owned Hours meter kind,
  snapshotted with the integer reading.
- Needs Repair requires overall problem context; Previously Noted requires no
  repeated text, and an explicit text-only reuse action may reduce typing.
- Unknown and future Equipment categories require explicit architecture
  approval and feature-owned template eligibility before selection. The
  confirmed follow-up stores an explicit unit on the checklist; no Equipment
  preferred-unit field is approved yet.
- No automatic Defect mutation exists in V1.
- Day View and Equipment timeline participation remain feature-owned and
  deferred.

### Still Unresolved

None for the implemented V1 foundation. The separately confirmed meter-unit,
optional image-evidence, and NAM save-confirmation enhancements require an
architecture amendment before implementation.

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
   image evidence, and NAM save confirmation before implementation.
5. Day View participation only after separate approval.
6. Optional Defect traceability only after separate approval.

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
