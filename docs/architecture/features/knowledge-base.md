# Knowledge Base V1 Architecture

Status: Approved

Product Phase: Phase 28.2 — Knowledge Base V1 Feature Architecture

Product Discovery Authority: Phase 28.1 — Knowledge Base Product Discovery And
V1 Decision Closure

Review Status: Independent architecture review complete in Phase 28.2.1.

Formal Acceptance Status: Complete in Phase 28.2.2.

Implementation Authorization: Not granted. No Knowledge Base Prisma model,
migration, route, feature module, component, Server Action, or test exists.

Primary Feature: Knowledge Base V1 — Personal Operational Knowledge Records

Bounded Context: Knowledge Base

Depends On:

- Operations reference data for Equipment, Mine, and derived City context
- Existing Daily Work Log ownership and stable detail routes
- Existing Defect Tracking ownership and stable detail routes
- ADR-015 server-owned application state and data flow
- Existing PostgreSQL, Prisma, App Router, Server Action, and Vitest conventions
- docs/product-roadmap.md
- docs/delivery-architecture.md
- docs/dependency-architecture.md
- docs/feature-architecture.md
- docs/application-state-and-data-flow.md
- docs/ui-architecture.md
- docs/testing-strategy.md

Related Documents:

- docs/product-vision.md
- docs/prd.md
- docs/modules.md
- docs/database.md
- docs/roadmap.md
- docs/architecture/features/README.md
- docs/architecture/features/daily-work-logs.md
- docs/architecture/features/defect-tracking.md
- docs/architecture/equipment-operations.md
- docs/decisions/adr-015-application-state-and-data-flow.md
- docs/decisions/adr-016-testing-foundation.md
- docs/decisions/adr-018-private-operational-safety-checklist-photo-storage.md
- docs/decisions/adr-019-managed-private-overlay-operational-pilot.md

Last Reviewed: 2026-08-01

## 1. Status

Phase 28.1 closed the Knowledge Base V1 product boundary. The confirmed product
is a text-first, single-user Personal Operational Knowledge Records feature.

This Phase 28.2 architecture is Approved. Independent architecture review and
formal acceptance are complete.

Implementation has not started and no implementation phase is authorized.
Separate explicit authorization must occur before any schema, migration, route,
action, component, dependency, or test is added. Phase 28.3A remains a proposed
first implementation phase only.

## 2. Purpose

Knowledge Base V1 preserves reusable operational knowledge that should outlive
one shift, Defect, inspection, Supply Request, or dated event.

It helps the operator answer:

> What practical knowledge have I retained about this Equipment, Mine,
> symptom, procedure, safety reminder, or external reference, and how much
> personal confidence should I place in the current content?

Knowledge Base differs from neighboring owners:

- Daily Work Logs own what happened during a workday.
- Defects own equipment-issue lifecycle and corrective resolution.
- Checklists own completed inspection facts.
- STOP Cards own specific safety observations and corrective actions.
- Supply Requests own request identity and lifecycle.
- Day View composes feature-owned dated records and owns no Knowledge Base
  interpretation.
- Repository documentation describes the NAM product and engineering system;
  it is not operator-authored field knowledge.

Knowledge Base owns reusable guidance and observations. It does not replace any
neighboring record or official source.

## 3. Scope

### V1 In Scope

- Stable Personal Operational Knowledge Records.
- Exactly five content kinds: Field Note, Troubleshooting, Procedure, Safety
  Reminder, and Reference.
- Separate Unverified and Personally Reviewed trust states.
- Separate Active and Archived lifecycle states.
- Required title and restricted-Markdown body.
- Optional safety caution.
- General, Mine, or Equipment context.
- Up to ten ordered labeled HTTPS external references.
- Zero or one source Daily Work Log reference.
- Zero or one related Defect reference.
- Create, current detail, edit, personal review, reviewed revision, history,
  content-kind change, archive, restore, and permanent delete workflows.
- Feature-owned title/body search, filters, ordering, and pagination.
- Responsive mobile, tablet, and desktop presentation.
- Safe disclaimer, warning, rendering, validation, error, and logging
  boundaries.

### Explicitly Excluded

- Day View participation.
- Structured procedure-step records.
- Direct City input.
- Multi-Equipment, Equipment-model, or Equipment-category applicability.
- User-managed categories or tags.
- Checklist, STOP Card, Supply Request, Work Authorization, Work Order, or
  generic feature relationships.
- Raw HTML, images, embeds, tables, rich-text blocks, executable content, and
  uploaded files.
- Autosave, offline capture, synchronization, camera capture, and rich-text
  editing.
- Application users, authors, reviewers, roles, approvals, collaboration, and
  organizational review.
- Generic audit, revision, relationship, event, attachment, content, or search
  platforms.

### Deferred

- Pinning and favorites.
- Global, fuzzy, semantic, indexed, or AI-assisted search.
- Notifications, comments, reactions, analytics, reports, and exports.
- Equipment Activity Timeline integration.
- Additional feature relationships.

### Blocked

- Photos, attachments, PDFs, manual uploads, OCR, and other private media.
- Confidential operational use before an accepted application or
  deny-by-default network access boundary is implemented and verified.

### Requires Separate Discovery

- Multi-user collaboration and approval.
- Training acknowledgments, quizzes, and certifications.
- Corporate document management.
- Authentication and authorization.
- Any AI-generated or AI-interpreted operational guidance.

## 4. Product Invariants

Implementation must preserve all of these invariants:

1. One stable Knowledge Record owns one explicit current revision.
2. Normal reads follow the explicit current-revision pointer.
3. Highest revision number, latest timestamp, or array position never implies
   current authority.
4. New records are Active and Unverified.
5. Content kind, trust, and lifecycle remain independent dimensions.
6. Content kind is exactly Field Note, Troubleshooting, Procedure, Safety
   Reminder, or Reference.
7. Trust is exactly Unverified or Personally Reviewed.
8. Lifecycle is exactly Active or Archived.
9. Unverified current content edits in place without creating edit history.
10. Personal review freezes the current revision against Knowledge Base-owned
    material changes.
11. A material change to reviewed content creates a new current Unverified
    revision and retains the reviewed revision.
12. A reviewed-content revision requires a short change summary.
13. Changing kind keeps the same stable record and resets current trust.
14. Archived records are read-only and excluded from default active results.
15. Restoring always produces an Active, Unverified current state.
16. Permanent deletion remains available with explicit destructive
    confirmation and deletes only Knowledge Base-owned data.
17. Context is exactly General, Mine, or Equipment.
18. Equipment context derives Mine and City display context from Equipment.
19. City is never direct user input.
20. Live cross-feature references provide current navigation; limited snapshots
    preserve Knowledge Base readability.
21. Daily Logs and Defects retain their own lifecycle and mutation ownership.
22. No relationship is inferred or created automatically.
23. External references are labeled, ordered, HTTPS-only, bounded to ten, and
    never fetched automatically.
24. Stored content is restricted Markdown; rendered HTML is never authoritative
    persisted content.
25. Personal review never implies corporate, manufacturer, engineering, MSHA,
    site, or another person's approval.
26. Day View receives no Knowledge Base contribution in V1.
27. No operation creates or mutates Equipment, Mine, City, Daily Log, Defect,
    Day View, generic event, generic audit, or media records.
28. Public errors and logs never expose body content, external URLs, secrets,
    raw SQL, connection details, or stack traces.

## 5. Bounded Context And Ownership

The Knowledge Base bounded context owns:

- Stable Knowledge Record identity.
- Root lifecycle and concurrency state.
- The explicit current-revision pointer.
- Current and retained reviewed revision rows.
- Content kind, trust, title, body, caution, and change summary.
- Limited context and relationship display snapshots.
- Ordered external references.
- Feature-owned actions, queries, validation, UI, errors, and tests.

Shared reference owners remain unchanged:

- Equipment owns Equipment identity and lifecycle.
- Mine owns Mine identity and lifecycle.
- City owns City identity and lifecycle.
- Daily Logs own dated work narrative.
- Defect Tracking owns issue lifecycle.

Knowledge Base stores outbound, optional live references and limited snapshots.
It never writes reciprocally into those owner aggregates.

Day View is not a Knowledge Base owner or consumer in V1. Equipment Activity
Timeline is also excluded. No generic cross-feature owner, event registry, or
polymorphic relation is introduced.

## 6. Terminology

- **Knowledge Record**: The stable aggregate root and permanent detail identity.
- **Content kind**: Field Note, Troubleshooting, Procedure, Safety Reminder, or
  Reference.
