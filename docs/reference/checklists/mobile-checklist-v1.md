# NACCO Mobile Inspection Checklist V1

Status: Canonical Source Reference

Template Name: Mobile Inspection

Template Key: `mobile_inspection`

Template Version: `1`

Intended Equipment Family: Pickup trucks, tractors, forklifts, and explicitly approved future mobile Equipment

Source: [NACCO Mobile Operational Safety Checklist](../../../source-forms/NACCO_Mobile_Operational_Safety_Checklist_Source.pdf)

Related Architecture: [Operational Safety Checklists Architecture](../../architecture/features/operational-safety-checklists.md)

Last Verified: 2026-07-15

## 1. Authority And Transcription Rules

This catalog transcribes the visible NACCO source form in source order. Visible
capitalization, punctuation, spelling, source markers, and response options are
preserved wherever legible.

Stable internal keys are NAM identifiers and do not replace source labels. The
source visibly prefixes some item labels with `*` or `**`, but the supplied form
contains no visible legend explaining those markers. The catalog records them
exactly without inventing a meaning. NAM completion behavior is defined by
feature architecture and requires a response for every listed inspection item.

No visible Mobile wording was unreadable in the supplied source. The visible
source spelling `Fire Supression System` is intentionally preserved.

## 2. Workflow Overview

The operator completes one Mobile Inspection at the beginning of the shift for
the actual mobile Equipment inspected, including temporary replacement or
rental Equipment. The form records shift metadata, Rental status, Equipment,
the starting hour meter, ordered condition responses, Fuel Card presence,
problem context, and operator and supervisor names.

The source ends with Planner Review. Planner Review is not operator-editable
and is intentionally excluded from NAM Dashboard V1.

## 3. Response Sets

| Response-set key | Visible options in source order |
| --- | --- |
| `yes_no` | Yes; No |
| `condition_three` | OK; Needs Repair; N/A |
| `condition_four` | OK; Needs Repair; Previously Noted; N/A |
| `presence_three` | Present; Not Present; N/A |

## 4. Source Field Order

### Metadata

| Source position | Internal key | Exact visible wording | Source control | Visible required indicator |
| ---: | --- | --- | --- | --- |
| 1 | `inspection_date` | Date | Date input | None |
| 2 | `shift` | Shift | Selection control | None |
| 3 | `rental_status` | Rental | Yes/No response | None |
| 4 | `equipment_number` | Equipment Number | Text input | None |
| 5 | `starting_hour_meter` | Hour Meter (Start) | Text or numeric input | None |

### Inspection Items

| Source position | Item key | Exact visible wording | Visible source marker | Response set |
| ---: | --- | --- | --- | --- |
| 6 | `seat_belt` | Seat Belt | `*` | `condition_three` |
| 7 | `backup_up_alarm` | Backup-Up Alarm | `*` | `condition_three` |
| 8 | `park_service_brake` | Park & Service Brake | `*` | `condition_three` |
| 9 | `fire_extinguisher_tag_seal` | Fire Extinguisher (Tag & Seal) | `*` | `condition_three` |
| 10 | `horn` | Horn | `*` | `condition_three` |
| 11 | `steering` | Steering | `**` | `condition_four` |
| 12 | `two_way_radio` | Two-Way Radio | `**` | `condition_four` |
| 13 | `oil_grease_accumulation` | Oil & Grease Accumulation | `**` | `condition_four` |
| 14 | `working_lights` | Working Lights | `**` | `condition_four` |
| 15 | `tail_lights` | Tail Lights | `**` | `condition_four` |
| 16 | `fire_suppression_system` | Fire Supression System | `**` | `condition_four` |
| 17 | `hydraulic_level` | Hydraulic Level | None | `condition_four` |
| 18 | `oil_level` | Oil Level | None | `condition_four` |
| 19 | `coolant_level` | Coolant Level | None | `condition_four` |
| 20 | `oil_water_leaks` | Oil & Water Leaks | None | `condition_four` |
| 21 | `tires_rims_lugs_or_tracks` | Tires, Rims, & Lugs or Tracks | None | `condition_four` |
| 22 | `pins_connections` | Pins & Connections | None | `condition_four` |
| 23 | `cab_condition` | Cab Condition | None | `condition_four` |
| 24 | `glass_wipers` | Glass & Wipers | None | `condition_four` |
| 25 | `instrument_panel` | Instrument Panel | None | `condition_four` |
| 26 | `area_around_equipment` | Area Around Equipment | None | `condition_four` |
| 27 | `fuel_card` | Fuel Card | None | `presence_three` |

The stable key `fire_suppression_system` uses conventional internal spelling;
the user-facing source label remains the exact visible `Fire Supression System`.

### Completion Metadata

| Source position | Internal key | Exact visible wording | Source control | Visible required indicator |
| ---: | --- | --- | --- | --- |
| 28 | `problem_descriptions` | Problem Description(s) | Multiline text input | None |
| 29 | `operator_display_name` | Operator | Displayed person name | None |
| 30 | `supervisor_display_name` | Supervisor | Selection-style person field | None |

### Source-Only Excluded Field

| Source position | Exact visible wording | Visible options | NAM Dashboard V1 treatment |
| ---: | --- | --- | --- |
| 31 | Planner Review | Yes; No | Excluded; no field, identity, approval, or workflow is implemented |

## 5. Problem Description Behavior

The source provides one multiline `Problem Description(s)` field after all
inspection responses. It does not provide item-specific note fields.

NAM V1 requires a nonblank overall Problem Description when any item is marked
Needs Repair. Previously Noted does not require the operator to repeat existing
damage text. A future explicit text-only reuse action may reduce repeated
typing, but prior responses must never be copied or preselected.

## 6. Operator And Supervisor Behavior

The source displays the Operator as a person name and Supervisor as a
selection-style person field. NAM V1 stores required operator and supervisor
display-name snapshots. It does not introduce Employee, Supervisor, User,
authentication, or workforce-management models.

## 7. Meter Type

The exact source field is `Hour Meter (Start)`. Mobile Inspection V1 therefore
uses an Hours meter kind for the canonical source template. The broader feature
architecture may support Mileage for explicitly approved future mobile
Equipment, but Mobile must never be hardcoded to odometer.

The canonical V1 Hour Meter uses a whole-number value from `0` through
`999999` inclusive. The upper bound is an implementation validation guard
rather than a business rule. Decimal and floating-point values are not
accepted. Future Equipment types may define different meter semantics only
after separate operational evidence and template/version approval.

## 8. Historical Snapshot Notes

Historical checklist records should retain:

- Template key, name, and version.
- Stable item keys, exact label snapshots, source ordering, visible source
  markers, and response-set identity.
- Selected response code and visible label.
- Rental and Fuel Card response history.
- Operator and supervisor display-name snapshots.
- Hour-meter kind and entered value.
- Limited Equipment, Mine, and City display snapshots defined by feature
  architecture.

Later label, marker, response-set, or ordering changes require a new template
version. They must not rewrite this V1 catalog or historical records.

## 9. Implementation Notes

- NAM uses an Equipment selector even though the source presents `Equipment
  Number` as a text input.
- Rental is shift-specific checklist metadata, not a permanent Equipment
  attribute.
- Fuel Card is an inspection response, not a permanent Equipment attribute.
- Every listed inspection item requires one response before submission under
  the approved complete-only workflow, independent of the unexplained source
  `*` and `**` markers.
- Client-submitted template labels, response options, Equipment context, and
  historical snapshots are not authoritative.
- Planner Review remains outside V1.
