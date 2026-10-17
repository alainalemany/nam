"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { parseDateOnly } from "@/features/timesheets/calculations";
import { prisma } from "@/lib/prisma";

import {
  clearPayrollSession,
  establishPayrollSession,
  payrollPreviewSigningSecret,
  requirePayrollPrincipal,
} from "./auth";
import type { PayrollPrincipal } from "./auth";
import { projectedCheckDateForNamPeriod } from "./calculations";
import { acquirePayrollEvidenceLock } from "./evidence-review-locks";
import { extractPaycheckPdf } from "./parser";
import { manualPaycheckFingerprint } from "./fingerprint";
import {
  type EvidenceEnvelopeFailure,
  verifyCorrectionPreviewEnvelope,
  verifyPdfPreviewEnvelope,
  createPdfPreviewEnvelope,
} from "./preview-evidence";
import {
  decimalHoursToMinutes,
  rateSubmissionMatchesExtraction,
} from "./rate-extraction";
import {
  ingestPayRateObservations,
  supersedePaycheckRateEvidenceForCorrection,
  type RateObservationDraft,
} from "./rate-observations";
import type { PayrollImportState } from "./types";
import { payrollUnlockClientKey, payrollUnlockRateLimiter } from "./unlock-rate-limit";
import { paycheckInputSchema, type PaycheckInput } from "./validation";