- **Current revision**: The revision selected by the root's explicit pointer.
- **Reviewed revision**: A revision whose trust is Personally Reviewed and whose
  Knowledge Base-owned material fields are immutable.
- **Unverified**: Personal field knowledge that has not been personally
  reviewed.
- **Personally Reviewed**: Content the single user has reread and personally
  considers useful; never an approval.
- **Active**: Mutable according to trust rules and visible by default.
- **Archived**: Read-only, historically visible, and excluded by default.
- **General context**: No Mine or Equipment subject.
- **Mine context**: One Mine subject and derived City display snapshots.
- **Equipment context**: One Equipment subject with derived Mine and City
  display snapshots.
- **External reference**: One ordered labeled HTTPS URL owned by a revision.
- **Source Daily Log**: Optional navigation to the workday record that prompted
  reusable knowledge.
- **Related Defect**: Optional navigation to a Defect connected to reusable
  troubleshooting knowledge.

## 7. Aggregate Design

The selected design is a stable root plus an explicit current-revision pointer
and feature-owned revision rows.

The root owns lifecycle, current authority, aggregate timestamps, an optimistic
state version, and one-time create-submission identity. A revision owns all
material content and historical display facts. External references are ordered
children of a revision.

Revision rows are selectively mutable:

- The pointer-owned Unverified revision may be updated in place.
- Personal review changes that revision to Personally Reviewed.
- After review, its material content and snapshots are immutable.
- The next material change inserts a complete Unverified revision and
  atomically advances the root pointer.
- Every non-current retained revision must be Personally Reviewed.

Feature-owned persistence maintains contiguous revision numbers beginning at
1. Current authority still comes only from the explicit pointer: neither list
queries nor mutations use `MAX(revisionNumber)` or timestamps to select the
current row. History and detail integrity validation may verify after following
that pointer that it identifies the highest member of one coherent contiguous
owner history; a gap, higher decoy, or non-current Unverified row is invalid
persisted history rather than alternate current authority.

This design avoids a second mutable content table, avoids versioning every quick
edit, and preserves deterministic current authority. It is feature-specific,
not a reusable revision framework.

Stable routes use only the root ID. Revision detail uses the stable root ID plus
a positive revision number.

## 8. Persistence Model

The architecture proposes these conceptual Prisma-level entities. Names remain
proposed until an authorized schema phase.

### KnowledgeRecord

Responsibilities and fields:

- **id**: generated stable primary key.
- **currentRevisionId**: nullable only for transactional create/delete staging.
- **lifecycle**: ACTIVE or ARCHIVED.
- **stateVersion**: positive integer incremented by every Knowledge Base-owned
  aggregate mutation. Owner-driven `SetNull` navigation changes are exempt.
- **createSubmissionKey**: opaque UUID, globally unique.
- **createSubmissionFingerprint**: immutable SHA-256 digest of the canonical
  normalized create payload, used only to distinguish a true replay from reuse
  of one submission key with different content. Persistence uses a fixed
  32-byte digest or checked 64-character lowercase hexadecimal representation.
- **createdAt**, **updatedAt**, **archivedAt**.
- Owned revisions and explicit current-revision relation.

Constraints:

- Lifecycle and archived timestamp must be coherent.
- State version must be positive.
- Current revision must belong to the same root through a composite
  owner-constrained foreign key.
- Committed application state requires a non-null valid current pointer.
- Submission key and fingerprint are created together and never rewritten.

### KnowledgeRecordRevision

Responsibilities and fields:

- **id** and **knowledgeRecordId**.
- **revisionNumber**: positive signed 32-bit integer.
- **origin**: INITIAL, REVISED, or RESTORED.
- **contentKind**.
- **trust**.
- **title**, **normalizedTitle**, **bodyMarkdown**, **safetyCaution**.
- **contextKind**: GENERAL, MINE, or EQUIPMENT.
- Optional live **mineId** and **equipmentId**.
- Mine, City, and Equipment limited display snapshots.
- Optional live **sourceDailyLogId** and its date/shift snapshots.
- Optional live **relatedDefectId** and its title/reported-date snapshots.
- **changeSummary**, **reviewedAt**, **createdAt**, and **updatedAt**.
- Ordered external-reference children.

Constraints:

- Unique revision number per stable record.
- Unique composite identity of revision ID and owning record ID.
- Title, body, caution, and change-summary length checks.
- Trust and reviewed timestamp coherence.
- Origin, revision number, and change-summary coherence.
- Context-kind and snapshot-shape coherence. Database checks permit a Mine or
  Equipment live ID to be null after `SetNull`; complete snapshots remain
  required. Feature actions, rather than a static check constraint, require an
  active live owner when a user creates or deliberately changes context.
- General context has no context references or snapshots.
- Mine context has no Equipment reference or Equipment snapshots and requires
  complete Mine/City snapshots; its live Mine ID may later be null.
- Equipment context requires complete Equipment/Mine/City snapshots; its live
  Equipment and derived Mine IDs may later be null independently.
- Live IDs may become null through owner deletion while snapshots remain. The
  database can validate the resulting shape but cannot prove the cause of a
  null transition without a trigger; V1 uses owner foreign keys, feature-owned
  mutation boundaries, and persisted-state validation rather than such a
  trigger.

Origin coherence is exact:

- INITIAL is revision 1 and has no change summary.
- REVISED is revision 2 or later and has a nonblank change summary.
- RESTORED is revision 2 or later and has no user change summary.

### KnowledgeRevisionExternalReference

Responsibilities and fields:

- **id**, **knowledgeRecordRevisionId**, **sequence**.
- **label**, **url**, and **normalizedUrl**.
- **createdAt**.

Constraints:

- Sequence is 1 through 10.
- Unique sequence per revision.
- Unique normalized URL per revision.
- Nonblank label with maximum 120 characters.
- HTTPS URL with maximum 2,048 characters.

### Keys, Indexes, And Ordering

The minimum index plan includes:

- Root lifecycle, updated timestamp, and stable ID for default ordering.
- Root current-pointer composite ownership and unique create-submission key.
- Revision owner/revision-number uniqueness and revision primary identity.
- Revision normalized title for title ordering.
- Revision live Mine and Equipment IDs for context filtering.
- Revision source Daily Log and related Defect IDs in the relationship
  migration.
- External-reference revision/sequence and normalized-URL uniqueness.

Standalone indexes on low-cardinality kind or trust values are not required by
architecture. The authorized migration phase must inspect representative
PostgreSQL plans before adding any such index or another speculative index.
B-tree indexes are not claimed to accelerate leading-wildcard body search.

Default root ordering is root updated timestamp descending, then root ID
descending. Title ordering is current normalized title ascending, then stable
root ID ascending.

## 9. Content Kind Architecture

Content kind lives on each revision because historical reviewed content must
retain the kind under which it was reviewed.

For an Active Unverified current revision, kind change updates the current row
in place and increments root state version.

For an Active Personally Reviewed current revision, kind change is material. It
requires a change summary, creates a complete new Unverified revision on the
same root, and atomically advances the pointer.

List filtering uses current pointer-owned kind only. Revision detail displays
the historical kind stored on that revision.

## 10. Trust Architecture

Trust lives on revisions.

An Active Unverified current revision may be personally reviewed only after the
complete current aggregate passes validation. Review records a server-owned
timestamp and changes trust to Personally Reviewed in the same transaction.
No reviewer identity exists.

After review, these fields are material and immutable on that revision:

- Content kind.
- Title and body.
- Safety caution.
- Context kind, live context references, and context snapshots.
- External references and their order.
- Source Daily Log and related Defect references and snapshots.

Content kind changes only through the dedicated kind-change boundary. A normal
edit or reviewed-content revision must retain the current kind.

Root lifecycle and automatic SetNull of navigation-only live foreign keys are
not content edits. Snapshots remain immutable.

PostgreSQL check constraints enforce trust/review-timestamp shape, but a static
check constraint cannot prevent arbitrary updates to every reviewed material
column. V1 does not add a trigger or generic audit framework. Feature-owned
mutation boundaries enforce reviewed immutability under the root lock, and
detail/history integrity validation rejects a non-current Unverified row,
incoherent numbering, or malformed reviewed row. PostgreSQL tests prove that
production persistence operations leave retained reviewed rows byte-for-byte
unchanged; they must not describe this as protection against arbitrary
administrator SQL.

