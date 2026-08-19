# Dragline Delay Reports Architecture

Status: Approved

Product Phase: Product Roadmap Phase 2 Shift And Safety Records; implementation
sequence DDR-1 through DDR-3

Primary Feature: Dragline Delay Reports

Depends On:

- Canonical Dragline Equipment, Mine, and City reference data
- Canonical Employee reference data
- Verified Dragline Delay Report source artifacts and Delay Code Catalog V1
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
- `docs/reference/dragline-delay-reports/delay-code-catalog-v1.md`

Last Reviewed: 2026-08-19

Implementation Status: DDR-1 through DDR-3 are implemented as an independent
usable Draft, completion, and correction workflow. The aggregate includes
canonical references, production/progress facts, normalized calculations,
stable repeated children, explicit completion, Completed read-only detail,
reasoned correction history, optimistic concurrency, complete failure-state
preservation, and explicit mutation feedback.

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
- Starting and Ending Hour Meter values are nonnegative whole numbers. Starting
  is required in Draft; Ending may remain blank while Draft.
- Station values have normalized numeric meaning and Advance is derived.
- Lake is canonical Mine-owned reference data; DDR exposes no Direction field.
- Advance is the absolute distance between normalized Station Start and End,
  regardless of increasing or decreasing station order.
- No attachments, photos, Day View contribution, Daily Log redesign, or global
  shift redesign belongs to DDR-1 through DDR-3.

### Open Questions

- Whether a future release should derive Ground Check times from timeline
  codes.
- Whether source evidence requires time precision finer than integer minutes.

These questions do not block the implemented lifecycle and must not be answered
by guesswork during future work.

### Deferred

- Daily Log redesign into a richer personal operational timeline.
- Dragline Delay Report contribution to Day View.
- Attachments, photos, or shared media infrastructure.
- Work Schedule-derived defaults or required schedule relationships.
- Approval workflow, planner review, or heavyweight generic revision systems.
- Automatic relationship to Equipment Fuel Events.
- Automatic Ground Check extraction from timeline entries.
- Analytics, exports, corporate submission, integrations, and global search.

## 3. Source Verification

The two authoritative source images are preserved at:

- [Dragline Delay Report front](../../../source-forms/dragline-delay-report/01-dragline-delay-report-front.jpg)
- [Official Delay Code Legend](../../../source-forms/dragline-delay-report/02-delay-code-legend.jpg)

Both images were visually verified on 2026-08-18. The legend's exact 66-entry
transcription is canonical only in the
[Dragline Delay Code Catalog V1](../../reference/dragline-delay-reports/delay-code-catalog-v1.md):
28 Operational, 23 Mechanical, and 15 Electrical codes. All visible legend
entries are readable. Numeric gaps are preserved and must not be filled.

### Source-Visible Report Wording

| Product concept | Exact visible source wording | Verification note |
| --- | --- | --- |
| Equipment | `Equipo #` | Printed in the report title area. |
| Shift | `TURNO: 1 - 2 - 3 (ESCOJA UNA)` | Paper numbering is visible; NAM still accepts only Day and Night. |
| Date | `FECHA:` | Printed in the header. |
| Starting Hour Meter | `INICIAR EL MEDIDOR DE HORA:` | One printed meter line is visible. |
| Ending Hour Meter | No separate printed label | A handwritten whole-number pair appears on the meter line, but the second value is not separately labeled. |
| Timeline columns | `HORA`, `CODIGO`, `DESCRIPCION`, `TIEMPO DE RETARDO`; the second time block uses `TIME` | Paper rows use ten-minute increments. |
| Normal Digging Buckets | `CUBOS DE EXCAVACIÓN NORMALES` | Printed production field. |
| Benchfill Buckets | `CUBOS DE BENCHFILL` | Printed production field. |
| Lake ID / Direction | `IDENTIFICACION Y DIRECCION DEL LAGO` | One combined printed field; no format or controlled vocabulary is stated. |
| Operators | `OPERADOR 1:`, `OPERADOR 2:` | Paper provides two lines; digital participation remains repeatable and ordered. |
| Supervisor | `SUPERVISOR:` | Printed person field. |
| Comments | `COMENTARIOS:` | Printed multiline area. |
| Station Start / End | `STATION START/END:` | One combined printed line. |
| Advance | `ADVANCE:` | Printed manual total on paper. |
| Run Time / Down Time | `RUN TIME:`, `DOWN TIME:` | Printed manual totals on paper. |
| Depth / Fuel | `DEPTH:`, `FUEL:` | No unit or numeric precision is printed. |
| Cable Drag / Hoist | `CABLE DRAG:`, `HOIST:` | No unit or numeric precision is printed. |
| Ground Check | `GROUND CHECK` | Paper provides fixed spaces with four visible handwritten times in this completed example. |
| Safety / action | `SAFETY ITEMS FOUND:`, `ACTION TAKEN:` | These headings appear below the code table on the legend artifact, not on the report-front image. |

