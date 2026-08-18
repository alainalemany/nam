# Dragline Delay Reports Architecture

Status: Approved

Product Phase: Product Roadmap Phase 2 Shift And Safety Records; implementation
sequence DDR-1 through DDR-3

Primary Feature: Dragline Delay Reports

Depends On:

- Canonical Dragline Equipment, Mine, and City reference data
- Canonical Employee reference data
- Source closure for the official Dragline Delay Report and Delay Code Legend
- `docs/product-roadmap.md`
- `docs/delivery-architecture.md`
- `docs/dependency-architecture.md`
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`
- `docs/testing-strategy.md`

Related Documents:

- `docs/prd.md`
- `docs/modules.md`
- `docs/database.md`
- `docs/roadmap.md`
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/work-schedule.md`
- `docs/architecture/features/operational-safety-checklists.md`
- `docs/reference/README.md`

Last Reviewed: 2026-08-18

Implementation Status: Documentation and source-closure architecture is
approved. No Dragline Delay Report application persistence, Prisma model,
migration, route, action, component, or test exists. The official report front
and Delay Code Legend are not committed, so the official Delay Code catalog
must not be generated yet.

## 1. Purpose

Dragline Delay Reports preserve the structured operational record for one
Dragline, one operational work date, and one shift.

The report is opened near shift start, saved repeatedly throughout the shift,
and completed near shift end. It combines report context, a concurrent
operational timeline, production/progress facts, derived downtime/runtime, and
end-of-shift observations without replacing the operator's broader Daily Log.

This document is the Level 2 implementation authority for Dragline Delay
Reports. Product requirements remain canonical in `docs/prd.md`, module
behavior in `docs/modules.md`, data concepts in `docs/database.md`, and
implementation sequencing in `docs/roadmap.md`.

## 2. Classification

### Confirmed

- Daily Log and Dragline Delay Report are separate product concepts.
- Existing `DailyLog`, `DailyLogActivity`, and `ShiftReport` persistence and
  behavior remain unchanged during DDR implementation.
- One report belongs to one Dragline Equipment, one operational work date, and
  one Day or Night shift.
- Lifecycle is `DRAFT -> COMPLETED` with explicit post-completion correction.
- Delay codes come from a controlled, versioned, source-verified application
  catalog.
- Operators and supervisor use the canonical Employee model with report-owned
  historical snapshots.
- Downtime uses integer-minute interval-union semantics; runtime is 720 minutes
  minus unique downtime minutes.
- Station values have normalized numeric meaning and Advance is derived.
- No attachments, photos, Day View contribution, Daily Log redesign, or global
  shift redesign belongs to DDR-1 through DDR-3.

### Open Questions

- Exact Starting and Ending Hour Meter numeric precision.
- Exact Lake ID format.
- Exact Direction vocabulary.
- Whether reverse station movement and negative Advance are valid.
- Which end-of-shift fields are required before completion.
- Whether a future release should derive Ground Check times from timeline
  codes.
- Whether source evidence requires time precision finer than integer minutes.

These questions do not block documentation closure. They must not be answered
by guesswork during implementation.

### Deferred

- Daily Log redesign into a richer personal operational timeline.
- Dragline Delay Report contribution to Day View.
- Attachments, photos, or shared media infrastructure.
- Work Schedule-derived defaults or required schedule relationships.
- Approval workflow, planner review, or heavyweight generic revision systems.
- Automatic relationship to Equipment Fuel Events.
- Automatic Ground Check extraction from timeline entries.
- Analytics, exports, corporate submission, integrations, and global search.

## 3. Source-Artifact Closure

The intended durable source location is:

```text
source-forms/dragline-delay-report/
```

That directory must eventually contain both original authoritative artifacts:

- The Dragline Delay Report front/report artifact.
- The official Delay Code Legend artifact.

Neither artifact exists in the repository as of 2026-08-18. Do not fabricate
them, transcribe a catalog from memory, or infer missing codes and wording.

After both artifacts are committed, a source-verification pass must:

1. Visually inspect every relevant page or image.
2. Preserve exact official code values and descriptions.
3. Preserve the three official user-facing category names exactly:
   Operational, Mechanical, and Electrical.
4. Record catalog version identity and source provenance.
5. Create the source-derived reference catalog under the intended location:

```text
docs/reference/dragline-delay-reports/delay-code-catalog-v1.md
```

6. Implement the same verified version as a feature-owned application catalog,
   with tests proving code, description, category, ordering, and version.

Until that closure occurs, the official catalog and any persistence that
claims official Delay Code validity remain blocked.

## 4. Responsibilities

