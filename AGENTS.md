\# AGENTS.md - NAM Dashboard Project Guidance



\# Mission



The AI is expected to act primarily as:



\- Product Manager

\- Software Architect

\- Technical Analyst

\- Documentation Manager



NOT as an autonomous programmer.



During the current phase, success is measured by improving the design of the system rather than producing code.



When in doubt, ask questions before proposing implementation.



Every new discussion should classify conclusions as:



\- Confirmed

\- Recommended

\- Idea

\- Open Question



Only Confirmed items should modify project documentation.



Do not simply agree with proposed ideas.



Challenge assumptions.



When a design decision is presented:



\- identify trade-offs

\- identify scalability concerns

\- identify maintainability concerns

\- identify security implications

\- suggest simpler alternatives when appropriate



Agreement without analysis is discouraged.



If documentation becomes inconsistent, outdated, duplicated, or contradictory:



\- identify the inconsistency

\- recommend the authoritative source

\- suggest documentation cleanup



Documentation quality is part of the project itself.



\## Project Identity



NAM Dashboard is a personal mining operations dashboard for centralizing the operator's daily work records, safety activity, equipment notes, schedules, timesheets, fuel tracking, work truck logs, payslips, documents, and long-term operational history.



The project is for a dragline operator at North American Mining. It is initially a personal-use application, but it should be designed with professional architecture so it can grow into a more complete operational system later.



The user also has significant IT experience, including Linux system administration and cloud engineering, so technical conversations can assume comfort with architecture, data modeling, infrastructure tradeoffs, and implementation details.



\## Current Project Status



The project is currently in the planning, requirements, and architecture phase.



Documentation is the source of truth. No production application code has meaningfully started yet, even though `src/` and `public/` exist.



Primary docs:



\- `README.md`

\- `docs/prd.md`

\- `docs/modules.md`

\- `docs/database.md`

\- `docs/architecture.md`

\- `docs/roadmap.md`

\- `docs/ideas.md`



Reference assets and source forms live under:



\- `source-forms/`

\- `docs/assets/`



Before implementing anything substantial, read the relevant docs first and preserve their intent.



\## Core Product Goal



NAM Dashboard should replace scattered notes, paperwork, photos, PDFs, forms, memory, and disconnected systems with structured, searchable, permanent records.



The central product question is:



> What happened on a given workday, what equipment was involved, what paperwork or related records existed, and what historical context surrounds that date?



The system should become a permanent personal operational history organized by:



\- Date

\- Date range

\- Equipment

\- Mine

\- Module

\- Shift

\- Work activity

\- Attachments

\- Related records



Historical lookup, calendar navigation, and cross-module relationships are first-class product capabilities, not secondary features.



\## Planned Technology Stack



Preferred stack:



\- Next.js

\- TypeScript

\- Tailwind CSS

\- PostgreSQL

\- Prisma ORM

\- React Hook Form

\- Zod

\- TanStack Table

\- ApexCharts

\- Metronic UI Template



The architecture should remain modular, scalable, maintainable, and relational.



PostgreSQL was selected over MongoDB because the data is highly relational.



\## Working Philosophy



Documentation first, code second.



Do not casually generate application code while the project is still defining requirements unless the user explicitly asks for implementation.



When new requirements, modules, workflows, data relationships, milestones, or architecture decisions emerge, explicitly identify where they belong:



\- `docs/prd.md` for confirmed product requirements.

\- `docs/modules.md` for module definitions, workflows, capabilities, and boundaries.

\- `docs/database.md` for entities, fields, relationships, enums, and data modeling.

\- `docs/architecture.md` for architecture decisions, tradeoffs, boundaries, and consequences.

\- `docs/roadmap.md` for phased implementation plans.

\- `docs/ideas.md` for unapproved or future ideas needing evaluation.



The project should avoid losing decisions in chat history. Important information should be promoted into documentation.



\## Scope Discipline



Do not treat every idea as a requirement.



Classify new ideas as one of:



1\. Confirmed project requirement

2\. Module definition

3\. Database design decision

4\. Architecture decision

5\. Future idea requiring evaluation



If something is not approved for implementation, recommend adding it to `docs/ideas.md` and clearly state:



> Recommendation: Add this to docs/ideas.md for future evaluation.



Version 1 should stay focused on manual entry, reliable records, clean workflows, searchable history, and calendar/day navigation.



Avoid premature automation.



\## Version 1 Priorities



V1 should prioritize:



\- Manual data entry

\- Daily Log

\- Shift Reports

\- Work Authorizations

\- Work Schedule

\- Timesheet

\- Fuel Log

\- Work Truck Log

\- Searchable historical records

\- Calendar / Day View navigation

\- Clean modular database design

\- Reliable preservation of source artifacts where useful



V1 should favor manual reliability over brittle automation.



\## Version 1 Out Of Scope



The following are intentionally deferred unless the user explicitly reopens them:



\- Mobile application

\- AI-generated recommendations

\- GPS integration

\- Weather API integration

\- QR code tracking

\- Inventory management

\- Crew management

\- Parts ordering

\- Offline mode

\- Automatic SMS import or parsing

\- Automatic submission to external work systems

\- Payroll-provider login automation

\- WFS automation, scraping, or submission

\- Official work website automation

\- Automatic fuel-price lookup

\- Financial recommendation engine



These may be tracked in `docs/ideas.md` for future evaluation.



\## Architectural Decisions



PostgreSQL is the preferred database because NAM Dashboard has highly relational data: dates, shifts, equipment, mines, logs, inspections, permits, attachments, fuel records, timesheets, payslips, and cross-module links.



Work Authorizations are child records of Shift Reports. A Work Authorization must not exist as a standalone record because it happens during a specific operating shift.



Work Authorizations should be captured structurally, not only as photos or scanned forms. Original form photos may still be stored as attachments.



Optional permits are child records of a Work Authorization.



Paper-style PDF export can be added later because structured data will already exist.



NAM Dashboard prioritizes permanent operational history with search and calendar navigation. Records should be retained indefinitely unless explicitly deleted or archived by the operator.



Day View should return both direct records for a selected date and contextual records whose date range contains the selected date.



Work Schedule uses manual entry and manual editing instead of SMS import or natural-language parsing because supervisor messages may contain spelling errors, grammar issues, or accidental substitutions.



Payslip Repository is a dedicated financial bounded context because payslip data is sensitive personal financial data with different privacy, retention, extraction, and analytics requirements.



Fuel Log is a structured operational module. Fuel pricing is optional enrichment, not required for saving a record.



Work Truck Log is a structured personal log linked to Equipment, not automation of the official work website.



\## Core Modules



Current planned modules include:



\- Dashboard Home

\- Daily Log

\- Shift Reports

\- Work Authorizations

\- Daily Inspections

\- Defect Tracking

\- Knowledge Base

\- Work Schedule

\- Timesheet

\- Fuel Log

\- Work Truck Log

\- Payslip Repository



Dashboard Home should show high-level open items, recent activity, safety, maintenance, and operational stats.



Daily Log is the operator's narrative layer and full-day activity record.



Shift Reports are structured shift-level records connecting work activity, inspections, Work Authorizations, and related paperwork.



Work Authorizations handle safety and maintenance work records tied to a Shift Report.



Daily Inspections handle pre-shift and operational inspection findings.



Defect Tracking tracks equipment issues from report through closure.



Knowledge Base stores field notes, procedures, troubleshooting, safety notes, training, and equipment-specific knowledge.



Work Schedule tracks manually entered weekly assignments and changes.



Timesheet tracks personal weekly time entries, pay codes, work codes, equipment, comments, and totals.



Fuel Log tracks diesel deliveries, gasoline purchases, gallons, vendors, pricing, receipts, and equipment links.



Work Truck Log tracks work truck mileage, daily website log responses, submitted status, and related fuel activity.



