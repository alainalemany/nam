import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { correctPaycheckAction, savePaycheckAction } from "@/features/payroll/actions";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  requirePrincipal: vi.fn(),
  paycheckFindUnique: vi.fn(),
  paycheckFindFirst: vi.fn(),
  paycheckCreate: vi.fn(),
  paycheckUpdate: vi.fn(),
  periodUpsert: vi.fn(),
  periodUpdate: vi.fn(),
  rateFindMany: vi.fn(),
  rateFindFirst: vi.fn(),
  rateCreate: vi.fn(),
  rateUpdateMany: vi.fn(),
  executeRaw: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/payroll/auth", () => ({
  clearPayrollSession: vi.fn(),
  establishPayrollSession: vi.fn(),
  requirePayrollPrincipal: mocks.requirePrincipal,
}));
vi.mock("@/features/payroll/parser", () => ({ extractPaycheckPdf: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

function tx() {
  return {
    $executeRaw: mocks.executeRaw,
    paycheck: {
      findUnique: mocks.paycheckFindUnique,
      findFirst: mocks.paycheckFindFirst,
      create: mocks.paycheckCreate,
      update: mocks.paycheckUpdate,
    },
    payrollPeriod: { upsert: mocks.periodUpsert, update: mocks.periodUpdate },
    employeePayRate: {
      findMany: mocks.rateFindMany,
      findFirst: mocks.rateFindFirst,
      create: mocks.rateCreate,
      updateMany: mocks.rateUpdateMany,
    },
  };
}

function payload(overrides: Record<string, string> = {}) {
  return {
    fingerprint: "a".repeat(64),
    parserVersion: "synthetic-v1",
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    checkDate: "2026-09-23",
    regularHours: "40",
    overtimeHours: "0",
    baseRate: "",
    regularEarnings: "100",
    overtimeBaseEarnings: "0",
    overtimePremiumEarnings: "0",
    otherCashEarnings: "0",
    grossCashPay: "100",
    noncashImputedEarnings: "0",
    preTaxDeductions: "0",
    employeeTaxes: "20",
    postTaxDeductions: "0",
    adjustments: "0",
    netPay: "80",
    notes: "Synthetic evidence",
    warnings: [],
    ...overrides,
  };
}

function formData(values = payload(), paycheckId?: string) {
  const data = new FormData();
  data.set("payload", JSON.stringify(values));
  if (paycheckId) data.set("paycheckId", paycheckId);
  return data;
}

describe("Payroll payday persistence actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({ employeeId: "employee-1", expiresAt: 999_999 });
    mocks.transaction.mockImplementation((callback) => callback(tx()));
    mocks.paycheckFindUnique.mockResolvedValue(null);
    mocks.periodUpsert.mockResolvedValue({ id: "period-1" });
    mocks.paycheckCreate.mockResolvedValue({ id: "paycheck-1" });
    mocks.paycheckUpdate.mockResolvedValue({ id: "paycheck-1" });
    mocks.periodUpdate.mockResolvedValue({ id: "period-1" });
    mocks.rateFindMany.mockResolvedValue([]);
    mocks.rateFindFirst.mockResolvedValue(null);
    mocks.rateCreate.mockResolvedValue({ id: "rate-1" });
    mocks.rateUpdateMany.mockResolvedValue({ count: 0 });
    mocks.executeRaw.mockResolvedValue(1);
  });

  it("persists Wednesday as the projected date for a Monday-Sunday NAM period", async () => {
    const result = await savePaycheckAction({ status: "idle", message: "" }, formData());

    expect(result).toMatchObject({ status: "saved", paycheckId: "paycheck-1" });
    expect(mocks.periodUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        expectedCheckDate: new Date("2026-09-23T00:00:00.000Z"),
        actualCheckDate: new Date("2026-09-23T00:00:00.000Z"),
      }),
    }));
    expect(mocks.paycheckCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ checkDate: new Date("2026-09-23T00:00:00.000Z") }),
    }));
  });

  it("uses the authoritative actual date as the schema fallback for an arbitrary Workday period", async () => {
    await savePaycheckAction(
      { status: "idle", message: "" },
      formData(payload({
        periodStart: "2026-09-16",
        periodEnd: "2026-09-22",
        checkDate: "2026-09-25",
      })),
    );

    expect(mocks.periodUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        expectedCheckDate: new Date("2026-09-25T00:00:00.000Z"),
        actualCheckDate: new Date("2026-09-25T00:00:00.000Z"),
      }),
    }));
    expect(mocks.paycheckCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ checkDate: new Date("2026-09-25T00:00:00.000Z") }),
    }));
  });

  it("links a newly imported Paycheck rate to its supporting Paycheck", async () => {
    await savePaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ baseRate: "33.15" })),
    );

    expect(mocks.rateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: "employee-1",
        hourlyRate: expect.objectContaining({}),
        sourcePaycheckId: "paycheck-1",
        verificationStatus: "VERIFIED",
        provenanceKind: "PAYCHECK",
      }),
    });
    expect(mocks.executeRaw).toHaveBeenCalledTimes(2);
  });

  it("reports a rate-slot uniqueness collision as rate evidence rather than a period conflict", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "6.16.3",
          meta: { target: "EmployeePayRate_verified_employee_effective_key" },
        },
      ),
    );

    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ baseRate: "33.15" })),
    );

    expect(result).toMatchObject({
      status: "error",
      code: "RATE_EVIDENCE_CONFLICT",
      message: expect.stringMatching(/Concurrent rate evidence/),
    });
  });

  it("preserves the existing expected date and import provenance during correction", async () => {
    mocks.paycheckFindFirst.mockResolvedValue({
      id: "paycheck-1",
      employeeId: "employee-1",
      payrollPeriodId: "period-1",
      sourceFingerprint: "a".repeat(64),
      parserVersion: "synthetic-v1",
      payrollPeriod: { expectedCheckDate: new Date("2026-09-23T00:00:00.000Z") },
    });

    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ checkDate: "2026-09-24" }), "paycheck-1"),
    );

    expect(result).toMatchObject({ status: "saved", paycheckId: "paycheck-1" });
    const periodData = mocks.periodUpdate.mock.calls[0][0].data;
    expect(periodData).toEqual({
      periodStart: new Date("2026-09-14T00:00:00.000Z"),
      periodEnd: new Date("2026-09-20T00:00:00.000Z"),
      actualCheckDate: new Date("2026-09-24T00:00:00.000Z"),
    });
    expect(periodData).not.toHaveProperty("expectedCheckDate");
    const paycheckData = mocks.paycheckUpdate.mock.calls[0][0].data;
    expect(paycheckData.checkDate).toEqual(new Date("2026-09-24T00:00:00.000Z"));
    expect(paycheckData).not.toHaveProperty("sourceFingerprint");
    expect(paycheckData).not.toHaveProperty("parserVersion");
  });

  it("updates only the linked paycheck-derived rate when rate and period change", async () => {
    mocks.paycheckFindFirst.mockResolvedValue({
      id: "paycheck-1",
      employeeId: "employee-1",
      payrollPeriodId: "period-1",
      payrollPeriod: {},
    });
    mocks.rateFindMany.mockResolvedValueOnce([{
      id: "rate-linked",
      employeeId: "employee-1",
      sourcePaycheckId: "paycheck-1",
      evidenceVersion: 1,
    }]);

    await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ periodStart: "2026-09-21", periodEnd: "2026-09-27", baseRate: "35.25" }), "paycheck-1"),
    );

    expect(mocks.rateUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["rate-linked"] } },
      data: { verificationStatus: "SUPERSEDED", evidenceVersion: { increment: 1 } },
    });
    expect(mocks.rateCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      effectiveFrom: new Date("2026-09-21T00:00:00.000Z"),
      sourcePaycheckId: "paycheck-1",
      verificationStatus: "VERIFIED",
      evidenceVersion: 2,
    }) });
  });

  it("removes a linked paycheck-derived rate when baseRate is cleared", async () => {
    mocks.paycheckFindFirst.mockResolvedValue({
      id: "paycheck-1",
      employeeId: "employee-1",
      payrollPeriodId: "period-1",
      payrollPeriod: {},
    });
    mocks.rateFindMany.mockResolvedValueOnce([{
      id: "rate-linked",
      employeeId: "employee-1",
      sourcePaycheckId: "paycheck-1",
      evidenceVersion: 1,
    }]);

    await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ baseRate: "" }), "paycheck-1"),
    );

    expect(mocks.rateUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["rate-linked"] } },
      data: { verificationStatus: "SUPERSEDED", evidenceVersion: { increment: 1 } },
    });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("preserves an unrelated destination rate instead of overwriting it", async () => {
    mocks.paycheckFindFirst.mockResolvedValue({
      id: "paycheck-1",
      employeeId: "employee-1",
      payrollPeriodId: "period-1",
      payrollPeriod: {},
    });
    mocks.rateFindMany.mockResolvedValueOnce([{
      id: "rate-linked",
      employeeId: "employee-1",
      sourcePaycheckId: "paycheck-1",
      evidenceVersion: 1,
    }]);
    mocks.rateFindFirst.mockResolvedValueOnce({ id: "rate-manual", sourcePaycheckId: null });

    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ periodStart: "2026-09-21", periodEnd: "2026-09-27", baseRate: "35.25" }), "paycheck-1"),
    );

    expect(mocks.rateUpdateMany).toHaveBeenCalled();
    expect(mocks.rateCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      verificationStatus: "CONFLICT",
      sourcePaycheckId: "paycheck-1",
    }) });
    expect(result).toMatchObject({
      status: "saved",
      code: "RATE_EVIDENCE_CONFLICT",
      rateEvidence: "CONFLICT",
    });
  });

  it("fails closed when stored rate provenance belongs to another employee", async () => {
    mocks.paycheckFindFirst.mockResolvedValue({
      id: "paycheck-1",
      employeeId: "employee-1",
      payrollPeriodId: "period-1",
      payrollPeriod: {},
    });
    mocks.rateFindMany.mockResolvedValueOnce([{
      id: "rate-corrupt",
      employeeId: "employee-2",
      sourcePaycheckId: "paycheck-1",
      evidenceVersion: 1,
    }]);

    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ baseRate: "35.25" }), "paycheck-1"),
    );

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.rateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("creates provenance for a corrected rate only when no unrelated rate occupies the date", async () => {
    mocks.paycheckFindFirst.mockResolvedValue({
      id: "paycheck-1",
      employeeId: "employee-1",
      payrollPeriodId: "period-1",
      payrollPeriod: {},
    });
    mocks.rateFindMany.mockResolvedValue([]);

    await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(payload({ baseRate: "34.50" }), "paycheck-1"),
    );

    expect(mocks.rateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: "employee-1",
        sourcePaycheckId: "paycheck-1",
        sourceNote: "Corrected Workday paycheck evidence",
        verificationStatus: "VERIFIED",
        provenanceKind: "PAYCHECK",
      }),
    });
  });
});