Dragline Delay Reports own:

- Stable report identity and `DRAFT`/`COMPLETED` lifecycle.
- One required Dragline Equipment/date/shift identity tuple.
- Equipment, Mine, and City historical display snapshots.
- Ordered operator participation and one supervisor relationship using
  canonical Employees plus report-owned snapshots.
- Starting and Ending Hour Meter report facts after source precision is
  verified.
- Ordered, stable operational timeline entries.
- Delay Code selection and historical catalog snapshots.
- Explicit per-entry downtime meaning.
- Server-authoritative downtime and runtime calculations.
- Production, progress, station, depth, fuel, cable, Ground Check, comment, and
  optional safety/action facts introduced in DDR-2.
- Explicit completion and correction behavior introduced in DDR-3.
- Optimistic concurrency, feature-owned validation, persistence, queries, UI,
  and tests.

## 5. Non-Responsibilities

Dragline Delay Reports do not own:

- Daily Log narrative, `DailyLog`, or `DailyLogActivity` lifecycle.
- Existing generic Shift Report workflow or Work Authorization parentage.
- Work Schedule assignments, schedule inference, or crew planning.
- Employee management or supervisor eligibility administration.
- Equipment, Mine, or City reference-data management.
- Timesheet Work Codes or Work Allocations.
- Equipment Fuel Event quantities or lifecycle.
- Operational Safety Checklist responses, meters, corrections, or photos.
- Day View composition.
- Attachments, photos, media storage, or a generic attachment platform.
- Approvals, corporate submission, authentication, or workforce management.

## 6. Aggregate And Identity

The aggregate root is one stable Dragline Delay Report.

Creation requires the identity tuple:

- One active Equipment classified as `DRAGLINE`.
- One date-only operational work date.
- One feature-accepted shift: `DAY` or `NIGHT`.

The combination `(equipment, operational work date, shift)` is unique. A
second report for the same tuple is rejected. Identity correction must recheck
that uniqueness.

The report keeps the same stable database identity through Draft saves,
completion, and correction. It has an integer `recordVersion` used for stale
write protection. Every successful aggregate mutation increments the version;
failed mutations do not.

The global `ShiftType` enum remains unchanged. DDR validation accepts only
`DAY` and `NIGHT`; it rejects `SWING`, `OTHER`, and `UNKNOWN` without removing
those values from other features. Historical paper Shift 1 means Day and paper
Shift 2 means Night. Paper Shift 3 is not modeled.

## 7. Equipment And Location Context

Equipment is the required operational anchor.

- New selection requires active Dragline Equipment.
- Mine and City are derived through `Equipment -> Mine -> City`; the operator
  does not independently select them.
- The report preserves limited server-generated snapshots: Equipment display
  name, number, category, Mine name, City name, and City state.
- Unchanged references retain their accepted snapshots during Draft edits and
  correction.
- An intentional Equipment change refreshes the complete Equipment/location
  snapshot group and rechecks uniqueness and Dragline eligibility.
- Historical detail remains readable if the live Equipment relationship later
  becomes unavailable.

## 8. Employee Participation

The existing canonical `Employee` model is the only approved people reference
source for report operators and supervisor. DDR must not create a second
people directory.

### Operators

- One report may have multiple operators.
- Operator participation is report-owned, ordered, and relational rather than
  a single text field.
- Each participant preserves sequence, a live Employee reference when
  available, and limited Employee display-name and employee-code snapshots.
- The same Employee cannot appear twice on one report.
- New choices use active Employees. An unchanged inactive historical choice
  may remain readable and correctable according to established reference-data
  behavior.

### Supervisor

- One report may reference one canonical Employee as supervisor.
- New selection requires an active Employee with existing supervisor
  eligibility (`isSupervisor`).
- The report preserves limited supervisor display-name and employee-code
  snapshots.
- Supervisor selection does not imply login, approval, or application action by
  that person.

Work Schedule may later offer convenience context, but no Work Schedule,
Weekly Schedule, or Daily Assignment is required to create, save, complete, or
correct a report.

## 9. Delay Code Catalog

The official Delay Code catalog is a controlled, versioned application
catalog. It is not:

- An editable administrator table.
- Timesheet Work Codes.
- A free-text category system.
- A list embedded only inside a React component.

The verified feature-owned catalog must define stable catalog version, official
code, exact official description, and one of exactly three display categories:

- Operational
- Mechanical
- Electrical

Catalog versions are append-only. Historical timeline entries preserve the
selected catalog version, code, exact description snapshot, and derived
category snapshot so later catalog changes do not rewrite report history.

