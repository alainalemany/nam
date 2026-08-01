# Product Roadmap

This document is the canonical home for NAM Dashboard product roadmap planning.

It defines the planned evolution of product capabilities: what should be
delivered, why it is prioritized, which capabilities belong to the MVP, which
capabilities are deferred, and how ideas move toward implementation.

It does not define detailed product requirements, module workflows, database
schema, delivery lifecycle, dependency architecture, application architecture,
implementation standards, test strategy, or infrastructure operations.

## Classification

| Classification | Meaning |
| --- | --- |
| Implemented | Product capability exists in the current application foundation. |
| In Progress | A roadmap phase contains both implemented and remaining capabilities. |
| Planned | Confirmed product capability intended for Version 1 or a documented future phase. |
| Deferred | Product capability intentionally excluded from Version 1. |
| Candidate Future | Unapproved future possibility that requires later evaluation. |

## Purpose

The product roadmap explains product delivery order and product value.

It should answer:

- Which product capabilities are implemented, planned, deferred, or only
  candidate future ideas?
- Which capabilities belong to the MVP?
- Why should one capability be delivered before another?
- Which delivery order is based on product priority, and which order is based on
  feature dependency?
- How does a future idea become approved implementation work?

Delivery lifecycle and milestone design live in `docs/delivery-architecture.md`.
Dependency types and dependency-management principles live in
`docs/dependency-architecture.md`.
Detailed implementation phases remain in `docs/roadmap.md`.

## Relationship To Other Documentation

| Document | Relationship |
| --- | --- |
| `docs/product-vision.md` | Defines product identity, users, business objectives, MVP, and long-term direction. |
| `docs/product-roadmap.md` | Defines product capability sequencing, priority, deferred scope, and roadmap governance. |
| `docs/delivery-architecture.md` | Defines delivery lifecycle, milestone design, dependency handling, and completion flow. |
| `docs/dependency-architecture.md` | Defines dependency types, dependency principles, and dependency evolution. |
| `docs/prd.md` | Defines confirmed product requirements and Version 1 scope details. |
| `docs/modules.md` | Defines module workflows, capabilities, and boundaries. |
| `docs/database.md` | Defines entities, relationships, enums, and data rules. |
| `docs/roadmap.md` | Defines module-by-module implementation phases. |
| `docs/ideas.md` | Holds unapproved future concepts before promotion. |
| `docs/feature-architecture.md` | Defines how approved features become implementation slices. |
| `docs/engineering-quality-standards.md` | Defines Definition of Done, verification, and handoff expectations. |

## Product Planning Principles

### MVP Before Expansion

Version 1 should prove the product value through reliable manual entry,
date-centered history, and connected operational records before adding
automation or external integrations.

### Product Priority Is Not The Same As Dependency

Product priority describes business value and sequencing preference.
Dependency describes what must exist first for a feature to be implemented
cleanly.

A high-priority feature may still wait for a dependency. For example, Work
Authorizations are important, but they belong under Shift Reports because the
work occurs during a specific shift.

### Manual Reliability Comes Before Automation

Automated imports, parsing, submissions, recommendations, and integrations
should remain deferred until the manual workflow is useful and reliable.

### Historical Lookup Is The Main Product Outcome

Roadmap priority should favor capabilities that improve the ability to answer
what happened on a date, which equipment was involved, which records existed,
and what context surrounded the workday.

### Sensitive Financial Scope Requires Extra Discipline

Payslip and compensation records are part of the long-term product vision, but
they require privacy, storage, and access-control decisions before broad
implementation.

## Product Delivery Phases

### Phase 0: Product Foundation

Status: Implemented

Business value:

- Establishes the first usable operational records.
- Proves the product can connect workday history to mines and equipment.
- Creates a foundation for future module links.

Capabilities:

- Operations reference data for cities, mines, and equipment.
- Daily Work Log create, edit, list, and detail workflows.
- Multiple manual activity entries per Daily Log.
- Daily Log and activity links to mine and equipment records.
- Daily Log summary and activity timeline views.

Success criteria:

- The operator can maintain core operational context.
- The operator can create a workday record with multiple activities.
- Daily Log records can be reviewed later with date, mine, equipment, and
  activity context.

### Phase 1: MVP Workday History

Status: Implemented foundation; residual enhancements deferred or separately
authorized