A material change creates a new Unverified current revision. Review labels must
always say **Personally Reviewed** and must never say Approved, Official,
Verified by NAM, or Reviewed by another person.

## 11. Lifecycle Architecture

Lifecycle lives on the stable root.

### Active

Active records permit actions according to current trust. They appear in
default list results.

### Archived

Archive locks the root, checks expected current state, changes lifecycle to
ARCHIVED, records archivedAt, increments state version, and changes no revision
content. Archived records are read-only except for Restore and Delete.

Archived detail, history, revision detail, context snapshots, external
references, and available navigation remain readable.

### Restore

Restore locks the root and checks expected state:

- If current trust is Unverified, the same revision remains current.
- If current trust is Personally Reviewed, restore inserts a complete
  RESTORED-origin Unverified revision copied from the reviewed revision and
  advances the pointer.

Restore changes lifecycle to ACTIVE, clears archivedAt, increments state
version, and preserves every prior reviewed revision. The server-owned restored
origin explains why no user change summary is required.

### Delete Eligibility

Permanent deletion is allowed for Active or Archived, Unverified or Personally
Reviewed records, including records with optional relationships. Archive is
preferred but does not replace deletion.

## 12. Context Architecture

Every revision has exactly one context kind.

### General

No Mine or Equipment live ID or snapshot is stored.

### Mine

The action accepts one active Mine ID. It derives and stores:

- Live Mine ID.
- Mine name snapshot.
- City name and optional state snapshots.

### Equipment

The action accepts one active Equipment ID and no separate Mine input. It
derives and stores:

- Live Equipment ID.
- Equipment display name, number, and category snapshots.
- Live derived Mine ID.
- Mine name snapshot.
- City name and optional state snapshots.

Creation and deliberate context changes require active references. An unchanged
inactive reference may be retained during an edit or reviewed revision. This
prevents unrelated reference deactivation from forcing a context change.

When the submitted context kind and live owner IDs are unchanged, Unverified
edits preserve the existing snapshots even if the live reference label changed.
A reviewed revision likewise copies unchanged context snapshots. Snapshots are
refreshed from one coherent owner query only when the user deliberately selects
a different context kind or owner. This keeps reference-data edits from
becoming silent Knowledge Base content changes.

Live Mine and Equipment references use SetNull for exceptional owner deletion.
Context kind and snapshots remain, so historical and current Knowledge Base
display remains readable. The application never permits a user to create a
snapshot-only context; that state can arise only from owner deletion.

Current list filtering uses live IDs. A deleted target is no longer selectable,
but its snapshot label remains on detail and history.

## 13. External Reference Architecture

External references are revision-owned ordered children.

Validation requires:

- Zero through ten entries.
- Contiguous one-based ordering.
- Trimmed nonblank label of at most 120 characters.
- Absolute HTTPS URL of at most 2,048 characters.
- No username or password component.
- No javascript, data, file, HTTP, relative, or other scheme.
- No duplicate normalized URL within one revision.

Normalization uses the platform URL parser, lowercases the scheme and hostname
according to URL semantics, removes an empty fragment, and serializes the
result. It does not fetch, resolve, preview, download, monitor, or log the URL.

The ten-entry limit applies to the dedicated external-reference list. Inline
Markdown links do not create external-reference rows, but every inline link is
subject to the same HTTPS, credential, rendering, and logging restrictions.

Unverified edits fully validate a submitted ordered set before atomically
replacing current children. Reviewed revision creation inserts a complete new
set. Root deletion cascades through revisions to references.

Detail rendering shows the explicit label and safely encoded HTTPS destination.
External links identify themselves as external and use safe browser relationship
attributes when opened in a new browsing context.

## 14. Daily Log Relationship Architecture

The current revision may reference zero or one Daily Log. The revision owns the
outbound relationship; Daily Log owns its record and narrative.

Selection permits any existing Daily Log because this relationship records
source context rather than current operational eligibility. Options are
feature-owned, searchable, deterministically ordered, and bounded or paginated.

At selection time Knowledge Base stores:

- Live Daily Log ID.
- Daily Log date snapshot.
- Shift snapshot.

An unchanged source ID preserves its existing snapshots. A deliberately
selected different source derives new snapshots. Owner-record edits never
silently rewrite Knowledge Base snapshots.

The live foreign key uses SetNull when the Daily Log is deleted. Snapshots
remain and display **Daily Log unavailable** without a link. When present,
navigation uses /daily-logs/[stable Daily Log ID].

Persistence shape is exact: a relationship never selected has a null live ID
and null snapshots; a current or formerly selected relationship has complete
date/shift snapshots while its live ID may be null after SetNull. Unverified
removal clears the live ID and snapshots together. A reviewed relationship
change creates a new revision and never clears historical snapshots.

Knowledge Base never creates, edits, deletes, or revalidates a Daily Log.

## 15. Defect Relationship Architecture

The current revision may reference zero or one Defect. The revision owns the
outbound relationship; Defect Tracking owns defect state and lifecycle.

Selection permits any existing Defect, including closed historical Defects,
because the relationship records knowledge provenance. Options are
feature-owned, searchable, deterministically ordered, and bounded or paginated.

At selection time Knowledge Base stores:

- Live Defect ID.
- Defect title snapshot.
- Reported-date snapshot.

An unchanged related Defect ID preserves its existing snapshots. A deliberately
selected different Defect derives new snapshots. Defect edits never silently
rewrite Knowledge Base snapshots.

The live foreign key uses SetNull when the Defect is deleted. Snapshots remain
and display **Defect unavailable** without a link. When present, navigation uses
/defect-tracking/[stable Defect ID].

Persistence shape is exact: a relationship never selected has a null live ID
and null snapshots; a current or formerly selected relationship has complete
title/reported-date snapshots while its live ID may be null after SetNull.
Unverified removal clears the live ID and snapshots together. A reviewed
relationship change creates a new revision and never clears historical
snapshots.

Knowledge Base never changes priority, severity, status, corrective action,
resolution, closure, or any other Defect fact.

## 16. Create Architecture

The public create boundary accepts one strict normalized input and one opaque
submission key generated when the server renders the form. It derives a
feature-owned canonical serialization of all normalized create fields,
ordered external references, and selected relationship IDs, then stores its
SHA-256 fingerprint without logging either the payload or digest.

Validation covers title, body, caution, kind, context, Markdown, external
references, and optional relationships before persistence.

The transaction:

1. Validates the submission key shape and derives the canonical fingerprint.
2. Resolves and protects selected references in deterministic table order.
3. Derives context and relationship snapshots.
4. Pre-generates root, revision, and reference IDs.
5. Creates a root with ACTIVE lifecycle and a temporarily null pointer.
6. Creates INITIAL revision 1 as UNVERIFIED.
7. Creates ordered external references.
8. Updates the root pointer to the same-owner revision.
9. Verifies the completed pointer and aggregate.
10. Commits before route revalidation or redirect.

The unique submission key makes repeated form submission and ambiguous create
recovery idempotent. A recognized duplicate key returns the already committed
stable root only when its immutable create fingerprint matches and its current
state is coherent. Reuse of one key with a different canonical payload returns
`DUPLICATE_SUBMISSION_CONFLICT`; it never silently returns an unrelated prior
submission. The key and fingerprint live until their owning root is deleted and
do not create a global idempotency service or cleanup process.

Only the exact create-submission-key unique constraint receives this recovery
handling. After the failed create transaction is known rolled back, a fixed
dependency lookup by key compares the fingerprint and validates the aggregate.
Other uniqueness failures are not treated as duplicates. Ambiguous create
commit recovery performs the same key/fingerprint lookup; it never blindly
replays a second insert. The canonical serialization and its domain/version
prefix are frozen for V1 so a later normalization change cannot reinterpret an
old submission fingerprint without an explicit compatibility decision.

After commit, the action revalidates /knowledge-base and redirects to stable
detail. Validation and safe persistence errors remain on the submitted form.

## 17. Unverified Edit Architecture

Only an Active record whose pointer-owned current revision is Unverified may use
the in-place edit boundary.

Allowed material fields are title, body, caution, context, external references,
source Daily Log, and related Defect. Content kind changes only through the
dedicated kind-change action.

The client supplies expected root state version and expected current revision
ID. Persistence locks the root before authoritative reads, validates both
tokens, validates the complete replacement input, protects referenced targets,
updates the same current revision, replaces external references atomically,
increments root state version, and commits.

No revision row is added. Revision number and pointer remain unchanged.
Failure rolls back content, snapshots, relationships, and references together.

