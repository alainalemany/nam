import "server-only";

import { createHash, createHmac } from "node:crypto";

import { z } from "zod";

import { PAYROLL_PARSER_VERSION } from "./constants";
import { normalizedDecimalKey } from "./rate-extraction";
import type { RateExtractionResult } from "./types";
import { safePayrollEqual } from "./security";

const ENVELOPE_VERSION = 1;
const PREVIEW_TTL_SECONDS = 15 * 60;
const MAX_CLOCK_SKEW_SECONDS = 30;

export const payrollEvidencePurposes = {
  pdfImport: "PAYROLL_PDF_RATE_PREVIEW",
  correction: "PAYROLL_PAYCHECK_CORRECTION",
} as const;

type PayrollEvidencePurpose = typeof payrollEvidencePurposes[keyof typeof payrollEvidencePurposes];

const commonClaimsSchema = z.object({
  version: z.literal(ENVELOPE_VERSION),
  purpose: z.enum([payrollEvidencePurposes.pdfImport, payrollEvidencePurposes.correction]),
  employeeId: z.string().min(1).max(191),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  fingerprint: z.string().regex(/^[a-f\d]{64}$/u),
  parserVersion: z.string().min(1).max(80),
  evidenceDigest: z.string().regex(/^[a-f\d]{64}$/u),
});

const pdfClaimsSchema = commonClaimsSchema.extend({
  purpose: z.literal(payrollEvidencePurposes.pdfImport),
  importMode: z.literal("PDF_IMPORT"),
  disposition: z.enum(["SUPPORTED", "REVIEW_REQUIRED", "UNSUPPORTED"]),
  issueCodes: z.array(z.string().min(1).max(80)).max(100),
  observationCount: z.number().int().nonnegative().max(50),
  rateContextDigest: z.string().regex(/^[a-f\d]{64}$/u),
});

const correctionClaimsSchema = commonClaimsSchema.extend({
  purpose: z.literal(payrollEvidencePurposes.correction),
  importMode: z.literal("CORRECTION"),
  paycheckId: z.string().min(1).max(191),
  recordUpdatedAt: z.string().datetime(),
  rateContextDigest: z.string().regex(/^[a-f\d]{64}$/u),
});

type PdfClaims = z.infer<typeof pdfClaimsSchema>;
type CorrectionClaims = z.infer<typeof correctionClaimsSchema>;

export type PdfPreviewEvidence = {
  fingerprint: string;
  parserVersion: string;
  periodStart: string;
  periodEnd: string;
  checkDate: string;
  regularHours: string;
  baseRate: string;
  regularEarnings: string;
  rateExtraction: RateExtractionResult;
};

export type CorrectionPreviewEvidence = {
  paycheckId: string;
  recordUpdatedAt: string;
  fingerprint: string;
  parserVersion: string;
  periodStart: string;
  periodEnd: string;
  regularHours: string;
  baseRate: string;
  regularEarnings: string;
};

export type EvidenceEnvelopeFailure =
  | "MISSING"
  | "INVALID"
  | "EXPIRED"
  | "WRONG_PRINCIPAL"
  | "STALE";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function purposeKey(sessionSecret: string, purpose: PayrollEvidencePurpose) {
  return createHmac("sha256", sessionSecret)
    .update(`nam/payroll/evidence-envelope/v1/${purpose}`)
    .digest();
}

function signature(payload: string, sessionSecret: string, purpose: PayrollEvidencePurpose) {
  return createHmac("sha256", purposeKey(sessionSecret, purpose))
    .update(payload)
    .digest("base64url");
}

