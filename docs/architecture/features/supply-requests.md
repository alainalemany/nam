# Supply Requests Architecture

Status: Approved

Product Phase: Phase 26.2 — Supply Requests Feature Architecture

Review Status: Phase 26.2.1 independent review and Phase 26.2.2 formal
architecture acceptance complete

Primary Feature: Supply Requests

Bounded Context: Supply Requests

Depends On:

- Operations reference data for Equipment, Mine, and City context
- Existing Daily Work Log activity ownership
- Existing Day View composition boundary
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
- `docs/architecture/features/daily-work-logs.md`
- `docs/architecture/features/day-view.md`
- `docs/architecture/features/equipment-fuel-events.md`
- `docs/architecture/features/timesheets.md`

Last Reviewed: 2026-07-31

Implementation Status: Phases 26.3A through 26.9 are implemented and accepted.
Operators can record a request that was already submitted through the corporate
system by using searchable active Equipment, supervisor, and Supply Item
selection. Selected Supply Items support quantity editing, removal, and
deterministic ordering, and submitted local date and time default from
America/New_York.

Initial creation continues to use the sole accepted transactional
`createSupplyRequest(input)` boundary and redirects after commit to permanent
current detail. Current detail follows the explicit current-version pointer,
and immutable original version `1` is available read-only. Both surfaces render
snapshots first, including after Equipment SetNull. Initial creation never
creates a Daily Log, Activity, or link automatically.

Requested Supply Requests now expose explicit Fulfill and Cancel actions.
Both actions lock the stable root before loading current state, follow the
explicit current-version pointer, compare the expected current version, append
one complete immutable lifecycle version and ordered item-line set, and
atomically advance the same-owner current pointer. Existing versions and item
lines are never mutated. Parent snapshots and item lines copy exactly, so
inactive references and Equipment SetNull remain transitionable and original
Requested version `1` remains readable.

Lifecycle timestamps are captured automatically in America/New_York.
Fulfillment records a fulfillment operational work date and optional
Fulfillment Note. Cancellation records an optional Cancellation Reason in NAM
only and does not cancel or contact the corporate system. Fulfilled and
Cancelled are terminal for normal lifecycle actions.

Correct Request is available from Requested, Fulfilled, and Cancelled current
states. It edits NAM's historical record only and does not contact or modify
the corporate system. Correction requires an expected current version and a
permanent Correction Reason; corrected-by and correction local date/time are
server-owned. The transaction locks the stable root before authoritative
current-state reads and compares the expected version before resolving
replacement references. Every correction appends one complete immutable
`CORRECTED` version and complete ordered lines, then atomically advances the
same-owner current pointer. Existing versions and lines are never mutated.

Permanent NAM Reference, reference year, sequence, and requester identity never
change. Unchanged references, including inactive references, preserve their
snapshots. Deliberately changed references and newly added items require active
authoritative records. Equipment SetNull requires deliberate active Equipment
replacement. Retained items preserve snapshots while quantity and order may
change; removed items remain visible in older versions.

Correct Request may repair the resulting state to Requested, Fulfilled, or
Cancelled. Fulfilled-to-Requested and Cancelled-to-Requested are historical
corrections, not normal Reopen actions. Correction History lists every older
immutable version newest first, and general immutable version detail supports
every existing canonical positive version number. Presentation distinguishes
Original, Current, and Superseded versions while preserving status and change
kind as independent facts. Current detail and Correction History load from one
Repeatable Read snapshot.

`/supply-requests` is now the canonical Supply Request history route. It lists
each stable root exactly once by following the explicit current-version
pointer; superseded versions remain available through Correction History and
immutable version detail but are not separate canonical rows. Current rows
render immutable snapshots first. Null current pointers and malformed selected
current aggregates fail safely instead of appearing as empty results.

The supported URL parameters are exactly `dateFrom`, `dateTo`, `status`,
`equipmentId`, `supervisorId`, `reference`, `item`, `notes`, and `page`.
Repeated parameters use only the first value. Runtime values are narrowed
before string operations, and invalid values are ignored with bounded
nonfatal notices. Valid reversed date ranges remain preserved and intentionally
return no matches. Bounded unknown Equipment and supervisor IDs remain valid
filters, while NAM Reference matching is normalized and exact.

All independent filters use database-owned AND predicates against the same
pointer-owned current version. Item Number and Description search uses stored
current-version snapshots through one relational `some` predicate with one
line-local OR. Notes search uses current-version Notes only. Superseded item,
Notes, and reference facts do not match canonical history.

Equipment and supervisor options include active references plus inactive
references used by current versions; unused and superseded-only inactive
references are excluded. Equipment SetNull remains readable through snapshots
but creates no Equipment ID option. Unknown selected bounded IDs remain safely
representable without exposing the unknown ID as a label.

Canonical history uses fifty-row pages. Matching count occurs before row
retrieval, offset arithmetic is overflow-safe and server-only, and out-of-range
or huge safe pages do not issue unsafe Prisma row queries. Database ordering is
operational work date, submitted local date, submitted local time, NAM
Reference, and stable root ID, all descending. Previous and Next URLs preserve
normalized filters. Count, rows, Equipment options, and supervisor options load
from one Repeatable Read snapshot. Canonical history is read-only.

Supply Requests can now explicitly link existing Daily Log Activities for
Submission and Fulfillment. Daily Logs continue to own Daily Logs, Activities,
their narrative, and deliberate Activity deletion. Supply Requests own only
the stable-root link rows and explicit link, replacement, and removal
workflows. Daily Log Activities use the shared `SUPPLY_REQUEST`
classification; the role and exact server-derived canonical title distinguish
Submission from Fulfillment. A title alone never implies a link.

The database enforces one link per Supply Request role and one global Supply
Request link per Activity. Submission uses the pointer-owned current
operational work date. Fulfillment requires current resulting status
`FULFILLED`, including a corrected-to-Fulfilled current version, and uses the
fulfillment operational work date. The Activity and its parent Daily Log must
use the role date and the Activity must use the exact classification and
canonical title. Activity Equipment may be null or match current request
Equipment; Equipment SetNull requires an Equipment-null Activity.

Link create, replacement, and removal lock the stable root. Target Activity
facts are protected during compatibility validation, and expected-current-link
state prevents stale overwrites. Replacement validates completely before the
old link is deleted, and deletion plus creation are atomic. Removal deletes
only the link. Activity deletion cascades only its link; Daily Log deletion
cascades through owned Activities; exceptional Supply Request deletion removes
owned links while preserving Daily Logs and Activities.

Current detail loads both role summaries coherently with the current version
and Correction History. Linked Daily Log Activities display role, NAM
Reference, and a stable link to current Supply Request detail. Corrections and
Daily Log edits that would invalidate a link are rejected without silent
unlinking, automatic repair, or narrative rewriting. Daily Log Activity edits
also preserve existing Equipment Fuel Event compatibility.

The broader Supply Request workflow remains incomplete. Day View participation
is not implemented.

Acceptance evidence: 4 Phase 26.9 schema/migration tests, 14 Phase 26.9
validation/persistence unit tests, 7 Phase 26.9 Server Action tests, 5 Phase
26.9 query tests, 10 Phase 26.9 route/component tests, 12 Phase 26.9 PostgreSQL
tests, 8 Phase 26.8 PostgreSQL tests, 10 Phase 26.7 PostgreSQL tests, 12 Phase
26.6 PostgreSQL tests, 8 Phase 26.5 PostgreSQL tests, 6 Phase 26.4 PostgreSQL
tests, 11 Phase 26.3B PostgreSQL tests, 11 Phase 26.3A PostgreSQL tests, 8
existing PostgreSQL regression tests, 14 existing Daily Log tests, and the
full 746-test suite passed with zero skips, 18 disposable migrations, and no
schema drift.