## 18. Reviewed-Content Revision Architecture

Only an Active record whose pointer-owned current revision is Personally
Reviewed may use the reviewed-revision boundary.

Every editable material field is submitted as a complete replacement while
content kind remains unchanged. A trimmed nonblank change summary is required
and bounded to 500 characters. Kind change uses section 20 instead.

Material comparison uses one canonical normalized value object. It compares
kind where applicable, title, body, caution, context kind and deliberately
selected owner IDs, preserved-or-new snapshots, ordered external-reference
labels and normalized URLs, and optional Daily Log/Defect IDs and snapshots.
Root lifecycle, timestamps, state version, automatic SetNull navigation loss,
and unrelated owner deactivation are excluded. A normalized no-op is rejected
deterministically. Phase 28.8 must extend this same comparator for the two
optional relationships; it may not create a second comparison rule.

The transaction:

1. Locks the stable root.
2. Validates expected state version and current revision ID.
3. Confirms current trust and ownership.
4. Fully validates replacement content and references.
5. Rejects a submission with no material difference.
6. Resolves and protects changed relationship targets.
7. Inserts a complete REVISED-origin Unverified revision with the next positive
   revision number.
8. Inserts its ordered external references.
9. Atomically advances the same-owner current pointer.
10. Increments root state version and updated timestamp.

The old reviewed row and its children remain unchanged. Unique owner/revision
constraints and expected state prevent duplicate concurrent revisions. A
failed transaction leaves the old reviewed revision current.

History remains under the stable record and uses revision number, never raw
revision ID, in public URLs.

## 19. Personal Review Architecture

Review requires:

- Active lifecycle.
- Pointer-owned Unverified current revision.
- Complete persisted-current integrity.
- Expected current revision ID and root state version.

The transaction locks the root, validates eligibility, changes trust to
PERSONALLY_REVIEWED, records server time, increments root state version, and
commits.

A repeated review request is idempotent only when the same revision remains
current, the record remains Active, and that revision is already Personally
Reviewed. A changed pointer, archive, or other mutation returns a stale or
invalid-transition error.

Blank content cannot exist because review revalidates all persisted limits and
Markdown safety. No separate “unchanged content” requirement applies to the
first personal review.

## 20. Content-Kind Change Architecture

Kind change is a distinct feature-owned action even though it uses shared
revision persistence:

- Active Unverified: update kind in place, remain Unverified.
- Active Personally Reviewed: require a change summary, create a complete new
  REVISED-origin Unverified revision, and advance the pointer.
- Archived: reject as read-only.

The stable root never changes. Historical reviewed revisions retain their prior
kind. Current filters immediately follow the pointer-owned new kind after
commit.

## 21. Archive Architecture

Archive requires Active lifecycle plus expected current revision and state
version.

The transaction locks the root, validates current authority, sets lifecycle to
ARCHIVED, records server-owned archivedAt, increments state version, and
changes no revision or relationship.

After commit, list, detail, edit, and history routes are revalidated. Detail
remains available, but Edit, Review, Change Kind, and Archive controls are
removed. Restore and Delete remain.

Archive errors distinguish not found, stale state, already archived idempotent
state, invalid persisted current state, and safe persistence failure.

## 22. Restore Architecture

Restore requires Archived lifecycle plus expected current revision and state
version.

If current trust is Unverified, the transaction reuses the same revision.

If current trust is Personally Reviewed, the transaction copies the complete
reviewed revision and its references into a new RESTORED-origin Unverified
revision, advances the pointer, and preserves the reviewed source. Restore does
not require a user change summary because it changes lifecycle and trust, not
content. The copied revision receives `reviewedAt = null`; its server-owned
RESTORED origin is displayed in history so the absent user change summary is
not ambiguous.

The transaction sets lifecycle ACTIVE, clears archivedAt, increments state
version, and commits atomically. Concurrent restore, delete, or edit attempts
resolve through root locking and expected-state comparison.

## 23. Permanent-Delete Architecture

Permanent delete is allowed for:

- Never-reviewed Active or Archived records.
- Reviewed Active or Archived records.
- Records with a source Daily Log.
- Records with a related Defect.
- Records with context or external references.

The destructive form requires the exact current title plus expected current
revision ID and state version. The action binds the stable ID from the route;
it does not trust an arbitrary target ID from FormData.

The transaction locks and validates the root, compares confirmation after the
lock, clears the current-revision pointer, and deletes the root. Cascade removes
owned revisions and external references. Outbound SetNull references do not
delete or mutate owner records.

Delete has no compensation deletion and no cross-feature revalidation. A
recognized rollback-certain serialization or deadlock error may be retried by
the persistence boundary within the bounded retry policy. Ambiguous network
commit errors are not blindly retried; the user must reload to determine
whether the stable route still exists.

Logs may include only a safe operation code and correlation identifier, never
the title, body, caution, change summary, external URLs, snapshots, or raw
database error.

## 24. Restricted Markdown Architecture

The database stores normalized source Markdown only. It never stores rendered
HTML as authoritative content.

Title, safety caution, change summary, link labels, and snapshots are normalized
plain text. Restricted Markdown applies only to `bodyMarkdown`.

The allowed syntax is:

- Paragraphs.
- Heading levels two through four.
- Ordered and unordered lists.
- Strong and emphasized text.
- Blockquotes.
- Inline code and fenced code blocks.
- Labeled absolute HTTPS links.

Heading level one is reserved for page structure. Raw HTML, images, embeds,
tables, task-list controls, rich-text blocks, and executable content are not
enabled. Because GFM table parsing is not enabled, pipe-delimited text remains
plain text rather than becoming a table.

Implementation must use one reviewed, server-compatible CommonMark parser and
React renderer with one feature-owned AST policy and explicit node allowlist.
Validation and rendering consume that same policy so accepted syntax cannot
drift from rendered syntax. Raw-HTML parsing plugins are prohibited. A
parser-based validator must reject HTML nodes, image nodes, unsafe link schemes,
unlabeled links, and unsupported constructs before persistence. The renderer
must still escape text and validate every link because stored content is
untrusted.

The rendering library must:

- Work during server rendering without a browser DOM.
- Produce React elements rather than accepting prebuilt HTML.
- Permit an explicit element/component allowlist.
- Keep raw HTML disabled by default.
- Permit safe custom link and code rendering.
- Have maintained TypeScript support and no requirement for client execution.

No current repository dependency satisfies this boundary. Phase 28.3B must
review the selected parser/renderer dependency and any package or lockfile
change explicitly; this Approved architecture does not pre-approve a library.
Fenced-code info strings are either ignored or restricted to a bounded safe
language token and are never interpolated into unchecked HTML or executable
behavior.

Rendered content remains a Server Component boundary. No HTML is inserted with
dangerouslySetInnerHTML. V1 has no live Markdown preview; the form edits source
and stable detail renders the committed result. Any later preview requires
separate authorization and must use the exact production parser and renderer.

Body input is normalized to LF line endings, preserves meaningful Markdown
whitespace, trims only outer blank lines, and must contain non-whitespace text.
It is limited to 50,000 Unicode code points. The same normalized text is used
for validation and search. Code fences count toward the body limit and render
as inert text with horizontal overflow handling.

Markdown validation errors are safe and identify an unsupported construct or
field position without echoing the submitted body.

## 25. Safety And Authority Presentation

Every create and edit surface displays the complete disclaimer before Save:

> Personal operational knowledge for reference only. It is not corporate,
> manufacturer, engineering, MSHA, or site approval. Verify against current
> official manuals, procedures, lockout/tagout requirements, and site rules
> before acting.

Current detail and revision detail display the disclaimer adjacent to content,
not only in a site footer.

Unverified current content and unverified restored content display:

> Unverified field knowledge — do not treat as instruction; confirm before use.

List cards show a text trust badge. Detail and history show trust label plus
review timestamp when present. Archived records display a separate Archived
label and read-only explanation.

Status meaning is conveyed by text, icon or semantic marker, and accessible
description, never color alone. Safety cautions use an alert or note landmark
with an explicit heading. Prohibited terms include Official, Approved,
Corporate Reviewed, Manufacturer Reviewed, Engineering Reviewed, MSHA
Reviewed, and Verified by NAM.

## 26. Search Architecture

Knowledge Base owns one fixed-dependency list query. It starts from stable
Knowledge Record roots and follows the explicit owner-constrained current
revision relation.

Search semantics:

- The normalized query is trimmed, at most 200 characters, and contains no
  implicit wildcard syntax.
