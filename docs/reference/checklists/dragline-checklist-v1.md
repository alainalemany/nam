# NACCO Dragline Inspection Checklist V1

Status: Canonical Source Reference

Template Name: Dragline Inspection

Template Key: `dragline_inspection`

Template Version: `1`

Intended Equipment Family: Dragline Equipment

Source: [NACCO Dragline Operational Safety Checklist](../../../source-forms/NACCO_Dragline_Operational_Safety_Checklist_Source.pdf)

Related Architecture: [Operational Safety Checklists Architecture](../../architecture/features/operational-safety-checklists.md)

Last Verified: 2026-07-15

## 1. Authority And Transcription Rules

This catalog transcribes the visible NACCO source form in source order. Visible
capitalization, punctuation, singular or plural wording, and response options
are preserved wherever legible.

Stable internal keys are NAM identifiers and do not replace the source labels.
The source displays no asterisk or other visible required indicator on the
Dragline metadata fields or inspection items. NAM completion behavior is
defined by feature architecture rather than inferred from missing source
markers.

No visible Dragline wording was unreadable in the supplied source.

## 2. Workflow Overview

The operator completes one Dragline Inspection at the beginning of the shift
for the actual Dragline Equipment inspected. The form records shift metadata,
the starting hour meter, ordered condition responses, problem context, and
operator and supervisor names.

The source ends with Planner Review. Planner Review is not operator-editable
and is intentionally excluded from NAM Dashboard V1.

## 3. Response Sets

| Response-set key | Visible options in source order |
| --- | --- |
| `condition_four` | OK; Needs Repair; Previously Noted; N/A |
| `yes_no` | Yes; No |

## 4. Source Field Order

### Metadata

| Source position | Internal key | Exact visible wording | Source control | Visible required indicator |
| ---: | --- | --- | --- | --- |
| 1 | `inspection_date` | Date | Date input | None |
| 2 | `shift` | Shift | Selection control | None |
| 3 | `location` | Location | Selection control | None |
| 4 | `equipment_number` | Equipment Number | Selection control | None |
| 5 | `starting_hour_meter` | Hour Meter (Start) | Text or numeric input | None |

### Inspection Items

| Source position | Item key | Exact visible wording | Visible source marker | Response set |
| ---: | --- | --- | --- | --- |
| 6 | `bench_condition` | Bench Condition | None | `condition_four` |
| 7 | `lights_working` | Lights Working | None | `condition_four` |
| 8 | `flammables_safely_stored` | Flammables Safely Stored | None | `condition_four` |
| 9 | `tools_stored_working` | Tools Stored, Working | None | `condition_four` |
| 10 | `electrical_cords_current` | Electrical Cords Current | None | `condition_four` |
| 11 | `fire_extinguishers_current` | Fire Extinguishers Current | None | `condition_four` |
| 12 | `guarding_sufficient` | Guarding Sufficient | None | `condition_four` |
| 13 | `walkways_clean_clear` | Walkways Clean & Clear | None | `condition_four` |
| 14 | `handrails_steps_usable` | Handrails & Steps Usable | None | `condition_four` |
| 15 | `trash_removed_daily` | Trash Removed Daily | None | `condition_four` |
| 16 | `bench_grinder_adjusted` | Bench Grinder Adjusted | None | `condition_four` |
| 17 | `all_gauges_functional` | All Gauges Functional | None | `condition_four` |
| 18 | `horn_functional` | Horn Functional | None | `condition_four` |
| 19 | `radios_functional` | Radios Functional | None | `condition_four` |
| 20 | `cab_is_clean` | Cab Is Clean | None | `condition_four` |
| 21 | `cab_glass_wipers` | Cab Glass & Wipers | None | `condition_four` |
| 22 | `brakes_working_properly` | Brakes Working Properly | None | `condition_four` |
| 23 | `hydraulic_level` | Hydraulic Level | None | `condition_four` |
| 24 | `oil_level` | Oil Level | None | `condition_four` |
| 25 | `coolant_level` | Coolant Level | None | `condition_four` |
| 26 | `spill_containment` | Spill Containment | None | `condition_four` |
| 27 | `limits` | Limits | None | `condition_four` |
| 28 | `spare_air_tanks_present_charged` | Spare Air Tank(s) Present And Charged | None | `condition_four` |
| 29 | `two_life_jackets_in_cabin` | Two Life Jackets In Cabin | None | `yes_no` |

### Completion Metadata

| Source position | Internal key | Exact visible wording | Source control | Visible required indicator |
| ---: | --- | --- | --- | --- |
| 30 | `problem_descriptions` | Problem Description(s) | Multiline text input | None |
| 31 | `operator_display_name` | Operator | Displayed person name | None |
| 32 | `supervisor_display_name` | Supervisor | Selection-style person field | None |

### Source-Only Excluded Field

| Source position | Exact visible wording | Visible options | NAM Dashboard V1 treatment |
| ---: | --- | --- | --- |
| 33 | Planner Review | Yes; No | Excluded; no field, identity, approval, or workflow is implemented |

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

The exact source field remains `Hour Meter (Start)`. NAM adds explicit `HOURS`
or `MILES` meter metadata without claiming that the corporate source form
contains a unit selector. The selected unit is visible and editable; Dragline
suggests `HOURS`. The governing behavior is defined by
`docs/architecture/features/operational-safety-checklists.md`.

NAM meter readings use whole-number values from `0` through `999999` inclusive.
The upper bound is an implementation validation guard rather than a business
rule. Decimal and floating-point values are not accepted.

## 8. Historical Snapshot Notes

Historical checklist records should retain:

- Template key, name, and version.
- Stable item keys, exact label snapshots, source ordering, visible source
  markers, and response-set identity.
- Selected response code and visible label.
- Operator and supervisor display-name snapshots.
- Explicit NAM meter kind and entered value.
- Limited Equipment, Mine, and City display snapshots defined by feature
  architecture.

Later label or ordering changes require a new template version. They must not
rewrite this V1 catalog or historical records.

## 9. Implementation Notes

- NAM uses an Equipment selector even though the source label is `Equipment
  Number`.
- Source `Location` is preserved in this catalog, but NAM derives Mine and City
  from Equipment and does not ask the user to select them independently.
- Every listed inspection item requires one response before submission under
  the approved complete-only workflow.
- Client-submitted template labels, response options, Equipment context, and
  historical snapshots are not authoritative.
- Planner Review remains outside V1.
