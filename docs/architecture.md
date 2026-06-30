\# Architecture Decision Log



\## ADR-001

Date: 6/4/2026

Decision: PostgreSQL selected instead of MongoDB.

Reason: Data is highly relational.



\## ADR-002

Date: 6/5/2026

Decision: Work Authorizations will be modeled as structured child records of Shift Reports.

Reason: Work Authorizations happen during a specific operating shift and should remain connected to the shift activity record. Modeling them as child records preserves operational context, supports historical review, and prevents standalone compliance records from becoming disconnected from daily work history.

Consequences:

\- A WorkAuthorization must always reference a ShiftReport.

\- Work Authorization data will be captured structurally rather than stored only as scanned forms or photos.

\- Original form photos may still be stored as attachments for reference.

\- Optional permits will be modeled as child records of the WorkAuthorization.

\- Paper-style PDF export can be added later because the structured data will already exist.

\## ADR-003

Date: 6/22/2026

Decision: NAM Dashboard will prioritize permanent operational history with search and calendar navigation.

Reason: The system is intended to become a long-term personal work record. The operator should be able to select a past date or search by relevant details and understand what happened that day across schedules, daily logs, inspections, work authorizations, defects, future work orders, and notes.

Consequences:

\- Operational records should be retained indefinitely unless explicitly deleted or archived by the operator.
\- Core records should include reliable dates, timestamps, equipment links, and module relationships.
\- Calendar and search views should be treated as cross-module product capabilities, not isolated features inside one module.
\- Day View should include direct records for the selected date and contextual records whose date range contains the selected date, such as the Work Schedule week.
\- Future modules should be designed so their records can appear in the historical timeline.

\## ADR-004

Date: 6/22/2026

Decision: Work Schedule will use manual entry and manual editing instead of SMS import or natural-language parsing.

Reason: Supervisor schedule messages may contain spelling errors, grammar issues, or accidental substitutions of numbers with other characters. Manual entry is more reliable for the operator's actual workflow.

Consequences:

\- SMS import and automatic schedule parsing are out of scope.
\- The schedule UI should make manual weekly entry and editing fast.
\- The system may still store source notes, but those notes are reference text, not parsed automation input.

\## ADR-005

Date: 6/23/2026

Decision: Payslip Repository will be modeled as a dedicated financial bounded context with original PDF storage, structured extraction, OCR fallback, and manual correction.

Reason: Payslip data is sensitive personal financial data and has different privacy, retention, extraction, and analytics requirements than operational mining records. The original PDF must remain the source artifact, while parsed payroll data should be normalized enough to support calendar lookup, date-range totals, annual totals, deductions, taxes, 401k, insurance, and other line-item analytics.

Consequences:

\- Payslip PDFs should be stored as immutable source documents unless explicitly deleted by the operator.
\- Parsed values should retain source text, extraction method, confidence, parser version, and manual corrections.
\- OCR must be supported because some payroll PDFs may be image-based or generated with compressed content that is not reliable through basic text extraction.
\- Payslip data should be hidden from general operational views unless the operator enables compensation visibility.
\- Future security work should evaluate encryption at rest, redaction, export controls, and stricter access permissions for financial data.

\## ADR-006

Date: 6/24/2026

Decision: Fuel Log will be modeled as a structured operational module, with fuel price data treated as optional enrichment.

Reason: Diesel service events and gasoline purchases are repeated operational records that need reliable search, date-range totals, equipment links, and historical reporting. Gallons delivered or purchased, equipment serviced, date, time, and source notes are primary facts. Price per gallon may be known, estimated, missing, or sourced later, so it should not be required for saving the operational record.

Consequences:

\- A FuelServiceRecord should preserve the base fueling facts even when no price is available.
\- Fuel price data should include a status such as Actual, Estimated, or Unknown.
\- Estimated fuel value should be calculated from gallons delivered and selected price per gallon, not stored as the only source of truth.
\- Fuel records should participate in Day View and global historical search.
\- Fuel records should support diesel, off-road diesel, gasoline, and future fuel types.
\- Automated historical fuel price lookup should be evaluated separately because external price data may vary by source, geography, date coverage, and reliability.