function createEnvelope(
  claims: PdfClaims | CorrectionClaims,
  sessionSecret: string,
) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, sessionSecret, claims.purpose)}`;
}

function verifyEnvelope(
  token: string | undefined,
  purpose: PayrollEvidencePurpose,
  employeeId: string,
  sessionSecret: string,
  now: number,
) {
  if (!token) return { ok: false as const, reason: "MISSING" as const };
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) {
    return { ok: false as const, reason: "INVALID" as const };
  }
  if (!safePayrollEqual(suppliedSignature, signature(payload, sessionSecret, purpose))) {
    return { ok: false as const, reason: "INVALID" as const };
  }
  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const parsed = purpose === payrollEvidencePurposes.pdfImport
      ? pdfClaimsSchema.safeParse(raw)
      : correctionClaimsSchema.safeParse(raw);
    if (!parsed.success || parsed.data.purpose !== purpose) {
      return { ok: false as const, reason: "INVALID" as const };
    }
    const nowSeconds = Math.floor(now / 1000);
    if (parsed.data.issuedAt > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
      return { ok: false as const, reason: "INVALID" as const };
    }
    if (parsed.data.expiresAt <= nowSeconds) {
      return { ok: false as const, reason: "EXPIRED" as const };
    }
    if (parsed.data.employeeId !== employeeId) {
      return { ok: false as const, reason: "WRONG_PRINCIPAL" as const };
    }
    return { ok: true as const, claims: parsed.data };
  } catch {
    return { ok: false as const, reason: "INVALID" as const };
  }
}

function pdfEvidenceDigest(input: PdfPreviewEvidence) {
  return digest({
    fingerprint: input.fingerprint,
    parserVersion: input.parserVersion,
    rateExtraction: input.rateExtraction,
  });
}

function pdfRateContextDigest(input: PdfPreviewEvidence) {
  return digest({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    checkDate: input.checkDate,
    regularHours: normalizedDecimalKey(input.regularHours) ?? input.regularHours,
    baseRate: normalizedDecimalKey(input.baseRate) ?? input.baseRate,
    regularEarnings: normalizedDecimalKey(input.regularEarnings) ?? input.regularEarnings,
  });
}

function correctionRateContextDigest(input: CorrectionPreviewEvidence) {
  return digest({
    fingerprint: input.fingerprint,
    parserVersion: input.parserVersion,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    regularHours: normalizedDecimalKey(input.regularHours) ?? input.regularHours,
    baseRate: normalizedDecimalKey(input.baseRate) ?? input.baseRate,
    regularEarnings: normalizedDecimalKey(input.regularEarnings) ?? input.regularEarnings,
  });
}

export function createPdfPreviewEnvelope(
  employeeId: string,
  input: PdfPreviewEvidence,
  sessionSecret: string,
  now = Date.now(),
) {
  const issuedAt = Math.floor(now / 1000);
  return createEnvelope({
    version: ENVELOPE_VERSION,
    purpose: payrollEvidencePurposes.pdfImport,
    importMode: "PDF_IMPORT",
    employeeId,
    issuedAt,
    expiresAt: issuedAt + PREVIEW_TTL_SECONDS,
    fingerprint: input.fingerprint,
    parserVersion: input.parserVersion,
    evidenceDigest: pdfEvidenceDigest(input),
    rateContextDigest: pdfRateContextDigest(input),
    disposition: input.rateExtraction.disposition,
    issueCodes: input.rateExtraction.issues.map((issue) => issue.code),
    observationCount: input.rateExtraction.observations.length,
  }, sessionSecret);
}

export function verifyPdfPreviewEnvelope(
  token: string | undefined,
  employeeId: string,
  input: PdfPreviewEvidence,
  sessionSecret: string,
  now = Date.now(),
) {
  const verified = verifyEnvelope(
    token,
    payrollEvidencePurposes.pdfImport,
    employeeId,
    sessionSecret,
    now,
  );
  if (!verified.ok) return verified;
  const claims = verified.claims as PdfClaims;
  if (
    claims.parserVersion !== PAYROLL_PARSER_VERSION ||
    input.parserVersion !== claims.parserVersion ||
    input.fingerprint !== claims.fingerprint ||
    claims.evidenceDigest !== pdfEvidenceDigest(input) ||
    claims.disposition !== input.rateExtraction.disposition ||
    claims.observationCount !== input.rateExtraction.observations.length ||
    digest(claims.issueCodes) !== digest(input.rateExtraction.issues.map((issue) => issue.code))
  ) {
    return { ok: false as const, reason: "STALE" as const };
  }
  return {
    ok: true as const,
    claims,
    rateContextMatches: claims.rateContextDigest === pdfRateContextDigest(input),
  };
}

export function createCorrectionPreviewEnvelope(
  employeeId: string,
  input: CorrectionPreviewEvidence,
  sessionSecret: string,
  now = Date.now(),
) {
  const issuedAt = Math.floor(now / 1000);
  return createEnvelope({
    version: ENVELOPE_VERSION,
    purpose: payrollEvidencePurposes.correction,
    importMode: "CORRECTION",
    employeeId,
    issuedAt,
    expiresAt: issuedAt + PREVIEW_TTL_SECONDS,
    fingerprint: input.fingerprint,
    parserVersion: input.parserVersion,
    paycheckId: input.paycheckId,
    recordUpdatedAt: input.recordUpdatedAt,
    evidenceDigest: digest({ paycheckId: input.paycheckId, recordUpdatedAt: input.recordUpdatedAt }),
    rateContextDigest: correctionRateContextDigest(input),
  }, sessionSecret);
}

export function verifyCorrectionPreviewEnvelope(
  token: string | undefined,
  employeeId: string,
  input: CorrectionPreviewEvidence,
  sessionSecret: string,
  now = Date.now(),
) {
  const verified = verifyEnvelope(
    token,
    payrollEvidencePurposes.correction,
    employeeId,
    sessionSecret,
    now,
  );
  if (!verified.ok) return verified;
  const claims = verified.claims as CorrectionClaims;
  if (
    claims.paycheckId !== input.paycheckId ||
    claims.fingerprint !== input.fingerprint ||
    claims.parserVersion !== input.parserVersion ||
    claims.recordUpdatedAt !== input.recordUpdatedAt ||
    claims.evidenceDigest !== digest({ paycheckId: input.paycheckId, recordUpdatedAt: input.recordUpdatedAt })
  ) {
    return { ok: false as const, reason: "STALE" as const };
  }
  return {
    ok: true as const,
    claims,
    rateContextMatches: claims.rateContextDigest === correctionRateContextDigest(input),
  };
}

export const payrollPreviewTtlSeconds = PREVIEW_TTL_SECONDS;
