# Ideas Backlog

This document is the canonical home for unapproved future ideas and concepts
that require later evaluation.

Items in this document are not confirmed requirements unless they are promoted
into the relevant canonical document.

Candidate future product directions remain here until they are promoted into
[Product Vision](product-vision.md), [Product Roadmap](product-roadmap.md),
[Product Requirements](prd.md), or another appropriate canonical document.

## Future Ideas

### Paper-Style Work Authorization PDF Export

Generate PDF exports that match the layout of the original paper Work Authorization, Lockout Permit, Hot Work Permit, Working at Heights Permit, and Completion Checklist forms.

Status: Future evaluation

Reason: This is useful for sending copies to a supervisor or keeping formal records, but exact form reproduction adds layout and PDF-generation complexity. The system should first capture the structured data cleanly.

### Work Authorization Audit Log

Track changes made to Work Authorization records, including who changed a field and when.

Status: Future evaluation

Reason: This may become important for compliance review, but it is not required for the first working version.

### Automatic Permit Suggestions

Suggest required permits based on the type of work being performed.

Examples:

- Welding suggests Hot Work Permit
- Elevated work suggests Working at Heights Permit
- Equipment maintenance suggests Lockout Permit

Status: Future evaluation

Reason: Helpful later, but V1 should rely on operator selection to avoid overcomplicating the workflow too early.

### Work Schedule Reminders And Calendar Sync

Add reminders for upcoming assignments and optionally export or sync manually entered work schedules to a calendar.

Status: Future evaluation

Reason: This could make manually entered schedules more useful, but Version 1 should first support reliable manual schedule logging, editing, and history. SMS import and natural-language parsing are intentionally out of scope.

### Equipment Alarm And Observation Templates

Create equipment-specific Daily Log templates for recording the different kinds of operational information each dragline provides.

Examples:

- Dragline 102: digital alarm screen entries with alarm code, description, date, and time
- Draglines 119, 137, and 142: diesel dragline condition observations without digital alarm screen data

Status: Future evaluation

Reason: Equipment-specific templates would make data entry faster and more consistent, but the first requirement is to support flexible Daily Log activity entries that can link to equipment and preserve historical context.

### Automatic Payroll Provider Import

Automatically connect to Workday or another payroll provider to import payslips without manual upload.

Status: Future evaluation

Reason: Manual PDF upload is the preferred V1 workflow. Payroll-provider login automation would add security, maintenance, and account-access risk, so it should only be evaluated after the Payslip Repository works reliably from uploaded PDFs.

### Financial Recommendation Engine

Use payslip history to suggest tax, retirement, benefits, or savings decisions.

Status: Future evaluation

Reason: The system can calculate historical totals, but financial advice introduces accuracy, liability, and personalization concerns. V1 should focus on archiving, extraction, search, and factual analytics.

### Fleet Fuel Price Lookup

Estimate the value of future Fleet gas-station purchases by looking up gasoline
prices for the purchase date and nearby location, such as public fuel price
datasets, commercial APIs, vendor data, or manually curated local gas-station
estimates.

Status: Future evaluation

Reason: Fleet purchase-value estimates may be useful later, but external price
history may be incomplete, location-dependent, paid, or unreliable. Fleet
purchase evidence and manual price capture must be defined before external
lookup is considered. This idea does not belong to Equipment Fuel Events.
