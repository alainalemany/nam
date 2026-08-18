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

The intended source-derived catalog location is:

```text
docs/reference/dragline-delay-reports/delay-code-catalog-v1.md
```

Status: Blocked. The original Dragline Delay Report front and official Delay
Code Legend are not committed. They must first be preserved under
`source-forms/dragline-delay-report/` and visually verified. Do not create the
catalog from memory, inference, Timesheet Work Codes, or rewritten
descriptions.

Feature behavior and source-closure rules are authoritative in the
[Dragline Delay Reports Architecture](../architecture/features/dragline-delay-reports.md).