export async function unlockPayrollAction(
  _state: { ok: boolean; message: string },
  formData: FormData,
) {
  const clientKey = payrollUnlockClientKey(await headers());
  const currentLimit = payrollUnlockRateLimiter.check(clientKey);
  if (!currentLimit.allowed) {
    return {
      ok: false,
      message: `Too many invalid attempts. Try again in ${Math.ceil(currentLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }
  const candidate = formData.get("accessKey");
  if (typeof candidate !== "string" || !(await establishPayrollSession(candidate))) {
    const nextLimit = payrollUnlockRateLimiter.recordFailure(clientKey);
    return {
      ok: false,
      message: nextLimit.allowed
        ? "Payroll access key was not accepted."
        : `Too many invalid attempts. Try again in ${Math.ceil(nextLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }
  payrollUnlockRateLimiter.reset(clientKey);
  redirect("/payroll");
}

export async function lockPayrollAction() {
  await clearPayrollSession();
  redirect("/payroll/access");
}

export async function parsePaycheckAction(
  _state: PayrollImportState,
  formData: FormData,
): Promise<PayrollImportState> {
  const principal = await requirePayrollPrincipal();
  const file = formData.get("payslip");
  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a Workday PDF to continue." };
  }
  try {
    const values = await extractPaycheckPdf(file);
    if (!values.rateExtraction) throw new Error("Rate extraction metadata is unavailable. Use manual entry instead.");
    values.evidenceEnvelope = createPdfPreviewEnvelope(
      principal.employeeId,
      { ...values, rateExtraction: values.rateExtraction },
      payrollPreviewSigningSecret(),
    );
    return {
      status: "review",
      message: "Review every extracted value before saving. The PDF has been discarded from memory.",
      values,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "The PDF could not be read. Use manual entry instead.",
    };
  }
}

function parseReviewPayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 25_000) return undefined;
  try {
    return paycheckInputSchema.safeParse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function uniqueConflictKind(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return undefined;
  }
  const target = error.meta?.target;
  const description = Array.isArray(target)
    ? target.map(String).join(" ")
    : String(target ?? error.message);
  if (
    description.includes("EmployeePayRate_verified_employee_effective_key") ||
    (description.includes("employeeId") && description.includes("effectiveFrom"))
  ) return "RATE_SLOT" as const;
  if (
    description.includes("PayrollPeriod_employee_period_key") ||
    (description.includes("employeeId") &&
      description.includes("periodStart") &&
      description.includes("periodEnd"))
  ) return "PAYROLL_PERIOD" as const;
  if (
    description.includes("Paycheck_employee_fingerprint_key") ||
    description.includes("sourceFingerprint")
  ) return "PAYCHECK_FINGERPRINT" as const;
  return "OTHER" as const;
}

function evidenceEnvelopeError(reason: EvidenceEnvelopeFailure, correction = false): PayrollImportState {
  if (reason === "EXPIRED") {
    return {
      status: "error",
      code: "PREVIEW_EXPIRED",
      message: correction
        ? "This correction review expired. Reload the Paycheck before trying again. No values were changed."
        : "This payslip preview expired. Re-upload the PDF and review the new extraction before saving.",
    };
  }
  if (reason === "STALE") {
    return {
      status: "error",
      code: "PREVIEW_STALE",
      message: correction
        ? "This correction is stale. Reload the Paycheck before trying again. No values were changed."
        : "This payslip preview no longer matches its authenticated extraction. Re-upload the PDF before saving.",
    };
  }
  return {
    status: "error",
    code: "PREVIEW_INVALID",
    message: correction
      ? "Correction evidence could not be authenticated. Reload the Paycheck before trying again. No values were changed."
      : "Payslip preview evidence could not be authenticated. Re-upload the PDF before saving.",
  };
}

const observationDecimal = /^\d+(?:\.\d{1,4})?$/u;

function decimalObservationValue(value: string) {
  return observationDecimal.test(value) ? value : null;
}

function pdfObservationDrafts(value: PaycheckInput): RateObservationDraft[] {
  const periodStart = parseDateOnly(value.periodStart);
  const periodEnd = parseDateOnly(value.periodEnd);
  const observations = value.rateExtraction?.observations ?? [];
  if (observations.length === 0) {
    return [{
      sourceRowSequence: 1,
      observedHourlyRate: null,
      regularMinutes: null,
      regularEarnings: null,
      observedDateStart: null,
      observedDateEnd: null,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      extractionBasis: "WORKDAY_REGULAR_ROW",
      dateConfidence: "PAY_PERIOD_ONLY",
      observationState: "UNSUPPORTED",
      parserVersion: value.parserVersion,
    }];
  }
  return observations.map((observation) => {
    const rate = decimalObservationValue(observation.hourlyRate);
    const earnings = decimalObservationValue(observation.regularEarnings);
    const minutes = observation.regularMinutes ?? decimalHoursToMinutes(observation.regularHours) ?? null;
    const severities = [
      ...observation.issues.map((issue) => issue.severity),
      ...(value.rateExtraction?.issues.map((issue) => issue.severity) ?? []),
    ];
    const structurallySupported = observation.eligibleForVerification &&
      rate !== null && new Prisma.Decimal(rate).greaterThan(0) &&
      earnings !== null && minutes !== null && minutes > 0;
    const observationState = severities.includes("UNSUPPORTED")
      ? "UNSUPPORTED" as const
      : structurallySupported && severities.every((severity) => severity === "INFO")
        ? "SUPPORTED" as const
        : "REVIEW_REQUIRED" as const;
    return {
      sourceRowSequence: observation.sequence,
      observedHourlyRate: rate,
      regularMinutes: minutes,
      regularEarnings: earnings,
      observedDateStart: observation.rowDateStart ? parseDateOnly(observation.rowDateStart) : null,
      observedDateEnd: observation.rowDateEnd ? parseDateOnly(observation.rowDateEnd) : null,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      extractionBasis: "WORKDAY_REGULAR_ROW" as const,
      dateConfidence: observation.dateConfidence,
      observationState,
      parserVersion: value.parserVersion,
    };
  });
}

function enteredObservationDraft(
  value: PaycheckInput,
  extractionBasis: "MANUAL_ENTRY" | "PAYCHECK_CORRECTION",
): RateObservationDraft {
  const observedHourlyRate = value.baseRate == null ? null : String(value.baseRate);
  const regularMinutes = Math.round(value.regularHours * 60);
  return {
    sourceRowSequence: 1,
    observedHourlyRate,
    regularMinutes,
    regularEarnings: String(value.regularEarnings),
    observedDateStart: null,
    observedDateEnd: null,
    payPeriodStart: parseDateOnly(value.periodStart),
    payPeriodEnd: parseDateOnly(value.periodEnd),
    extractionBasis,
    dateConfidence: "PAY_PERIOD_ONLY",
    observationState: observedHourlyRate !== null && regularMinutes > 0
      ? "REVIEW_REQUIRED"
      : "UNSUPPORTED",
    parserVersion: value.parserVersion,
  };
}

async function correctionObservationDrafts(
  tx: Prisma.TransactionClient,
  paycheckId: string,
  evidenceRevision: number,
  value: PaycheckInput,
  rateContextMatches: boolean,
): Promise<RateObservationDraft[]> {
  if (rateContextMatches) {
    const activeParserObservations = await tx.payRateObservation.findMany({
      where: {
        sourcePaycheckId: paycheckId,
        sourcePaycheckEvidenceRevision: evidenceRevision,
        supersession: null,
        extractionBasis: "WORKDAY_REGULAR_ROW",
        observationState: "SUPPORTED",
      },
      orderBy: [{ sourceRowSequence: "asc" }, { id: "asc" }],
    });
    if (activeParserObservations.length > 0) {
      return activeParserObservations.map((observation) => ({
        sourceRowSequence: observation.sourceRowSequence,
        observedHourlyRate: observation.observedHourlyRate?.toString() ?? null,
        regularMinutes: observation.regularMinutes,
        regularEarnings: observation.regularEarnings?.toString() ?? null,
        observedDateStart: observation.observedDateStart,
        observedDateEnd: observation.observedDateEnd,
        payPeriodStart: parseDateOnly(value.periodStart),
        payPeriodEnd: parseDateOnly(value.periodEnd),
        extractionBasis: "WORKDAY_REGULAR_ROW",
        dateConfidence: observation.dateConfidence,
        observationState: "SUPPORTED",
        parserVersion: observation.parserVersion,
      }));
    }
  }
  return [enteredObservationDraft(value, "PAYCHECK_CORRECTION")];
}

async function persistReviewedPaycheck(
  principal: PayrollPrincipal,
  value: PaycheckInput,
  options: {
    sourceFingerprint: string;
    parserVersion: string;
    authoritativeRate: Prisma.Decimal | null;
    reviewCandidateRate: Prisma.Decimal | null;
    observations: RateObservationDraft[];
  },
): Promise<PayrollImportState> {
  const { authoritativeRate, reviewCandidateRate, sourceFingerprint } = options;
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.paycheck.findUnique({
        where: {
          employeeId_sourceFingerprint: {
            employeeId: principal.employeeId,
            sourceFingerprint,
          },
        },
      });
      if (duplicate) {
        const observations = await tx.payRateObservation.findMany({
          where: { sourcePaycheckId: duplicate.id },
          include: { rateSupports: true, boundaryCandidates: { include: { candidate: true } } },
        });
        const hasVerifiedSupport = observations.some((item) => item.rateSupports.length > 0);
        const hasOpenCandidate = observations.some((item) =>
          item.boundaryCandidates.some((link) => link.candidate.status === "OPEN"));
        return {
          paycheckId: duplicate.id,
          rateEvidence: hasVerifiedSupport
            ? "VERIFIED" as const
            : hasOpenCandidate
              ? "NEEDS_REVIEW" as const
              : "NOT_ESTABLISHED" as const,
        };
      }
      const periodStart = parseDateOnly(value.periodStart);
      const periodEnd = parseDateOnly(value.periodEnd);
      const checkDate = parseDateOnly(value.checkDate);
      // The schema requires a value. Only project Wednesday for a confirmed
      // Monday-Sunday NAM period; otherwise retain the authoritative check date
      // without presenting it as an independently calculated projection.
      const expectedCheckDate = projectedCheckDateForNamPeriod(periodStart, periodEnd) ?? checkDate;
      const period = await tx.payrollPeriod.upsert({
        where: {
          employeeId_periodStart_periodEnd: {
            employeeId: principal.employeeId,
            periodStart,
            periodEnd,
          },
        },
        create: {
          employeeId: principal.employeeId,
          periodStart,
          periodEnd,
          expectedCheckDate,
          actualCheckDate: checkDate,
        },
        update: { actualCheckDate: checkDate },
      });
      const paycheck = await tx.paycheck.create({
        data: {
          employeeId: principal.employeeId,
          payrollPeriodId: period.id,
          checkDate,
          regularPaidMinutes: Math.round(value.regularHours * 60),
          overtimePaidMinutes: Math.round(value.overtimeHours * 60),
          baseRate: authoritativeRate ?? reviewCandidateRate,
          regularEarnings: new Prisma.Decimal(value.regularEarnings),
          overtimeBaseEarnings: new Prisma.Decimal(value.overtimeBaseEarnings),
          overtimePremiumEarnings: new Prisma.Decimal(value.overtimePremiumEarnings),
          otherCashEarnings: new Prisma.Decimal(value.otherCashEarnings),
          grossCashPay: new Prisma.Decimal(value.grossCashPay),
          noncashImputedEarnings: new Prisma.Decimal(value.noncashImputedEarnings),
          preTaxDeductions: new Prisma.Decimal(value.preTaxDeductions),
          employeeTaxes: new Prisma.Decimal(value.employeeTaxes),
          postTaxDeductions: new Prisma.Decimal(value.postTaxDeductions),
          adjustments: new Prisma.Decimal(value.adjustments),
          netPay: new Prisma.Decimal(value.netPay),
          sourceFingerprint,
          parserVersion: options.parserVersion,
          reviewStatus: "CONFIRMED",
          notes: value.notes || null,
        },
      });
      const observations = await ingestPayRateObservations(tx, {
        paycheckId: paycheck.id,
        employeeId: principal.employeeId,
        evidenceRevision: paycheck.evidenceRevision,
        observations: options.observations,
        supersedePriorRevision: false,
      });
      const rateEvidence = observations.some((item) => item.rateSupports.length > 0)
        ? "VERIFIED" as const
        : observations.some((item) => item.classifications.some((classification) =>
            classification.kind !== "UNSUPPORTED_OBSERVATION"))
          ? "NEEDS_REVIEW" as const
          : "NOT_ESTABLISHED" as const;
      return { paycheckId: paycheck.id, rateEvidence };
    });
    revalidatePath("/");
    revalidatePath("/payroll");
    return {
      status: "saved",
      message: saved.rateEvidence === "NEEDS_REVIEW"
          ? "Paycheck saved. Rate observations were retained, but no exact effective-date boundary was verified; owner review is required before estimates can use a changed rate."
        : saved.rateEvidence === "NOT_ESTABLISHED"
          ? "Paycheck saved. No authoritative hourly rate was established; expected-gross estimates remain unavailable until supported rate evidence is reviewed."
          : "Paycheck saved.",
      paycheckId: saved.paycheckId,
      rateEvidence: saved.rateEvidence,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "PAY_RATE_PROVENANCE_MISMATCH") {
      return {
        status: "error",
        code: "PAY_RATE_PROVENANCE_MISMATCH",
        message: "Paycheck rate provenance conflicts with another employee. No payroll values were changed.",
      };
    }
    const conflict = uniqueConflictKind(error);
    return {
      status: "error",
      ...(conflict === "RATE_SLOT" ? { code: "RATE_EVIDENCE_CONFLICT" as const } : {}),
      message: conflict === "RATE_SLOT"
        ? "Concurrent rate evidence occupied this employee and effective date. No paycheck was saved."
        : conflict === "PAYCHECK_FINGERPRINT"
          ? "This paycheck evidence has already been imported. Open the existing paycheck to make a controlled correction."
          : conflict === "PAYROLL_PERIOD"
            ? "A conflicting payroll period already exists. No paycheck was saved."
            : "Paycheck could not be saved. No payroll values were changed.",
    };
  }
}

