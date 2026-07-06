# UI Architecture

This document is the canonical UI architecture and design-system standard for
NAM Dashboard.

It defines how screens should be composed, how common UI states should behave,
and how vendor UI resources should be used. It does not document every CSS
class, replace product requirements, or redefine feature code ownership.

## Classification

| Classification | Meaning |
| --- | --- |
| Confirmed | These UI architecture standards are approved project direction. |
| Recommended | Suggested UI improvements that still need approval. |
| Open Question | UI areas that need future decisions. |

## Documentation Graph Fit

UI architecture sits in this path:

```text
docs/philosophy.md
-> docs/engineering-principles.md
-> docs/ui-architecture.md
-> docs/feature-architecture.md
-> implementation files
```

Related authorities:

- Product requirements and user experience goals live in `docs/prd.md`.
- Module workflows live in `docs/modules.md`.
- Feature module implementation standards live in `docs/feature-architecture.md`.
- Testing and E2E expectations live in `docs/testing-strategy.md`.
- Architecture overview lives in `docs/architecture.md`.
- Metronic integration boundaries are recorded in
  `docs/decisions/adr-014-metronic-integration-strategy.md`.
- Documentation formatting rules live in `docs/documentation-style.md`.

This document should be discovered through `AGENTS.md`, `docs/README.md`, and
`docs/ai-context.md` before feature UI work begins.

## Purpose

NAM Dashboard should feel like a quiet, durable operational tool. The UI should
support repeated data entry, scanning, comparison, and historical lookup without
unnecessary decoration.

The purpose of this document is to standardize:

- Application shell and navigation behavior.
- Page layout and visual hierarchy.
- Forms, tables, detail pages, and timeline patterns.
- Common action, loading, empty, error, and success states.
- Responsive and accessibility expectations.
- Tailwind and Metronic usage boundaries.

## Source Of Truth Boundaries

Use the right document for the right question:

| Question | Source |
| --- | --- |
| What should the product do? | `docs/prd.md` |
| How should a module workflow behave? | `docs/modules.md` |
| Where should feature UI code live? | `docs/feature-architecture.md` |
| How should UI behavior be tested? | `docs/testing-strategy.md` |
| Why is Metronic a toolkit, not architecture? | ADR-014 |
| How should screens look and behave? | `docs/ui-architecture.md` |

Do not duplicate module requirements, database rules, feature ownership, or
testing policy in this document.

## UI Principles

Confirmed UI principles:

- Prioritize clarity, density, and repeat use over marketing-style presentation.
- Make the current task obvious.
- Keep operational records scannable by date, equipment, mine, module, and
  status.
- Prefer compact but readable layouts.
- Use consistent controls for repeated workflows.
- Keep visual styling restrained and professional.
- Avoid decorative UI that competes with operational data.
- Preserve accessibility and keyboard usability as the interface grows.

## Application Shell And Navigation

The application shell should provide stable navigation and predictable page
placement.

Shell expectations:

- Primary navigation should remain persistent on desktop.
- Navigation labels should match module names used in documentation.
- The current module should be easy to identify.
- The shell should avoid mixing product navigation with documentation or
  administrative links unless those areas are intentionally added.
- Public development access through Caddy does not change the application shell.

Future navigation additions should follow confirmed module scope rather than
pre-emptively adding links for unimplemented modules.

## Page Layout Standards

Pages should use a consistent hierarchy:

- Page header with module context, page title, and concise summary.
- Primary action near the page header when the page has a dominant action.
- Content sections arranged for scanning.
- Tables for lists of records.
- Detail views for one record.
- Forms for create/edit workflows.

Page headings should describe the user's current task, not implementation
details.

Avoid landing-page patterns for operational screens. The first viewport should
show usable application content.

## Panels, Tables, Detail Views, And Timelines

Use panels when grouping related operational content.

Tables should be used for record lists when users need to compare dates, names,
equipment, statuses, or actions.

Detail views should:

- Show the record identity clearly.
- Surface date, mine, equipment, and status context.
- Keep edit actions discoverable.
- Present related records or activities in a predictable order.

Timelines should be used when sequence matters, such as Daily Log activities.
Timeline entries should make time, activity type, title, and related equipment
easy to scan.

## Form UX Standards

Forms should be optimized for reliable manual entry.

Form expectations:

- Group fields into clear sections.
- Use labels for every input.
- Use selects for bounded option sets.
- Use checkboxes or toggles for binary choices.
- Use textareas for longer notes.
- Show field-level validation errors near the field.
- Keep submit and cancel actions consistently placed.
- Avoid forcing repeated input when a value can inherit from the parent record.
- Preserve entered values where practical after validation errors.

