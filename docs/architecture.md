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