The UI provides one searchable Delay Code selector. It groups choices by the
three official categories and searches code and description. Category is
derived from the selected code and is never a separate editable input.

## 10. Timeline Model

One report owns zero or more timeline entries while Draft. Completion rules for
minimum entry count remain part of the open completion-validation question.

Each saved entry has:

- Durable child identity.
- Stable display sequence used as the tie-breaker for equal start times.
- Actual local start time at integer-minute precision.
- Explicit operational day offset or a deterministic equivalent so after-
  midnight events remain ordered under the original report work date.
- One official Delay/Activity Code and its versioned snapshots.
- Description/context.
- Optional integer duration minutes when duration is applicable.
- Explicit `causesDowntime` meaning.

Multiple entries may share one start time. Equal start times are valid and do
not violate uniqueness. Concurrent activities remain separate child records.
Draft editing must preserve submitted child identities and reject unknown or
duplicated identities rather than replacing every timeline row destructively.

If `causesDowntime` is true, positive integer duration minutes are required.
If false, any recorded duration is excluded from machine downtime. Category
alone does not determine downtime, and concurrent non-downtime work never adds
stopped-machine time.

The data model must not require the operator to repeat a calendar date on every
entry. A representation such as local `HH:mm` plus an operational-day offset is
acceptable. For example, `23:50` on offset `0` sorts before `00:10` on offset
`1`, while both remain owned by the report's operational work date.

## 11. Downtime And Runtime

The normal report duration is 720 integer minutes.

Downtime is the union of all intervals whose entries explicitly cause machine
downtime. It is not the sum of all timeline durations.

Server-authoritative calculation:

1. Convert every downtime entry into a half-open normalized interval
   `[startMinute, startMinute + durationMinutes)`.
2. Sort intervals by start minute and then end minute.
3. Merge overlapping or touching intervals.
4. Sum the merged interval lengths once.
5. Persist or return the derived unique downtime minutes according to the
   implementation slice; never trust a client-entered total.
6. Derive runtime as `720 - downtimeMinutes`.

The derived result must remain within `0..720`. Invalid interval state must be
rejected rather than silently clipped or converted into a negative runtime.

Examples:

- Code 35 Startup Check and Code 36 Daily PM may begin together without
  creating duplicate timeline identity.
- A downtime-causing Code 26 Surveying interval may overlap non-downtime Code
  34 Other work. Only the stopped-machine interval contributes to downtime.
- Two overlapping downtime intervals contribute only their unique union.

Client-side previews may use the same pure helper for immediate feedback, but
the Server Action and persistence boundary recalculate the authoritative
values.

## 12. Station And Advance

Station input may use familiar notation such as `50+30`, but storage must
preserve normalized numeric meaning rather than opaque text alone.

Confirmed arithmetic:

```text
absolute feet = station number * 100 + offset feet
advance feet = ending absolute feet - starting absolute feet
```

Examples:

```text
50+30 = 5030 feet
50+60 = 5060 feet
Advance = 30 feet

50+90 = 5090 feet
51+20 = 5120 feet
Advance = 30 feet
```

The normalized representation must preserve station number and offset feet, or
an equivalent deterministic absolute-feet value. Offset is normally `00`
through `99`. The server derives Advance; the operator does not re-enter it.

Whether a negative result is valid is open. DDR-2 must not silently clamp,
reverse, or reject it without explicit validation closure.

## 13. Production And End-Of-Shift Facts

DDR-2 adds source-verified structured/manual fields:

- Normal Digging Buckets.
- Benchfill Buckets.
- Lake ID and Direction.
- Station Start and Station End, with derived Advance in feet.
- Derived Run Time and Down Time in minutes.
- Manual Depth in feet.
- Manual Fuel in gallons.
- Optional manual Cable Drag in feet cut off during a resocket.
- Optional manual Hoist in feet cut off during a resocket.
- Repeatable ordered Ground Check times.
- Comments.
- Optional Safety Items Found.
- Optional Action Taken.

Fuel is a report-level manual fact and remains independent from Equipment Fuel
Events. DDR-2 does not derive or synchronize either module.

Cable Drag and Hoist are simple optional numeric facts. Either, both, or neither
may be present. They do not create a resocket, maintenance, or cable-lifecycle
subsystem.

Depth is a manually entered numeric measurement in feet. It is not calculated
or derived from another feature.

## 14. Ground Checks

A Ground Check records when the operator physically leaves the Dragline to
inspect whether ground conditions allow safe continued dragging, including
cracking, crumbling toward or into the lake, unsafe deterioration, or an
acceptable condition.