export async function savePaycheckAction(
  _state: PayrollImportState,
  formData: FormData,
): Promise<PayrollImportState> {
  const principal = await requirePayrollPrincipal();
  const parsed = parseReviewPayload(formData);
  if (!parsed?.success) {
    return {
      status: "error",
      message: parsed?.error.issues[0]?.message ?? "Review data could not be read.",
    };
  }
  const value = parsed.data;
  if (value.importMode !== "PDF_IMPORT" || !value.rateExtraction) {
    return evidenceEnvelopeError("MISSING");
  }
  const verified = verifyPdfPreviewEnvelope(
    value.evidenceEnvelope,
    principal.employeeId,
    {
      fingerprint: value.fingerprint,
      parserVersion: value.parserVersion,
      periodStart: value.periodStart,
      periodEnd: value.periodEnd,
      checkDate: value.checkDate,
      regularHours: String(value.regularHours),
      baseRate: value.baseRate == null ? "" : String(value.baseRate),
      regularEarnings: String(value.regularEarnings),
      rateExtraction: value.rateExtraction,
    },
    payrollPreviewSigningSecret(),
  );
  if (!verified.ok) return evidenceEnvelopeError(verified.reason);
  const authoritativeRate = value.baseRate != null && verified.rateContextMatches &&
      rateSubmissionMatchesExtraction(value.rateExtraction, {
        regularHours: String(value.regularHours),
        hourlyRate: String(value.baseRate),
        regularEarnings: String(value.regularEarnings),
      })
    ? new Prisma.Decimal(value.baseRate)
    : null;
  const reviewCandidateRate = value.baseRate != null && authoritativeRate === null
    ? new Prisma.Decimal(value.baseRate)
    : null;
  return persistReviewedPaycheck(principal, value, {
    sourceFingerprint: verified.claims.fingerprint,
    parserVersion: verified.claims.parserVersion,
    authoritativeRate,
    reviewCandidateRate,
    observations: pdfObservationDrafts(value),
  });
}

