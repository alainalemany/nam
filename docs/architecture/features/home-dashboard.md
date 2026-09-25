# Home Dashboard Architecture

Status: Approved

Product Phase: Home operational-summary evolution

Primary Feature: Dashboard Home

Depends On:

- Feature-owned server reads from Work Schedule and Maintenance Tracking
- `docs/feature-architecture.md`
- `docs/application-state-and-data-flow.md`
- `docs/ui-architecture.md`

Last Reviewed: 2026-09-25

## 1. Purpose

Home is a read-only operational composition surface. It answers what requires
attention now without copying records from the modules that own them.

## 2. Responsibilities

Home owns reusable card composition, responsive card layout, quick navigation,
and parallel invocation of explicit feature-owned summary queries.

The implemented foundation includes Current/Next Shift, Maintenance Health,
Fleet Attention, and Quick Actions cards. Future cards may summarize DDR, Fuel Events, STOP Cards,
or other approved modules through the same explicit ownership pattern.

## 3. Non-Responsibilities

Home does not persist schedules, Equipment, maintenance state, DDR facts, fuel
events, STOP Cards, or copied dashboard records. It does not infer feature
business rules inside React components and does not introduce a generic widget
registry or global client store.

## 4. User Workflow

The operator opens Home and sees an active shift when one exists; otherwise the
next future scheduled assignment appears. Maintenance Health focuses on one
selected Dragline and defaults to the Current/Next Shift Equipment when it has
trackers. Fleet Attention shows only actionable exceptions on other Draglines.
Empty states explain when no assignment, tracker, or fleet exception exists.

## 5. Module Boundaries

- Work Schedule owns assignment selection and shift interpretation.
- Maintenance Tracking owns DDR-derived rule evaluation, Dragline selection,
  component ranking, and fleet-exception ordering.
- Home owns only layout and links to source records.
- Quick Actions link to existing routes and do not duplicate mutations.

## 6. Data Flow

The server-rendered Home route first invokes `getHomeShiftSummary`, then passes
its Equipment ID and any valid URL selector to the Maintenance-owned
`getHomeMaintenanceSummary`. Each helper returns display-ready domain data.
Home does not query feature tables directly or calculate maintenance status.

Current/Next Shift uses America/New_York local time. Day is 5:00 AM through
5:00 PM and Night is 5:00 PM through 5:00 AM on the next calendar day. The
interval uses a half-open end boundary. An explicitly recorded actual
assignment supersedes its plan; otherwise the planned assignment is used.
Only Scheduled Day/Night assignments are eligible. Direct date ordering avoids
week-boundary assumptions.

## 7. UI Composition

Cards use the existing CSS design language, restrained status badges, readable
metadata, and a container-aware responsive layout. When the Home content
container is sufficiently wide, an asymmetric two-column composition gives
Maintenance Health more room while Current/Next Shift and Fleet Attention use
the supporting column. When the content container is constrained by the
sidebar, page padding, or viewport, the cards stack naturally. The transition
is based on usable Home content width rather than a device-specific viewport
breakpoint, and cards keep their natural heights instead of stretching to match
one another.

Maintenance Health uses accessible progress rings whose visual fill caps at
100 percent while text preserves actual overage. The widget establishes its own
inline-size container so component rows, progress-ring sizing, title/status
wrapping, and selector controls respond to the space actually available inside
the card. Narrow containers use full-width horizontal component rows and stack
the selector action only when required; wider containers may use denser
multi-column presentation without duplicating markup.

Maintenance Health renders configured active components rather than hard-coded
cable/teeth branches, limits Home growth, and links each item to feature detail.
Each initialized component also identifies the available completed-DDR coverage
behind its derived value. Home uses a compact coverage summary with the complete
wording available as supplemental text and on component detail, so a date-only
historical anchor remains honest without repeating audit prose in every summary
row. Equipment with no initialized tracker remains dormant and does not become
a fleet exception. The components contain no persistence or status
calculations, keeping future Metronic/ReUI restyling separate from feature
behavior.

## 8. Validation And Error Handling

A successful empty feature query renders a useful empty state. Route-level
runtime failures continue through the existing Next.js error boundary pattern.

## 9. Testing Strategy

Unit coverage protects active Day, overnight Night, current-over-next priority,
future selection, no-upcoming behavior, actual-over-planned selection, relative
labels, and Sunday/Monday crossings. Maintenance tests protect schedule-based
selection, manual selection, Fleet Attention filtering/order, and ring progress
without duplicating feature calculations in Home.

## 10. Future Evolution

Additional cards should consume explicit feature-owned contracts and remain
small. A registry, copied dashboard table, chart platform, or client cache is
not justified by the current foundation.
