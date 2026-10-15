import { beforeEach, describe, expect, it, vi } from "vitest";

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
  rateUpsert: vi.fn(),
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
    paycheck: {
      findUnique: mocks.paycheckFindUnique,
      findFirst: mocks.paycheckFindFirst,
      create: mocks.paycheckCreate,
      update: mocks.paycheckUpdate,
    },
    payrollPeriod: { upsert: mocks.periodUpsert, update: mocks.periodUpdate },
    employeePayRate: { upsert: mocks.rateUpsert },
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
});