Business value:

- Turns the Daily Log foundation into the core workday memory.
- Makes historical lookup useful across dates and records.
- Gives later modules a date-centered navigation target.

Capabilities:

Implemented:

- Daily Log feature-owned filtering and date navigation.
- Day View navigation and selected-workday composition, guided by
  `docs/architecture/features/day-view.md`.
- Date-aware participation for Shift Reports, Daily Work Logs, STOP Cards,
  Daily Inspections, Operational Safety Checklists, Work Authorizations, Defect
  Tracking, Work Schedule, Timesheet, Equipment Fuel Events, and Supply
  Requests. Day View now composes eleven feature-owned contributors.

Residual work:

- Broader historical lookup across modules requires a separately confirmed
  retrieval problem and feature-owned scope.
- Cross-record links remain feature-owned and require separately approved
  workflows.
- Global cross-module search remains deferred until separately approved.

Success criteria:

- The operator can find prior workday records by date, text, equipment, mine,
  and module context.
- A selected date can show direct workday records and relevant surrounding
  context.
- Daily Log remains the narrative layer without replacing structured modules.

### Phase 2: Shift And Safety Records

Status: Implemented foundation; optional photo evidence blocked and other
residual enhancements separately authorized

Business value:

- Captures safety and shift paperwork that currently lives across paper forms,
  notes, and memory.
- Connects work activity, inspections, defects, and authorizations to the shift
  where they occurred.

Capabilities:

Implemented foundations and current Day View participation:

- STOP Cards, including feature-owned list filtering.
- Shift Reports, including feature-owned list filtering.
- Work Authorizations with required Shift Report parent context and
  feature-owned list filtering.
- Daily Inspections, including current-schema feature-owned list filtering.
- Defect Tracking, with approved architecture, V1 foundation, and Day View
  participation implemented, including feature-owned list filtering.
- Operational Safety Checklists, with accepted V1 foundation, canonical
  Dragline and Mobile catalogs, correction workflow, and feature-owned history
  filtering, `HOURS`/`MILES` meters, NAM save feedback, Create Another, and Day
  View participation.

Blocked or separately authorized work:

- Optional checklist-level photo evidence remains blocked; no implementation
  is authorized until ADR-018's access, processing, storage, and backup gates
  are satisfied and a separate implementation milestone is approved.
- Add cross-record relationships only where approved workflows require them.

Success criteria:

- Shift Reports can connect work activity, inspections, and related paperwork.
- Work Authorizations are created from the correct shift context.
- Inspections and defects can be reviewed historically with equipment and date
  context.

Dependency notes:

- Work Authorizations depend on Shift Reports because a Work Authorization
  should not exist independently from the shift where the work occurred.
- Defects and inspections benefit from equipment reference data and Day View,
  but their exact implementation order can be decided by immediate product
  need.

### Phase 3: Personal Work Administration

Status: Complete for the approved foundations

Business value:

- Centralizes the operator's schedule, time, fuel, and related personal
  operational records.
- Improves personal reconciliation across schedule, work performed, submitted
  logs, and historical records.

Capabilities:

- Work Schedule, with V1 foundation and Day View participation implemented.
- Timesheet, with the V1 foundation, Day View participation, and URL-addressable
  Weekly Timesheet history filtering implemented. Structured filters support
  payroll-week overlap, status, Equipment, Work Code, Work Order, Support
  Personnel, and overtime while retaining inactive historical reference
  choices and snapshot meaning.
- Equipment Fuel Events for operational fuel delivered to Equipment.
- Separate future Fleet context remains deferred.
- Supply Requests, with Phase 26.1 product discovery, Phase 26.2 feature
  architecture, Phase 26.2.1 independent review, and Phase 26.2.2 formal
  acceptance complete. The architecture is Approved, Phases 26.3A through
  26.10 are implemented and accepted, and Supply Requests V1 is complete and
  accepted. The approved V1 operator workflow includes recording a request
  already submitted through the corporate system, Supply Item and supervisor
  management, permanent NAM References, current detail, fulfillment and
  cancellation, explicit correction, complete immutable history, canonical
  current-version history and filtering, explicit Submission and Fulfillment
  Daily Log Activity links, and Day View participation. NAM never performs the
  corporate submission and Supply Requests create no Daily Log or Activity
  automatically.

  Day View presents one structured current request per stable root on its
  pointer-owned current operational work date. Resulting status, Equipment and
  supervisor snapshots, current item count, and submitted local date/time come
  from the feature-owned display-ready contract. Fulfillment Daily Log
  narrative remains separate, and correction or Daily Log link state does not
  create duplicate structured entries. Phase 26.10 required no schema or
  migration change. No new Supply Requests implementation phase is planned;
  deferred enhancements remain outside V1 and require separate product and
  architecture authorization. Infrastructure recovery and the operational
  pilot remain parked outside this feature series.