- Empty search means no text predicate.
- Nonempty search applies case-insensitive title OR body contains predicates to
  the pointer-owned current revision.
- Search never scans retained reviewed revisions.
- Search does not inspect caution, snapshots, relationship labels, or external
  URLs in V1.

The result is database-filtered, ordered, and paginated. No application-memory
filtering, sorting, or deduplication is permitted.

V1 assumes personal volume. Ordinary PostgreSQL case-insensitive contains
predicates are sufficient. B-tree indexes support equality filters and ordering
but are not claimed to accelerate leading-wildcard body search. Full-text,
trigram, semantic, embedding, external indexing, and global search remain
excluded. Search architecture should be reconsidered only after measured
same-feature volume or latency demonstrates a problem.

## 27. Filter Architecture

The canonical list URL supports exactly:

- **q**
- **kind**
- **trust**
- **lifecycle**
- **equipmentId**
- **mineId**
- **sort**
- **page**

Defaults:

- Lifecycle: ACTIVE.
- Sort: UPDATED_DESC.
- Page: 1.
- All other filters absent.

Lifecycle accepts ACTIVE, ARCHIVED, or ALL. Sort accepts UPDATED_DESC or
TITLE_ASC. Kind and trust accept only known enums. Equipment and Mine IDs are
bounded opaque strings.

Repeated parameters use the first runtime string. Invalid or non-string values
are ignored with bounded nonfatal filter notices. Search is trimmed; blank
search is omitted from normalized URLs. Page parsing is positive,
overflow-safe, and bounded before offset arithmetic.

A well-formed but unknown Equipment or Mine ID is a valid filter that returns
zero matches; it is not silently rewritten to another owner. The UI describes
the unavailable selection without echoing an unsafe raw ID. Unsupported
parameters and invalid enum or ID shapes are omitted from generated canonical
URLs. Changing search, sort, or any filter resets page to 1.

Independent filters combine with database-owned AND semantics. Text search
retains its one local OR between title and body.

Equipment and Mine options include active references plus inactive references
used by current records. Deleted SetNull references are represented by
snapshots on results but have no selectable live-ID option.

Normalized Previous, Next, Clear, and filter-form URLs preserve only supported
canonical parameters.

Within one Repeatable Read list composition, a bounded integrity precheck
rejects roots in the selected lifecycle scope whose current pointer is null or
whose current relation is missing. Archived corruption does not poison the
default Active query, but lifecycle ALL intentionally validates both scopes.
Corrupt roots never silently disappear as ordinary empty results.

## 28. List Architecture

The canonical list route displays one row or record card per stable root.

Each entry contains only:

- Stable record ID and detail URL.
- Current title and short plain-text excerpt.
- Content-kind label.
- Trust label.
- Lifecycle label when archived results are included.
- Context snapshot label.
- Updated timestamp.

The excerpt is a server-derived, whitespace-normalized plain-text projection of
the validated current-body AST, bounded to 240 characters. It collects visible
text, link labels, and inert code text but never link destinations, markup, or
raw HTML. It is not stored and never renders Markdown on the list.
External-reference URLs, relationship IDs, internal revision IDs, and complete
body content are excluded.

Pagination uses 50 stable roots per page. Count and rows load from one
Repeatable Read snapshot and use the exact same matching predicate. Fifty is a
bounded mobile-friendly page size for expected personal V1 volume, not a hidden
result cap. Ordering is UPDATED_DESC by root updatedAt then root ID descending,
or TITLE_ASC by current normalizedTitle then root ID ascending. No arbitrary
hidden take limit exists beyond explicit pagination.

Offset arithmetic uses a checked integer or BigInt boundary. If the requested
offset is at or beyond the matching count, the query does not issue an unsafe
row query and returns an empty out-of-range page with normalized Previous and
first-page navigation; it never clamps silently or mistakes the result for “no
Knowledge Records exist.” Count/result predicate parity, out-of-range behavior,
and stable-ID tie-breakers are query-test requirements.

Empty states distinguish:

- No Knowledge Records exist: offer Create Knowledge Record.
- Records exist but no Active record remains: explain that only Archived
  records exist and offer a normalized Archived/All view.
- No current filters match: offer Clear Filters.
- Requested page is out of range: explain the page condition and offer the
  first or last available page without claiming that no records exist.
- Query or integrity failure: use the route error boundary, never an empty
  result.

Cards use semantic headings and large touch-friendly detail links.

## 29. Detail Architecture

The stable route is /knowledge-base/[id].

Current detail loads one coherent snapshot containing:

- Stable identity and root lifecycle.
- Pointer-owned current revision.
- Kind, trust, title, rendered body, caution, and timestamps.
- Context snapshots and available live navigation.
- Ordered external references.
- Optional Daily Log and Defect snapshot/link.
- Review metadata.
- Retained reviewed-revision summary.
- Mutation-only expected state for permitted actions.

The query validates non-null current pointer, same-owner relation, revision
number, lifecycle/timestamp coherence, trust/review coherence, current snapshot
shape, external-reference ordering, and all required bounds.

Active Unverified detail offers Edit, Personally Review, Change Kind, Archive,
and Delete. Active Personally Reviewed detail offers Revise, Change Kind,
Archive, and Delete. Archived detail offers Restore and Delete only.

Unavailable owner references show retained labels without links. Archived
detail stays readable. Raw revision IDs and concurrency fields are not shown.
Server-rendered mutation forms may receive the expected current revision ID and
state version as hidden mutation inputs; these are not display facts and are
never shown or logged.

## 30. History Architecture

History is feature-specific reviewed-content history, not a generic audit log.

History lists:

- The current revision first, whether Unverified or Personally Reviewed.
- All older retained Personally Reviewed revisions by revision number
  descending.

An older Unverified revision is invalid persisted state. Unverified edits do
not produce history rows.

Each summary displays revision number, Current or Reviewed History designation,
origin, kind, trust, review time when present, change summary when present, and
context snapshot. Revision detail displays the revision's stored title,
rendered body, caution, kind, context, external references, and relationship
snapshots exactly as stored.

Live navigation is offered only when the historical row's optional live foreign
key remains present. Otherwise the historical snapshot is labeled unavailable.
Automatic SetNull does not rewrite snapshots.

The stable revision URL is
/knowledge-base/[recordId]/history/[positiveRevisionNumber]. It never accepts a
raw revision ID. The query verifies owner and revision number and labels Current
or Retained Reviewed based on the explicit root pointer. A retained reviewed
revision is immutable. When this route identifies the current Unverified
revision, its content may still change in place until review and the page must
say **Current Unverified** rather than claim immutable history.

## 31. Route Architecture

Proposed routes:

- **/knowledge-base** — canonical searchable, filterable list.
- **/knowledge-base/new** — create.
- **/knowledge-base/[id]** — stable current detail.
- **/knowledge-base/[id]/edit** — Unverified edit or reviewed revision form.
- **/knowledge-base/[id]/history** — current plus retained reviewed revisions.
- **/knowledge-base/[id]/history/[revisionNumber]** — numbered revision detail;
  retained reviewed rows are immutable, while the current Unverified row is
  explicitly labeled mutable.

No Day View route, contribution route, generic knowledge API, upload route, or
media route is introduced.

Routes remain dynamic Server Components where database reads occur. Not-found
and error boundaries follow current repository conventions.

## 32. Server Action Architecture

Feature-owned public Server Actions:

- **createKnowledgeRecord**
- **updateUnverifiedKnowledgeRecord**
- **reviseReviewedKnowledgeRecord**
- **reviewKnowledgeRecord**
- **changeKnowledgeRecordKind**
- **archiveKnowledgeRecord**
- **restoreKnowledgeRecord**
- **deleteKnowledgeRecord**

Every action:

- Binds stable route identity outside arbitrary FormData where applicable.
- Parses strict FormData cardinality and rejects duplicate scalar values.
- Accepts only action-specific fields.
- Calls its public persistence boundary exactly once.
- Performs no direct Prisma work in the client component or route.
- Maps feature-owned errors to safe action state.
- Revalidates only affected Knowledge Base routes after commit.
- Allows framework redirect control flow to escape broad catches.
- Logs no content or raw persistence details.

Create redirects to stable detail. Edit, reviewed revision, review, kind change,
archive, and restore redirect or return to stable detail after commit according
to repository form conventions. Delete redirects to /knowledge-base.

No action calls another feature's mutation boundary.

## 33. Query Architecture

Feature-owned queries:

- List/search/filter/count.
- Stable current detail.
- Create reference options.
- Edit preparation.
- Reviewed history.
- Revision detail.
- Mine and Equipment options.
- Daily Log relationship options.
- Defect relationship options.

Production query modules have fixed Prisma and mapper dependencies. Public
callers cannot substitute predicates, selects, validators, or transaction
callbacks. Clearly internal seams may accept a Prisma-shaped test client.

All public results are narrow immutable JSON-safe contracts. Display contracts
contain no Prisma records, Date, BigInt, Error, Map, Set, class instance,
function, raw current revision ID, or mutable collection. A distinct
server-rendered mutation-preparation contract may contain only the expected
current revision ID and root state version needed for stale-state comparison;
those values are never rendered as record facts, included in list/detail
display contracts, or logged.

Current list and detail start from KnowledgeRecord. History revision detail may
start from KnowledgeRecordRevision only when it also loads and validates its
owning root and current pointer.

Reference-option queries remain feature-specific. No generic repository or
selector abstraction is introduced.

## 34. Validation Architecture

Validation is feature-owned and shared across form parsing, persistence, and
persisted-state integrity checks where appropriate.

Required rules:

- Title: LF-independent trimmed nonblank text, maximum 160 code points.
- Body: normalized LF, nonblank, maximum 50,000 code points.
- Caution: absent or trimmed nonblank text, maximum 2,000 code points.
- Kind: one of five fixed values.
- Trust and lifecycle: never accepted as arbitrary edit fields.
- Context: one valid context kind and no contradictory user IDs.
- Equipment context: Equipment input only; derived Mine must match.
- Mine context: Mine input only.
- General context: no reference input.
- External references: zero through ten, strict ordered entries, safe labels
  and URLs, no normalized duplicates.
- Daily Log and Defect: absent or exactly one existing stable ID.
- Change summary: required only for REVISED creation, maximum 500 code points.
- Query parameters: runtime-narrowed, bounded, normalized.
- Expected state: positive root state version and nonblank current revision ID.
- Markdown: parser-based allowed-node and HTTPS-link validation.

Validation can prohibit clearly identified secret fields or unsafe URLs, but it
must not claim semantic detection can guarantee that body text contains no
sensitive or confidential material. User guidance remains required.

## 35. Error Architecture

The feature-owned error vocabulary includes:

- **INVALID_INPUT**
- **RECORD_NOT_FOUND**
- **CURRENT_STATE_INVALID**
- **STALE_CURRENT_STATE**
- **INVALID_TRANSITION**
- **ARCHIVED_READ_ONLY**
- **REFERENCE_UNAVAILABLE**
- **CONTEXT_MISMATCH**
- **UNSAFE_URL**
- **UNSAFE_MARKDOWN**
- **NO_MATERIAL_CHANGE**
- **DUPLICATE_SUBMISSION_CONFLICT**
- **RELATIONSHIP_TARGET_REMOVED**
- **DELETE_CONFIRMATION_MISMATCH**
- **DELETE_CONFLICT**
- **PERSISTENCE_UNAVAILABLE**

Known validation and transition errors map to field or form messages. Not-found
maps to route not-found or safe action state. Integrity and unexpected
persistence failures map to one corporate-system-neutral safe message.

Errors never expose body, caution, change summary, external URLs, snapshot
values, raw Prisma messages, SQLSTATE, constraint names, database URLs,
credentials, stack traces, or unnecessary internal IDs.

## 36. Concurrency Architecture

All existing-root mutations begin with a parameterized row lock:

SELECT id FROM KnowledgeRecord WHERE id = the bound stable ID FOR UPDATE.

The root lock precedes authoritative current reads. The mutation then validates
the explicit current pointer, same-owner relation, expected current revision
ID, and expected root state version.

The two expected values have separate purposes. The current revision ID binds a
mutation to the exact content row the form prepared, while `stateVersion`
detects same-row edits, review transitions, archive/restore changes, and other
root mutations that do not advance the pointer. `updatedAt` is presentation
data and is not a concurrency token. State version is a positive signed 32-bit
integer; an attempted increment past its maximum fails as invalid persisted
state rather than wrapping.

Deterministic outcomes:

- Simultaneous Unverified edits: first commits; second returns stale state.
- Review versus edit: first commits; loser returns stale state or invalid
  transition.
- Simultaneous reviews: first commits; same-current Active duplicate review is
  idempotent.
- Simultaneous reviewed revisions: one advances pointer; other is stale.
- Kind change versus edit/revision: one root-locked mutation commits; the other
  is stale and cannot overwrite or duplicate history.
- Archive versus edit/review: first commits; other is stale or archived.
- Restore versus delete: first commits; delete after restore requires renewed
  confirmation; restore after delete is not found.
- Duplicate create: matching submission key and fingerprint resolve to one
  coherent root; a mismatched fingerprint is a deterministic conflict.
- Reference change versus target deletion: protected reads and foreign keys
  produce either a complete snapshot/link or a safe rollback, never a partial
  aggregate.
- Knowledge Record delete versus owner-target delete: each may commit in either
  order, but bounded deadlock/serialization handling leaves either no Knowledge
  aggregate or a complete aggregate with SetNull navigation; neither deletes or
  rewrites the neighboring owner.

Reference targets are resolved after the root lock in a fixed context, Daily
Log, then Defect order. Newly selected or newly copied live targets are loaded
through parameterized single-statement owner queries and protected with
`FOR KEY SHARE` (or the Prisma/PostgreSQL equivalent proven by the authorized
implementation) until commit. Equipment context resolves Equipment, its Mine,
and City in one coherent statement. This blocks target deletion or key changes
during snapshot/FK creation; a concurrent non-key label update may occur only
before or after that one statement, so the stored snapshot is internally
coherent. Lock ordering and bounded rollback-certain retry tests must prove
that cross-owner races cannot leave a partial aggregate.

External references are ordered by sequence.

Persistence may retry only rollback-certain Prisma P2034, PostgreSQL 40001, or
40P01 outcomes, at most three attempts. It must not retry broad P2002 errors,
string-matched transient messages, validation errors, stale states, or
ambiguous network commits. Only explicitly recognized feature constraint names
receive special mapping.

## 37. Reference Deletion And Historical-Readability Architecture

### Equipment Deactivation

The live reference remains. Current and historical display use snapshots.
Unchanged inactive context may be retained; a new selection must be active.

### Mine Deactivation

The live reference remains under the same retention rule. Derived City and Mine
snapshots remain authoritative for Knowledge Base display.

### Exceptional Equipment Deletion

The live Equipment ID becomes null through SetNull. Equipment, Mine, and City
snapshots remain. If the derived Mine still exists, its live ID may remain.
Navigation to Equipment is removed.

### Exceptional Mine Deletion

Existing reference ownership must first permit deletion. Knowledge Base Mine
IDs become null through SetNull while snapshots remain. Equipment-owner
constraints remain outside Knowledge Base.

### Daily Log Deletion

The live source ID becomes null. Date and shift snapshots remain with an
unavailable label. Knowledge Base never blocks or cascades deletion of a Daily
Log.

### Defect Deletion

The live related Defect ID becomes null. Title and reported-date snapshots
remain. Knowledge Base never blocks or cascades deletion of a Defect.

SetNull changes navigation metadata only; it does not constitute a content
revision or silently remove historical display facts.

## 38. Revalidation Architecture

After successful commit:

- Create: revalidate /knowledge-base; redirect to stable detail.
- Unverified edit: revalidate list, stable detail, edit, and history.
- Reviewed revision: revalidate list, detail, edit, history, and new revision
  detail.
- Review: revalidate list, detail, edit, history, and current revision detail.
- Kind change: revalidate list, detail, edit, and history.
- Archive: revalidate list, detail, edit, and history.
- Restore: revalidate list, detail, edit, history, and created restored
  revision detail when applicable.
- Delete: revalidate list; redirect to list.

Daily Log, Defect, Day View, Equipment, Mine, and unrelated feature routes are
not revalidated because Knowledge Base owns only outbound presentation.

## 39. Client/Server Architecture

Server Components own list, detail, history, reference options, validation
context, and rendered Markdown.

Server Actions own mutations. Prisma remains server-only.

Client components are limited to:

- Form pending and submitted-state recovery.
- Dynamic context-field visibility.
- Ordered external-reference rows.
- Filter controls.
- Destructive confirmation dialog.

There is no global client store, client database access, autosave, offline
queue, synchronization layer, rich-text editor, or client-rendered trusted HTML.