Payslip Repository stores payslip PDFs and extracted payroll data in a separate financial context.



\## Historical Search And Day View



Historical search and calendar navigation are cross-module capabilities.



The user should be able to select a date, such as January 16, 2025, and see what happened that day across schedules, daily logs, shift reports, inspections, work authorizations, defects, fuel, timesheets, work truck records, work orders, notes, and attachments.



Day View should include:



\- Exact-date records for the selected date

\- Period records containing the selected date, such as the schedule week

\- Related records connected through equipment, mine, shift, or module links

\- Optional financial context when compensation visibility is enabled



Records should support searching by:



\- Date

\- Date range

\- Equipment

\- Mine

\- Activity type

\- Module

\- Notes

\- Linked work order

\- Contractor

\- Company

\- Meaningful metadata



PostgreSQL full-text search may be used for notes, descriptions, and titles.



A searchable activity/index table may be added later if direct module queries become too slow.



\## Daily Log



Daily Log records the operator's full workday as a searchable timeline.



It should capture activities such as:



\- Moving the dragline

\- Making a cut

\- Greasing the bucket

\- Fuel service / diesel delivery

\- Scheduled PM

\- Equipment alarms

\- Sensor observations

\- Work order activity

\- Lockout/tagout activity

\- Hot work

\- Working at heights

\- Work Authorization opened or completed

\- Escorting contractors or visitors

\- Maintenance observations

\- Delay or downtime events

\- Production notes

\- Safety observations

\- General shift notes



Daily Log should link to related modules rather than duplicating structured data as plain text.



Equipment-specific observations should usually start in Daily Log because they happened on a specific date during a specific shift.



If an observation becomes reusable knowledge, it should also be linked to a Knowledge Base article or equipment profile.



V1 Daily Log should support manual entries, activity categories, notes, dates, equipment links, and basic related-record links.



\## Work Authorizations



A Work Authorization is required when maintenance, electrical, mechanical, PM, breakdown, or other technician work is performed on the dragline during a shift.



Every Work Authorization must belong to a Shift Report.



Standalone Work Authorizations are not allowed.



The operator fills out Work Authorization records in NAM Dashboard.



Technician-owned paperwork is outside NAM Dashboard scope, but technician names, roles, companies, and signatures may be captured.



Dragline number is the primary equipment identifier for this workflow.



Potential permit types:



\- Workplace Exam

\- Confined Spaces

\- Lockout / Tagout

\- Hot Work

\- Working at Heights

\- STOP Card / Job Hazard Analysis



Lockout Permit is not always required, but is required in most scenarios. The system should default Lockout Permit Required to Yes. If set to No, require a reason.



Each Work Authorization should include a completion checklist before closing.



Future capability: paper-style PDF exports matching the original Work Authorization forms.



\## Work Schedule



Work Schedule tracks weekly assignments manually.



The operator usually receives the next week's schedule by SMS on Friday, sometimes Saturday.



The system should allow manual entry in English even if the source message was Spanish.



Schedules must be editable because supervisors may send updates before or during the week.



The system should preserve enough schedule history to show what was originally planned, what changed, and what is currently expected.



Automatic SMS reading and natural-language parsing are out of scope for V1.



Work Schedule should inform shift creation but not replace Daily Log or Shift Report.



\## Timesheet



Timesheet tracks the operator's personal weekly time entries.



It should preserve key fields from the WFS workflow:



\- Work date

\- Pay code

\- Hours

\- Equipment

\- Work code

\- Work order

\- Worked pay grade

\- Worked company code

\- Worked business unit

\- Injury

\- Comments



Pay code fixed list:



\- Regular Time

\- FTO

\- On Call Pay

\- Unpaid Leave



New entries default to:



\- Pay code: Regular Time

\- Worked company code: 00067

\- Worked business unit: 141

\- Injury: false



Defaults must remain editable.



Work date, pay code, and hours are required.



Timesheet entries should group by work week and work date.



Daily totals and weekly total hours should be calculated automatically.



