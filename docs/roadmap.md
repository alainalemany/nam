\## Work Authorization Roadmap



\### Phase 1: Requirements Definition



\- Document Work Authorization source forms

\- Identify required and optional permits

\- Define relationship between Shift Reports and Work Authorizations

\- Define completion checklist requirements

\- Confirm V1 scope



\### Phase 2: Data Model Design



\- Define WorkAuthorization entity

\- Define WorkAuthorizationPermit entity

\- Define WorkAuthorizationTechnician entity

\- Define WorkAuthorizationCompletionChecklist entity

\- Define required relationship to ShiftReport



\### Phase 3: V1 Implementation



\- Create Work Authorization records from inside a Shift Report

\- Capture core Work Authorization fields

\- Capture technician names and signatures

\- Track required and optional permits

\- Default Lockout Permit Required to Yes

\- Require a reason when Lockout Permit Required is No

\- Capture completion checklist before closing the Work Authorization



\### Phase 4: Future Enhancements



\- Generate paper-style PDF exports matching original forms

\- Add audit history

\- Add approval workflow

\- Add reusable permit templates

\- Add automatic permit suggestions based on work type

\## Work Schedule Roadmap

\### Phase 1: Requirements Definition

\- Confirm what counts as a work assignment: dragline number, mine, location, shift, or day off
\- Confirm whether time ranges are usually known or optional
\- Define how schedule changes should be displayed
\- Define schedule history display for V1

\### Phase 2: Data Model Design

\- Define WorkScheduleWeek entity
\- Define WorkScheduleDay entity
\- Define WorkScheduleChange entity
\- Define relationship to Equipment
\- Define future relationship to ShiftReport

\### Phase 3: V1 Implementation

\- Create weekly schedules manually
\- Enter and edit day-by-day assignments
\- Mark days as scheduled, off, unknown, or changed
\- Display current week and next week
\- Capture source notes from supervisor messages or updates

\### Phase 4: Future Enhancements

\- Add reminders for upcoming assignments
\- Add calendar export or sync
\- Add schedule change notifications

\## Timesheet Roadmap

\### Phase 1: Requirements Definition

\- Confirm editable timesheet fields from WFS screenshots
\- Define fixed pay code options: Regular Time, FTO, On Call Pay, and Unpaid Leave
\- Define default values for new rows: Regular Time, company code 00067, business unit 141, and injury false
\- Define reusable list behavior for equipment, work codes, work orders, worked pay grade, company code, and business unit
\- Define weekly and daily total behavior

\### Phase 2: Data Model Design

\- Define TimesheetWeek entity
\- Define TimesheetEntry entity
\- Define TimesheetWorkCode entity
\- Define TimesheetWorkOrder entity
\- Define relationship to Equipment
\- Define future relationships to Work Schedule, Daily Log, Payslip, Work Orders, and Shift Reports

\### Phase 3: V1 Implementation

\- Create manual timesheet entries
\- Edit, copy, and delete timesheet entries
\- Group entries by work week and work date
\- Calculate daily and weekly hour totals
\- Provide searchable/autocomplete selectors for saved equipment, work codes, and work orders
\- Allow adding new reusable equipment, work code, or work order values from the form
\- Show Timesheet entries in Day View and global search

\### Phase 4: Future Enhancements

\- Add richer reports comparing Work Schedule, Daily Log, Timesheet, and Payslip records
\- Add import/export if a reliable source format becomes available
\- Evaluate WFS integration only if the security and maintenance tradeoffs are acceptable

\## Daily Log And Historical Search Roadmap

\### Phase 1: Requirements Definition

\- Define Daily Log activity categories
\- Define required fields for a daily activity entry
\- Define how Daily Log entries link to equipment, Work Authorizations, future Work Orders, defects, inspections, KB notes, and attachments
\- Define calendar view requirements
\- Define Day View result groups for exact-date records and containing-period records
\- Define global search filters and result types

\### Phase 2: Data Model Design

\- Define DailyLog entity
\- Define DailyLogActivity entity
\- Define common date, timestamp, equipment, and attachment patterns across modules
\- Define cross-module search strategy
\- Define future WorkOrder relationship points

\### Phase 3: V1 Implementation

\- Create and edit Daily Logs
\- Add multiple activity entries per Daily Log
\- Link Daily Log activities to equipment and available related records
\- Search Daily Logs by date, text, equipment, activity type, contractor, or company
\- Add calendar navigation for historical daily records
\- Show the Work Schedule week that contains the selected date in Day View

\### Phase 4: Future Enhancements

\- Add richer cross-module global search
\- Add full historical timeline view for any selected date
\- Add Work Order module integration
\- Add advanced analytics from Daily Log activities

\## Payslip Repository Roadmap