Success criteria:

- The operator can manually record schedules and changes.
- Historical Weekly Timesheets can be found through structured, URL-addressable
  filters and recognized through compact snapshot-based daily context.
- Equipment fueling can be reviewed by date, Equipment, fuel type, tank-fill
  quantity, and service context.
- Operator-originated supply requests can be retrieved without introducing
  inventory or purchasing ownership.

Dependency notes:

- These modules can be developed independently after shared reference data
  exists.
- Their value increases when Day View and searchable history can show their
  records alongside Daily Logs and shift records.

### Operational Usage Pilot

Status: Parked; authorization gates remain incomplete

Phase 24.2 readiness assessment is complete. Phase 24.2.1 provides the
[Operational Pilot Runbook](infrastructure/operational-pilot-runbook.md), but
real operational use is not yet authorized. Phase 24.2.2 selected the private
access architecture, and ADR-019 records the approved managed private overlay
with Tailscale as the implementation reference. Phase 24.2.2.1 records the
controlled implementation and verification plan. The access implementation,
current-deployment, reference-data, recovery, and pilot-scope gates must all
pass before the first real shift.

No new product feature is required merely to continue preparation. Phase 23.5
photo evidence remains blocked by its approved access and media prerequisites.
The operational pilot remains gated and parked outside the Supply Requests
feature series. Supply Requests were selected through explicit product
direction; their architecture and later implementation do not authorize or
depend on resuming the pilot.

### Phase 4: Knowledge And Sensitive Records

Status: Conceptually planned; discovery and prerequisite closure required

Business value:

- Preserves reusable operational knowledge.
- Archives sensitive financial records separately from operational records.

Capabilities:

- Knowledge Base.
- Payslip Repository.

Success criteria:

- Knowledge Base records can be organized by location, mine, equipment, and
  topic.
- Payslip records can be archived and reviewed without mixing compensation data
  into general operational records.

Dependency notes:

- Knowledge Base benefits from stable location, mine, and Equipment context,
  but it still requires focused V1 product discovery and an accepted Level 2
  feature architecture. Attachment and media needs remain part of that future
  discovery rather than an implementation authorization.
- Payslip Repository is supported by ADR-005 bounded-context guidance but is
  blocked from implementation until privacy, access, storage, extraction,
  redaction, and export decisions are complete and an accepted Level 2 feature
  architecture exists.

### Phase 5: Product Expansion

Status: Deferred / Candidate Future

Business value:

- Adds automation, integrations, exports, analytics, or organizational features
  only after the manual recordkeeping product is dependable.

Capabilities:

- Deferred capabilities listed in this document.
- Candidate future ideas tracked in `docs/ideas.md`.
- Future enhancements listed in `docs/roadmap.md`.

Success criteria:

- A candidate capability solves a confirmed product problem.
- Manual workflows remain useful without the automation.
- Security, maintenance, privacy, and reliability tradeoffs are documented
  before implementation.

## MVP Definition

The MVP is the first version that makes NAM Dashboard useful as a personal
operations memory.

MVP capabilities:

- Manual data entry.
- Daily Log.
- Shift Reports.
- Work Authorizations.
- Work Schedule.
- Timesheet.
- Equipment Fuel Events.
- Operational Safety Checklist meter-unit and NAM save-confirmation
  enhancements under the approved Phase 23.3 architecture.
- Optional checklist-level photo evidence after its access and infrastructure
  prerequisites are approved and verified.
- Searchable historical records.
- Calendar and Day View navigation.
- Clean modular database design.

The MVP should not require:

- Mobile app support.
- AI-generated recommendations.
- GPS integration.
- Weather API integration.
- QR code tracking.
- Inventory management.
- Crew management.
- Parts ordering.
- Offline mode.
- Automatic SMS import or parsing.
- Automatic submission to external work systems.

## Priority And Dependency Summary

| Capability group | Product priority | Main dependency | Status |
| --- | --- | --- | --- |
| Operations reference data | Establishes shared mine and equipment context. | None beyond the application foundation. | Implemented |
| Daily Work Log foundation | Establishes the first usable workday history. | Operations reference data. Feature architecture: `docs/architecture/features/daily-work-logs.md`. | Implemented |
| Feature filtering, date navigation, and Day View | Makes historical lookup practical across implemented modules. | Daily records and date-aware modules. | Feature-owned filtering and Day View composition implemented for current operational modules; global cross-module search deferred |
| Controlled operational pilot | Validates implemented workflows with narrowly governed real use. | Implemented and verified ADR-019 private access, current verified deployment, reviewed reference data, and proven current-schema recovery. | Phase 24.2 assessment and Phase 24.2.1 runbook complete; Phase 24.2.2.1 access architecture approved; implementation pending; real pilot not authorized |
| STOP Cards | Captures safety observations and corrective actions. | Day View context; feature architecture: `docs/architecture/features/stop-cards.md`. | V1 foundation, filtering, and Day View participation implemented |
| Daily Inspections | Captures equipment inspection findings and condition context. | Equipment reference data and Day View context; feature architecture: `docs/architecture/features/daily-inspections.md`. | Daily Inspection and Operational Safety Checklist foundations, feature-owned filtering, and Day View participation implemented |
| Shift Reports | Creates the parent structure for shift paperwork. | Daily/date context and equipment references. Feature architecture: `docs/architecture/features/shift-reports.md`. | V1 foundation, filtering, and Day View participation implemented |
| Work Authorizations | Captures safety and maintenance work records. | Shift Reports. Feature architecture: `docs/architecture/features/work-authorizations.md`. | V1 foundation, filtering, and Day View participation implemented |
| Defect Tracking | Captures equipment issue history from report through closure. | Equipment reference data and feature architecture: `docs/architecture/features/defect-tracking.md`; stronger value with Day View. | V1 foundation, filtering, and Day View participation implemented |
| Work Schedule and Timesheet | Supports personal schedule and time reconciliation. | Reference data; stronger value with Day View. Work Schedule feature architecture: `docs/architecture/features/work-schedule.md`; Timesheet feature architecture: `docs/architecture/features/timesheets.md`. | Work Schedule and Timesheet V1 foundations and Day View participation implemented; Timesheet structured, URL-addressable Weekly Timesheet history filtering complete |
| Equipment Fuel Events | Captures operational fuel delivered to one Equipment subject, including multi-tank occurrences. | Equipment reference data; boundary assessment: `docs/architecture/equipment-operations.md`; feature architecture: `docs/architecture/features/equipment-fuel-events.md`; stronger value with Day View. | V1 foundation, structured history filtering, and Phase 24.1 Day View participation implemented |
| Supply Requests | Preserves records of requests already submitted through the corporate system, with permanent identity, ordered catalog items, lifecycle, immutable history, and bounded Daily Log and Day View context. | Equipment reference data; Phase 26.1 product decisions; boundary assessment: `docs/architecture/equipment-operations.md`; Approved feature architecture: `docs/architecture/features/supply-requests.md`. | Supply Requests V1 complete and accepted; Phases 26.1 through 26.10 complete as applicable; create, current detail, reference management, lifecycle, Correct Request, immutable history, canonical current-version history/filtering, explicit Submission/Fulfillment Daily Log Activity linking, and Day View participation available; deferred enhancements remain outside V1 and require separate authorization |
| Operational Safety Checklist meter and confirmation | Adds explicit `HOURS`/`MILES` meter units and clear NAM save confirmation. | Approved Phase 23.3 architecture. | Phase 23.4 implemented; Phase 23.4.2 monotonic marker supersession and safe presentation fallback complete |
| Operational Safety Checklist photo evidence | Adds optional checklist-level normalized photos with captions. | ADR-018 access boundary, Docker media processing, private storage, and coordinated backup/restore. | Architecture Approved; Phase 23.5 implementation and real photo use blocked until prerequisites close |
| Fleet | May later address purchases, ownership, assignments, cards, receipts, registration, insurance, and replacement lifecycle. | Separate product discovery and architecture. | Deferred; no product discovery or feature architecture; not a prerequisite for current Equipment Fuel Event or checklist workflows |
| Equipment Activity Timeline | Provides derived Equipment-centered history from feature-owned records. | Multiple implemented Equipment-centered contributors and demonstrated user need. | Deferred derived capability; implemented contributors now include Supply Requests, but recurring user demand and feature architecture remain absent |
| Knowledge Base | Preserves reusable operational knowledge. | Location, mine, and equipment organization. | Conceptually planned; focused V1 product discovery and accepted Level 2 feature architecture required before implementation |
| Payslip Repository | Preserves sensitive compensation history. | Privacy and storage decisions before expansion. | Conceptually planned under ADR-005; implementation blocked by unresolved privacy, access, storage, extraction, redaction, and export decisions and absent Level 2 feature architecture |
| Automation and integrations | Reduces manual work after workflows prove stable. | Reliable manual workflow and documented tradeoffs. | Deferred / Candidate Future |