Equipment, work codes, and work orders should be reusable searchable/autocomplete lists.



Timesheet records participate in Day View and global historical search.



Timesheet does not replace Work Schedule or Daily Log. Schedule records expected assignments, Daily Log records what happened, and Timesheet records payroll-facing hours and codes.



\## Fuel Log



Fuel Log records diesel deliveries, gasoline purchases, and fuel service events.



Fuel records should save operational facts even when price is unknown.



Primary facts:



\- Date

\- Time

\- Equipment

\- Mine/location

\- Fuel type

\- Gallons delivered or purchased

\- Vendor/service provider/gas station

\- Delivery truck identifier if known

\- Notes

\- Attachments



Pricing is optional:



\- Price per gallon

\- Total USD

\- Price source

\- Price status: Actual, Estimated, Unknown



Estimated fuel value should be calculated from gallons and selected price per gallon.



Fuel records participate in Day View and global search.



V1 supports manual records and basic totals by date range, equipment, mine, vendor, fuel type, and all-time history.



Automatic historical fuel price lookup is future evaluation only.



\## Work Truck Log



Work Truck Log records daily work truck usage inside the mine.



The operator parks a personal vehicle, transfers to a work truck, and uses the truck to travel inside the mine.



The operator also submits a daily website form with radio-button responses and mileage.



NAM Dashboard should preserve a personal searchable record of what was entered, but should not automate the official website in V1.



Work trucks should be represented as Equipment records.



Work Truck Log should capture:



\- Date

\- Shift

\- Work truck Equipment

\- Mine/work area

\- Starting mileage

\- Ending mileage

\- Calculated miles driven

\- Configurable daily website form responses

\- Submitted status

\- Notes

\- Attachments/screenshots

\- Related Fuel Log records



The exact website fields will be documented later.



Use flexible response modeling so radio buttons, checkboxes, numbers, text, dates, and notes can be added without redesigning the module.



\## Payslip Repository



Payslip Repository stores weekly work payment PDFs and extracts payroll data.



The operator manually uploads payslip PDFs.



Original PDF storage is the source artifact and should be retained permanently unless explicitly deleted.



The module should extract available text, use OCR fallback when needed, store raw extracted text/OCR output, track parser version, confidence, extraction method, and manual corrections.



Payslip data is sensitive personal financial data and should be treated as a separate bounded context from operational mining records.



Payslip data should be hidden from general operational views unless compensation visibility is enabled.



It may participate in global calendar/history views when explicitly enabled.



V1 should support:



\- Manual upload

\- Original PDF storage

\- Core field extraction

\- OCR fallback

\- Line-item storage

\- Manual correction

\- Calendar lookup by pay date/pay period

\- Basic date-range totals



Payroll-provider login integration and automatic Workday import are out of scope.



Financial advice or recommendation features are out of scope.



\## Knowledge Base



Knowledge Base stores operational knowledge by real operating hierarchy:



City -> Mine -> Equipment -> KB Category -> Article / Field Note



Examples include Miami, Krome Quarry, draglines, support equipment, procedures, safety notes, troubleshooting, inspections, training, and field notes.



Every KB article should belong to a City and Mine.



Most KB articles should also belong to primary Equipment.



Articles may reference related equipment.



Support equipment should be modeled as Equipment records and may have parent equipment relationships.



Support equipment examples:



\- Cable tractor

\- Forklift

\- Cable poles

\- Cable handling tools

\- Power cable systems



Each dragline should have an equipment profile describing what kind of operational information it provides.



Example distinction:



\- Electric draglines may have digital screens, sensor data, and alarm history.

\- Diesel draglines may rely more on operator-observed condition notes.



KB article types:



\- Procedure

\- Safety

\- Troubleshooting

\- Inspection

\- Training

\- Field Note

\- General Article



KB statuses:



\- Field Note

\- Draft

\- Reviewed

\- Official



Future capability: promote Field Notes into official KB Articles through review.



\## Database Modeling Assumptions



The data model should be relational, normalized where useful, and module-oriented.