\### Phase 1: Requirements Definition

\- Confirm required payslip upload workflow
\- Identify payroll provider format from sample PDFs
\- Define required payroll header fields
\- Define earnings, deductions, taxes, employer contributions, and payment distribution line-item categories
\- Define calendar lookup behavior by pay date and pay period
\- Define financial privacy requirements

\### Phase 2: Data Model Design

\- Define PayslipDocument entity
\- Define Payslip entity
\- Define PayslipEarningLine entity
\- Define PayslipDeductionLine entity
\- Define PayslipTaxLine entity
\- Define PayslipEmployerContributionLine entity
\- Define PayslipPaymentDistribution entity
\- Define PayslipExtractionField entity
\- Define duplicate detection strategy using file hash and payroll identifiers

\### Phase 3: V1 Implementation

\- Upload and store payslip PDFs
\- Extract PDF text when available
\- Run OCR fallback for image-based PDFs
\- Parse core header fields, totals, and line items
\- Show extraction status and confidence
\- Allow manual correction of extracted values
\- Search payslips by pay date, pay period, amount, and line-item type
\- Show basic date-range and annual totals for gross pay, net pay, taxes, deductions, 401k, insurance, and employer contributions

\### Phase 4: Future Enhancements

\- Add advanced compensation dashboards
\- Add CSV or spreadsheet export
\- Add tax-year summary reports
\- Add payroll-provider specific parser templates
\- Add automatic Workday import only if the security and maintenance tradeoffs are acceptable
\- Add encryption-at-rest and redacted display modes for sensitive financial fields

\## Fuel Log Roadmap

\### Phase 1: Requirements Definition

\- Confirm required fuel record fields for diesel tank truck service events and gasoline purchases
\- Confirm whether fuel records usually need equipment hour-meter, odometer, or tank-level readings
\- Define price status values: actual, estimated, or unknown
\- Define Day View and global search behavior for Fuel Log records
\- Define reporting totals by day, month, year, equipment, vendor, custom date range, and all-time history

\### Phase 2: Data Model Design

\- Define FuelServiceRecord entity
\- Define FuelPriceReference entity
\- Define relationship to Equipment
\- Define optional relationship to Mine
\- Define optional relationship to DailyLogActivity
\- Define attachment support for receipts, photos, notes, and invoices

\### Phase 3: V1 Implementation

\- Create manual Fuel Log records
\- Record date, time, equipment, fuel type, and gallons delivered
\- Record optional vendor, gas station, address, service truck, driver, tank, meter, odometer, receipt, invoice, and notes
\- Record optional manual price per gallon, total USD, and price source
\- Calculate estimated total value when price is available
\- Search fuel records by date, date range, equipment, mine, vendor, fuel type, price status, and notes
\- Show fuel totals by day, month, year, custom date range, equipment, and all-time history
\- Show Fuel Log records in Day View and global search

\### Phase 4: Future Enhancements

\- Evaluate historical diesel and gasoline price lookup from public or commercial data sources
\- Add vendor invoice import if reliable source documents become available
\- Add fuel usage trend charts by equipment and date range
\- Add missing-data reports for records without price, vendor, receipt, or meter readings
\- Add fuel forecasting only after enough reliable history exists

\## Work Truck Log Roadmap

\### Phase 1: Requirements Definition

\- Collect the exact daily work website form fields
\- Identify all radio-button options, numeric inputs, text inputs, and required fields
\- Confirm mileage fields used by the work website
\- Confirm whether one work truck is usually assigned or whether the truck changes by day
\- Define how Work Truck Log records should appear in Day View and global search

\### Phase 2: Data Model Design

\- Define WorkTruckLog entity
\- Define WorkTruckLogResponse entity for flexible website form answers
\- Define Equipment category for Work Truck
\- Define optional relationship to DailyLogActivity
\- Define relationship between WorkTruckLog and FuelServiceRecord
\- Define attachment support for screenshots, receipts, photos, and notes

\### Phase 3: V1 Implementation

\- Create manual Work Truck Log records
\- Link each record to a work truck Equipment record
\- Record date, shift, starting mileage, ending mileage, and calculated miles driven
\- Capture website daily log responses using configurable fields
\- Track whether the official website daily log was submitted
\- Link gasoline purchases from Fuel Log to the relevant Work Truck Log
\- Search truck logs by date, truck, mileage, submitted status, missing fields, and notes
\- Show Work Truck Log records in Day View and global search

\### Phase 4: Future Enhancements

\- Add reusable form templates once the website fields are stable
\- Add missing-submission reminders
\- Add mileage trend charts by week, month, year, and work truck
\- Add export or print views for personal records
\- Evaluate whether any official website automation is appropriate only after manual logging works reliably