The image does not independently establish Starting or Ending Hour Meter
precision. The completed example uses handwritten whole numbers, but the form
supplies no printed format, decimal marker, unit, or precision instruction and
does not separately label Ending Hour Meter. Confirmed digital product direction
nevertheless requires nonnegative whole numbers; that decision is not presented
as an inference from one handwritten example.

The completed example visibly uses station-style handwriting and handwritten
Depth, Fuel, delay durations, and Ground Check times. Those entries verify
operational use but do not create a reliable printed precision, format, or unit
rule. Confirmed digital units and calculations come from approved product
direction, not from otherwise unlabeled handwriting.

### Intentional Paper-To-Digital Differences

| Paper source | Approved digital model |
| --- | --- |
| Numbered Shift 1, 2, or 3 | Feature validation accepts `DAY` and `NIGHT` only; Shift 3 is not modeled. |
| Fixed ten-minute timeline rows | Entries use actual integer-minute start times and deterministic overnight chronology. |
| Two printed operator lines | Report-owned operator participation is repeatable and ordered. |
| Delay time is written in each row | Each entry has explicit downtime meaning; unique downtime uses interval union. |
| Run Time and Down Time are written on the report | Server-authoritative totals are derived; runtime is `720 - unique downtime`. |
| Station Start/End and Advance are written | The operator enters normalized Start/End values and NAM derives Advance. |
| Fixed Ground Check row | Ground Check times are a repeatable ordered digital list. |

Source-artifact and reference-catalog closure is complete. DDR-1 implements the
same verified catalog as a feature-owned application definition, with tests for
version, code, exact description, category, and ordering.

## 4. Responsibilities

Dragline Delay Reports own:

- Stable report identity and `DRAFT`/`COMPLETED` lifecycle.
- One required Dragline Equipment/date/shift identity tuple.
- Equipment, Mine, and City historical display snapshots.
- Ordered operator participation and one supervisor relationship using
  canonical Employees plus report-owned snapshots.
- Nonnegative whole-number Starting and Ending Hour Meter report facts, with
  Ending optional while Draft.
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
- Generic location management beyond the feature-owned minimal Lake reference.
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

Lake is a minimal canonical reference owned by Mine. DDR owns the small
list/create/edit/inactivate surface needed to maintain Lakes. New report
selection shows only active Lakes whose `mineId` matches the selected
Equipment's Mine. The root stores a nullable live Lake relation plus the
selected Lake display-name snapshot. The operator never selects Mine
independently, and DDR stores no Direction value.
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

One report owns zero or more timeline entries while Draft. Completion requires
at least one entry and requires the final normalized chronological entry to be
official Code 13 — Shift Change. Chronology sorts by `startMinuteOffset` and
then stable sequence; when rows share the final time, the highest-sequence row
must be Code 13.

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

The data model does not require the operator to repeat a calendar date on every
entry. DDR-1 stores an integer `startMinuteOffset` from operational-date
midnight. Day Shift is 05:00 through before 17:00 (`[300, 1020)`). Night Shift
is 17:00 through before 05:00 on the next calendar day (`[1020, 1740)`). For
example, `23:50` is 1430 and next-day `00:10` is 1450, while both remain owned
by the report's operational work date.

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

Advance is `abs(stationEndFeet - stationStartFeet)`. Both `50+30 -> 50+60`
and `50+60 -> 50+30` therefore produce 30 feet. Reverse station order is valid
input and does not create Direction semantics.

## 13. Production And End-Of-Shift Facts

DDR-2 implements source-verified structured/manual Draft fields:

- Normal Digging Buckets.
- Benchfill Buckets.
- Canonical Lake selected from the Equipment's Mine.
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

All DDR-2 fields remain optional while Draft except that Station Start and End
must be supplied as a valid pair when either is entered. Completion-requiredness
is deferred to DDR-3. Bucket and measurement storage uses nonnegative whole
units in the implemented schema.

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
- Completion requires Ending Hour Meter, at least one Operator, a Supervisor,
  a valid timeline, and final normalized Code 13 — Shift Change.
- Normal Digging Buckets, Benchfill Buckets, Lake, paired-or-blank Stations,
  Depth, Fuel, Cable Drag, Hoist, Ground Checks, Comments, Safety Items Found,
  and Action Taken remain optional.
- Code 13 does not complete a report automatically and is not required at an
  exact boundary minute beyond the normal shift-window rules.
- Successful completion records `completedAt` and increments `recordVersion`
  once.
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

The correction event stores no authenticated actor because the current
single-user application has no reliable authentication identity. It does not
store full aggregate snapshots or field-level diffs.

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

Implemented DDR-1 through DDR-3 feature-owned surfaces:

- Report history.
- New Draft report.
- Draft detail/edit workspace.
- Minimal Lake reference list/create/edit surface.
- Production, work-area/progress, operational-context, Ground Check, and
  closing-note Draft sections.
- Completed read-only detail.
- Explicit Correct Report workflow and ordered correction-event summary.

The DDR-1 Draft workspace groups:

- Equipment, work date, shift, hour meters, operators, and supervisor.
- Chronological timeline with stable repeatable rows.
- Runtime/downtime summary.

The Draft completion and Completed correction workspaces preserve every
controlled field, repeated child row, and Correction Reason when server
validation, stale-version checks, or persistence fails. Pending, error,
field-validation, stale-write, and successful mutation states are explicit;
raw database or framework errors are never shown.

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
- Required nonnegative whole-number Starting Hour Meter and optional
  nonnegative whole-number Ending Hour Meter while Draft.
- Official Delay Code membership in the submitted catalog version.
- No client authority over code description or category snapshots.
- Valid local start time, operational day offset, stable sequence, and child
  identity.
- Required positive integer duration for a downtime-causing entry.
- Interval-union result and runtime within `0..720`.
- Station notation parsing, offset normalization, and server-derived Advance.
- Optional Lake membership in the selected Equipment's Mine and active status
  for a newly selected Lake.
- Optional nonnegative bucket/measurement values and bounded closing text.
- Valid paired station inputs with absolute derived Advance.
- Ordered Ground Check identities and times within the report shift window.
- Expected `recordVersion` on every existing-report mutation.
- Draft-only ordinary editing and explicit completion/correction commands.
- Required correction reason and immutable correction event.
- Completion-only Ending Hour Meter and Supervisor requirements plus final
  chronological Code 13 — Shift Change using stable sequence as the equal-time
  tie-breaker.

Finer-than-minute time precision remains open. Completion-requiredness is
closed by the minimal implemented rule above; optional DDR-2 fields remain
optional.

Validation errors should map to the report section and repeated row where
practical. Stale writes should instruct the operator to reload and reconcile;
they must not silently overwrite newer saved work.

## 19. Testing Strategy

Testing follows `docs/testing-strategy.md` and the disposable-PostgreSQL safety
rules in `docs/development.md`.

### Pure Unit Tests

- `DAY`/`NIGHT` feature restriction without changing global `ShiftType`.
- Delay Code lookup, search text, derived category, version, and snapshots
  against the canonical V1 catalog.
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

Status: Implemented

Target:

- Additive Dragline Delay Report persistence.
- Verified Delay Code Catalog V1 as the application-owned source definition.
- Dragline Equipment context and snapshots.
- Canonical Employee operator/supervisor context and snapshots.
- Draft history, create, edit, and detail.
- Stable ordered timeline entries.
- Actual-time and overnight chronology.
- Deterministic integer-minute interval-union downtime calculation.
- Derived 720-minute runtime.
- Station parsing, normalization, and calculation helpers with focused tests.
- Optimistic stale-version protection for repeated Draft saves.
- Nonnegative whole-number Starting Hour Meter and optional Ending Hour Meter
  while Draft.

Exclusions:

- No Daily Log or existing Shift Report modification.
- No Day View participation.
- No attachments or photos.
- No global shift redesign.
- No decimal hour-meter storage or inferred precision.
- No production/end-of-shift completion surface.

### DDR-2 — Production / Progress / End-of-Shift Draft Entry

Status: Implemented

Target:

- Source-verified production and end-of-shift fields.
- Normal Digging and Benchfill Buckets.
- Canonical Mine-owned Lake reference and snapshot; no Direction field.
- Station Start and End with derived Advance.
- Depth in feet.
- Fuel in gallons, independent from Equipment Fuel Events.
- Optional Cable Drag and Hoist in feet.
- Repeatable ordered Ground Check times.
- Comments, optional Safety Items Found, and optional Action Taken.
- Complete Draft form-state preservation and clear mutation feedback.

Completion validation rules remain DDR-3 work once requiredness is confirmed.

### DDR-3 — Completion / Correction

Status: Implemented

Target:

- Explicit `DRAFT -> COMPLETED` transition.
- Completed read-only state.
- Explicit Correct Report workflow.
- Required correction reason.
- Optimistic stale-version protection.
- Durable lightweight correction-event history.
- Minimal completion requiredness and final chronological Code 13 validation.
- Completed timestamp and ordered reason/version correction summary.
- Complete failure-state preservation and clear lifecycle mutation feedback.

Any Day View contribution requires separate product and architecture approval.
Future Daily Log redesign remains a separate future milestone.

## 21. Success Criteria

The architecture is successful when:

- The implemented DDR-1 through DDR-3 workflow remains reproducible from
  repository truth without chat memory.
- The implemented catalog remains traceable to the canonical source-derived V1
  reference without invented codes or rewritten descriptions.
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