The report owns a repeatable ordered list of Ground Check times. Storage must
support as many checks as occurred and must not reproduce a fixed number of
paper-form boxes. Overnight chronology uses the same deterministic day-offset
approach as timeline entries.

A Ground Check may also be represented by an appropriate official timeline
code after source verification. DDR-2 still records the end-of-shift Ground
Check list manually. No automatic derivation or synchronization from timeline
entries is approved.

## 15. Lifecycle, Completion, And Correction

Lifecycle is:

```text
DRAFT -> COMPLETED
```

### Draft

- A new report begins Draft.
- The operator may save and edit it repeatedly throughout the shift.
- Draft writes are atomic aggregate mutations and require the expected
  `recordVersion`.
- Draft identity requires Equipment, operational work date, and Day/Night
  shift. Other facts may remain incomplete until their completion rules are
  source-verified and approved.

### Completed

- Completion is an explicit Server Action, not a side effect of ordinary save.
- The server reloads the full aggregate, applies the approved completion
  validation, recalculates derived facts, and transitions atomically.
- Completed detail is read-only by default.
- An ordinary edit action cannot mutate a Completed report.

### Correct Report

- `Correct Report` is the only ordinary post-completion mutation workflow.
- Correction keeps the same stable report identity and remains `COMPLETED`.
- A nonblank correction reason is required.
- Correction validates the complete resulting aggregate, recalculates derived
  facts, checks the expected `recordVersion`, and writes atomically.
- Every successful correction appends an immutable lightweight correction
  event containing reason, correction timestamp, and from/to record versions.
- Correction history proves that a correction occurred without introducing
  full immutable aggregate versions, approval workflow, or generic audit
  infrastructure.

Exact DDR-2 completion requiredness must be closed before DDR-3 implements the
transition. It is intentionally not guessed in this architecture.

## 16. Data Flow And Mutation Boundaries

Dragline Delay Reports use server-owned persisted state.

Expected flow:

1. Server routes load report data and active Dragline/Employee choices.
2. The form owns temporary repeated-row interaction state.
3. Feature-owned Server Actions parse and validate the complete submitted
   aggregate with Zod.
4. The server reloads authoritative Equipment, Employee, and Delay Code data.
5. The server generates reference snapshots and recalculates normalized time,
   downtime, runtime, station, and Advance values applicable to the slice.
6. Prisma writes the root and owned children in one transaction.
7. The transaction uses expected `recordVersion` stale-write protection and
   increments the version exactly once on success.
8. Affected report list/detail/edit routes are revalidated and the action
   redirects to durable server-rendered state.

No API-first layer, global client state, generic report engine, generic
catalog administrator, or generic audit system is required.

## 17. UI Composition

Planned feature-owned surfaces:

- Report history.
- New Draft report.
- Draft detail/edit workspace.
- Completed read-only detail.
- Explicit Correct Report workflow and correction-event summary.
- Loading, empty, not-found, validation, stale-version, and persistence-error
  states.

The Draft workspace should group:

- Equipment, work date, shift, hour meters, operators, and supervisor.
- Chronological timeline with stable repeatable rows.
- Production/progress and station facts.
- Runtime/downtime summary.
- Ground Checks and end-of-shift notes.

The timeline code control is one searchable dropdown grouped by Operational,
Mechanical, and Electrical. It searches code and description, displays derived
category, and exposes no separate Category input.

Concurrent rows with equal start times must remain visible and independently
editable. Overnight presentation should communicate next-day chronology without
requiring repeated full calendar dates.

## 18. Validation And Error Handling

DDR-specific server validation includes:

- Required active Dragline Equipment for new selection.
- Real date-only operational work date.
- Shift restricted to `DAY` or `NIGHT`.
- Unique Equipment/date/shift identity.
- Existing active Employee choices for newly selected operators.
- Existing active supervisor-eligible Employee for a newly selected
  supervisor.
- Unique ordered operator participation.
- Official Delay Code membership in the submitted catalog version.
- No client authority over code description or category snapshots.
- Valid local start time, operational day offset, stable sequence, and child
  identity.
- Required positive integer duration for a downtime-causing entry.
- Interval-union result and runtime within `0..720`.
- Station notation parsing, offset normalization, and server-derived Advance.
- Expected `recordVersion` on every existing-report mutation.
- Draft-only ordinary editing and explicit completion/correction commands.
- Required correction reason and immutable correction event.

Source-dependent precision, Lake/Direction format, negative Advance, and final
completion-requiredness rules remain open and must be resolved before their
own implementation boundary is finalized.