Do not add controls for future module behavior before that behavior is approved.

## Buttons, Actions, And Links

Actions should communicate intent clearly.

Use:

- Primary buttons for the dominant page action.
- Secondary buttons for cancel, add-row, or non-destructive supporting actions.
- Text links for table row navigation and low-emphasis actions.
- Destructive actions only after lifecycle and confirmation rules are defined.

Avoid presenting too many equal-weight actions in the same area.

## Loading, Empty, Error, And Success States

Every route that can wait, fail, or show no records should have an intentional
state.

Expected states:

- Loading states should preserve the page shape when possible.
- Empty states should explain what is missing and offer the next useful action.
- Error states should give a retry path when recovery is possible.
- Success states should usually redirect to the resulting list or detail page
  instead of displaying temporary success banners.

Do not expose raw stack traces or database errors in user-facing UI.

## Responsive Behavior

The application should remain usable on narrow screens, but V1 is not a mobile
application.

Responsive expectations:

- Navigation should collapse or stack cleanly.
- Forms should move from multi-column to single-column layouts on narrow
  screens.
- Tables should allow horizontal scrolling when dense data cannot fit.
- Buttons and labels should not overlap or truncate essential meaning.
- Text should remain readable without viewport-based font scaling.

## Accessibility Expectations

Accessibility should be built into normal component patterns.

Expectations:

- Use semantic headings in order.
- Associate labels with inputs.
- Use `aria-labelledby` for page sections when appropriate.
- Keep focusable controls keyboard reachable.
- Ensure visible focus states are not removed.
- Use color as support, not the only signal.
- Keep contrast sufficient for operational use.
- Use meaningful link and button text.

Accessibility should be verified manually until automated accessibility checks
are introduced.

## Tailwind Usage

Tailwind CSS is part of the planned stack, but current implementation may use
plain CSS while the foundation is still small.

Tailwind usage should:

- Support the project design system rather than replace it.
- Avoid one-off visual styling that cannot be reused.
- Keep layout and spacing consistent across modules.
- Avoid large, decorative gradients or single-hue palettes for operational
  screens.

When Tailwind adoption expands, document any durable class or component
conventions here or near the relevant shared UI code.

## Metronic Usage Boundaries

Metronic is a vendor UI toolkit, not application architecture.

Use Metronic selectively for useful patterns, components, layouts, and visual
guidance when it helps NAM Dashboard. Do not copy the full Metronic package into
the repository.

Metronic-derived code must:

- Preserve NAM Dashboard domain architecture.
- Keep business logic outside vendor-derived UI code.
- Be adapted to project conventions.
- Be documented near imported code or feature documentation when meaningful.

ADR-014 is the durable source for this decision.

## Feature UI Checklist

Before implementing a feature UI, confirm:

- The workflow is approved and documented in the correct product/module source.
- The route and feature ownership are clear in `docs/feature-architecture.md`.
- Required data fields and relationships are documented in `docs/database.md`.
- The page type is clear: list, create, edit, detail, timeline, dashboard, or
  other approved pattern.
- Loading, empty, error, and success states are identified.
- Validation and field error behavior are defined.
- Primary and secondary actions are clear.
- Responsive behavior is acceptable for expected use.
- Any Metronic usage respects ADR-014.
- Testing or manual verification expectations are identified through
  `docs/testing-strategy.md`.

After implementation, verify:

- Text does not overlap or overflow in normal desktop and narrow layouts.
- Forms can be completed and corrected.
- List/detail navigation is clear.
- The UI does not expose unimplemented module behavior.
- The feature remains consistent with existing module screens.

## What Not To Standardize Yet

Do not standardize these areas until requirements justify them:

- A full design-token system.
- A shared component package.
- A complete Metronic import strategy.
- Dark mode.
- Mobile app navigation.
- Attachment gallery patterns.
- Day View layout.
- Global search UI.
- Analytics dashboard patterns.
- Print/PDF export UI.
- Authentication and user-profile UI.

These may become necessary later, but standardizing them now would add
structure ahead of confirmed requirements.

## Open Questions

- When should repeated page and form patterns become shared components?
- What UI primitives should be introduced before Metronic integration expands?
- What table pattern should be used when TanStack Table is introduced?
- How should Day View combine records from multiple modules?
- What accessibility checks should become part of the testing workflow?
