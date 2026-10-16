import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { guardedPhaseADatabaseUrl } from "../helpers/phase-a-postgres-guard";

const databaseUrl = guardedPhaseADatabaseUrl();
const describePostgres = databaseUrl ? describe.sequential : describe.skip;

let prisma: PrismaClient;

describePostgres("Payroll historical evidence quarantine migration", () => {
  beforeAll(() => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("quarantines every pre-existing Timesheet without trusting current names", async () => {
    const timesheets = await prisma.weeklyTimesheet.findMany({
      where: { id: { startsWith: "migration-timesheet-" } },
      orderBy: { id: "asc" },
    });

    expect(timesheets).toHaveLength(7);
    for (const timesheet of timesheets) {
      expect(timesheet).toMatchObject({
        primaryEmployeeId: null,
        primaryEmployeeIdentityStatus: "NEEDS_REVIEW",
        identityVersion: 1,
      });
    }

    expect(timesheets.find((item) => item.id === "migration-timesheet-unique"))
      .toMatchObject({
        primaryEmployeeDisplayName: "Historical UNIQUE Operator Snapshot",
        primaryEmployeeKey: "unique operator",
        identityCandidateEmployeeId: "migration-employee-unique",
        createdAt: new Date("2026-06-01T08:00:00.000Z"),
        updatedAt: new Date("2026-06-01T09:00:00.000Z"),
      });
    expect(timesheets.find((item) => item.id === "migration-timesheet-inactive")?.identityCandidateEmployeeId)
      .toBe("migration-employee-inactive");
    expect(timesheets.find((item) => item.id === "migration-timesheet-post34-name-inferred")?.identityCandidateEmployeeId)
      .toBe("migration-employee-later-duplicate");
    expect(timesheets.find((item) => item.id === "migration-timesheet-arbitrary-id")?.identityCandidateEmployeeId)
      .toBe("migration-employee-duplicate-a");
    expect(timesheets.find((item) => item.id === "migration-timesheet-duplicate")?.identityCandidateEmployeeId)
      .toBeNull();
    expect(timesheets.find((item) => item.id === "migration-timesheet-missing")?.identityCandidateEmployeeId)
      .toBeNull();
    expect(timesheets.find((item) => item.id === "migration-timesheet-post34-null")?.identityCandidateEmployeeId)
      .toBeNull();
  });

  it("preserves Daily Time Entry and Work Allocation evidence byte-for-value", async () => {
    const entry = await prisma.dailyTimeEntry.findUniqueOrThrow({
      where: { id: "migration-time-entry" },
      include: { allocations: true },
    });

    expect(entry).toMatchObject({
      weeklyTimesheetId: "migration-timesheet-unique",
      workDate: new Date("2026-06-02T00:00:00.000Z"),
      workedMinutes: 600,
      regularMinutes: 600,
      overtimeMinutes: 0,
      primaryEquipmentDisplayNameSnapshot: "Historical Dragline",
      notes: "Preserve this entry",
      createdAt: new Date("2026-06-02T08:00:00.000Z"),
      updatedAt: new Date("2026-06-02T18:00:00.000Z"),
    });
    expect(entry.allocations).toEqual([
      expect.objectContaining({
        id: "migration-work-allocation",
        workCodeSnapshot: "MIG-1",
        allocatedMinutes: 600,
        notes: "Preserve this allocation",
        createdAt: new Date("2026-06-02T08:00:00.000Z"),
        updatedAt: new Date("2026-06-02T18:00:00.000Z"),
      }),
    ]);
  });

  it("quarantines every pre-existing rate while preserving values and candidate provenance", async () => {
    const rates = await prisma.employeePayRate.findMany({
      where: { id: { startsWith: "migration-rate-" } },
      orderBy: { id: "asc" },
    });

    expect(rates).toHaveLength(3);
    for (const rate of rates) {
      expect(rate).toMatchObject({
        sourcePaycheckId: null,
        verificationStatus: "NEEDS_REVIEW",
        provenanceKind: "UNKNOWN",
        evidenceVersion: 1,
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      });
    }
    expect(rates.find((rate) => rate.id === "migration-rate-unique"))
      .toMatchObject({
        hourlyRate: new Prisma.Decimal("33.15"),
        effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
        provenanceCandidatePaycheckId: "migration-paycheck-unique-rate",
      });
    expect(rates.find((rate) => rate.id === "migration-rate-ambiguous")?.provenanceCandidatePaycheckId)
      .toBeNull();
    expect(rates.find((rate) => rate.id === "migration-rate-manual"))
      .toMatchObject({
        sourceNote: "Synthetic independently supported rate",
        provenanceCandidatePaycheckId: null,
      });
  });

  it("preserves predecessor checksums and installs migration 36 constraints and partial indexes", async () => {
    const ledger = await prisma.$queryRaw<Array<{ migration_name: string; checksum: string }>>`
      SELECT "migration_name", "checksum"
      FROM "_prisma_migrations"
      WHERE "migration_name" IN (
        '20261008000100_payroll_reconciliation_v1',
        '20261015000100_payroll_pr_review_corrections',
        '20261015000200_payroll_historical_evidence_quarantine'
      )
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
      ORDER BY "migration_name"
    `;
    expect(ledger).toEqual([
      {
        migration_name: "20261008000100_payroll_reconciliation_v1",
        checksum: "151d2efa4609d5957f25eeb04d9a1a069539a54d6a32106f48b519ff87012d16",
      },
      {
        migration_name: "20261015000100_payroll_pr_review_corrections",
        checksum: "3e0f181987c89038495ef34ea905273345a216cf89a726e8bd787fdcf9818eff",
      },
      expect.objectContaining({
        migration_name: "20261015000200_payroll_historical_evidence_quarantine",
      }),
    ]);

    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conname IN (
        'WeeklyTimesheet_identity_relationship_check',
        'WeeklyTimesheet_identityVersion_check',
        'EmployeePayRate_provenance_relationship_check',
        'EmployeePayRate_verified_provenance_check',
        'EmployeePayRate_evidenceVersion_check'
      )
      ORDER BY conname
    `;
    expect(constraints).toHaveLength(5);

    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE indexname IN (
        'EmployeePayRate_verified_employee_effective_key',
        'EmployeePayRate_verified_paycheck_source_key'
      )
      ORDER BY indexname
    `;
    expect(indexes).toHaveLength(2);

    const employeeRateForeignKey = await prisma.$queryRaw<Array<{ delete_action: string }>>`
      SELECT confdeltype::text AS delete_action
      FROM pg_constraint
      WHERE conname = 'EmployeePayRate_employee_fkey'
        AND conrelid = '"EmployeePayRate"'::regclass
    `;
    expect(employeeRateForeignKey).toEqual([{ delete_action: "r" }]);
  });

  it("enforces impossible-state checks and trusted-only uniqueness", async () => {
    await expect(prisma.weeklyTimesheet.create({
      data: {
        id: "migration-invalid-trusted-timesheet",
        payrollWeekStartDate: new Date("2026-08-03T00:00:00.000Z"),
        payrollWeekEndDate: new Date("2026-08-09T00:00:00.000Z"),
        primaryEmployeeDisplayName: "Invalid",
        primaryEmployeeKey: "invalid",
        primaryEmployeeIdentityStatus: "EXPLICIT_SELECTION",
        primaryEmployeeId: null,
      },
    })).rejects.toThrow();

    await prisma.employeePayRate.createMany({
      data: [
        {
          id: "migration-unverified-coexist-a",
          employeeId: "migration-employee-manual-rate",
          effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
          hourlyRate: new Prisma.Decimal("40"),
        },
        {
          id: "migration-unverified-coexist-b",
          employeeId: "migration-employee-manual-rate",
          effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
          hourlyRate: new Prisma.Decimal("41"),
        },
      ],
    });

    await prisma.employeePayRate.create({
      data: {
        id: "migration-verified-rate-a",
        employeeId: "migration-employee-manual-rate",
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
        hourlyRate: new Prisma.Decimal("42"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    });
    await expect(prisma.employeePayRate.create({
      data: {
        id: "migration-verified-rate-b",
        employeeId: "migration-employee-manual-rate",
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
        hourlyRate: new Prisma.Decimal("43"),
        verificationStatus: "VERIFIED",
        provenanceKind: "INDEPENDENT",
      },
    })).rejects.toMatchObject({ code: "P2002" });

    await expect(prisma.employeePayRate.create({
      data: {
        id: "migration-invalid-verified-rate",
        employeeId: "migration-employee-manual-rate",
        effectiveFrom: new Date("2026-08-02T00:00:00.000Z"),
        hourlyRate: new Prisma.Decimal("44"),
        verificationStatus: "VERIFIED",
        provenanceKind: "UNKNOWN",
      },
    })).rejects.toThrow();
  });

  it("restricts Employee deletion while preserving historical pay-rate evidence", async () => {
    await prisma.employee.create({
      data: {
        id: "migration-delete-restricted-employee",
        employeeCode: "MIG-DELETE-RESTRICTED",
        displayName: "Deletion Restricted Employee",
      },
    });
    await prisma.employeePayRate.create({
      data: {
        id: "migration-delete-restricted-rate",
        employeeId: "migration-delete-restricted-employee",
        effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
        hourlyRate: new Prisma.Decimal("45.00"),
      },
    });
    const before = await prisma.employeePayRate.findMany({
      where: { employeeId: "migration-delete-restricted-employee" },
      orderBy: { id: "asc" },
    });
    expect(before.length).toBeGreaterThan(0);

    await expect(prisma.employee.delete({
      where: { id: "migration-delete-restricted-employee" },
    })).rejects.toThrow(/EmployeePayRate_employee_fkey|foreign key constraint/i);

    expect(await prisma.employee.findUnique({
      where: { id: "migration-delete-restricted-employee" },
    })).not.toBeNull();
    expect(await prisma.employeePayRate.findMany({
      where: { employeeId: "migration-delete-restricted-employee" },
      orderBy: { id: "asc" },
    })).toEqual(before);
  });
});