\## ADR-007

Date: 6/24/2026

Decision: Work truck daily records will be modeled as a structured personal log linked to Equipment, not as automation of the official work website.

Reason: The operator uses a work truck to travel inside the mine and submits a daily website form with radio-button responses, mileage, and other fields. NAM Dashboard should preserve a personal searchable history of what was entered and how the truck was used, while avoiding dependence on the official website's authentication, layout, or submission workflow.

Consequences:

\- Work trucks should be represented as Equipment records.
\- WorkTruckLog should capture daily mileage, submitted status, and notes.
\- WorkTruckLogResponse should support configurable form fields so exact website questions can be added later.
\- Work Truck Log records should participate in Day View and global historical search.
\- Gasoline purchases for the work truck should be stored in FuelServiceRecord and may link back to WorkTruckLog.
\- Automatic submission to the official work website is out of scope unless explicitly evaluated in a future phase.

\## ADR-008

Date: 6/29/2026

Decision: NAM Dashboard will use Docker Compose as the standard deployment method, with the Next.js application and PostgreSQL running in Docker containers and Caddy installed directly on the VPS host as the public reverse proxy.

Reason: This keeps the platform simple to operate, production-ready, reproducible, and easy to extend without adding unnecessary infrastructure before it is needed. Docker Compose provides clear service boundaries for the application and database, while host-level Caddy keeps TLS termination and public HTTP routing simple and independent of application container rebuilds.

Deployment baseline:

\- Docker Compose is the standard deployment method.
\- The Next.js application runs inside Docker.
\- PostgreSQL runs inside Docker using persistent named volumes.
\- Database storage must not rely on the container filesystem.
\- Regular PostgreSQL backups must be written outside the database container.
\- Caddy is installed directly on the VPS host, not inside Docker.
\- Caddy terminates TLS, automatically manages HTTPS certificates, and reverse proxies requests to the Next.js container.
\- Only Caddy should be exposed directly to the Internet.

Initial Docker services:

\- app
\- postgres

Future services, added only when justified by real requirements:

\- redis
\- background workers
\- object storage
\- monitoring
\- logging

Network flow:

\- Internet
\- Caddy on the VPS host
\- Docker network
\- Next.js app container
\- PostgreSQL container with persistent storage

Consequences:

\- Containers should be replaceable without data loss.
\- Infrastructure should remain reproducible through Docker Compose.
\- PostgreSQL backup and restore procedures are required platform work, not optional polish.
\- Caddy configuration becomes the authoritative public ingress layer for the dashboard.
\- Additional infrastructure components should be deferred until they solve a specific problem.
\- This deployment model is the baseline for future infrastructure decisions unless a specific requirement justifies changing it.

\## ADR-009

Date: 6/29/2026

Decision: Phase 2A will establish a development-only Docker Compose foundation for PostgreSQL inside the existing project repository at /home/alain/projects/nam. Phase 2A will not create the Next.js application container, scaffold application code, install Caddy, expose public services, or create /opt/nam.

Reason: The project is still following an architecture-first and documentation-first workflow. The next useful infrastructure step is to validate the database container, persistent storage, private Docker networking, environment conventions, health checks, backup approach, and rollback procedure before introducing application code. Keeping Phase 2A inside the existing repository preserves development simplicity while leaving /opt/nam available for a future production deployment location if that separation becomes useful.

Environment boundaries:

\- Development is the current VPS project repository at /home/alain/projects/nam.
\- Staging is an optional future environment and is not implemented in Phase 2A.
\- Production is a future deployed environment, possibly under /opt/nam, and is not implemented in Phase 2A.

Phase 2A scope:

\- Create Docker Compose infrastructure for PostgreSQL only.
\- Run PostgreSQL on a private Docker network.
\- Store PostgreSQL data in a persistent named Docker volume.
\- Keep PostgreSQL unexposed to the host and Internet.
\- Use .env for local secrets and .env.example for documented placeholders.
\- Document manual PostgreSQL backup and restore strategy before automating backups.
\- Verify database health, connectivity, and persistence before adding an application container.

