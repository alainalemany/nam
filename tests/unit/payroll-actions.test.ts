import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  correctPaycheckAction,
  saveManualPaycheckAction,
  savePaycheckAction,
} from "@/features/payroll/actions";
import { PAYROLL_PARSER_VERSION } from "@/features/payroll/constants";
import {
  createCorrectionPreviewEnvelope,
  createPdfPreviewEnvelope,
} from "@/features/payroll/preview-evidence";
import type { RateExtractionResult } from "@/features/payroll/types";

const previewSecret = "signed-preview-test-secret".repeat(2);

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
  queryRaw: vi.fn(),
  employeeFindUnique: vi.fn(),
  rateEventCreate: vi.fn(),
  observationFindMany: vi.fn(),
  ingestObservations: vi.fn(),
  supersedeRates: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/payroll/auth", () => ({
  clearPayrollSession: vi.fn(),
  establishPayrollSession: vi.fn(),
  payrollPreviewSigningSecret: () => previewSecret,
  requirePayrollPrincipal: mocks.requirePrincipal,
}));
vi.mock("@/features/payroll/parser", () => ({ extractPaycheckPdf: vi.fn() }));
vi.mock("@/features/payroll/rate-observations", () => ({
  ingestPayRateObservations: mocks.ingestObservations,
  supersedePaycheckRateEvidenceForCorrection: mocks.supersedeRates,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

function tx() {
  return {
    $executeRaw: mocks.executeRaw,
    $queryRaw: mocks.queryRaw,
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
    employee: { findUnique: mocks.employeeFindUnique },
    payRateEvidenceReviewEvent: { create: mocks.rateEventCreate },
    payRateObservation: { findMany: mocks.observationFindMany },
  };
}

function extraction(): RateExtractionResult {
  return {
    disposition: "SUPPORTED",
    observations: [{
      sequence: 1,
      rowIndex: 4,
      hourlyRate: "33.15",
      regularHours: "40.00",
      regularMinutes: 2400,
      regularEarnings: "1326.00",
      payPeriodStart: "2026-09-14",
      payPeriodEnd: "2026-09-20",
      extractionBasis: "EXPLICIT_WORKDAY_REGULAR_ROW",
      dateConfidence: "PAY_PERIOD_ONLY",
      issues: [],
      eligibleForVerification: true,
    }],
    issues: [],
  };
}

function ambiguousExtraction(): RateExtractionResult {
  const issue = {
    code: "MULTIPLE_REGULAR_RATES_WITHOUT_EXPLICIT_DATES" as const,
    severity: "REVIEW_REQUIRED" as const,
    message: "Different regular rates have no reliable row dates.",
  };
  return {
    disposition: "REVIEW_REQUIRED",
    observations: [{
      ...extraction().observations[0],
      hourlyRate: "33.15",
      regularHours: "24.00",
      regularMinutes: 1440,
      regularEarnings: "795.60",
      issues: [issue],
      eligibleForVerification: false,
    }, {
      ...extraction().observations[0],
      sequence: 2,
      rowIndex: 5,
      hourlyRate: "35.25",
      regularHours: "16.00",
      regularMinutes: 960,
      regularEarnings: "564.00",
      issues: [issue],
      eligibleForVerification: false,
    }],
    issues: [issue],
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    importMode: "PDF_IMPORT",
    fingerprint: "a".repeat(64),
    parserVersion: PAYROLL_PARSER_VERSION,
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    checkDate: "2026-09-25",
    regularHours: "40",
    overtimeHours: "0",
    baseRate: "33.15",
    regularEarnings: "1326.00",
    overtimeBaseEarnings: "0",
    overtimePremiumEarnings: "0",
    otherCashEarnings: "0",
    grossCashPay: "1326.00",
    noncashImputedEarnings: "0",
    preTaxDeductions: "0",
    employeeTaxes: "326",
    postTaxDeductions: "0",
    adjustments: "0",
    netPay: "1000",
    notes: "Synthetic evidence",
    warnings: [],
    rateExtraction: extraction(),
    ...overrides,
  };
}

function signedPdfPayload(
  overrides: Record<string, unknown> = {},
  employeeId = "employee-1",
  now = Date.now(),
) {
  const values = basePayload(overrides);
  const evidenceEnvelope = createPdfPreviewEnvelope(employeeId, {
    fingerprint: String(values.fingerprint),
    parserVersion: String(values.parserVersion),
    periodStart: String(values.periodStart),
    periodEnd: String(values.periodEnd),
    checkDate: String(values.checkDate),
    regularHours: String(values.regularHours),
    baseRate: String(values.baseRate),
    regularEarnings: String(values.regularEarnings),
    rateExtraction: values.rateExtraction as RateExtractionResult,
  }, previewSecret, now);
  return { ...values, evidenceEnvelope };
}

function manualPayload(overrides: Record<string, unknown> = {}) {
  const { rateExtraction: _rateExtraction, ...values } = basePayload({
    importMode: "MANUAL_ENTRY",
    fingerprint: "",
    baseRate: "",
    ...overrides,
  });
  return values;
}

const currentUpdatedAt = new Date("2026-10-16T12:00:00.000Z");

function currentPaycheck(overrides: Record<string, unknown> = {}) {
  return {
    id: "paycheck-1",
    employeeId: "employee-1",
    payrollPeriodId: "period-1",
    sourceFingerprint: "a".repeat(64),
    parserVersion: PAYROLL_PARSER_VERSION,
    regularPaidMinutes: 2400,
    baseRate: new Prisma.Decimal("33.15"),
    regularEarnings: new Prisma.Decimal("1326.00"),
    updatedAt: currentUpdatedAt,
    payrollPeriod: {
      periodStart: new Date("2026-09-14T00:00:00.000Z"),
      periodEnd: new Date("2026-09-20T00:00:00.000Z"),
      expectedCheckDate: new Date("2026-09-23T00:00:00.000Z"),
    },
    ...overrides,
  };
}

function correctionPayload(
  overrides: Record<string, unknown> = {},
  snapshot = currentPaycheck(),
  tokenUpdatedAt = snapshot.updatedAt,
) {
  const { rateExtraction: _rateExtraction, ...values } = {
    ...basePayload({ importMode: "CORRECTION" }),
    ...overrides,
  };
  const evidenceEnvelope = createCorrectionPreviewEnvelope("employee-1", {
    paycheckId: snapshot.id,
    recordUpdatedAt: tokenUpdatedAt.toISOString(),
    fingerprint: snapshot.sourceFingerprint,
    parserVersion: snapshot.parserVersion,
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    regularHours: "40",
    baseRate: snapshot.baseRate?.toString() ?? "",
    regularEarnings: snapshot.regularEarnings.toString(),
  }, previewSecret);
  return { ...values, evidenceEnvelope };
}

function formData(values: Record<string, unknown>, paycheckId?: string) {
  const data = new FormData();
  data.set("payload", JSON.stringify(values));
  if (paycheckId) data.set("paycheckId", paycheckId);
  return data;
}

function linkedRate() {
  return {
    id: "rate-linked",
    employeeId: "employee-1",
    sourcePaycheckId: "paycheck-1",
    evidenceVersion: 1,
    effectiveFrom: new Date("2026-09-14T00:00:00.000Z"),
    hourlyRate: new Prisma.Decimal("33.15"),
    verificationStatus: "VERIFIED",
    provenanceKind: "PAYCHECK",
    reviewEvents: [],
  };
}

describe("Payroll paycheck persistence actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePrincipal.mockResolvedValue({ employeeId: "employee-1", expiresAt: 999_999 });
    mocks.transaction.mockImplementation((callback) => callback(tx()));
    mocks.paycheckFindUnique.mockResolvedValue(null);
    mocks.paycheckFindFirst.mockResolvedValue(currentPaycheck());
    mocks.periodUpsert.mockResolvedValue({ id: "period-1" });
    mocks.paycheckCreate.mockResolvedValue({ id: "paycheck-1", evidenceRevision: 1 });
    mocks.paycheckUpdate.mockResolvedValue({ id: "paycheck-1", evidenceRevision: 2 });
    mocks.periodUpdate.mockResolvedValue({ id: "period-1" });
    mocks.rateFindMany.mockResolvedValue([]);
    mocks.rateFindFirst.mockResolvedValue(null);
    mocks.rateCreate.mockImplementation(async ({ data }) => ({ id: "rate-1", ...data }));
    mocks.rateUpdateMany.mockResolvedValue({ count: 1 });
    mocks.executeRaw.mockResolvedValue(1);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.employeeFindUnique.mockResolvedValue({ id: "employee-1", displayName: "Owner", employeeCode: "E-1" });
    mocks.rateEventCreate.mockResolvedValue({ id: "event-1" });
    mocks.observationFindMany.mockResolvedValue([]);
    mocks.ingestObservations.mockResolvedValue([{
      classifications: [{ kind: "FIRST_RATE_CANDIDATE" }],
      rateSupports: [],
      boundaryCandidates: [{ candidateId: "candidate-1" }],
    }]);
    mocks.supersedeRates.mockResolvedValue(1);
  });

  it("creates authenticated observations without inventing an exact effective-date boundary", async () => {
    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(signedPdfPayload()),
    );

    expect(result).toMatchObject({ status: "saved", rateEvidence: "NEEDS_REVIEW" });
    expect(mocks.paycheckCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceFingerprint: "a".repeat(64),
        parserVersion: PAYROLL_PARSER_VERSION,
        baseRate: expect.objectContaining({}),
      }),
    });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
    expect(mocks.ingestObservations).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      paycheckId: "paycheck-1",
      evidenceRevision: 1,
      supersedePriorRevision: false,
    }));
  });

  it("rejects missing envelopes and removed extraction metadata", async () => {
    const missingEnvelope = signedPdfPayload();
    delete (missingEnvelope as { evidenceEnvelope?: string }).evidenceEnvelope;
    await expect(savePaycheckAction(
      { status: "idle", message: "" },
      formData(missingEnvelope),
    )).resolves.toMatchObject({ status: "error", code: "PREVIEW_INVALID" });

    const missingExtraction = signedPdfPayload();
    delete (missingExtraction as { rateExtraction?: RateExtractionResult }).rateExtraction;
    await expect(savePaycheckAction(
      { status: "idle", message: "" },
      formData(missingExtraction),
    )).resolves.toMatchObject({ status: "error", code: "PREVIEW_INVALID" });
    expect(mocks.paycheckCreate).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("rejects fabricated extraction metadata", async () => {
    const values = signedPdfPayload();
    values.rateExtraction = extraction();
    values.rateExtraction.observations[0].hourlyRate = "99.99";
    const result = await savePaycheckAction({ status: "idle", message: "" }, formData(values));
    expect(result).toMatchObject({ status: "error", code: "PREVIEW_STALE" });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["period start", { periodStart: "2026-09-15", periodEnd: "2026-09-21" }],
    ["period end", { periodEnd: "2026-09-21" }],
    ["rate", { baseRate: "34.00" }],
    ["hours", { regularHours: "39" }],
    ["earnings", { regularEarnings: "1300.00", grossCashPay: "1300.00" }],
  ])("withholds rate evidence after an authenticated preview changes %s", async (_label, change) => {
    const values = signedPdfPayload();
    Object.assign(values, change);
    const result = await savePaycheckAction({ status: "idle", message: "" }, formData(values));
    expect(result).toMatchObject({
      status: "saved",
      rateEvidence: "NEEDS_REVIEW",
      message: expect.stringMatching(/no exact effective-date boundary.*owner review/u),
    });
    expect(mocks.paycheckCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ baseRate: expect.objectContaining({}) }) });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("allows an ambiguous PDF rate to remain blank without creating evidence", async () => {
    mocks.ingestObservations.mockResolvedValueOnce([{
      classifications: [{ kind: "UNSUPPORTED_OBSERVATION" }],
      rateSupports: [],
      boundaryCandidates: [],
    }]);
    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(signedPdfPayload({
        baseRate: "",
        rateExtraction: ambiguousExtraction(),
        regularEarnings: "1359.60",
        grossCashPay: "1359.60",
      })),
    );

    expect(result).toMatchObject({ status: "saved", rateEvidence: "NOT_ESTABLISHED" });
    expect(mocks.paycheckCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      baseRate: null,
    }) });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("retains an owner-entered ambiguous PDF rate only as review evidence", async () => {
    const values = signedPdfPayload({
      baseRate: "",
      rateExtraction: ambiguousExtraction(),
      regularEarnings: "1359.60",
      grossCashPay: "1359.60",
    });
    values.baseRate = "34.00";

    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(values),
    );

    expect(result).toMatchObject({
      status: "saved",
      rateEvidence: "NEEDS_REVIEW",
      message: expect.stringMatching(/no exact effective-date boundary.*owner review/u),
    });
    expect(mocks.paycheckCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      baseRate: expect.objectContaining({}),
    }) });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["fingerprint", { fingerprint: "b".repeat(64) }],
    ["parser version", { parserVersion: "workday-stale" }],
  ])("rejects a changed %s", async (_label, change) => {
    const values = signedPdfPayload();
    Object.assign(values, change);
    await expect(savePaycheckAction(
      { status: "idle", message: "" },
      formData(values),
    )).resolves.toMatchObject({ status: "error", code: "PREVIEW_STALE" });
    expect(mocks.paycheckCreate).not.toHaveBeenCalled();
  });

  it("rejects preview evidence issued for another principal", async () => {
    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(signedPdfPayload({}, "employee-2")),
    );
    expect(result).toMatchObject({ status: "error", code: "PREVIEW_INVALID" });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("reuses an exact authenticated duplicate without creating a second rate", async () => {
    mocks.paycheckFindUnique.mockResolvedValueOnce({ id: "paycheck-existing" });
    mocks.observationFindMany.mockResolvedValueOnce([{
      rateSupports: [{ employeePayRateId: "rate-1" }],
      boundaryCandidates: [],
    }]);
    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(signedPdfPayload()),
    );
    expect(result).toMatchObject({ status: "saved", paycheckId: "paycheck-existing", rateEvidence: "VERIFIED" });
    expect(mocks.paycheckCreate).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("keeps an exact duplicate of a review candidate non-authoritative", async () => {
    mocks.paycheckFindUnique.mockResolvedValueOnce({ id: "paycheck-existing" });
    mocks.observationFindMany.mockResolvedValueOnce([{
      rateSupports: [],
      boundaryCandidates: [{ candidate: { status: "OPEN" } }],
    }]);
    const result = await savePaycheckAction(
      { status: "idle", message: "" },
      formData(signedPdfPayload({ baseRate: "34.00" })),
    );
    expect(result).toMatchObject({
      status: "saved",
      paycheckId: "paycheck-existing",
      rateEvidence: "NEEDS_REVIEW",
    });
    expect(mocks.paycheckCreate).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("persists manual entry without creating verified rate evidence", async () => {
    const result = await saveManualPaycheckAction(
      { status: "idle", message: "" },
      formData(manualPayload({ baseRate: "55.00" })),
    );
    expect(result).toMatchObject({ status: "saved", rateEvidence: "NEEDS_REVIEW" });
    expect(mocks.paycheckCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      baseRate: expect.objectContaining({}),
      sourceFingerprint: expect.stringMatching(/^[a-f\d]{64}$/),
    }) });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("does not let a client switch a PDF payload into a trusted manual mode", async () => {
    const forged = signedPdfPayload({ importMode: "MANUAL_ENTRY" });
    const result = await saveManualPaycheckAction(
      { status: "idle", message: "" },
      formData(forged),
    );
    expect(result).toMatchObject({ status: "error", code: "PREVIEW_INVALID" });
    expect(mocks.paycheckCreate).not.toHaveBeenCalled();
  });

  it("preserves an unchanged verified boundary while appending correction observations", async () => {
    mocks.rateFindFirst.mockResolvedValueOnce(linkedRate());
    mocks.ingestObservations.mockResolvedValueOnce([{
      classifications: [{ kind: "REPEATED_SUPPORTING_OBSERVATION" }],
      rateSupports: [],
      boundaryCandidates: [],
    }]);
    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload(), "paycheck-1"),
    );
    expect(result).toMatchObject({ status: "saved", rateEvidence: "VERIFIED" });
    expect(mocks.rateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
    expect(mocks.rateEventCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["verified rate", { baseRate: "35.00" }],
    ["period boundary", { periodStart: "2026-09-15", periodEnd: "2026-09-21" }],
  ])("withholds replacement evidence when correction changes %s", async (_label, change) => {
    mocks.rateFindMany.mockResolvedValueOnce([linkedRate()]);
    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload(change), "paycheck-1"),
    );
    expect(result).toMatchObject({ status: "saved", rateEvidence: "NEEDS_REVIEW" });
    expect(mocks.supersedeRates).toHaveBeenCalledOnce();
    expect(mocks.rateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
    expect(mocks.rateEventCreate).not.toHaveBeenCalled();
    expect(mocks.paycheckUpdate).toHaveBeenCalledWith({ data: expect.objectContaining({ baseRate: expect.objectContaining({}) }), where: { id: "paycheck-1" } });
  });

  it("does not promote an ambiguous imported Paycheck during correction", async () => {
    const snapshot = currentPaycheck({ baseRate: null });
    mocks.paycheckFindFirst.mockResolvedValueOnce(snapshot);
    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload({ baseRate: "33.15" }, snapshot), "paycheck-1"),
    );
    expect(result).toMatchObject({ status: "saved", rateEvidence: "NEEDS_REVIEW" });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("does not promote an unchanged correction candidate that was never verified", async () => {
    mocks.rateFindMany.mockResolvedValueOnce([{
      ...linkedRate(),
      verificationStatus: "CONFLICT",
      provenanceCandidatePaycheckId: "paycheck-1",
    }]);
    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload(), "paycheck-1"),
    );
    expect(result).toMatchObject({ status: "saved", rateEvidence: "NEEDS_REVIEW" });
    expect(mocks.rateCreate).not.toHaveBeenCalled();
  });

  it("preserves a quarantined historical candidate during correction", async () => {
    mocks.rateFindMany.mockResolvedValueOnce([{
      ...linkedRate(),
      sourcePaycheckId: null,
      verificationStatus: "NEEDS_REVIEW",
      provenanceKind: "UNKNOWN",
      provenanceCandidatePaycheckId: "paycheck-1",
    }]);

    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload(), "paycheck-1"),
    );

    expect(result).toMatchObject({ status: "saved", rateEvidence: "NEEDS_REVIEW" });
    expect(mocks.rateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.rateCreate).not.toHaveBeenCalled();
    expect(mocks.rateEventCreate).not.toHaveBeenCalled();
  });

  it("rejects stale correction evidence before mutation", async () => {
    const staleSnapshot = currentPaycheck();
    const current = currentPaycheck({ updatedAt: new Date("2026-10-16T12:01:00.000Z") });
    mocks.paycheckFindFirst.mockResolvedValueOnce(current);
    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload({}, staleSnapshot, staleSnapshot.updatedAt), "paycheck-1"),
    );
    expect(result).toMatchObject({ status: "error", code: "PREVIEW_STALE" });
    expect(mocks.paycheckUpdate).not.toHaveBeenCalled();
    expect(mocks.rateUpdateMany).not.toHaveBeenCalled();
  });

  it("reports a failed correction audit insertion as an atomic action failure", async () => {
    mocks.supersedeRates.mockRejectedValueOnce(new Error("audit insert rejected"));
    const result = await correctPaycheckAction(
      { status: "idle", message: "" },
      formData(correctionPayload({ baseRate: "35.00" }), "paycheck-1"),
    );
    expect(result).toMatchObject({ status: "error" });
  });
});