export async function saveManualPaycheckAction(
  _state: PayrollImportState,
  formData: FormData,
): Promise<PayrollImportState> {
  const principal = await requirePayrollPrincipal();
  const parsed = parseReviewPayload(formData);
  if (!parsed?.success) {
    return {
      status: "error",
      message: parsed?.error.issues[0]?.message ?? "Manual paycheck data could not be read.",
    };
  }
  const value = parsed.data;
  if (
    value.importMode !== "MANUAL_ENTRY" ||
    value.fingerprint !== "" ||
    value.evidenceEnvelope ||
    value.rateExtraction
  ) {
    return {
      status: "error",
      code: "PREVIEW_INVALID",
      message: "Manual entry could not be authenticated as a manual workflow. Start a new manual entry.",
    };
  }
  const sourceFingerprint = manualPaycheckFingerprint(principal.employeeId, {
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    checkDate: value.checkDate,
    grossCashPay: value.grossCashPay,
    netPay: value.netPay,
  });
  return persistReviewedPaycheck(principal, value, {
    sourceFingerprint,
    parserVersion: value.parserVersion,
    authoritativeRate: null,
    reviewCandidateRate: value.baseRate == null ? null : new Prisma.Decimal(value.baseRate),
    observations: [enteredObservationDraft(value, "MANUAL_ENTRY")],
  });
}