Consequences:

\- Docker Compose infrastructure can be tested before application scaffolding begins.
\- The future Next.js application container will be introduced separately in Phase 2B.
\- The future production deployment location remains undecided and should not be assumed from the development layout.
\- Database data must be protected from accidental volume deletion, especially commands such as docker compose down -v.
\- Backup files must live outside the PostgreSQL container lifecycle.
\- ADR-008 remains the high-level deployment baseline; this ADR refines the development infrastructure foundation for Phase 2A.

\## ADR-010

Date: 6/29/2026

Decision: Phase 2A infrastructure naming, PostgreSQL versioning, backup location, and operational documentation location are standardized.

Standards:

\- PostgreSQL will use the PostgreSQL 18 major version.
\- Docker images must pin to the PostgreSQL 18 major version rather than latest.
\- Docker Compose project name: nam.
\- Docker Compose services: app and postgres.
\- Docker network: nam-network.
\- PostgreSQL named volume: postgres-data.
\- Explicit container names, if used: nam-app and nam-postgres.
\- PostgreSQL backup files must not be stored inside the Git repository.
\- Development PostgreSQL backups should use /home/alain/backups/nam/postgres/.
\- Operational infrastructure procedures belong in docs/infrastructure.md.
\- docs/architecture.md should remain focused on architecture decisions, ADRs, tradeoffs, and consequences rather than command-level operating procedures.

Reason: Stable infrastructure names reduce operational ambiguity, make backup and restore procedures easier to document, and avoid accidental drift between development and future deployment environments. Pinning PostgreSQL to a major version improves repeatability while still allowing compatible patch updates. Keeping backups outside the repository prevents sensitive database dumps from being committed. Separating operational procedures into docs/infrastructure.md keeps the architecture document focused on durable decisions rather than runbooks.

Consequences:

\- Phase 2A implementation files should use these names unless a later approved ADR changes them.
\- Backup and restore documentation should reference /home/alain/backups/nam/postgres/ as the development backup location.
\- .env must remain local and uncommitted; .env.example may document required variable names with placeholder values.
\- Future Phase 2B application container work should reuse the app service name and nam-app container name if explicit container names are used.
\- Future Caddy, firewall, deployment workflow, and maintenance procedures should be documented in docs/infrastructure.md when those phases are approved.

## ADR-011

Date: 6/30/2026

Decision: Phase 2B establishes the application platform foundation with Next.js, TypeScript, Prisma, pnpm, and a Docker Compose `app` service bound only to localhost.

Reason: Phase 2A validated the private PostgreSQL foundation. The next approved platform step is to introduce the application runtime without starting feature-module implementation, public ingress, authentication, or production deployment work. A minimal Next.js foundation gives the project a real application build target, Prisma Client generation path, and app-to-database connectivity check while preserving the documentation-first product workflow.

Phase 2B scope:

- Initialize a minimal Next.js application foundation.
- Use TypeScript.
- Use pnpm as the package manager.
- Configure Prisma with PostgreSQL as the datasource.
- Generate the initial Prisma Client.
- Add a Dockerfile for the Next.js application.
- Add the `app` service to Docker Compose.
- Attach `app` and `postgres` to `nam-network`.
- Keep PostgreSQL private with no published database port.
- Publish the application only on `127.0.0.1:3000`.
- Keep the Compose structure extensible for future services.

Out of scope:

- Authentication, authorization, and user management.
- Feature modules and business logic.
- Production deployment.
- Caddy, HTTPS, public ingress, and firewall changes.
- Monitoring and background workers.

Consequences:

- The repository now contains application source files, but product modules remain unimplemented until approved requirements are ready.
- Local development should use pnpm commands documented in `docs/development.md`.
- Docker Compose remains the development platform entry point.
- The application can reach PostgreSQL through Docker networking without exposing PostgreSQL to the host or Internet.
- Public access remains deferred to the later reverse proxy and HTTPS phase.