## Deferred Capabilities

The following capabilities are intentionally deferred from Version 1:

| Capability | Roadmap status | Reason |
| --- | --- | --- |
| Mobile application | Deferred | V1 should first prove the web-based manual workflow. |
| AI-generated recommendations | Deferred | Product should first preserve reliable factual history. |
| GPS integration | Deferred | Adds integration and privacy complexity before core workflows are complete. |
| Weather API integration | Deferred | Useful context later, but not required for manual recordkeeping. |
| QR code tracking | Deferred | Adds asset workflow complexity before the core modules are stable. |
| Inventory management | Deferred | Outside the current personal operations record scope. |
| Crew management | Deferred | Current confirmed scope is personal use, not multi-user workforce management. |
| Parts ordering | Deferred | Outside the V1 recordkeeping and history scope. |
| Offline mode | Deferred | Adds sync complexity before the online workflow is proven. |
| Automatic SMS import or parsing | Deferred | Manual schedule entry is preferred for V1 reliability. |
| Automatic submission to external work systems | Deferred | Adds security, account, and maintenance risk before manual records are useful. |

Candidate future ideas remain in `docs/ideas.md` until promoted.

## Roadmap Governance

Product capabilities should move through this path:

```text
Idea or source artifact
-> docs/ideas.md
-> docs/product-roadmap.md
-> docs/delivery-architecture.md
-> docs/prd.md
-> docs/modules.md and docs/database.md
-> docs/roadmap.md
-> feature implementation
```

Promotion rules:

- An idea starts in `docs/ideas.md` unless it is already confirmed scope.
- A candidate becomes roadmap material only when it has a clear product problem,
  user value, and rough delivery placement.
- Delivery shaping, milestone design, and dependency planning belong in
  `docs/delivery-architecture.md`.
- Confirmed requirements belong in `docs/prd.md`.
- Module workflows belong in `docs/modules.md`.
- Data rules belong in `docs/database.md`.
- Implementation sequencing belongs in `docs/roadmap.md`.
- Delivery must follow `docs/feature-architecture.md`,
  `docs/application-state-and-data-flow.md`, `docs/ui-architecture.md`,
  `docs/testing-strategy.md`, and `docs/engineering-quality-standards.md`.

Roadmap updates should not promote deferred automation or integrations into V1
unless the user explicitly reopens and confirms that scope.

## Relationship To Delivery Architecture

The product roadmap decides what should be built and why. Delivery architecture
decides how approved work should be implemented.

Use this division:

| Question | Canonical document |
| --- | --- |
| What is the product? | `docs/product-vision.md` |
| What should be delivered and in what product order? | `docs/product-roadmap.md` |
| What are the detailed requirements? | `docs/prd.md` |
| How should each module behave? | `docs/modules.md` |
| What data model supports it? | `docs/database.md` |
| What is the module implementation sequence? | `docs/roadmap.md` |
| How should a feature slice be built? | `docs/feature-architecture.md` |
| How should state and mutations flow? | `docs/application-state-and-data-flow.md` |
| How should UI be composed? | `docs/ui-architecture.md` |
| How should quality be verified? | `docs/testing-strategy.md` and `docs/engineering-quality-standards.md` |