## 40. Accessibility Architecture

V1 requires:

- Logical keyboard order and visible focus.
- Proper labels and descriptions for every input.
- Error summary linked to field errors.
- Focus transfer to the error summary after failed submission.
- Semantic headings for records and history.
- Alert/note semantics for caution and unverified warning.
- Text labels and non-color cues for kind, trust, and lifecycle.
- Accessible names for external and owner-feature links.
- Destructive confirmation with initial safe focus, focus trap, Escape
  behavior, and focus restoration.
- Minimum practical touch target sizing for mobile use.
- Screen-reader announcements for pending and successful mutations.

## 41. Security And Privacy Architecture

Knowledge Base V1 stores ordinary personal operational text, not secrets,
confidential document copies, employee-sensitive data, or approved procedures.

Forms and detail surfaces state the prohibited-content boundary. Validation
rejects structural hazards such as unsafe links and Markdown but does not claim
perfect semantic secret detection.

Security requirements:

- HTTPS-only URL parsing with credential rejection.
- Server-side Markdown AST allowlist.
- Output encoding and no raw HTML execution.
- No body or URL values in logs or analytics.
- Safe feature-owned public errors.
- No original corporate document storage.
- No authentication implementation in this feature.
- Synthetic, non-sensitive fixtures for development and automated tests.

Architecture and implementation testing do not depend on authentication.
Confidential operational use remains unauthorized until a separately accepted
access boundary is implemented and verified.

## 42. Test Architecture

### Unit Tests

- Enum labels and exact product vocabulary.
- Normalization, limits, and snapshot display helpers.
- Material-difference detection.
- Canonical create fingerprint and same-key/same-payload versus
  same-key/different-payload behavior.
- Trust/lifecycle transition matrix.
- Root/current/revision integrity mapping, including contiguous history,
  higher decoys, and non-current Unverified rejection.
- Markdown plain-text excerpt behavior.
- Stable route and revision URL encoding.

### Validation Tests

- Title, body, caution, and change-summary boundaries.
- Every content kind.
- Context exclusivity and derived Mine coherence.
- External-reference count, order, duplicates, HTTPS, credentials, schemes,
  and length.
- Markdown allowlist and raw HTML, image, table, embed, and unsafe-link
  behavior.
- Strict FormData cardinality and runtime non-string values.
- Query parameter normalization.

### Query Tests

- Stable-root ownership and explicit current relation.
- Narrow selects and no all-revision overfetch on list.
- Search title/body OR under independent filter AND predicates.
- Combined filters, lifecycle default, ordering, count, pagination, and URL
  normalization.
- Exact count/result predicate parity and safe out-of-range page handling.
- Global-empty, archived-only, filter-empty, and out-of-range distinctions.
- Current detail and history integrity.
- Reference and relationship option eligibility.
- No application filtering, sorting, or deduplication.
- Safe query and integrity failure translation.

### Server Action Tests

- Strict inputs and route-bound IDs.
- One persistence call.
- Commit-before-redirect.
- Revalidation boundaries.
- Submitted-input recovery.
- Safe error mapping.
- Injected logging-boundary assertions proving content, snapshots, URLs,
  fingerprints, and raw persistence details are absent.
- No broad redirect catch.
- No neighboring feature mutation.

### Component Tests

- Responsive semantic structure, touch-target classes, and record cards;
  component tests do not claim pixel-level viewport proof.
- External-reference row behavior.
- Context-field behavior.
- Trust, caution, archive, and disclaimer presentation.
- Restricted-Markdown source help and committed server-rendered output; V1 has
  no live preview.
- Destructive confirmation.
- Accessible pending and error states.

### Route Tests

- List, create, stable detail, edit, history, and revision detail.
- Active and archived controls.
- Unverified and Personally Reviewed controls.
- Empty, not-found, integrity-failure, and persistence-failure boundaries.
- Missing-reference snapshots.
- No Day View contribution or link-management controls, plus an existing Day
  View composition regression proving no Knowledge Base helper or section was
  added.

### PostgreSQL Integration Tests

- Migration and constraints.
- Same-owner current pointer.
- Create, in-place edit, review, reviewed revision, kind change, archive,
  restore, and delete.
- Reference snapshots and SetNull behavior.
- External-reference ordering and rollback.
- Search/filter/order/pagination.
- Every defined concurrency race.
- Duplicate create and ambiguous-safe state behavior.
- No cross-feature mutation.
- Cleanup and repeatability.

## 43. PostgreSQL Evidence Plan

The implementation must use a dedicated disposable PostgreSQL database named
exactly **nam_knowledge_base_test**.

The guard must:

- Require **KNOWLEDGE_BASE_TEST_DATABASE_URL**.
- Require PostgreSQL protocol.
- Parse the URL safely.
- Require the exact database name.
- Reject **nam_dashboard**.
- Never fall back to ordinary DATABASE_URL.
- Never print credentials.
- Produce zero skipped tests in final evidence.
- Never create, migrate, reset, truncate, or clean a database by itself; database
  provisioning remains outside the test process and requires separate
  authorization.
- Clean only phase-owned fixtures and preserve unrelated disposable records.

Real PostgreSQL evidence must prove:

- Ordered additive migration application and current migration status.
- Live-schema-to-Prisma no-drift result.
- Enum, length, lifecycle, trust, origin, context, owner-pointer, sequence, and
  uniqueness constraints.
- Atomic initial create and current pointer.
- Unverified edit in place with no new revision.
- Review transition and production-boundary reviewed immutability without
  claiming a database trigger protects against arbitrary administrator SQL.
- Atomic reviewed revision and rollback preserving old current.
- Kind-change behavior from both trust states.
- Archive and both restore paths.
- Permanent deletion for every accepted state and relationship combination.
- External-reference replacement, ordering, duplicates, and rollback.
- Daily Log and Defect SetNull plus snapshot retention.
- Equipment and Mine deactivation/deletion behavior where safe fixtures permit.
- All concurrency outcomes in section 36 using independent Prisma clients.
- Root, revisions, references, and relationships remain unchanged after failed
  transactions.
- Owner records are never deleted by Knowledge Base.
- Phase-owned fixtures are completely cleaned without touching unrelated data.

## 44. Migration Architecture

No migration is created in Phase 28.2.

The proposed implementation uses two additive migrations:

1. **knowledge_base_foundation**
   - Feature enums.
   - KnowledgeRecord.
   - KnowledgeRecordRevision.
   - KnowledgeRevisionExternalReference.
   - Mine and Equipment live context relations.
   - Same-owner current-pointer constraint.
   - Checks, uniqueness, and indexes.
2. **knowledge_base_daily_log_defect_links**
   - Nullable Daily Log and Defect live-reference fields.
   - Limited relationship snapshots.
   - SetNull foreign keys and indexes.

Splitting owner-feature relationships keeps the highest cross-feature deletion
and cleanup risk independently reviewable. All columns are additive. The first
migration assumes no Knowledge Base rows because it creates the feature. The
second migration must assume records created by accepted earlier slices may
already exist: every relationship and snapshot column it adds is nullable, so
those rows represent “no relationship” without a data backfill. Migration
evidence must seed a pre-relationship record, apply the second migration, and
prove that content and current authority remain unchanged. No production
backfill is designed or authorized.

Migration SQL must order enum creation, root creation, revision creation,
children, indexes/checks, and the same-owner pointer foreign key so dependencies
are explicit. The pointer remains nullable for transactional cycle staging, but
public persistence must never commit a root without a valid pointer.

Prisma 6.16 can represent the root/revision relations, composite uniqueness,
same-owner composite foreign key, owned cascades, and optional SetNull owner
references using the existing Supply Request pattern. Manual migration SQL is
still required for positive-number, length, lifecycle/timestamp,
trust/timestamp, origin/summary, context/snapshot, HTTPS-shape, and ordered-
sequence check constraints that Prisma schema syntax cannot express. Those
checks do not enforce cross-row current-is-highest history or material-column
immutability; feature transactions and persisted-state validators own those
invariants, as sections 7 and 10 state. No database trigger, raw-SQL current
selection, or timestamp/MAX inference is introduced.

Migration directories use the repository timestamp convention with bounded
names ending in `knowledge_base_foundation` and
`knowledge_base_daily_log_defect_links`.

Rollback evidence means disposable-database transaction and failed-migration
proof; destructive production rollback is not promised.

## 45. Implementation Sequence