## Contents

- [1. Status And Decision Classification](#1-status-and-decision-classification)
- [2. Purpose](#2-purpose)
- [3. Product Boundary](#3-product-boundary)
- [4. Confirmed V1 Scope](#4-confirmed-v1-scope)
- [5. Explicit Exclusions](#5-explicit-exclusions)
- [6. Related-Feature Ownership](#6-related-feature-ownership)
- [7. Aggregate And Conceptual Data Model](#7-aggregate-and-conceptual-data-model)
- [8. Supply Item Reference Architecture](#8-supply-item-reference-architecture)
- [9. Supervisor Reference Architecture](#9-supervisor-reference-architecture)
- [10. Request Identity And NAM Reference Architecture](#10-request-identity-and-nam-reference-architecture)
- [11. Requester Snapshot Architecture](#11-requester-snapshot-architecture)
- [12. Equipment Relationship And Snapshots](#12-equipment-relationship-and-snapshots)
- [13. Item-Line Ownership And Snapshots](#13-item-line-ownership-and-snapshots)
- [14. Dates And Local-Time Semantics](#14-dates-and-local-time-semantics)
- [15. Lifecycle](#15-lifecycle)
- [16. Fulfillment](#16-fulfillment)
- [17. Cancellation](#17-cancellation)
- [18. No-Deletion Rule](#18-no-deletion-rule)
- [19. Explicit Correction Workflow](#19-explicit-correction-workflow)
- [20. Full Correction-History Architecture](#20-full-correction-history-architecture)
- [21. Daily Work Log Relationship](#21-daily-work-log-relationship)
- [22. Day View Participation](#22-day-view-participation)
- [23. History Route And Filtering](#23-history-route-and-filtering)
- [24. Routes And UI Surfaces](#24-routes-and-ui-surfaces)
- [25. Server Action Ownership](#25-server-action-ownership)
- [26. Query Ownership](#26-query-ownership)
- [27. Validation](#27-validation)
- [28. Transactions And Concurrency](#28-transactions-and-concurrency)
- [29. Referential Integrity And Deletion Behavior](#29-referential-integrity-and-deletion-behavior)
- [30. Historical Preservation](#30-historical-preservation)
- [31. Empty States And Error Behavior](#31-empty-states-and-error-behavior)
- [32. Testing Strategy](#32-testing-strategy)
- [33. Security And Privacy Boundary](#33-security-and-privacy-boundary)
- [34. Deferred Enhancements](#34-deferred-enhancements)
- [35. Delivery Sequence](#35-delivery-sequence)
- [36. Architecture Invariants](#36-architecture-invariants)
- [37. Acceptance Criteria](#37-acceptance-criteria)

## 1. Status And Decision Classification

The product decisions represented here are Confirmed. The persistence,
transaction, route, query, and UI choices in this document are the Approved
architecture selected to satisfy those requirements. Independent review and
formal architecture acceptance are complete. Phases 26.3A through 26.8 are
implemented and accepted; every later implementation milestone still requires
separate explicit authorization.

Implementation guidance uses `should` where a repository-aligned technique may
be refined without changing the approved behavior. Deferred items are not V1
requirements and must not be implemented without separate product review.

## 2. Purpose

Supply Requests preserve the operator's personal historical record of requests
that were already submitted through the external corporate Supplies Request
system.

The feature should help the operator answer:

> What supplies did I submit through the corporate system, for which Equipment,
> under which supervisor, when did I submit the request, and what happened to
> it afterward?

NAM records the external submission fact. NAM does not perform or prove the
external submission. The dominant create action must use truthful language such
as `Record Submitted Request`, and the form must explain:

> This records the request in NAM and does not submit it to the warehouse.

## 3. Product Boundary

One Supply Request represents one dated corporate request occurrence for one
Equipment record. It owns one or more ordered Supply Request Item lines.

It is not a reusable list, warehouse order, purchase order, inventory record,
procurement transaction, or ERP transaction.

V1 assumes the operator's current South Warehouse workflow. `South Warehouse`
is an immutable feature-owned V1 display constant used for explanatory UI
context. It is not persisted, selected, related, or managed. Another warehouse
requires separate product review.

## 4. Confirmed V1 Scope

V1 includes:

- A permanent NAM-owned Supply Request identity and generated reference.
- One required active Equipment selection per new request.
- Automatic requester name and employee-number snapshots.
- One required active feature-owned supervisor reference and snapshots.
- A reusable active/inactive Supply Item Catalog.
- One through fifty ordered item lines with positive whole-number quantities.
- Item Number, Description, and Unit snapshots on every version line.
- Required operational work date and actual submission local date and time.
- Required confirmation that corporate submission succeeded before creation.
- `REQUESTED`, `FULFILLED`, and `CANCELLED` lifecycle states.
- Explicit fulfillment, cancellation, and correction workflows.
- Immutable relational versions sufficient to review every accepted state.
- Optional general Notes.
- Feature-owned structured history and pagination.
- Optional explicit Daily Work Log activity links for submission and
  fulfillment.
- One feature-owned Day View contribution on the request operational work date.
- Supply Item and supervisor management surfaces.

## 5. Explicit Exclusions

V1 excludes:

- NAM submission, email, approval, or mutation of the corporate system.
- Warehouse, inventory, stock, location, purchasing, procurement, vendor,
  price, receipt, and ERP models.
- Central Warehouse and warehouse selection or management.
- Spanish Description and item lines without an Item Number.
- The old corporate form's additional-items table or full catalog grid.
- Work Order, Work Authorization, Defect, and multi-Equipment relationships.
- Reuse of Timesheet-owned Work Orders.
- Selected, multi-selected, or free-text Work Order fields.
- Corporate request or confirmation numbers.
- Draft, Submitted, Partial Fulfillment, Completed, Reopened, or approval
  statuses.
- Requested, fulfilled, or outstanding quantities by receipt.
- Normal request deletion.
- Automatic Daily Log or Daily Log Activity creation.
- Generic audit, contribution, activity-event, or link registries.
- Attachments, photos, authentication, authorization, multi-user workflows,
  notifications, integrations, global search, analytics, exports, and reports.
- Kanban boards, warehouse dashboards, inventory screens, approval queues, and
  procurement workspaces.
- Infrastructure, deployment, operational-pilot, or private-access work.

## 6. Related-Feature Ownership

| Fact or behavior | Owner |
| --- | --- |
| Structured request, item lines, Equipment, supervisor, submission facts, lifecycle, versions, and links | Supply Requests |
| Equipment, Mine, and City current reference data | Operations reference data |
| Workday narrative, activity timing, travel, waiting, and pickup description | Daily Work Logs |
| Date-centered section composition and rendering | Day View |
| Payroll-allocation Work Codes and Work Orders | Timesheets |
| External submission and warehouse fulfillment | External corporate and warehouse processes, not NAM |

Supply Requests may reference a Daily Log Activity explicitly without taking
ownership of its narrative. Daily Logs must not infer or mutate a Supply
Request. Day View consumes a display-ready Supply Request contribution and owns
no Supply Request interpretation or mutation.

## 7. Aggregate And Conceptual Data Model

The selected architecture uses a stable identity plus immutable relational
versions.

### Supply Request

The aggregate root owns:

- Permanent database identity.
- Permanent NAM Reference, reference year, and annual sequence.
- A nullable-at-schema-level `currentVersionId` pointer to one immutable
  version. It may be null only while the initial aggregate transaction is in
  progress; no successful feature write may commit a root without a current
  version.
- All immutable versions.
- Zero through two role-specific Daily Log Activity links.
- Technical `createdAt` and `updatedAt` timestamps.

The root does not duplicate mutable current business fields. History, detail,
filtering, and Day View read the version identified by the current-version
pointer.

### Supply Request Version

Each version is a complete immutable representation of the accepted request
state after one successful aggregate mutation. It owns:

- Deterministic version number starting at `1`.
- Change kind: `CREATED`, `FULFILLED`, `CANCELLED`, or `CORRECTED`.
- Current lifecycle status for that version.
- Operational work date and actual submission local date and time.
- Equipment reference and limited Equipment/location snapshots.
- Requester name and employee-number snapshots.
- Supervisor reference, name snapshot, and email snapshot.
- Optional Notes.
- Fulfillment or cancellation facts required by the version status.
- Required correction reason when change kind is `CORRECTED`.
- Corrected-by snapshot and local correction date and time for corrections.
- A complete ordered set of version-owned item lines.
- A technical row-creation timestamp.

Versions are append-only. No normal action edits or deletes a version.

### Supply Request Version Item

Each item belongs to exactly one version and owns its sequence, Supply Item
reference, quantity, Item Number, derived normalized Item Number, Description,
and Unit snapshots.

### Supply Item

A feature-owned active/inactive catalog reference with Item Number,
normalized Item Number, Description, Unit, and technical timestamps.

### Supply Request Supervisor

A feature-owned active/inactive reference with full name, email address,
normalized email, and technical timestamps.

### Supply Request Reference Counter

One narrow counter row per submission calendar year owns the last allocated
annual sequence.

### Supply Request Daily Log Activity Link

A request-owned link associates one Supply Request and one Daily Log Activity
with exactly one role: `SUBMISSION` or `FULFILLMENT`.

### Conceptual Constraints And Indexes

| Concept | Required constraints and indexes |
| --- | --- |
| Supply Request | Unique NAM Reference; unique `(referenceYear, referenceSequence)`; compound unique `(currentVersionId, id)` for the one-to-one current relation; composite current-version ownership foreign key |
| Supply Request Version | Unique `(supplyRequestId, versionNumber)`; candidate unique key `(id, supplyRequestId)` for current-pointer ownership; indexes for operational work date, status, Equipment, supervisor, and submitted local date/time |
| Supply Request Version Item | Unique `(versionId, sequence)`; unique `(versionId, supplyItemId)`; index on Supply Item reference |
| Supply Item | Unique normalized Item Number; indexes for active state, display Item Number, and Description |
| Supply Request Supervisor | Unique normalized email; indexes for active state and full name |
| Reference Counter | Submission year primary or unique key |
| Daily Log Activity Link | Unique `(supplyRequestId, role)`; unique Daily Log Activity reference; index on Supply Request |

Initial V1 does not add full-text or trigram indexes for Item Description or
Notes. The current-version pointer and version ownership must be enforced so a
request cannot point at another request's version. Concretely, the root's
`(currentVersionId, id)` pair references the version candidate key
`(id, supplyRequestId)`. This composite foreign key is the ownership guard; a
plain foreign key to version identity is insufficient. Prisma relation names
must disambiguate the owned-versions and current-version relationships.

The nullable pointer breaks the insert cycle without a deferrable custom
constraint: create the root, append complete version `1` and its lines, then
set the pointer in one transaction. Nullability is a persistence accommodation,
not a product state. Feature reads treat a null pointer as an integrity fault,
and real PostgreSQL tests must prove that the only initial write boundary
cannot commit that state.

This relationship is expressible in the repository's current Prisma stack:
the root relation uses fields `(currentVersionId, id)`, the version exposes
candidate key `(id, supplyRequestId)`, and the matching compound unique on the
root satisfies one-to-one relation semantics. A separate standalone
`currentVersionId` unique constraint is unnecessary because the ownership
pair and unique root identity already prevent cross-request pointer reuse.

## 8. Supply Item Reference Architecture

Supply Items are managed inside the Supply Requests feature. They are not a
generic inventory or parts catalog.

Each record requires:

- Item Number: display value, `1` through `100` characters.
- Normalized Item Number: server-derived unique key.
- Description: `1` through `500` characters.
- Unit: user-facing label, `1` through `100` characters.
- Active/inactive state.

Normalization Unicode-trims the value, collapses every internal whitespace run
to one ASCII space, and applies locale-independent uppercase comparison.
Punctuation remains unchanged. The separately stored display value receives
the same trim and whitespace collapse but preserves the operator's letter case
and punctuation. Normalization must not merge otherwise distinct item numbers.

Management supports list, search, create, edit, activate, and inactivate.
Search matches Item Number or Description. There is no normal hard-delete
action. Reads never auto-create catalog records.

The initial catalog contains only commonly used items and grows gradually
through explicit catalog management. Importing or prepopulating a broad
corporate inventory catalog is outside V1.

The request form may expose an explicit `Add Supply Item` entry point. That
entry point creates a validated catalog record and then returns to the request
workflow. It must not create an ad hoc request line without a catalog record.

New requests and new or replacement lines in correction may use only active
items. An unchanged line may retain an inactive item reference and its original
snapshots. Editing a catalog record never rewrites request versions.

## 9. Supervisor Reference Architecture

Supply Request Supervisors are feature-owned references, not employees, users,
approvers, or workforce-directory records.

Each record requires:

- Full name: normalized display text, `1` through `200` characters.
- Email address: valid trimmed address with no internal whitespace, at most
  `320` characters.
- Normalized email: server-derived lowercase uniqueness key.
- Active/inactive state.

Full names are not unique. Normalized email is the entire validated, trimmed
address lowercased with locale-independent semantics; it is unique because
name-only uniqueness would merge distinct people. Display-name normalization
Unicode-trims and collapses whitespace to one ASCII space but is used for
display and search, not identity. The trimmed display email remains separate
from its normalized uniqueness key.

Management supports list, search, create, edit, activate, and inactivate.
There is no normal hard-delete action. Reads never auto-create supervisors.
The request form may expose an explicit `Add Supervisor` catalog-management
entry point.

Selecting a supervisor fills email read-only from server-owned data. New
requests and deliberate supervisor replacements require an active reference.
An unchanged inactive reference remains valid during correction. Later name or
email edits do not rewrite historical snapshots.

## 10. Request Identity And NAM Reference Architecture

The permanent reference format is:

```text
SR-YYYY-NNNN
```

`NNNN` is a minimum four-digit, zero-padded annual sequence. Values above 9999
expand rather than failing or wrapping. The reference year comes from the
actual corporate submission local calendar date, not the operational work date
or server timezone. Numbering resets for each submission year.

The aggregate root stores the reference year and sequence as separate
server-owned values and stores the formatted NAM Reference. The database must
enforce both:

- Unique NAM Reference.
- Unique `(referenceYear, referenceSequence)`.

Reference allocation uses one counter row per year. Inside the same database
transaction that creates the aggregate, one parameterized PostgreSQL
`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` statement inserts
sequence `1` or increments and returns the affected year's sequence. That
single statement supplies the required row-level serialization; it is the
narrow approved raw-SQL boundary because a read followed by an update would
not provide the same atomic allocation guarantee. The request, version `1`,
item lines, and current-version pointer then persist before commit.

`MAX + 1` over Supply Requests is prohibited. Client-generated references are
prohibited.

Concurrent creates for the same year serialize on the counter row. Creates for
different years may proceed independently. A transaction rollback also rolls
back its counter increment. Gaps remain acceptable after exceptional
administrative repair or deletion outside normal product behavior; references
are never reused and the feature does not promise gapless legal numbering.

Reference year, sequence, and formatted NAM Reference are fixed by initial
creation. Correcting the submitted local date, including changing its calendar
year, never regenerates those fields, moves the request to another counter, or
reuses the original number.

Deadlock, serialization, or allocator unique-conflict failures caused by a
recognized transient race receive at most three total full-transaction
attempts: the initial attempt plus two retries. Exhaustion returns a safe
retryable error and exposes no partial request or duplicate reference.

## 11. Requester Snapshot Architecture

Repository inspection found no canonical primary-employee configuration that
contains both the approved display name and employee number.

V1 therefore uses one explicit feature-owned server code-configuration module
within the future Supply Requests vertical slice:

- Requested by: `Alain Alemany`
- Employee number: `911601`

The typed immutable constant belongs to Supply Requests and must not be
silently duplicated in unrelated shared code. Environment variables are not
appropriate: these values are approved non-secret product defaults, and
deployment-specific overrides could silently change historical identity. This
module is not application-wide workforce configuration, an Employee record, a
User record, authentication identity, or an editable request-form field.

Both values are copied into every new version `1`. Later versions copy the
previous requester snapshots unchanged. A future configuration change affects
only newly created requests and cannot rewrite history. V1 correction does not
expose requester editing; exceptional identity repair remains administrative
database repair outside the normal UI. Pure validation and persistence tests
receive an explicit requester snapshot fixture or mock this feature module;
tests must not mutate process environment to replace the identity.

## 12. Equipment Relationship And Snapshots

Every request version references exactly one Equipment when created. New
requests require an existing active Equipment record. The operator selects
Equipment only; Mine and City are derived server-side.

Equipment belongs only to each complete immutable version. The stable root
does not duplicate an Equipment foreign key, so there is no competing current
Equipment owner; current Equipment is read through the current-version
pointer.

A real-world request concerning two Equipment records must be recorded as two
Supply Requests. V1 has no multi-Equipment join or shared item-line context.

The exact limited snapshot group is:

- Equipment display name.
- Equipment number.
- Equipment category.
- Mine name.
- City name.
- City state.

These are display facts, not copies of complete Equipment, Mine, or City
records.

When Equipment is unchanged during correction, the prior snapshots are copied
unchanged even if current reference data was renamed or inactivated. A
deliberate Equipment change requires an active replacement and refreshes the
entire snapshot group from server-owned reference data. It does not infer Mine
or City selections independently.

The live relation uses SetNull-style deletion behavior so unexpected Equipment
deletion cannot erase immutable request history. A version with a missing live
relation remains readable from snapshots. Correction of such a request
requires deliberate selection of an active Equipment replacement.

Display identity uses the following deterministic fallback:

1. Display name plus Equipment number when both exist and are not equivalent.
2. Display name when only a usable display name exists.
3. `Equipment <number>` when only Equipment number exists.
4. `Equipment unavailable` when neither snapshot is usable.

The request display label is:

```text
Supply Request — <equipment label> — <formatted operational work date>
```

It is derived, read-only, and never persisted as an editable title.

## 13. Item-Line Ownership And Snapshots

Every version contains between `1` and `50` ordered item lines. Fifty aligns
with existing bounded nested operational records while allowing a materially
larger request than the ten-line Fuel Event aggregate. It is a payload and
usability guard, not an inventory business limit.

Each line owns:

- Contiguous sequence starting at `1`.
- One Supply Item reference.
- Positive whole-number requested quantity from `1` through `999999`.
- Item Number snapshot.
- Server-derived normalized Item Number snapshot used only for historical
  lookup and duplicate defense.
- Description snapshot.
- Unit snapshot.

The same Supply Item may appear only once per version. Because Item Number is
globally normalized and unique in the catalog, this also prevents duplicate
Item Numbers in one request. Both application validation and database
uniqueness protect the rule.

The server canonicalizes sequence from submitted list order after validation.
The client cannot create gaps, duplicate sequence, or override Unit. Unit comes
from the selected Supply Item.

Unchanged item references copy prior snapshots during correction. Quantity and
sequence may change without refreshing snapshots. A deliberately added or
replacement item requires an active Supply Item and captures current catalog
snapshots. Removing an item affects only the new version; older version lines
remain immutable.

## 14. Dates And Local-Time Semantics

Supply Requests preserve business wall-clock facts separately from technical
timestamps.

| Fact | Conceptual representation | Meaning |
| --- | --- | --- |
| Operational work date | Date-only | Historical grouping, Day View, and submission Daily Log context |
| Submitted local date | Date-only | Actual corporate submission calendar date |
| Submitted local time | `HH:mm` string | Actual corporate submission local minute |
| Fulfilled operational work date | Date-only, nullable | Workday on which all supplies were received |
| Fulfilled local date and time | Date-only plus `HH:mm`, nullable | Actual local receipt-confirmation minute |
| Cancelled local date and time | Date-only plus `HH:mm`, nullable | Actual local cancellation-recording minute |
| Correction local date and time | Date-only plus `HH:mm` on correction version | Actual local correction minute |
| `createdAt`, `updatedAt` | Technical timestamps | Persistence chronology, not operational wall-clock facts |

Date-only fields use the repository's PostgreSQL date convention. Local times
use canonical minute-precision `HH:mm` strings. Forms submit local date and time
components directly. Browser or JavaScript UTC conversion must not shift their
meaning.

Operational work date may precede submitted local date for an overnight shift.
It is not inferred from submission time. Submitted date and time default to the
current America/New_York local wall clock on create but remain editable. The
default must come from one server-owned America/New_York wall-clock helper and
must not depend on the process, container, browser, or database session
timezone.

Wall-clock comparisons combine canonical local date and time strings in the
single approved operational timezone. Normal fulfillment and cancellation may
not predate submission. Fulfillment operational work date may equal or follow
the request operational work date. These rules do not require submission
calendar date to equal operational work date.

Normal fulfillment and cancellation action timestamps are captured
automatically and are not editable in those action forms. A `Correct Request`
version may repair them with a required reason. Correction local date/time is
always server-captured metadata for the correction itself and is not editable.
Technical timestamps remain database instants and never substitute for these
business wall-clock facts.

## 15. Lifecycle

Every persisted request begins as `REQUESTED`. There is no Draft.

Normal transitions are:

```text
REQUESTED -> FULFILLED
REQUESTED -> CANCELLED
```

`REQUESTED` means the operator confirmed that the real request was successfully
submitted through the corporate system and is now recorded in NAM.

`FULFILLED` means the operator personally confirmed that all requested supplies
were received.

`CANCELLED` means the externally submitted request is no longer needed or
should remain historically recorded as cancelled.

Fulfilled and Cancelled are terminal for normal lifecycle actions. There is no
ordinary Reopen. A status mistake is repaired only through `Correct Request`
with a required reason.

Every complete version obeys status-specific field invariants:

- `REQUESTED` has no fulfillment or cancellation facts.
- `FULFILLED` has fulfillment operational work date, fulfilled local date and
  time, optional Fulfillment Note, and no cancellation facts.
- `CANCELLED` has cancelled local date and time, optional Cancellation Reason,
  and no fulfillment facts.

Every normal lifecycle transition creates a new immutable complete version.
This preserves the original Requested version and the state before any later
correction.

## 16. Fulfillment

Fulfillment is an explicit action from `REQUESTED`.

The action:

- Automatically captures fulfilled local date and time.
- Defaults fulfillment operational work date to the request operational work
  date.
- Allows the operator to choose a later operational work date.
- Accepts an optional Fulfillment Note up to `1000` characters.
- Copies all other parent snapshots and every ordered item line unchanged.
- Creates the next immutable version with status `FULFILLED` and change kind
  `FULFILLED`.

Fulfillment remains separate even when submission and receipt occurred on the
same operational work date. V1 has no partial quantities or Partially Fulfilled
status. Partial receipt leaves the request Requested; context may be added to
Notes through explicit correction.

## 17. Cancellation

Cancellation is an explicit action from `REQUESTED`.

The action:

- Automatically captures cancelled local date and time.
- Accepts an optional Cancellation Reason up to `1000` characters.
- Copies all other parent snapshots and every ordered item line unchanged.
- Creates the next immutable version with status `CANCELLED` and change kind
  `CANCELLED`.

V1 does not store a separate cancellation operational work date. Cancellation
does not create a second Supply Request Day View contribution or an automatic
Daily Log Activity. The operator may describe operationally relevant
cancellation manually in a Daily Log.

Cancellation records a NAM lifecycle fact only. It does not cancel or mutate
the corporate request.

## 18. No-Deletion Rule

No standard route, button, or Server Action hard-deletes a Supply Request.
Cancellation replaces deletion for a request that is no longer needed.

There is no Draft-only deletion because there is no Draft state. Administrative
database repair is outside normal product behavior and must not be represented
as a V1 product workflow.

## 19. Explicit Correction Workflow

`Correct Request` edits NAM's historical record only. It does not resubmit,
email, reactivate, cancel, fulfill, or otherwise mutate the external request.

A correction:

1. Starts from the current immutable version.
2. Requires the expected current version number to prevent stale submission.
3. Requires a trimmed nonblank Correction Reason up to `1000` characters.
4. Revalidates the complete corrected aggregate.
5. Preserves unchanged references and snapshots.
6. Refreshes snapshots only for deliberately changed references.
7. Creates the next complete immutable version with change kind `CORRECTED`.
8. Records corrected by `Alain Alemany` and the automatic local correction date
   and time.
9. Atomically advances the aggregate's current-version pointer.

The reason belongs permanently to the correction version and cannot later be
blanked, changed, or removed.

Correction may repair status and lifecycle facts, including returning an
incorrectly Fulfilled or Cancelled request to Requested. The corrected version
must satisfy all invariants for its resulting status. This is not a Reopen
action.

Fulfilled and Cancelled requests are otherwise read-only. Catalog management
and Daily Log linking are separate explicit workflows.

## 20. Full Correction-History Architecture

The selected strategy is immutable version rows with one current-version
pointer.

Version `1` is created with the request and preserves the original Requested
state. Fulfillment, cancellation, and correction each append one complete
version instead of mutating an existing one. This is feature-owned relational
state-snapshot versioning, not generic audit infrastructure, event sourcing,
or JSON-only history. The current pointer is authoritative; current state is
not reconstructed by replaying change kinds or selecting an unguarded maximum
version number.

The database enforces unique `(supplyRequestId, versionNumber)`. Version numbers
are contiguous positive integers allocated while the aggregate root is locked.
The composite ownership foreign key prevents the current pointer from
referencing another aggregate's version. Pointer nullability exists only to
permit the initial insert sequence described in Section 7.

Every version includes complete parent facts and complete ordered item lines.
Therefore historical review does not depend on current Equipment, supervisor,
or Supply Item display values.

For correction versions:

- Correction Reason is required.
- Corrected-by snapshot is `Alain Alemany`.
- Correction local date and time are required and server-generated.

For lifecycle versions, change kind and the status-specific facts explain the
transition; Correction Reason is absent. A later correction of status,
fulfillment, cancellation, or timestamps creates another `CORRECTED` version
and leaves the mistaken lifecycle version visible.

Change kind describes why the version was appended; status describes the
accepted resulting state. A correction from Fulfilled back to Requested
therefore has change kind `CORRECTED`, status `REQUESTED`, and null fulfillment
and cancellation facts. The older mistaken Fulfilled version remains
reviewable. This distinction makes every current state deterministic without
turning lifecycle changes into a generic event stream.

The normal detail page renders only the current version as authoritative
current state. A Correction History section lists older versions newest first
with version number, change kind, status, local change time, and reason where
applicable. A version-detail route renders a complete read-only parent and
ordered-line snapshot. It must clearly label historical versions as superseded.

## 21. Daily Work Log Relationship

Supply Request creation never automatically creates a Daily Log or Activity.
Date alone must not select a Daily Log because the current schema does not
guarantee one Daily Log per date.

After create, the UI may offer `Add Submission to Daily Log`. After fulfillment,
it may offer `Add Fulfillment to Daily Log`. The operator must explicitly
select an existing Daily Log or navigate to create/open the intended Daily Log.

The narrow relationship is a feature-owned link record with:

- Required Supply Request foreign key.
- Required Daily Log Activity foreign key.
- Role `SUBMISSION` or `FULFILLMENT`.
- Unique `(supplyRequestId, role)`.
- Globally unique `dailyLogActivityId`.

This permits at most one activity per role, prevents an activity from serving
both roles, and prevents sharing one activity across requests.

A dedicated link record is narrower and safer than two nullable foreign keys
on Supply Request because one unique `dailyLogActivityId` constraint enforces
cross-role and cross-request Activity reuse prevention. The link belongs to the
stable request, not an immutable version, because linking is optional narrative
association rather than accepted structured request state.

Daily Log uses one new `SUPPLY_REQUEST` activity classification. Link role and
the activity title distinguish submission from fulfillment without expanding
the shared enum with two narrowly similar types. Daily Log history can search
the common classification, while the explicit link role and required
role-specific title keep the two facts understandable. The activity narrative
should be:

- `Submitted supply request <NAM Reference> for <Equipment label>.`
- `Received all supplies associated with <NAM Reference>.`

The activity provides a source link to the authoritative request through the
explicit link. It does not duplicate the item list.

Submission activity date and parent Daily Log operational date must match the
request operational work date. Fulfillment activity date and parent Daily Log
operational date must match the fulfillment operational work date. Fulfillment
linking requires a current Fulfilled version. An Activity's optional Equipment
must either be null or equal the current version's live Equipment reference. If
that live reference is null, only an Equipment-null Activity is eligible until
an explicit correction selects an active Equipment replacement. The same
Daily Log may contain both roles, but they must be different Activities.

Link creation, replacement, and removal are explicit request-owned actions.
Replacement atomically removes the old role link and creates the validated new
one. Deleting a Daily Log Activity cascades only its link row; the Supply
Request and versions remain unchanged. Deleting a Daily Log continues to own
and delete its activities, which consequently removes affected link rows.

The link action accepts an existing Activity; it does not create one
implicitly. In the assisted creation path, the operator first confirms a
Daily Log-owned Activity create, then the Supply Request action links the
result. If linking fails, the explicitly created narrative Activity remains
owned by Daily Logs and the UI offers retry, replacement, or removal; Supply
Requests must not delete it as rollback compensation.

Request correction never edits Daily Log content. A correction that would make
an existing role link invalid by date, status, or Equipment context must fail
with guidance to remove or replace that link first; it must not silently
mutate or unlink narrative history.

## 22. Day View Participation

Supply Requests contribute only the current version whose operational work date
equals the selected Day View date.

Fulfillment and cancellation do not create additional structured Supply Request
entries. A fulfillment Daily Log Activity may independently appear as Daily Log
narrative on its own date.

The feature-owned selected-date helper returns:

- NAM Reference.
- Derived Equipment label from snapshots.
- Current item count.
- Supervisor name snapshot.
- Current status label.
- Actual submission local date and time.
- Stable detail link.

It does not return the complete item list.

Ordering is deterministic and chronological:

1. Submitted local date ascending.
2. Submitted local time ascending.
3. NAM Reference ascending.
4. Database identity ascending.

Day View composes and renders this display-ready result. It does not query
Supply Request tables directly, infer status, count items, or format Equipment.

## 23. History Route And Filtering

`/supply-requests` is the canonical history route. It queries current versions
only; superseded versions are available through Correction History.

V1 parameters are:

| Parameter | Meaning |
| --- | --- |
| `dateFrom` | Inclusive operational work date lower bound |
| `dateTo` | Inclusive operational work date upper bound |
| `status` | Exact `REQUESTED`, `FULFILLED`, or `CANCELLED` |
| `equipmentId` | Exact live Equipment reference |
| `supervisorId` | Exact live supervisor reference |
| `reference` | Normalized exact NAM Reference |
| `item` | Item Number or Description snapshot lookup |
| `notes` | Notes text lookup |
| `page` | Positive one-based page number |

Parsing rules:

- For repeated parameters, only the first value is considered.
- Values are trimmed; blank values are absent.
- Dates accept only one real canonical Gregorian `YYYY-MM-DD` value.
- Status accepts only exact stable enum values.
- Page accepts only a positive safe integer and defaults to `1`.
- Equipment and supervisor IDs accept trimmed nonblank values through `100`
  characters. A syntactically bounded but nonexistent ID is a valid filter that
  returns no matches.
- Reference accepts at most `50` characters. Item and Notes search each accept
  at most `200` characters.
- Invalid values are ignored, a nonfatal notice is displayed, and normalized
  pagination URLs omit them.
- A reversed valid date range is not swapped; it intentionally returns no
  results.
- Reference normalization trims and uppercases before exact comparison.
- Item and Notes lookup use separate bounded parameters because they represent
  different fields and relational semantics.

Every active filter uses AND semantics. `item` matches when the same current
version contains at least one item line whose normalized Item Number snapshot
contains the normalized Item Number search key or whose Description snapshot
contains the trimmed term using case-insensitive comparison. It must use one
relational `some` predicate with that line-local OR, not application-memory
filtering or predicates satisfied by different requests. Current-version
selection follows the ownership-constrained pointer; it does not use latest
`createdAt` or an unguarded maximum version number.

Notes uses case-insensitive `contains`. PostgreSQL full-text search and trigram
indexes are not required for the expected V1 personal-data volume. Query
performance should be measured before adding them.

Equipment and supervisor filter options include active references plus inactive
references used by current requests. Inactive selection is valid for history
filtering. A deleted Equipment relation cannot be recovered as an ID filter,
but snapshots remain readable. Supply Item search uses historical snapshots, so
inactive catalog items remain discoverable without an ID selector.

Page size is `50`. Ordering is:

1. Operational work date descending.
2. Submitted local date descending.
3. Submitted local time descending.
4. NAM Reference descending.
5. Database identity descending.

Previous and Next links preserve every normalized active filter and set only
`page`. An out-of-range page renders the filtered empty state without silently
redirecting.

## 24. Routes And UI Surfaces

The smallest coherent V1 route structure is:

| Route | Purpose |
| --- | --- |
| `/supply-requests` | Canonical history and filters |
| `/supply-requests/new` | Record a submitted request |
| `/supply-requests/[id]` | Current detail, lifecycle actions, links, and Correction History |
| `/supply-requests/[id]/correct` | Explicit full correction form |
| `/supply-requests/[id]/history/[version]` | Read-only immutable version detail |
| `/supply-requests/[id]/fulfill` | Explicit fulfillment form |
| `/supply-requests/[id]/cancel` | Explicit cancellation form |
| `/supply-requests/[id]/daily-log/submission` | Explicit submission activity selection/creation flow |
| `/supply-requests/[id]/daily-log/fulfillment` | Explicit fulfillment activity selection/creation flow |
| `/supply-requests/items` | Supply Item management |
| `/supply-requests/items/new` | Explicit Supply Item creation |
| `/supply-requests/items/[id]/edit` | Supply Item edit and active-state management |
| `/supply-requests/supervisors` | Supervisor management |
| `/supply-requests/supervisors/new` | Explicit supervisor creation |
| `/supply-requests/supervisors/[id]/edit` | Supervisor edit and active-state management |

The create form uses searchable Item Number or Description selection, quantity
entry, an explicit add action, and a compact selected-items list. The list
supports quantity editing, removal, and deterministic order before save. It
does not render an empty quantity input for every catalog item.

Equipment and supervisor selection are searchable. Unit and supervisor email
are read-only derived displays. Requester values and South Warehouse context
are automatic read-only context.

The confirmation checkbox text is:

> I confirm that this request was successfully submitted through the corporate
> system.

The checkbox is transient create-action validation and is not persisted.
Existence of version `1` in Requested status proves confirmation passed.

Fulfilled and Cancelled detail is read-only except `Correct Request`, Daily Log
link management, and historical review.

## 25. Server Action Ownership

Supply Requests own Server Actions for:

- Initial aggregate creation.
- Fulfillment.
- Cancellation.
- Explicit correction.
- Supply Item create, edit, activate, and inactivate.
- Supervisor create, edit, activate, and inactivate.
- Submission and fulfillment Daily Log Activity link create, replace, and
  remove.

Daily Logs continue to own Daily Log and Activity creation. A Supply
Request-assisted flow may call a Daily Log-owned creation boundary only after
the operator explicitly selects the target Daily Log; it must not duplicate
Daily Log persistence logic inside Supply Requests.

Actions validate the complete relevant payload, reload authoritative
references, persist through transactions, return structured errors, revalidate
only affected list/detail/Day View/Daily Log paths, and redirect after commit.
Successful mutations use Post/Redirect/Get semantics so refresh does not repeat
a write. Revalidation or redirect failure after a confirmed commit must be
reported as a navigation problem and must never encourage resubmission of the
corporate request.

## 26. Query Ownership

Supply Requests own:

- Current-version detail and immutable version-detail queries.
- Correction History summaries.
- Active create-form Equipment, Supply Item, and supervisor options.
- Historical filter options including used inactive references.
- Searchable Supply Item and supervisor management queries.
- Filter parsing and paginated history predicates.
- Candidate Daily Log and Activity queries for each explicit link role.
- The selected-date Day View contribution.
- Display identity, status labels, item counts, and snapshot formatting.

App Router pages compose these helpers. Day View consumes only the selected-date
contract. Daily Logs do not query Supply Request internals to infer links.

## 27. Validation

All persisted input receives bounded server-side validation.

### Create

- Real canonical operational work date.
- Real canonical submitted local date and `HH:mm` time.
- Existing active Equipment.
- Existing active supervisor with server-owned snapshots.
- Server-owned nonblank requester snapshots.
- Confirmation exactly present and true.
- One through fifty item lines.
- Contiguous server-canonical sequence.
- Existing active Supply Item for every line.
- No duplicate Supply Item or normalized Item Number.
- Quantity integer from `1` through `999999`.
- Optional Notes trimmed to absent or at most `2000` characters.
- Generated unique NAM Reference.

### References

- Item Number `1..100`, normalized uniqueness.
- Item Description `1..500`.
- Unit `1..100`.
- Supervisor full name `1..200`.
- Supervisor valid email at most `320`, normalized-email uniqueness.
- Active state is explicit and server-validated.

### Lifecycle

- Normal fulfillment or cancellation starts only from Requested.
- Fulfilled date/time is not before submission.
- Fulfillment operational work date is not before request operational work
  date.
- Fulfillment Note is optional and at most `1000`.
- Cancelled date/time is not before submission.
- Cancellation Reason is optional and at most `1000`.
- Status-specific fields are complete and mutually exclusive.

### Correction

- Expected current version matches.
- Correction Reason is nonblank and at most `1000`.
- Resulting complete version passes create and status-specific invariants.
- Unchanged inactive Equipment, supervisor, and Supply Items may remain.
- Any newly selected or replacement reference must be active.
- Missing Equipment relation requires active replacement.
- Existing Daily Log links remain valid under the corrected work dates and
  status, or correction is rejected until links are explicitly changed.
- New version number and current pointer remain unique and coherent.

### Daily Log Links

- Request and Activity exist.
- Role is valid and unique for the request.
- Activity is not linked to another Supply Request role.
- Activity type is `SUPPLY_REQUEST`.
- Activity and parent Daily Log dates match the role's operational date.
- Activity Equipment is null or matches the current request Equipment; when
  the current live Equipment relation is null, Activity Equipment must be null.
- Fulfillment role requires current Fulfilled status.
- The same Activity cannot serve both roles.

Client validation may improve ergonomics but never replaces these checks.

The bounds follow existing NAM operational conventions rather than warehouse
capacity assumptions. Fifty lines is a bounded nested-write and form-usability
guard above the current ten-line Fuel Event and forty-response checklist
aggregates. Quantity `999999` reuses the repository's established whole-number
operational ceiling and prevents unsafe or malformed integers; it is not an
expected order size. Notes `2000` follows the Fuel Event general-notes bound.
The `1000`-character lifecycle and correction notes follow existing bounded
operational narrative fields. Item Number `100`, Unit `100`, supervisor name
`200`, and search `200` are compact label/query bounds; Description `500`
allows catalog clarity without becoming a document field. Email `320` is the
accepted practical address ceiling. These limits are V1 input and query
guards, not procurement rules, and changing them later requires validation and
database-compatibility review rather than a new domain model.

## 28. Transactions And Concurrency

### Initial create

One short interactive transaction:

1. Reloads and validates active Equipment, supervisor, and all Supply Items.
2. Captures every server-owned snapshot.
3. Atomically allocates the annual reference through the parameterized
   PostgreSQL upsert/increment/returning statement.
4. Creates the aggregate root with a temporarily null current pointer.
5. Creates immutable version `1` and all ordered lines.
6. Sets the ownership-constrained current-version pointer.

No parent or counter allocation commits if any line fails.

### Fulfillment, cancellation, and correction

Each short interactive transaction takes a row-level lock on the aggregate root
with one parameterized `SELECT ... FOR UPDATE` raw query, then loads the current
complete version, compares the submitted expected version, derives
`current + 1`, creates the complete next version and lines, and advances the
pointer. Prisma Client does not expose the required row-lock operation through
a normal model query in the repository's current stack, so this is the second
and only other approved narrow raw-SQL boundary.

The unique `(requestId, versionNumber)` constraint is a final guard. A stale
expected version returns a conflict that asks the operator to reload; it is not
silently retried against changed facts.

No correction may advance the pointer unless the entire prior immutable
version remains preserved and the complete replacement version commits.

### Daily Log links

Link create, replacement, or removal uses one short transaction and the same
request-root lock so correction cannot race link validity checks. It loads the
current version, validates both owners and role-specific date, status, type,
and Equipment context, then writes the role link. Replacement removes the old
link and creates the new link atomically. Unique constraints protect role and
Activity reuse. The transaction does not edit Daily Log narrative or Supply
Request versions.

### Retry behavior

Only recognized transient PostgreSQL transaction, deadlock, serialization, or
reference-allocation conflicts receive bounded full-transaction retry.
At most three attempts are allowed, matching the NAM Reference rule.
Validation, stale-version, and business-rule failures do not retry. At
PostgreSQL's default `READ COMMITTED` isolation, the atomic counter statement
and explicit root lock provide the required serialization. An implementation
that instead selects then updates the counter, omits the root lock, or moves
either operation outside the transaction is nonconforming.

## 29. Referential Integrity And Deletion Behavior

| Relationship | Conceptual behavior |
| --- | --- |
| Version to Supply Request | Owned; cascade only from exceptional root removal |
| Version Item to Version | Owned; cascade only with its owning version |
| Version to Equipment | SetNull; snapshots preserve display |
| Version to supervisor | Restrict; retirement uses inactive state |
| Version Item to Supply Item | Restrict; retirement uses inactive state |
| Current-version pointer | Restrict and same-request ownership enforced |
| Daily Log link to Supply Request | Owned; cascade only from exceptional root removal |
| Daily Log link to Daily Log Activity | Cascade link-row removal when Activity is deleted |
| Annual counter | Independent allocation state; request deletion never decrements it |

No normal root or immutable-version deletion exists. Cascade is limited to
strictly owned records and must not cross into Equipment, reference catalogs,
Daily Logs, or Activities.

The current pointer's composite foreign key uses the version's
`(id, supplyRequestId)` candidate key, and the root's
`(currentVersionId, id)` compound unique preserves one-to-one query semantics.
Counter rows have no product management or deletion surface; exceptional
counter repair must never decrement below an allocated request sequence or
make a prior reference reusable.

## 30. Historical Preservation

Snapshots are captured from authoritative server reads.

On create:

- Equipment/location, requester, supervisor, and every Supply Item snapshot are
  captured.

On a lifecycle version:

- All unchanged snapshot groups and lines are copied exactly.

On correction:

- Unchanged live references preserve prior snapshots.
- Deliberately changed references refresh only their complete snapshot group.
- Newly added lines capture current active Supply Item snapshots.
- Removed lines remain visible in older versions.

Current reference edits never update existing versions. SetNull Equipment
deletion and Daily Log Activity deletion do not make request versions
unreadable. Historical screens render snapshots first and treat live references
only as optional navigation context.

## 31. Empty States And Error Behavior

Required states include:

- No requests: explain the NAM-only record boundary and offer `Record Submitted
  Request`.
- No filtered results: preserve filters, explain that no requests match, and
  offer Clear Filters.
- Empty Supply Item Catalog: direct the operator to create an item before a
  request can be recorded.
- No active supervisors or Equipment: block create with a precise management or
  reference-data next step.
- No matching Daily Log: offer navigation to create or open one without
  auto-creation.
- No corrections: show `No corrections recorded` while version `1` remains the
  original state.
- Missing live Equipment: render snapshots and explain that correction requires
  active replacement.
- Stale version: preserve submitted input where practical and require reload.
- Duplicate normalized reference: return a field-level catalog error.
- Reference-generation exhaustion after retries: return a safe retry message
  and persist nothing.
- Invalid history parameters: ignore them, show a nonfatal notice, and use
  normalized links.

Raw Prisma, PostgreSQL, stack, or external-system errors must not reach the UI.
A post-commit redirect or revalidation failure must not imply that corporate
submission failed; the result should direct the operator to the permanent
request detail when possible.

## 32. Testing Strategy

Future tests follow `docs/testing-strategy.md`.

### Unit tests

- Strict local date and time validation, including overnight examples.
- Item Number and NAM Reference normalization.
- Supervisor name and email normalization.
- Whole-number quantity bounds.
- Item count, sequence, and duplicate prevention.
- Required confirmation and initial Requested status.
- Status-specific invariant validation.
- Correction Reason and snapshot-copy rules.
- History parsing, first repeated values, invalid values, reversed ranges, and
  normalized pagination URLs.
- Same-current-version item relational predicate construction.
- Notes and reference lookup behavior.
- Display fallback and Day View ordering.

### Action, query, route, and component tests

- Parent/item transactional create behavior.
- Active/inactive create and correction eligibility.
- Reference management and inline entry points.
- Fulfillment defaults and later operational work dates.
- Cancellation and absence of normal deletion.
- Explicit correction and read-only terminal detail.
- Full immutable historical review and status correction.
- Snapshot preservation and deliberate refresh.
- Daily Log link create, replacement, removal, and deletion behavior.
- Current-version-only history filtering and deterministic 50-row pagination.
- Empty states and invalid-filter notice.
- Feature-owned Day View summary and single-date contribution.

### Real PostgreSQL integration tests

Real PostgreSQL, not mocked Prisma, is required to prove:

- Atomic annual counter upsert/increment and rollback.
- Concurrent same-year reference allocation without duplicates.
- Unique NAM Reference and `(year, sequence)` enforcement.
- Aggregate root, version, and ordered-line atomicity.
- Root locking, stale-version rejection, version-number uniqueness, and current
  pointer ownership.
- Initial-write rollback proving no committed null current pointer or
  root-without-complete-version state.
- Correction rollback when version-line replacement fails.
- Supply Item and supervisor normalized uniqueness under concurrency.
- Duplicate item and sequence constraints.
- Daily Log role and cross-role Activity uniqueness.
- Daily Log link serialization against concurrent correction and Equipment,
  date, and status validity.
- SetNull, Restrict, and owned Cascade deletion behavior.
- Relational item filtering against the same current version.
- Date-only persistence and local wall-clock round trips.

An adversarial integration test should start multiple concurrent creates for
one year and verify a unique allocated sequence per committed request, counter
state equal to the highest committed sequence, one complete version per
committed request, and no exposed partial aggregates.

Broad browser E2E remains deferred until the repository's E2E infrastructure is
approved. Focused component and route tests should cover the critical UX in the
initial implementation.

## 33. Security And Privacy Boundary

Supply Requests contain ordinary operational data comparable to Daily Logs and
Defects. V1 does not add authentication or authorization.

Implementation must:

- Keep reference allocation and snapshots server-owned.
- Bound and trim every free-text field.
- Validate email without sending email.
- Avoid displaying raw persistence failures.
- Avoid implying that NAM submitted, approved, cancelled, or fulfilled the
  corporate request.
- Preserve existing application, database, and private-access boundaries.

Requester employee number and supervisor email are operational identity
snapshots. They must not be expanded into workforce, login, approval, or
communication infrastructure.

## 34. Deferred Enhancements

Deferred pending separate product review:

- Any other warehouse or warehouse management.
- Corporate submission, integration, confirmation number, or email.
- Inventory, stock, procurement, vendors, prices, and purchase orders.
- Custom unnumbered items or Spanish descriptions.
- Work Order, Work Authorization, or Defect relationships.
- Partial receipts, fulfilled quantities, or outstanding quantities.
- Attachments and photos.
- Notifications, approvals, multi-user identity, and roles.
- Reopen, ordinary delete, and generic audit administration.
- Global search, full-text search infrastructure, analytics, reports, and
  exports.
- Generic Daily Log event links, contribution registries, or Equipment
  timelines.

## 35. Delivery Sequence

Architecture acceptance does not authorize these milestones.

Recommended sequence:

1. **Phase 26.3A — Complete and accepted:** persistence schema and migration for references,
   annual counter, stable root, ownership-constrained current pointer,
   immutable versions, version lines, and PostgreSQL constraint tests.
2. **Phase 26.3B — Complete and accepted:** transactional initial-create persistence,
   including strict input validation, active-reference reload, reference
   allocation, snapshot capture, complete version `1`, rollback, and
   adversarial concurrent allocation tests, without routes or forms.
3. **Phase 26.4 — Complete and accepted:** Supply Item and Supply Request Supervisor list,
   search, create, edit, activate, and inactivate workflows with normalized
   uniqueness, bounded URL filtering, deterministic pagination, historical
   snapshot preservation, and PostgreSQL concurrency and Restrict evidence.
4. **Phase 26.5 — Complete and accepted:** request create, current detail, and read-only
   original-version `1` surfaces over the proven persistence boundary, with
   searchable active references, deterministic ordered item entry,
   America/New_York defaults, current-pointer authority, snapshot-first
   rendering, and informational Daily Work Log navigation only.
5. **Phase 26.6 — Complete and accepted:** fulfillment and cancellation append-only
   lifecycle versions with root locking, expected-version protection, complete
   snapshot and line copying, terminal detail, and deterministic PostgreSQL
   concurrency.
6. **Phase 26.7 — Complete and accepted:** explicit Correct Request and full immutable
   version review, including complete immutable corrected versions, reference
   reconciliation, status repair, Correction History, and read-only review of
   every existing immutable version.
7. **Phase 26.8 — Complete and accepted:** canonical current-version history filtering and
   pagination with pointer-owned rows, structured URL filters, inactive-used
   reference options, deterministic ordering, overflow-safe pagination, and
   one Repeatable Read page snapshot.
8. **Phase 26.9 — Complete and accepted:** `SUPPLY_REQUEST` Daily Log classification,
   stable-root role-link persistence, explicit Submission and Fulfillment
   Activity linking, replacement, removal, correction and Daily Log edit
   compatibility, source presentation, cascades, and concurrency proof.
9. **Phase 26.10 — Next planned candidate; not started; separate authorization required:**
   feature-owned Supply Request Day View participation.

Phase 26.3A has proven the schema, migration, composite pointer, uniqueness,
referential actions, and atomic annual-counter primitive. Phase 26.3B now
provides the sole production initial-create boundary and proves that a stable
root, immutable version `1`, complete ordered lines, counter allocation, and
non-null ownership-constrained current pointer commit or roll back together.
Phase 26.4 now provides the feature-owned Supply Item and supervisor management
workflows without mutating accepted historical snapshots or creating Supply
Request aggregates. Phase 26.5 now provides the initial operator create,
current-detail, and read-only original-version `1` surfaces. Phase 26.6 now
provides Requested-to-Fulfilled and Requested-to-Cancelled immutable lifecycle
transitions with root locking, stale protection, complete snapshot and line
copying, atomic pointer advancement, terminal detail, and no corporate-system
or Daily Log mutation. Phase 26.7 now provides explicit Correct Request,
immutable corrected versions, status repair, Correction History summaries, and
general read-only immutable version detail while preserving pointer authority
and historical snapshots.

Phase 26.8 now provides canonical Supply Request history and filtering over
explicit pointer-owned current versions, with structured URL state,
database-owned predicates, deterministic fifty-row pagination, inactive-used
reference options, snapshot-first rows, and coherent Repeatable Read page data.

Phase 26.9 now provides explicit, stable-root-owned Submission and Fulfillment
Daily Log Activity links while preserving Daily Log ownership and link
compatibility across corrections and Activity edits.

The smallest safe next candidate is feature-owned Supply Request Day View
participation. It has not started, requires separate explicit authorization,
and must not include partial fulfillment, normal Reopen, request deletion,
generic audit infrastructure, analytics, reports, exports, deployment, or
operational pilot work unless separately authorized.

## 36. Architecture Invariants

- NAM records an already successful corporate submission; it never performs
  one.
- One request has one Equipment context and at least one ordered item line.
- Every persisted request begins Requested and has a permanent NAM Reference.
- NAM Reference year uses submitted local date and allocation never uses
  `MAX + 1`.
- South Warehouse is display context only and is not persisted.
- Requester values are automatic immutable snapshots, not user input.
- Item Number, Description, Unit, supervisor, and Equipment history render from
  snapshots.
- Unit is catalog-owned and quantity is a positive whole number.
- Current state is exactly one immutable version owned by the request.
- Every accepted lifecycle or correction mutation appends one complete version.
- Correction requires a permanent reason and never mutates an older version.
- Fulfillment and cancellation are terminal normal states.
- Partial receipt remains Requested.
- No normal delete or Reopen action exists.
- Daily Log links are explicit, role-bounded, optional, and non-owning.
- Daily Log narrative is never automatically rewritten.
- Day View shows one current structured request on its operational work date.
- History filters current versions in PostgreSQL with AND semantics.
- No partial aggregate, duplicate reference, or current-pointer advance may
  survive a failed transaction.

## 37. Acceptance Criteria

This Approved architecture remains implementation-ready while:

- Every approved product decision is represented in canonical documentation.
- No canonical document still claims Supply Request product discovery is
  incomplete.
- The version model can reconstruct the original and every later accepted
  state with ordered lines.
- Annual numbering has explicit PostgreSQL locking, uniqueness, retry, and gap
  semantics.
- Lifecycle, correction, reference retirement, snapshot, filtering, Daily Log,
  and Day View boundaries are deterministic.
- The design introduces no inventory, procurement, workforce, Work Order,
  generic audit, generic activity-link, or infrastructure scope.
- Delivery remains sliced and implementation begins only through a separately
  authorized milestone.