export async function correctPaycheckAction(
  _state: PayrollImportState,
  formData: FormData,
): Promise<PayrollImportState> {
  const principal = await requirePayrollPrincipal();
  const paycheckId = formData.get("paycheckId");
  const parsed = parseReviewPayload(formData);
  if (typeof paycheckId !== "string" || !parsed?.success) {
    return {
      status: "error",
      message: parsed && !parsed.success
        ? parsed.error.issues[0]?.message ?? "Correction data could not be read."
        : "Correction data could not be read.",
    };
  }
  const value = parsed.data;
  if (value.importMode !== "CORRECTION" || !value.evidenceEnvelope || value.rateExtraction) {
    return evidenceEnvelopeError("MISSING", true);
  }
  try {
    const rateEvidence = await prisma.$transaction(async (tx) => {
      await acquirePayrollEvidenceLock(tx, "paycheck", paycheckId);
      const current = await tx.paycheck.findFirst({
        where: { id: paycheckId, employeeId: principal.employeeId },
        include: { payrollPeriod: true },
      });
      if (!current) throw new Error("ACCESS_DENIED");
      const storedEvidence = verifyCorrectionPreviewEnvelope(
        value.evidenceEnvelope,
        principal.employeeId,
        {
          paycheckId,
          recordUpdatedAt: current.updatedAt.toISOString(),
          fingerprint: current.sourceFingerprint,
          parserVersion: current.parserVersion,
          periodStart: current.payrollPeriod.periodStart.toISOString().slice(0, 10),
          periodEnd: current.payrollPeriod.periodEnd.toISOString().slice(0, 10),
          regularHours: String(current.regularPaidMinutes / 60),
          baseRate: current.baseRate?.toString() ?? "",
          regularEarnings: current.regularEarnings.toString(),
        },
        payrollPreviewSigningSecret(),
      );
      if (!storedEvidence.ok || !storedEvidence.rateContextMatches) {
        throw new Error(`PAYROLL_PREVIEW_${storedEvidence.ok ? "STALE" : storedEvidence.reason}`);
      }
      const verified = verifyCorrectionPreviewEnvelope(
        value.evidenceEnvelope,
        principal.employeeId,
        {
          paycheckId,
          recordUpdatedAt: current.updatedAt.toISOString(),
          fingerprint: value.fingerprint,
          parserVersion: value.parserVersion,
          periodStart: value.periodStart,
          periodEnd: value.periodEnd,
          regularHours: String(value.regularHours),
          baseRate: value.baseRate == null ? "" : String(value.baseRate),
          regularEarnings: String(value.regularEarnings),
        },
        payrollPreviewSigningSecret(),
      );
      if (!verified.ok) throw new Error(`PAYROLL_PREVIEW_${verified.reason}`);
      const authoritativeRate = verified.rateContextMatches && current.baseRate !== null
        ? current.baseRate
        : null;
      const reviewCandidateRate = value.baseRate != null && authoritativeRate === null
        ? new Prisma.Decimal(value.baseRate)
        : null;
      const correctionObservations = await correctionObservationDrafts(
        tx,
        current.id,
        current.evidenceRevision,
        value,
        verified.rateContextMatches,
      );
      const periodStart = parseDateOnly(value.periodStart);
      const periodEnd = parseDateOnly(value.periodEnd);
      const checkDate = parseDateOnly(value.checkDate);
      await tx.payrollPeriod.update({
        where: { id: current.payrollPeriodId },
        data: {
          periodStart,
          periodEnd,
          actualCheckDate: checkDate,
        },
      });
      const updatedPaycheck = await tx.paycheck.update({
        where: { id: current.id },
        data: {
          checkDate,
          regularPaidMinutes: Math.round(value.regularHours * 60),
          overtimePaidMinutes: Math.round(value.overtimeHours * 60),
          baseRate: authoritativeRate ?? reviewCandidateRate,
          regularEarnings: new Prisma.Decimal(value.regularEarnings),
          overtimeBaseEarnings: new Prisma.Decimal(value.overtimeBaseEarnings),
          overtimePremiumEarnings: new Prisma.Decimal(value.overtimePremiumEarnings),
          otherCashEarnings: new Prisma.Decimal(value.otherCashEarnings),
          grossCashPay: new Prisma.Decimal(value.grossCashPay),
          noncashImputedEarnings: new Prisma.Decimal(value.noncashImputedEarnings),
          preTaxDeductions: new Prisma.Decimal(value.preTaxDeductions),
          employeeTaxes: new Prisma.Decimal(value.employeeTaxes),
          postTaxDeductions: new Prisma.Decimal(value.postTaxDeductions),
          adjustments: new Prisma.Decimal(value.adjustments),
          netPay: new Prisma.Decimal(value.netPay),
          notes: value.notes || null,
          correctedAt: new Date(),
          reviewStatus: "CONFIRMED",
          evidenceRevision: { increment: 1 },
        },
      });
      if (!verified.rateContextMatches) {
        await supersedePaycheckRateEvidenceForCorrection(tx, {
          paycheckId: current.id,
          employeeId: principal.employeeId,
          evidenceRevision: updatedPaycheck.evidenceRevision,
        });
      }
      const observations = await ingestPayRateObservations(tx, {
        paycheckId: current.id,
        employeeId: principal.employeeId,
        evidenceRevision: updatedPaycheck.evidenceRevision,
        observations: correctionObservations,
        supersedePriorRevision: true,
        preserveExistingVerifiedRate: verified.rateContextMatches,
      });
      const directVerifiedRate = await tx.employeePayRate.findFirst({
        where: {
          sourcePaycheckId: current.id,
          provenanceKind: "PAYCHECK",
          verificationStatus: "VERIFIED",
        },
      });
      return directVerifiedRate || observations.some((item) => item.rateSupports.length > 0)
        ? "VERIFIED" as const
        : observations.some((item) => item.boundaryCandidates?.length > 0)
          ? "NEEDS_REVIEW" as const
          : "NOT_ESTABLISHED" as const;
    });
    revalidatePath("/");
    revalidatePath("/payroll");
    revalidatePath(`/payroll/paychecks/${paycheckId}`);
    return {
      status: "saved",
      message: rateEvidence === "NEEDS_REVIEW"
          ? "Paycheck correction saved. The corrected rate observation is non-authoritative and requires explicit owner review before estimates can use a changed rate."
        : rateEvidence === "NOT_ESTABLISHED"
          ? "Paycheck correction saved. No authoritative hourly rate was established; expected-gross estimates remain unavailable until supported rate evidence is reviewed."
          : "Paycheck correction saved.",
      paycheckId,
      rateEvidence,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PAYROLL_PREVIEW_")) {
      const reason = error.message.slice("PAYROLL_PREVIEW_".length) as EvidenceEnvelopeFailure;
      return evidenceEnvelopeError(reason, true);
    }
    if (error instanceof Error && error.message === "PAY_RATE_PROVENANCE_MISMATCH") {
      return {
        status: "error",
        code: "PAY_RATE_PROVENANCE_MISMATCH",
        message: "Paycheck rate provenance conflicts with another employee. No correction was saved.",
      };
    }
    const conflict = uniqueConflictKind(error);
    return {
      status: "error",
      ...(conflict === "RATE_SLOT" ? { code: "RATE_EVIDENCE_CONFLICT" as const } : {}),
      message: conflict === "RATE_SLOT"
        ? "Concurrent rate evidence occupied this employee and effective date. No correction was saved."
        : conflict === "PAYROLL_PERIOD"
          ? "Those dates conflict with another payroll period. No correction was saved."
          : conflict === "PAYCHECK_FINGERPRINT"
            ? "The correction conflicts with existing paycheck evidence. No correction was saved."
            : "Paycheck correction could not be saved.",
    };
  }
}