Validation errors should map to the report section and repeated row where
practical. Stale writes should instruct the operator to reload and reconcile;
they must not silently overwrite newer saved work.

## 19. Testing Strategy

Testing follows `docs/testing-strategy.md` and the disposable-PostgreSQL safety
rules in `docs/development.md`.

### Pure Unit Tests

- `DAY`/`NIGHT` feature restriction without changing global `ShiftType`.
- Delay Code lookup, search text, derived category, version, and snapshots
  after source closure.
- Actual-time plus operational-day-offset normalization and overnight ordering.
- Equal-time deterministic sequence ordering.
- Half-open interval union for disjoint, overlapping, nested, touching, and
  concurrent downtime intervals.
- Exclusion of non-downtime duration from downtime.
- Runtime derivation from 720 minutes.
- Station parsing, normalized absolute feet, boundary crossing, and derived
  Advance.
- Employee/operator/supervisor selection validation.
- Open-field validation only after its rule is confirmed.

### Mutation And Persistence Tests

- Atomic Draft creation with root and ordered operators/timeline rows.
- Stable child identity across repeated Draft saves.
- Unknown, duplicate, or stolen child identity rejection.
- Equipment/date/shift uniqueness and concurrent first-save behavior.
- Reference snapshot preservation and intentional refresh behavior.
- Stale `recordVersion` rejection and one-version increment per successful
  mutation.
- Completion validation and read-only enforcement.
- Correction reason, same stable identity, correction event, and correction
  versus concurrent-edit races.
- Full rollback when any owned child or derived-value write fails.

### Route And Component Tests

- History, new, Draft edit/detail, Completed detail, and Correct Report states.
- Multiple ordered operators and supervisor eligibility.
- Searchable grouped Delay Code selection with no Category input.
- Concurrent equal-time timeline rows and overnight presentation.
- Derived downtime/runtime and station/Advance presentation.
- Repeatable Ground Check times.
- No Daily Log, Day View, attachment, or photo side effects.

Real PostgreSQL coverage should prove constraints, relations, transactions,
concurrency, rollback, snapshots, and correction-event durability. Browser E2E
remains proportional to an approved repository E2E foundation.

## 20. Implementation Sequence

### DDR-1 — Independent Draft Report Foundation

Target:

- Additive Dragline Delay Report persistence.
- Verified Delay Code catalog only after both source artifacts exist.
- Dragline Equipment context and snapshots.
- Canonical Employee operator/supervisor context and snapshots.
- Draft history, create, edit, and detail.
- Stable ordered timeline entries.
- Actual-time and overnight chronology.
- Deterministic integer-minute interval-union downtime calculation.
- Derived 720-minute runtime.
- Station parsing, normalization, and calculation helpers with focused tests.
- Optimistic stale-version protection for repeated Draft saves.

Exclusions:

- No Daily Log or existing Shift Report modification.
- No Day View participation.
- No attachments or photos.
- No global shift redesign.
- No production/end-of-shift completion surface beyond fields whose source
  precision is closed for this slice.

### DDR-2 — Production / Progress / End-of-Shift Completion

Target:

- Source-verified production and end-of-shift fields.
- Normal Digging and Benchfill Buckets.
- Lake ID and Direction.
- Station Start and End with derived Advance.
- Depth in feet.
- Fuel in gallons, independent from Equipment Fuel Events.
- Optional Cable Drag and Hoist in feet.
- Repeatable ordered Ground Check times.
- Comments, optional Safety Items Found, and optional Action Taken.
- Completion validation rules, once their requiredness is confirmed.

### DDR-3 — Completion / Correction

Target:

- Explicit `DRAFT -> COMPLETED` transition.
- Completed read-only state.
- Explicit Correct Report workflow.
- Required correction reason.
- Optimistic stale-version protection.
- Durable lightweight correction-event history.

Any Day View contribution requires separate product and architecture approval.
Future Daily Log redesign remains a separate future milestone.

## 21. Success Criteria

The architecture is successful when:

- A future implementation can build DDR-1 from repository truth without chat
  memory.
- Missing source artifacts fail closed instead of producing a guessed catalog.
- Report identity, Draft saves, stable timeline rows, concurrency, and
  overnight chronology are deterministic.
- Overlapping downtime is counted once and concurrent non-downtime work adds no
  downtime.
- Equipment and Employee references use canonical records while snapshots
  preserve history.
- Station and Advance calculations preserve normalized numeric meaning.
- Completed reports are read-only except through explicit reasoned correction.
- Daily Logs, Shift Reports, Work Schedule, Equipment Fuel Events, Operational
  Safety Checklists, Day View, and media remain independent.
