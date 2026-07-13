# Database Design

This document is the canonical home for NAM Dashboard entities, fields,
relationships, enums, and data modeling notes.

## Table Of Contents

- [STOP Card Entities](#stop-card-entities)
- [Daily Inspection Entities](#daily-inspection-entities)
- [Defect Tracking Entities](#defect-tracking-entities)
- [Shift Report Entities](#shift-report-entities)
- [Work Authorization Entities](#work-authorization-entities)
- [Knowledge Base Entities](#knowledge-base-entities)
- [Daily Log Entities](#daily-log-entities)
- [Historical Search And Calendar Entities](#historical-search-and-calendar-entities)
- [Work Schedule Entities](#work-schedule-entities)
- [Timesheet Entities](#timesheet-entities)
- [Payslip Repository Entities](#payslip-repository-entities)
- [Work Truck Log Entities](#work-truck-log-entities)
- [Fuel Log Entities](#fuel-log-entities)

## STOP Card Entities

### StopCard

Represents a manual safety observation and corrective-action record.

Implemented fields:

- id
- observationDate
- category
- severity
- status
- mineId
- equipmentId
- location
- description
- correctiveAction
- createdBy
- createdAt
- updatedAt

Implemented categories:

- Hazard Observation
- Unsafe Condition
- Unsafe Act
- Near Miss
- Positive Observation
- Corrective Action
- General Safety

Implemented severities:

- Low
- Medium
- High
- Critical

Implemented statuses:

- Open
- In Progress
- Closed
- Archived

Relationships:

- May belong to one Mine record
- May belong to one Equipment record

## Daily Inspection Entities

### DailyInspection

Represents a manual equipment inspection record for a selected workday.

Implemented fields:

- id
- inspectionDate
- shift
- mineId
- equipmentId
- equipmentHours
- condition
- status
- findings
- defectsIdentified
- notes
- createdAt
- updatedAt

Implemented conditions:

- Satisfactory
- Needs Attention
- Unsafe
- Not Applicable

Implemented statuses:

- Completed
- Follow-up Needed
- Archived

Relationships:

- May belong to one Mine record
- May belong to one Equipment record
- May originate zero or many Defect records

## Defect Tracking Entities

### Defect

Represents an equipment issue from initial reporting through resolution and
closure.

Implemented fields:

- id
- reportedDate
- equipmentId
- sourceDailyInspectionId
- severity
- priority
- status
- title
- description
- correctiveAction
- resolutionSummary
- resolvedAt
- closedAt
- createdAt
- updatedAt

Implemented severities:

- Low
- Medium
- High
- Critical

Implemented priorities:

- Low
- Medium
- High
- Urgent

Implemented statuses:

- Open
- In Progress
- Resolved
- Closed

Relationships:

- Belongs to one required Equipment record
- May reference one source DailyInspection record
- Derives current Mine context through Equipment; V1 does not persist `mineId`
- Deleting a source DailyInspection clears the optional source reference and
  preserves the Defect

## Shift Report Entities

### ShiftReport

Represents a manual shift-level operational summary and coordination record.

Implemented fields:

- id
- reportDate
- shift
- status
- mineId
- equipmentId
- location
- summary
- operationalNotes
- createdAt
- updatedAt

Implemented statuses:

- Draft
- Completed
- Archived

Relationships:

- May belong to one Mine record
- May belong to one Equipment record
- Provides required parent context for WorkAuthorization records
- May later link to DailyLog, StopCard, DailyInspection, Defect, WorkSchedule,
  Timesheet, or other module-owned records when those relationships are
  explicitly implemented

## Work Authorization Entities

### WorkAuthorization

Represents a work authorization event performed during a shift.

Implemented fields:

- id
- shiftReportId
- status
- workType
- mineId
- equipmentId
- jobLocation
- workDescription
- startTime
- endTime
- crewWorkerCount
- contactName
- equipmentRequired
- personInChargeName
- lockoutRequired
- lockoutNotRequiredReason
- workplaceExamRequired
- confinedSpaceRequired
- lockoutTagoutRequired
- hotWorkRequired
- workingAtHeightsRequired
- stopCardJhaRequired
- jobCompleted
- permitsClosed
- guardsReplaced
- lockoutTagoutRemoved
- toolsRemoved
- housekeepingCompleted
- supervisorNotified
- completionNotes
- createdAt
- updatedAt

Implemented statuses:

- Draft
- Open
- Closed
- Archived

Implemented work types:

- Maintenance
- Electrical
- Mechanical
- Preventive Maintenance
- Breakdown
- Hot Work
- Working At Heights
- Lockout / Tagout
- Other

Relationships:

- Belongs to one ShiftReport
- May belong to one Mine record
- May belong to one Equipment record
- May later link to DailyLog, StopCard, DailyInspection, Defect, or other
  module-owned records when those relationships are explicitly implemented

### WorkAuthorizationPermit

Represents a permit or paperwork item associated with a Work Authorization.

Planned deeper model; not part of the current Prisma schema. The implemented V1
model stores its current permit and work-requirement selections as flat boolean
fields on `WorkAuthorization`.

Potential future fields:

- id
- workAuthorizationId
- permitType
- required
- completed
- completedAt
- notes

Potential permit types:

- Workplace Exam
- Confined Spaces
- Lockout / Tagout
- Hot Work
- Working at Heights
- STOP Card / Job Hazard Analysis

Relationships:

- Belongs to one WorkAuthorization

### WorkAuthorizationTechnician

Represents technician information captured by the operator.

Planned deeper model; not part of the current Prisma schema. Current V1 crew and
contact context remains on `WorkAuthorization`.

Potential future fields:

- id
- workAuthorizationId
- firstName
- lastName
- role
- company
- signature
- signedAt

Relationships:

- Belongs to one WorkAuthorization

### WorkAuthorizationCompletionChecklist

Represents the completion checklist for returning equipment or work area to production.

Planned deeper model; not part of the current Prisma schema. The implemented V1
completion checks are flat boolean fields on `WorkAuthorization`.

Potential future fields:

- id
- workAuthorizationId
- jobCompleted
- permitsClosed
- hotWorkFireWatchCompleted
- guardsReplaced
- lockoutTagoutRemoved
- laddersRemoved
- handrailsReplaced
- flooringReplaced
- debrisRemoved
- barricadesRemoved
- sparePartsReturned
- toolsRemoved
- housekeepingCompleted
- rentalEquipmentHandled
- supervisorNotified
- personInChargeName
- personInChargeSignature
- completedAt

Relationships:

- Belongs to one WorkAuthorization

## Knowledge Base Entities

### City

Represents a city or operating region that contains one or more mines.

Potential fields:

- id
- name
- state
- status
- notes
- createdAt
- updatedAt

Relationships:

- Has many Mine records

### Mine

Represents a mine, quarry, pit, plant, or yard within a city.

Potential fields:

- id
- cityId
- name
- type
- status
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one City
- Has many Equipment records
- Has many KnowledgeBaseArticle records

### Equipment

Represents draglines and support equipment used at a mine.

Potential fields:

- id
- mineId
- parentEquipmentId
- equipmentNumber
- displayName
- category
- make
- model
- powerType
- instrumentationType
- hasDigitalAlarmScreen
- status
- notes
- createdAt
- updatedAt

Potential categories:

- Dragline
- Tractor
- Forklift
- Work Truck
- Cable System
- Cable Pole
- Cable Handling Tool
- Support Tool

Relationships:

- Belongs to one Mine
- May belong to one parent Equipment record
- May have many child Equipment records
- Has many KnowledgeBaseArticle records as primary equipment
- Has many related KnowledgeBaseArticle records through KnowledgeBaseArticleEquipment

### KnowledgeBaseArticle

Represents a KB article, procedure, safety note, troubleshooting guide, training item, or field note.

Potential fields:

- id
- cityId
- mineId
- primaryEquipmentId
- title
- articleType
- status
- content
- tags
- authorId
- reviewedById
- reviewedAt
- version
- createdAt
- updatedAt

Potential article types:

- Procedure
- Safety
- Troubleshooting
- Inspection
- Training
- Field Note
- General Article

Potential statuses:

- Field Note
- Draft
- Reviewed
- Official

Relationships:

- Belongs to one City
- Belongs to one Mine
- May belong to one primary Equipment record
- May reference many related Equipment records through KnowledgeBaseArticleEquipment
- Has many KnowledgeBaseStep records
- Has many Attachments

### KnowledgeBaseStep

Represents one step in a step-by-step KB procedure.

Potential fields:

- id
- knowledgeBaseArticleId
- stepNumber
- title
- instructions
- warning
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one KnowledgeBaseArticle
- Has many Attachments

### KnowledgeBaseArticleEquipment

Represents related equipment connected to a KB article.

Potential fields:

- id
- knowledgeBaseArticleId
- equipmentId
- relationshipType
- notes

Potential relationship types:

- Primary
- Related
- Support
- Safety Critical

Relationships:

- Belongs to one KnowledgeBaseArticle
- Belongs to one Equipment

## Daily Log Entities

### DailyLog

Represents the operator's workday or shift narrative.

Potential fields:

- id
- date
- shift
- dailyAssignmentId
- primaryEquipmentId
- mineId
- summary
- weatherConditions
- generalNotes
- createdAt
- updatedAt

Relationships:

- May later reference one Work Schedule DailyAssignment
- May reference one primary Equipment record
- May reference one Mine record
- Has many DailyLogActivity records
- Has many Attachments

### DailyLogActivity

Represents one activity, event, note, or observation within a Daily Log.

Potential fields:

- id
- dailyLogId
- activityDate
- startTime
- endTime
- sequence
- activityType
- title
- description
- equipmentId
- location
- contractorCompany
- personName
- fuelServiceRecordId
- notes
- createdAt
- updatedAt

Potential activity types:

- Dragline Move
- Cut
- Greasing
- Scheduled PM
- Equipment Alarm
- Sensor Observation
- Equipment-Specific Observation
- Work Order
- Work Authorization
- Lockout / Tagout
- Hot Work
- Working at Heights
- Contractor Escort
- Maintenance Observation
- Fuel Service
- Delay
- Production Note
- Safety Observation
- General Note

Relationships:

- Belongs to one DailyLog
- May reference one Equipment record
- May reference one WorkAuthorization record
- May later reference one WorkOrder record
- May reference one Defect record
- May reference one DailyInspection record
- May reference one FuelServiceRecord record
- May reference one KnowledgeBaseArticle or field note
- Has many Attachments

### EquipmentObservationDetail

Represents optional structured details for a Daily Log activity that records equipment-specific information.

This allows electric draglines with digital alarm screens and diesel draglines with more manual/operator-observed conditions to use the same Daily Log foundation without forcing every dragline into the same fields.

Potential fields:

- id
- dailyLogActivityId
- observationSource
- alarmCode
- alarmDescription
- alarmOccurredAt
- sensorName
- sensorValue
- conditionLabel
- operatorInterpretation
- followUpNeeded
- createdAt
- updatedAt

Potential observation sources:

- Digital Alarm Screen
- Sensor Display
- Physical Gauge
- Operator Observation
- Maintenance Feedback

Relationships:

- Belongs to one DailyLogActivity
- May reference one Equipment record through the parent DailyLogActivity

## Historical Search And Calendar Entities

Global search and calendar views should be supported across modules.

Potential design options:

- Query module tables directly by date, equipment, text, and relationships
- Add a searchable activity/index table later if direct queries become too slow
- Use PostgreSQL full-text search for notes, descriptions, and titles
- Support exact-date queries for daily records
- Support date-containment queries for period records, such as WeeklySchedule
  where the selected date falls between weekStartDate and weekEndDate

All operational records should include stable dates, timestamps, and module relationships so a selected date can show schedules, daily logs, inspections, defects, work authorizations, future work orders, KB notes, and attachments together.

Day View queries should return both records dated on the selected day and contextual records whose date range contains the selected day.

## Work Schedule Entities

The Work Schedule feature architecture is defined in
`docs/architecture/features/work-schedule.md`.

The entities below are conceptual V1 data-design guidance. They are not yet
implemented in the Prisma schema.

### WeeklySchedule

Represents one Monday-through-Sunday schedule planning container for the primary
employee whose schedule is being entered.

Potential fields:

- id
- weekStartDate
- weekEndDate
- status
- primaryEmployeeDisplayName
- assignedByDisplayName
- receivedAt
- sourceNote
- scheduleNotes
- createdAt
- updatedAt

Potential statuses:

- Draft
- Active
- Archived

Relationships:

- Has many DailyAssignment records

### DailyAssignment

Represents the assignment for one date within a WeeklySchedule.

The day is the operational and historical unit. Do not model one multi-day
assignment spanning several dates.

Potential fields:

- id
- weeklyScheduleId
- assignmentDate
- dayOfWeek
- plannedStatus
- plannedShift
- plannedEquipmentId
- plannedEquipmentDisplayName
- plannedEquipmentNumber
- plannedEquipmentCategory
- plannedMineName
- plannedCityName
- plannedCityState
- actualStatus
- actualShift
- actualEquipmentId
- actualEquipmentDisplayName
- actualEquipmentNumber
- actualEquipmentCategory
- actualMineName
- actualCityName
- actualCityState
- changeReason
- plannedNotes
- actualNotes
- createdAt
- updatedAt

Potential assignment statuses:

- Scheduled
- Non-working
- Unknown
- Cancelled

Relationships:

- Belongs to one WeeklySchedule
- May reference one planned Equipment record
- May reference one actual Equipment record
- Has many AssignmentCrewMember records

Users select Equipment for planned and actual assignments. Mine and City are
derived through the selected Equipment. Historical equipment, mine, and city
display values are snapshots for schedule readability. They do not replace the
Equipment, Mine, or City reference-data records, and they should not duplicate
the full reference-data records.

The approved historical display snapshots are limited to equipment display
name, equipment number, equipment category, mine name, city name, and city
state for planned and actual equipment context.

### AssignmentCrewMember

Represents one planned or actual crew participant for a DailyAssignment.

Potential fields:

- id
- dailyAssignmentId
- phase
- role
- displayName
- isUnknown
- notes
- createdAt
- updatedAt

Potential phases:

- Planned
- Actual

Potential roles:

- Primary employee
- Partner

Relationships:

- Belongs to one DailyAssignment

V1 uses name snapshots only for crew participants. It does not introduce an
Employee, Supervisor, User, operator, owner, or workforce identity relation.
Unknown or not-yet-registered partners should be represented explicitly without
creating fake reference records.

### Deferred Work Schedule Entities

Full schedule revision history, supervisor publishing records, imported SMS
messages, AI parsing artifacts, and future Employee or Supervisor reference
relationships are deferred until the manual schedule workflow proves reliable
and the product owner approves the added scope.

## Timesheet Entities

### TimesheetWeek

Represents one weekly timesheet period.

Potential fields:

- id
- weekStartDate
- weekEndDate
- weeklyHoursTotal
- status
- createdAt
- updatedAt

Potential statuses:

- Draft
- SubmittedExternally
- Archived

Relationships:

- Has many TimesheetEntry records

### TimesheetEntry

Represents one manually entered timesheet row.

Potential fields:

- id
- timesheetWeekId
- workDate
- payCode
- hours
- equipmentId
- equipmentCodeSnapshot
- equipmentDescriptionSnapshot
- workCodeId
- workCodeSnapshot
- workCodeDescriptionSnapshot
- workOrderId
- workOrderSnapshot
- workedPayGrade
- workedCompanyCode
- workedBusinessUnit
- injury
- comments
- sourceSystem
- createdAt
- updatedAt

Default values for new rows:

- payCode: Regular Time
- workedCompanyCode: 00067
- workedBusinessUnit: 141
- injury: false

Potential pay codes:

- Regular Time
- FTO
- On Call Pay
- Unpaid Leave

Relationships:

- Belongs to one TimesheetWeek
- May reference one Equipment record
- May reference one TimesheetWorkCode record
- May reference one TimesheetWorkOrder record
- May later reference one Work Schedule DailyAssignment record
- May later reference one DailyLogActivity record
- May later reference one Payslip record

### TimesheetWorkCode

Represents a reusable work code option used by timesheet entries.

Potential fields:

- id
- code
- description
- active
- lastUsedAt
- createdAt
- updatedAt

Relationships:

- Has many TimesheetEntry records

### TimesheetWorkOrder

Represents a reusable work order option used by timesheet entries.

Potential fields:

- id
- workOrderNumber
- description
- active
- lastUsedAt
- createdAt
- updatedAt

Relationships:

- Has many TimesheetEntry records

### Timesheet Reporting Notes

Daily totals should be calculated by summing TimesheetEntry.hours grouped by workDate.

Weekly totals should be calculated by summing TimesheetEntry.hours within the TimesheetWeek date range.

Day View should include TimesheetEntry records whose workDate matches the selected date.

Equipment, work code, work order, worked pay grade, worked company code, and worked business unit fields should support saved history and autocomplete in the UI.

## Payslip Repository Entities

### PayslipDocument

Represents the original uploaded payslip PDF and its extraction status.

Potential fields:

- id
- originalFilename
- storagePath
- fileHash
- fileSizeBytes
- mimeType
- uploadedAt
- extractionStatus
- extractionMethod
- extractionConfidence
- rawExtractedText
- ocrText
- parserVersion
- parseError
- createdAt
- updatedAt

Potential extraction statuses:

- Uploaded
- Extracted
- Needs Review
- Corrected
- Failed

Potential extraction methods:

- PDF Text
- OCR
- Manual Entry
- Hybrid

Relationships:

- Has one Payslip record
- Has many PayslipExtractionField records

### Payslip

Represents the normalized payroll record from one payslip PDF.

Potential fields:

- id
- payslipDocumentId
- employerName
- employeeDisplayName
- employeeIdentifierMasked
- payslipNumber
- checkNumber
- payDate
- payPeriodStartDate
- payPeriodEndDate
- currency
- grossPayCurrent
- grossPayYtd
- netPayCurrent
- netPayYtd
- totalEarningsCurrent
- totalEarningsYtd
- totalTaxesCurrent
- totalTaxesYtd
- totalDeductionsCurrent
- totalDeductionsYtd
- totalEmployerContributionsCurrent
- totalEmployerContributionsYtd
- totalHoursCurrent
- totalHoursYtd
- reviewStatus
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one PayslipDocument
- Has many PayslipEarningLine records
- Has many PayslipDeductionLine records
- Has many PayslipTaxLine records
- Has many PayslipEmployerContributionLine records
- Has many PayslipPaymentDistribution records
- Has many PayslipExtractionField records

### PayslipEarningLine

Represents one earning line from a payslip, such as regular pay, overtime, shift differential, bonus, holiday, PTO, or other paid time.

Potential fields:

- id
- payslipId
- label
- earningType
- hoursCurrent
- hoursYtd
- rate
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Relationships:

- Belongs to one Payslip

### PayslipDeductionLine

Represents one employee deduction line, such as 401k, medical insurance, dental, vision, life insurance, union dues, garnishment, or other benefit deductions.

Potential fields:

- id
- payslipId
- label
- deductionType
- taxTreatment
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Potential deduction types:

- 401k
- Roth 401k
- Medical Insurance
- Dental Insurance
- Vision Insurance
- Life Insurance
- HSA
- FSA
- Union Dues
- Garnishment
- Other

Potential tax treatments:

- Pre Tax
- Post Tax
- Unknown

Relationships:

- Belongs to one Payslip

### PayslipTaxLine

Represents one employee tax or withholding line.

Potential fields:

- id
- payslipId
- label
- taxType
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Potential tax types:

- Federal Income Tax
- Social Security
- Medicare
- State Income Tax
- Local Tax
- Other

Relationships:

- Belongs to one Payslip

### PayslipEmployerContributionLine

Represents one employer-paid contribution or benefit line when shown on the payslip.

Potential fields:

- id
- payslipId
- label
- contributionType
- amountCurrent
- amountYtd
- sourceText
- confidence
- createdAt
- updatedAt

Potential contribution types:

- 401k Match
- Medical Insurance
- Dental Insurance
- Vision Insurance
- Life Insurance
- HSA
- Other

Relationships:

- Belongs to one Payslip

### PayslipPaymentDistribution

Represents direct deposit, check, or other payment distribution details when present.

Potential fields:

- id
- payslipId
- paymentMethod
- accountLabelMasked
- routingNumberMasked
- amount
- sourceText
- confidence
- createdAt
- updatedAt

Relationships:

- Belongs to one Payslip

### PayslipExtractionField

Represents a raw extracted field, normalized field mapping, confidence, and manual correction history.

Potential fields:

- id
- payslipDocumentId
- payslipId
- fieldName
- rawValue
- normalizedValue
- sourcePage
- sourceRegion
- confidence
- correctedValue
- correctedAt
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one PayslipDocument
- May belong to one Payslip

## Work Truck Log Entities

### WorkTruckLog

Represents one daily or shift-level work truck usage record.

Potential fields:

- id
- logDate
- shift
- equipmentId
- mineId
- dailyLogActivityId
- parkingArea
- workArea
- startingMileage
- endingMileage
- milesDriven
- websiteSubmitted
- websiteSubmittedAt
- submittedBy
- notes
- createdAt
- updatedAt

Relationships:

- Belongs to one Equipment record where category is Work Truck
- May belong to one Mine record
- May reference one DailyLogActivity record
- Has many WorkTruckLogResponse records
- Has many FuelServiceRecord records
- Has many Attachments

### WorkTruckLogResponse

Represents one answer from the work website daily log form.

This allows the exact website form fields to be added later without redesigning the Work Truck Log when the operator provides the radio buttons, mileage fields, and other inputs.

Potential fields:

- id
- workTruckLogId
- fieldKey
- fieldLabel
- fieldType
- optionLabel
- optionValue
- numericValue
- textValue
- booleanValue
- required
- displayOrder
- notes
- createdAt
- updatedAt

Potential field types:

- Radio
- Checkbox
- Number
- Text
- Textarea
- Date
- Time

Relationships:

- Belongs to one WorkTruckLog

## Fuel Log Entities

### FuelServiceRecord

Represents one diesel delivery, gasoline purchase, or fuel service event for equipment.

Potential fields:

- id
- serviceDate
- serviceTime
- equipmentId
- mineId
- dailyLogActivityId
- workTruckLogId
- fuelType
- gallonsDelivered
- unitOfMeasure
- vendorName
- serviceProviderName
- gasStationName
- gasStationAddress
- gasStationCity
- gasStationState
- gasStationZip
- deliveryTruckIdentifier
- driverName
- tankIdentifier
- preFuelLevel
- postFuelLevel
- odometerReading
- hourMeterReading
- engineHourReading
- pricePerGallon
- priceCurrency
- totalAmount
- priceStatus
- priceSource
- priceSourceDate
- estimatedTotalValue
- receiptNumber
- invoiceNumber
- notes
- createdAt
- updatedAt

Potential fuel types:

- Diesel
- Off-Road Diesel
- Gasoline
- Other

Potential price statuses:

- Actual
- Estimated
- Unknown

Relationships:

- Belongs to one Equipment record
- May belong to one Mine record
- May reference one DailyLogActivity record
- May reference one WorkTruckLog record
- Has many Attachments
- Has many FuelPriceReference records

### FuelPriceReference

Represents the source used to estimate or verify a fuel price for one or more fuel service records.

Potential fields:

- id
- fuelServiceRecordId
- priceDate
- fuelType
- pricePerGallon
- currency
- sourceType
- sourceName
- sourceLocation
- sourceUrl
- confidence
- notes
- createdAt
- updatedAt

Potential source types:

- Receipt
- Invoice
- Vendor
- Manual Estimate
- Gas Station Estimate
- Public Data Source
- Other

Relationships:

- Belongs to one FuelServiceRecord

### Fuel Reporting Notes

Fuel totals should be calculated from FuelServiceRecord.gallonsDelivered and grouped by date, month, year, equipment, mine, vendor, gas station, fuel type, or custom date range.

Estimated fuel value should be calculated from gallons delivered and the selected price per gallon. Actual purchase value may also be stored as totalAmount when a receipt or gas station purchase provides it. If no price is available, the record should still count toward gallon totals and appear in reports as missing price data.

Day View should include FuelServiceRecord records whose serviceDate matches the selected date.
