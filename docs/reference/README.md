# Reference Catalogs

This directory contains source-derived reference catalogs used by NAM
Dashboard feature architecture and later implementation.

Reference catalogs preserve authoritative external wording, ordering, response
options, and visible source markers. They do not authorize implementation and
do not replace feature architecture, product requirements, or source artifacts.

## Operational Safety Checklists

| Catalog | Source | Status |
| --- | --- | --- |
| [Dragline Inspection V1](checklists/dragline-checklist-v1.md) | [NACCO Dragline source form](../../source-forms/NACCO_Dragline_Operational_Safety_Checklist_Source.pdf) | Canonical V1 source catalog; implemented in the checklist foundation |
| [Mobile Inspection V1](checklists/mobile-checklist-v1.md) | [NACCO Mobile source form](../../source-forms/NACCO_Mobile_Operational_Safety_Checklist_Source.pdf) | Canonical V1 source catalog; implemented in the checklist foundation |

Feature behavior and boundaries are authoritative in the
[Operational Safety Checklists Architecture](../architecture/features/operational-safety-checklists.md).

## Dragline Delay Reports

| Catalog | Source | Status |
| --- | --- | --- |
| [Delay Code Catalog V1](dragline-delay-reports/delay-code-catalog-v1.md) | [Official Delay Code Legend](../../source-forms/dragline-delay-report/02-delay-code-legend.jpg) | Canonical V1 source-derived catalog; 66 visible codes verified |

The accompanying [Dragline Delay Report front](../../source-forms/dragline-delay-report/01-dragline-delay-report-front.jpg)
is also preserved and visually verified. The catalog retains exact legend
wording, categories, code identities, numeric gaps, and source ordering. It is
separate from Timesheet Work Codes and does not authorize implementation by
itself.

Feature behavior and source-verification rules are authoritative in the
[Dragline Delay Reports Architecture](../architecture/features/dragline-delay-reports.md).

## U.S. Geography

The normalized U.S. Census Gazetteer seed is an executable reference-data
artifact rather than a prose catalog. Its source, scope, checksums,
normalization, and controlled import procedure are documented in
[`data/geography/README.md`](../../data/geography/README.md). Feature behavior is
authoritative in the [U.S. Geography Reference Data Architecture](../architecture/features/geography-reference-data.md).