Every proposed implementation phase requires a later explicit authorization.
No phase after 28.2 is authorized by this architecture acceptance. Each future
implementation phase is followed by an independent review subphase and formal
acceptance bookkeeping before the next phase.

### Phase 28.3A — Knowledge Base Persistence Foundation

- Scope: First migration, Prisma conceptual models, constraints, generated
  client, schema tests, and disposable PostgreSQL integrity tests.
- Exclusions: Routes, actions, product UI, Daily Log/Defect relationships.
- Expected paths: prisma schema and one migration; focused schema and
  PostgreSQL tests.
- Schema impact: Add Knowledge Base foundation enums and tables.
- PostgreSQL evidence: Migration, constraints, same-owner pointer, context,
  snapshots, ordering, cascades, drift, cleanup.
- Tests: Schema/migration and guarded PostgreSQL tests.
- Review: Independent persistence review required.
- Acceptance: Foundation matches this architecture with no production surface.

### Phase 28.3B — Transactional Create And Current Detail

- Scope: Create persistence/action/form, stable current detail, restricted
  Markdown renderer, disclaimer, warning, and create idempotency.
- Exclusions: List search, editing, review, archive, relationships.
- Expected paths: Knowledge Base feature module, list entry navigation, create
  and stable-detail routes, unit/action/component/PostgreSQL tests, plus an
  explicitly reviewed parser/renderer dependency and lockfile change if the
  accepted implementation requires them.
- Schema impact: None beyond 28.3A.
- PostgreSQL evidence: Atomic create, current pointer, submission-key
  idempotency, snapshots, external references, rollback.
- Tests: Validation, Markdown safety, action, route, component, persistence.
- Review: Independent create/detail and Markdown-safety review required.
- Acceptance: One safe Active Unverified record can be created and read.

### Phase 28.4 — Canonical Knowledge Base Search And Filtering

- Scope: Canonical list, search, filters, ordering, pagination, normalized URL
  state, and empty/error states.
- Exclusions: Mutation expansion and global search.
- Expected paths: Feature-owned filters/data/types and list route/tests.
- Schema impact: No migration expected.
- PostgreSQL evidence: Pointer-only search, combined filters, exact order,
  pagination, no duplicates, no silent truncation.
- Tests: Unit, query, route, component, PostgreSQL.
- Review: Independent query and URL review required.
- Acceptance: Stable roots are retrievable through the approved V1 contract.

### Phase 28.5 — Unverified Editing And Personal Review

- Scope: In-place Unverified edit, external-reference replacement, personal
  review, optimistic state, locks, and errors.
- Exclusions: Reviewed-content revision/history, archive, relationships.
- Expected paths: Edit/review validation, actions, persistence, edit UI, tests.
- Schema impact: No migration expected.
- PostgreSQL evidence: In-place update, review, edit/review races, rollback,
  idempotent duplicate review.
- Tests: Validation, persistence, action, component, concurrency.
- Review: Independent mutation/concurrency review required.
- Acceptance: Unverified content edits safely and becomes frozen when reviewed.

### Phase 28.6 — Reviewed Revision History And Content-Kind Change

- Scope: Reviewed-content revision transaction, change summary, kind change,
  history list, revision detail, stable URLs.
- Exclusions: Archive/restore/delete and feature relationships.
- Expected paths: Revision persistence, history queries/routes/components, and
  tests.
- Schema impact: No migration expected.
- PostgreSQL evidence: Immutable reviewed retention, pointer advance, races,
  rollback, historical snapshots and references.
- Tests: Unit, action, query, route, component, concurrency.
- Review: Independent revision-authority review required.
- Acceptance: Reviewed content can evolve without losing reviewed history.

### Phase 28.7 — Archive, Restore, And Permanent Delete

- Scope: Archive/read-only enforcement, both restore paths, destructive delete,
  safe confirmation, cleanup, and lifecycle UI.
- Exclusions: Other owner relationships.
- Expected paths: Lifecycle actions/persistence/UI and tests.
- Schema impact: No migration expected.
- PostgreSQL evidence: State matrix, reviewed restore copy, full aggregate
  delete, races, rollback, no owner deletion.
- Tests: Unit, action, component, route, concurrency, PostgreSQL.
- Review: Independent deletion and lifecycle review required.
- Acceptance: Every accepted lifecycle/delete behavior is proven.

### Phase 28.8 — Daily Log And Defect Relationships

- Scope: Second migration, optional selection, snapshots, stable navigation,
  SetNull behavior, current/history presentation, and owner isolation.
- Exclusions: Reciprocal controls, automatic links, additional feature links.
- Expected paths: Prisma migration, feature relationship data/forms/detail,
  Daily Log/Defect-independent tests.
- Schema impact: Add only nullable relationship fields, snapshots, indexes, and
  two SetNull foreign keys.
- PostgreSQL evidence: Link create/change/remove, target deletion, concurrent
  deletion, pre-relationship-row migration preservation, historical
  readability, cleanup, no cross-owner mutation.
- Tests: Schema, validation, action, query, route/component, PostgreSQL.
- Review: Independent relationship and cascade review required.
- Acceptance: Both optional one-way relationships are complete and isolated.

### Phase 28.9 — Knowledge Base V1 Acceptance And Canonical Closure

- Scope: Final regression verification, documentation synchronization,
  implemented-capability status, implementation evidence, commit, and push.
- Exclusions: New product behavior or deferred scope.
- Expected paths: Canonical Knowledge Base documentation and only corrections
  accepted by prior independent reviews.
- Schema impact: None.
- PostgreSQL evidence: All Knowledge Base suites on the dedicated disposable
  database plus affected reference regressions.
- Tests: Full feature suite, relevant regressions, full repository suite, lint,
  build, migration status, and drift.
- Review: Preceded by independent final implementation review.
- Acceptance: Knowledge Base V1 is complete and accepted with no skipped
  required evidence.

## 46. Independent Review Plan

Phase 28.2.1 independent architecture review verified:

- Fidelity to every Phase 28.1 product decision.
- Separation of content kind, trust, and lifecycle.
- Stable-root and same-owner current-pointer correctness.
- Selective mutable/immutable revision semantics.
- Restore behavior and reviewed-history preservation.
- Permanent deletion across every accepted state.
- Context constraints and historical snapshots.
- Daily Log and Defect one-way ownership.
- External-reference limits and URL security.
- Restricted Markdown storage, parser, renderer, and XSS boundary.
- Search/filter/pagination semantics and absence of generic search.
- Server Action, query, error, revalidation, and client/server boundaries.
- All concurrency outcomes and bounded retry classification.
- Migration ordering and dedicated disposable-database guard.
- Test completeness and real PostgreSQL evidence.
- No Day View, media, auth, AI, tags, generic relationships, generic revisions,
  or other excluded/deferred scope.
- Canonical documentation consistency and absence of implementation
  authorization.

Review findings were classified and corrected only within the authorized
documentation boundary. Phase 28.2.2 formal architecture acceptance is
complete. These review requirements remain the baseline for detecting future
architecture drift.

## 47. Architecture Acceptance Criteria

### Ready For Independent Review

- All 47 required architecture areas are resolved.
- Canonical product documents reflect completed discovery and the proposed
  architecture.
- Links and Markdown structure validate.
- No implementation file changed.

Outcome: Completed in Phase 28.2.1.

### Ready For Formal Acceptance

- Independent review reports no unresolved critical, high, or medium defect.
- Product decisions remain unchanged.
- Aggregate, delete, Markdown, relationship, concurrency, and test boundaries
  are internally consistent.
- Canonical status language records Approved architecture and implementation
  not started after the acceptance milestone updates it.

Outcome: Completed in Phase 28.2.2.

### Eligible For Implementation Authorization

- The Chief Software Architect formally accepts this architecture.
- Canonical status synchronization is committed.
- An implementation phase is explicitly authorized with an exact starting
  commit and bounded paths.
- Disposable PostgreSQL safety requirements are available.

Current outcome: Architecture acceptance is complete, but no implementation
phase is authorized. Phase 28.3A remains Proposed.

### Product Discovery Must Reopen If

- V1 requires organizational approval, another reviewer, or multiple users.
- Confidential corporate documents or real restricted operational data become
  required.
- Photos, attachments, OCR, AI, global search, offline use, or Day View becomes
  mandatory.
- Multi-Equipment or model/category applicability becomes essential.
- Permanent deletion is withdrawn or regulated retention is introduced.
- The feature is expected to own Defect, Daily Log, Equipment, Mine, or
  corporate procedure lifecycle.
