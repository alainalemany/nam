# ADR-001: PostgreSQL Over MongoDB

Date: 2026-06-04

Status: Accepted

Category: Data architecture

## Decision

PostgreSQL is selected instead of MongoDB.

## Reason

NAM Dashboard data is highly relational. Core records connect dates, date
ranges, shifts, equipment, mines, modules, inspections, permits, attachments,
fuel records, timesheets, payslips, and historical lookup workflows.

## Consequences

- Relational modeling is the default data architecture.
- PostgreSQL is the primary database.
- Prisma is the preferred ORM.
- Future data modeling should preserve relationships instead of hiding them in
  unstructured documents.
