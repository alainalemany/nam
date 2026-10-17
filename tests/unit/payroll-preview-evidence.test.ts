import { describe, expect, it } from "vitest";

import { PAYROLL_PARSER_VERSION } from "@/features/payroll/constants";
import {
  createCorrectionPreviewEnvelope,
  createPdfPreviewEnvelope,
  payrollEvidencePurposes,
  payrollPreviewTtlSeconds,
  verifyCorrectionPreviewEnvelope,
  verifyPdfPreviewEnvelope,
} from "@/features/payroll/preview-evidence";
import type { RateExtractionResult } from "@/features/payroll/types";

const secret = "preview-test-secret".repeat(3);
const now = 1_800_000_000_000;

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

function pdfEvidence() {
  return {
    fingerprint: "a".repeat(64),
    parserVersion: PAYROLL_PARSER_VERSION,
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    checkDate: "2026-09-25",
    regularHours: "40.00",
    baseRate: "33.15",
    regularEarnings: "1326.00",
    rateExtraction: extraction(),
  };
}

function correctionEvidence() {
  return {
    paycheckId: "paycheck-1",
    recordUpdatedAt: "2026-10-16T12:00:00.000Z",
    fingerprint: "a".repeat(64),
    parserVersion: PAYROLL_PARSER_VERSION,
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    regularHours: "40",
    baseRate: "33.15",
    regularEarnings: "1326.00",
  };
}

describe("Payroll preview evidence envelopes", () => {
  it("accepts only unchanged PDF evidence for the same principal", () => {
    const evidence = pdfEvidence();
    const token = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    expect(verifyPdfPreviewEnvelope(token, "employee-1", evidence, secret, now + 1_000))
      .toMatchObject({
        ok: true,
        rateContextMatches: true,
        claims: {
          sourcePeriodStart: "2026-09-14",
          sourcePeriodEnd: "2026-09-20",
        },
      });
  });

  it.each([
    ["missing token", undefined, "MISSING"],
    ["tampered signature", "TOKEN", "INVALID"],
  ])("rejects %s", (_label, replacement, reason) => {
    const evidence = pdfEvidence();
    const token = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    const candidate = replacement === "TOKEN" ? `${token.slice(0, -1)}x` : replacement;
    expect(verifyPdfPreviewEnvelope(candidate, "employee-1", evidence, secret, now + 1_000))
      .toEqual({ ok: false, reason });
  });

  it("rejects expired evidence", () => {
    const evidence = pdfEvidence();
    const token = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    expect(verifyPdfPreviewEnvelope(
      token,
      "employee-1",
      evidence,
      secret,
      now + payrollPreviewTtlSeconds * 1_000,
    )).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects the wrong principal and purpose", () => {
    const evidence = pdfEvidence();
    const pdfToken = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    expect(verifyPdfPreviewEnvelope(pdfToken, "employee-2", evidence, secret, now + 1_000))
      .toEqual({ ok: false, reason: "WRONG_PRINCIPAL" });

    const correction = correctionEvidence();
    const correctionToken = createCorrectionPreviewEnvelope("employee-1", correction, secret, now);
    expect(verifyPdfPreviewEnvelope(correctionToken, "employee-1", evidence, secret, now + 1_000))
      .toEqual({ ok: false, reason: "INVALID" });
    expect(payrollEvidencePurposes.pdfImport).not.toBe(payrollEvidencePurposes.correction);
  });

  it("rejects fabricated observations and removed extraction metadata", () => {
    const evidence = pdfEvidence();
    const token = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    const fabricated = pdfEvidence();
    fabricated.rateExtraction.observations[0].hourlyRate = "99.99";
    expect(verifyPdfPreviewEnvelope(token, "employee-1", fabricated, secret, now + 1_000))
      .toEqual({ ok: false, reason: "STALE" });
  });

  it.each([
    ["fingerprint", { fingerprint: "b".repeat(64) }],
    ["parser version", { parserVersion: "workday-stale" }],
  ])("rejects changed %s", (_label, change) => {
    const evidence = pdfEvidence();
    const token = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    expect(verifyPdfPreviewEnvelope(token, "employee-1", { ...evidence, ...change }, secret, now + 1_000))
      .toEqual({ ok: false, reason: "STALE" });
  });

  it.each([
    ["period start", { periodStart: "2026-09-15" }],
    ["period end", { periodEnd: "2026-09-21" }],
    ["rate", { baseRate: "34.00" }],
    ["hours", { regularHours: "39.00" }],
    ["earnings", { regularEarnings: "1300.00" }],
  ])("authenticates the source but withholds rate eligibility after changed %s", (_label, change) => {
    const evidence = pdfEvidence();
    const token = createPdfPreviewEnvelope("employee-1", evidence, secret, now);
    expect(verifyPdfPreviewEnvelope(token, "employee-1", { ...evidence, ...change }, secret, now + 1_000))
      .toMatchObject({ ok: true, rateContextMatches: false });
  });

  it("rejects stale correction evidence and withholds a changed correction rate", () => {
    const evidence = correctionEvidence();
    const token = createCorrectionPreviewEnvelope("employee-1", evidence, secret, now);
    expect(verifyCorrectionPreviewEnvelope(token, "employee-1", evidence, secret, now + 1_000))
      .toMatchObject({ ok: true, rateContextMatches: true });
    expect(verifyCorrectionPreviewEnvelope(
      token,
      "employee-1",
      { ...evidence, baseRate: "35.00" },
      secret,
      now + 1_000,
    )).toMatchObject({ ok: true, rateContextMatches: false });
    expect(verifyCorrectionPreviewEnvelope(
      token,
      "employee-1",
      { ...evidence, recordUpdatedAt: "2026-10-16T12:01:00.000Z" },
      secret,
      now + 1_000,
    )).toEqual({ ok: false, reason: "STALE" });
  });
});