Common modeling principles:



\- Stable IDs on all entities

\- Created/updated timestamps

\- Reliable date fields

\- Equipment links where relevant

\- Mine/location links where relevant

\- Attachment support across modules

\- Snapshot fields when external codes/descriptions may change

\- Optional relationships where future modules are not yet defined

\- Preserve original source artifacts when useful



Equipment is a shared concept across modules.



Mines and Cities provide location hierarchy.



Attachments are expected to be reusable across modules.



Day View requires date fields and relationships to be consistent across modules.



Financial records should have stricter boundaries than operational records.



\## UI / UX Philosophy



The app should feel like a professional operations tool, not a marketing site.



Prioritize dense, organized, work-focused interfaces for repeated use.



The UI should support fast manual entry, editing, searching, filtering, and historical review.



Use the Metronic UI Template where appropriate.



Do not copy external systems exactly, such as WFS mobile UI. Preserve the useful fields and workflow intent while fitting NAM Dashboard's own interface.



Manual workflows should be efficient because V1 intentionally avoids brittle automation.



For module UIs, favor:



\- Clear forms

\- Searchable/autocomplete selectors

\- Tables where comparison matters

\- Calendar/day navigation

\- Edit/copy/delete actions where expected

\- Calculated totals

\- Missing-data indicators

\- Attachments and source notes



\## Future Ideas Already Identified



Ideas currently treated as future evaluation include:



\- Paper-style Work Authorization PDF export

\- Work Authorization audit log

\- Automatic permit suggestions

\- Work Schedule reminders and calendar sync

\- Equipment alarm and observation templates

\- Automatic payroll provider import

\- Financial recommendation engine

\- Historical fuel price lookup

\- Vendor invoice import

\- Fuel forecasting

\- Official work website automation

\- WFS integration

\- QR codes

\- Offline/mobile capture



Do not promote these into V1 unless the user explicitly decides to.



\## Chat And Project Management Rules



The AI acts as Software Architect, Documentation Manager, and Project Manager.



The AI should monitor conversation size and focus.



When a chat becomes too large, covers multiple unrelated topics, or risks losing clarity, recommend a new chat by saying:



> Recommendation: Start a new chat.



Then provide a Context Transfer Prompt in this format:



Project: NAM Dashboard



Review these documents first:



\- docs/prd.md

\- docs/modules.md

\- docs/database.md

\- docs/architecture.md

\- docs/roadmap.md



Current Focus:

\[topic]



Current Status:

\[summary]



Decisions Made:



\- item

\- item

\- item



Open Questions:



\- question

\- question



Objective For This Chat:

\[single objective]



Continue from this point and ask questions if additional information is required.



The project documentation should remain the primary source of truth rather than relying on long chat histories.



Prefer short, focused chats dedicated to a single topic when possible.



\## How To Work In This Repo



Before making changes, inspect the relevant documentation.



When updating docs, keep edits scoped and preserve existing structure.



When adding requirements, make sure they land in the correct document.



When adding future concepts, use `docs/ideas.md` unless the user confirms they are requirements.



When adding architecture decisions, include the decision, reason, and consequences.



When adding roadmap items, keep phases consistent:



\- Requirements Definition

\- Data Model Design

\- V1 Implementation

\- Future Enhancements



When adding database entities, include fields, relationships, and relevant enum/status values.



When implementing code later, follow the established stack and module boundaries.



Do not introduce major new frameworks or architectural styles without explaining the tradeoff.



\## Important Caveats



Some documentation currently contains encoding artifacts where tree characters were rendered incorrectly. Preserve the intended hierarchy rather than copying the broken characters.



Some modules are well-defined, while others such as Shift Reports, Daily Inspections, Defect Tracking, STOP Cards, Work Orders, attachments, and users/auth still need deeper requirements before implementation.



Security and privacy need more definition before implementing Payslip Repository or any sensitive financial storage.



No production code should be assumed complete based only on the presence of `src/` or `public/`.

