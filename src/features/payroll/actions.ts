"use server";

import { createHash, randomUUID } from "node:crypto";

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
import { acquirePayrollEvidenceLock, rateSlotLockKey } from "./evidence-review-locks";
import { extractPaycheckPdf } from "./parser";
import { manualPaycheckFingerprint } from "./fingerprint";
import {
  type EvidenceEnvelopeFailure,
  verifyCorrectionPreviewEnvelope,
  verifyPdfPreviewEnvelope,
  createPdfPreviewEnvelope,
} from "./preview-evidence";
import {
  rateSubmissionMatchesExtraction,
} from "./rate-extraction";
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

async function reconcilePaycheckDerivedRate(
  tx: Prisma.TransactionClient,
  input: {
    paycheckId: string;
    employeeId: string;
    effectiveFrom: Date;
    hourlyRate: Prisma.Decimal | null;
    reviewRequired?: boolean;
    preserveExistingVerifiedRate?: boolean;
    sourceNote: string;
    auditCorrection?: boolean;
  },
): Promise<"VERIFIED" | "CONFLICT" | "NEEDS_REVIEW" | "NOT_ESTABLISHED"> {
  await acquirePayrollEvidenceLock(tx, "paycheck", input.paycheckId);
  const linkedRates = await tx.employeePayRate.findMany({
    where: {
      verificationStatus: { in: ["NEEDS_REVIEW", "VERIFIED", "CONFLICT"] },
      OR: [
        { sourcePaycheckId: input.paycheckId, provenanceKind: "PAYCHECK" },
        { provenanceCandidatePaycheckId: input.paycheckId },
      ],
    },
    include: { reviewEvents: { select: { sequence: true } } },
    orderBy: [{ evidenceVersion: "desc" }, { createdAt: "desc" }],
  });
  if (linkedRates.some((rate) => rate.employeeId !== input.employeeId)) {
    throw new Error("PAY_RATE_PROVENANCE_MISMATCH");
  }

  const slotKeys = [
    ...(input.hourlyRate !== null ? [rateSlotLockKey(input.employeeId, input.effectiveFrom)] : []),
    ...linkedRates.map((rate) => rateSlotLockKey(rate.employeeId, rate.effectiveFrom)),
  ];
  for (const slotKey of [...new Set(slotKeys)].sort()) {
    await acquirePayrollEvidenceLock(tx, "rate-slot", slotKey);
  }
  if (linkedRates.length > 0) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "EmployeePayRate" WHERE "id" IN (${Prisma.join(linkedRates.map((rate) => rate.id).sort())}) ORDER BY "id" FOR UPDATE`,
    );
  }

  // Migration 36 intentionally retained historical source relationships only
  // as non-authoritative candidate provenance. A Paycheck correction must not
  // rewrite those quarantined rows or attribute an owner-review transition to
  // the correction system. Only direct, active Paycheck evidence has a valid
  // migration-37 correction-supersession transition.
  const correctionSupersedableRates = linkedRates.filter((rate) =>
    rate.provenanceKind === "PAYCHECK" &&
    rate.sourcePaycheckId === input.paycheckId &&
    (rate.verificationStatus === "VERIFIED" || rate.verificationStatus === "CONFLICT"));

  const reviewRequired = input.reviewRequired === true ||
    (input.preserveExistingVerifiedRate === true && input.hourlyRate !== null &&
      !correctionSupersedableRates.some((rate) =>
        rate.verificationStatus === "VERIFIED" &&
        rate.effectiveFrom.getTime() === input.effectiveFrom.getTime() &&
        rate.hourlyRate.equals(input.hourlyRate!)));

  const initiator = input.auditCorrection
    ? await tx.employee.findUnique({
        where: { id: input.employeeId },
        select: { id: true, displayName: true, employeeCode: true },
      })
    : null;
  if (input.auditCorrection && !initiator) throw new Error("ACCESS_DENIED");
  const correctionToken = input.auditCorrection ? randomUUID() : null;
  const correctionDigest = input.auditCorrection
    ? createHash("sha256").update(JSON.stringify({
        paycheckId: input.paycheckId,
        effectiveFrom: input.effectiveFrom.toISOString(),
        hourlyRate: input.hourlyRate?.toString() ?? null,
      })).digest("hex")
    : null;

  const nextEvidenceVersion = (linkedRates[0]?.evidenceVersion ?? 0) + 1;
  for (const rate of correctionSupersedableRates.sort((left, right) => left.id.localeCompare(right.id))) {
    const updated = await tx.employeePayRate.updateMany({
      where: { id: rate.id, evidenceVersion: rate.evidenceVersion, verificationStatus: rate.verificationStatus },
      data: { verificationStatus: "SUPERSEDED", evidenceVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new Error("STALE_RATE_EVIDENCE");
    if (input.auditCorrection) {
      await tx.payRateEvidenceReviewEvent.create({
        data: {
          employeePayRateId: rate.id,
          sequence: Math.max(0, ...rate.reviewEvents.map((event) => event.sequence)) + 1,
          decisionKind: "PAYCHECK_CORRECTION_SUPERSEDED",
          attributionKind: "PAYCHECK_CORRECTION_SYSTEM",
          previousStatus: rate.verificationStatus,
          newStatus: "SUPERSEDED",
          previousProvenanceKind: rate.provenanceKind,
          newProvenanceKind: rate.provenanceKind,
          previousSourcePaycheckId: rate.sourcePaycheckId,
          newSourcePaycheckId: rate.sourcePaycheckId,
          previousVersion: rate.evidenceVersion,
          newVersion: rate.evidenceVersion + 1,
          initiatedByEmployeeId: initiator!.id,
          initiatedByDisplayNameSnapshot: initiator!.displayName,
          initiatedByEmployeeCodeSnapshot: initiator!.employeeCode,
          reason: "Automatic supersession caused by an authenticated Paycheck correction.",
          sourceEvidenceReference: `Paycheck correction ${input.paycheckId}`,
          requestToken: correctionToken!,
          requestDigest: correctionDigest!,
        },
      });
    }
  }

  if (input.hourlyRate === null) {
    return "NOT_ESTABLISHED" as const;
  }

  if (reviewRequired) {
    const candidate = await tx.employeePayRate.create({
      data: {
        employeeId: input.employeeId,
        effectiveFrom: input.effectiveFrom,
        hourlyRate: input.hourlyRate,
        sourceNote: input.sourceNote,
        sourcePaycheckId: input.paycheckId,
        verificationStatus: "CONFLICT",
        provenanceKind: "PAYCHECK",
        provenanceCandidatePaycheckId: input.paycheckId,
        evidenceVersion: nextEvidenceVersion,
      },
    });
    if (input.auditCorrection) {
      await tx.payRateEvidenceReviewEvent.create({
        data: {
          employeePayRateId: candidate.id,
          sequence: 1,
          decisionKind: "PAYCHECK_CORRECTION_CREATED",
          attributionKind: "PAYCHECK_CORRECTION_SYSTEM",
          previousStatus: null,
          newStatus: "CONFLICT",
          previousProvenanceKind: null,
          newProvenanceKind: "PAYCHECK",
          previousSourcePaycheckId: null,
          newSourcePaycheckId: input.paycheckId,
          previousVersion: 0,
          newVersion: candidate.evidenceVersion,
          initiatedByEmployeeId: initiator!.id,
          initiatedByDisplayNameSnapshot: initiator!.displayName,
          initiatedByEmployeeCodeSnapshot: initiator!.employeeCode,
          reason: "Unverified replacement rate recorded by an authenticated Paycheck correction.",
          sourceEvidenceReference: `Paycheck correction ${input.paycheckId}`,
          requestToken: correctionToken!,
          requestDigest: correctionDigest!,
        },
      });
    }
    return "NEEDS_REVIEW" as const;
  }

  const competingRate = await tx.employeePayRate.findFirst({
    where: {
      employeeId: input.employeeId,
      effectiveFrom: input.effectiveFrom,
      verificationStatus: { in: ["NEEDS_REVIEW", "VERIFIED", "CONFLICT"] },
    },
  });
  const verificationStatus = competingRate ? "CONFLICT" as const : "VERIFIED" as const;
  const createdRate = await tx.employeePayRate.create({
    data: {
      employeeId: input.employeeId,
      effectiveFrom: input.effectiveFrom,
      hourlyRate: input.hourlyRate,
      sourceNote: input.sourceNote,
      sourcePaycheckId: input.paycheckId,
      verificationStatus,
      provenanceKind: "PAYCHECK",
      provenanceCandidatePaycheckId: null,
      evidenceVersion: nextEvidenceVersion,
    },
  });
  if (input.auditCorrection) {
    await tx.payRateEvidenceReviewEvent.create({
      data: {
        employeePayRateId: createdRate.id,
        sequence: 1,
        decisionKind: "PAYCHECK_CORRECTION_CREATED",
        attributionKind: "PAYCHECK_CORRECTION_SYSTEM",
        previousStatus: null,
        newStatus: verificationStatus,
        previousProvenanceKind: null,
        newProvenanceKind: "PAYCHECK",
        previousSourcePaycheckId: null,
        newSourcePaycheckId: input.paycheckId,
        previousVersion: 0,
        newVersion: createdRate.evidenceVersion,
        initiatedByEmployeeId: initiator!.id,
        initiatedByDisplayNameSnapshot: initiator!.displayName,
        initiatedByEmployeeCodeSnapshot: initiator!.employeeCode,
        reason: "Automatic replacement rate created by an authenticated Paycheck correction.",
        sourceEvidenceReference: `Paycheck correction ${input.paycheckId}`,
        requestToken: correctionToken!,
        requestDigest: correctionDigest!,
      },
    });
  }
  return verificationStatus;
}

async function persistReviewedPaycheck(
  principal: PayrollPrincipal,
  value: PaycheckInput,
  options: {
    sourceFingerprint: string;
    parserVersion: string;
    authoritativeRate: Prisma.Decimal | null;
    reviewCandidateRate: Prisma.Decimal | null;
    sourceNote: string;
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
        const rate = await tx.employeePayRate.findFirst({
          where: {
            sourcePaycheckId: duplicate.id,
            provenanceKind: "PAYCHECK",
            verificationStatus: { in: ["VERIFIED", "CONFLICT"] },
          },
          orderBy: [{ evidenceVersion: "desc" }, { createdAt: "desc" }],
        });
        return {
          paycheckId: duplicate.id,
          rateEvidence: rate?.verificationStatus === "CONFLICT" &&
            rate.provenanceCandidatePaycheckId === duplicate.id
            ? "NEEDS_REVIEW" as const
            : rate?.verificationStatus === "CONFLICT"
              ? "CONFLICT" as const
            : rate?.verificationStatus === "VERIFIED"
              ? "VERIFIED" as const
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
      const rateEvidence = await reconcilePaycheckDerivedRate(tx, {
        paycheckId: paycheck.id,
        employeeId: principal.employeeId,
        effectiveFrom: periodStart,
        hourlyRate: authoritativeRate ?? reviewCandidateRate,
        reviewRequired: authoritativeRate === null && reviewCandidateRate !== null,
        sourceNote: options.sourceNote,
      });
      return { paycheckId: paycheck.id, rateEvidence };
    });
    revalidatePath("/");
    revalidatePath("/payroll");
    return {
      status: "saved",
      message: saved.rateEvidence === "CONFLICT"
        ? "Paycheck saved. Rate evidence conflicts with an existing rate and will not be used for estimates."
        : saved.rateEvidence === "NEEDS_REVIEW"
          ? "Paycheck saved. The entered hourly rate is non-authoritative and requires explicit owner evidence review before estimates can use it."
        : saved.rateEvidence === "NOT_ESTABLISHED"
          ? "Paycheck saved. No authoritative hourly rate was established; expected-gross estimates remain unavailable until supported rate evidence is reviewed."
          : "Paycheck saved.",
      paycheckId: saved.paycheckId,
      rateEvidence: saved.rateEvidence,
      ...(saved.rateEvidence === "CONFLICT" ? { code: "RATE_EVIDENCE_CONFLICT" as const } : {}),
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
    sourceNote: "Authenticated Workday paycheck evidence",
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
    sourceNote: "Manual paycheck entry without authenticated rate evidence",
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
      await tx.paycheck.update({
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
        },
      });
      return reconcilePaycheckDerivedRate(tx, {
        paycheckId: current.id,
        employeeId: principal.employeeId,
        effectiveFrom: periodStart,
        hourlyRate: authoritativeRate ?? reviewCandidateRate,
        reviewRequired: authoritativeRate === null && reviewCandidateRate !== null,
        preserveExistingVerifiedRate: verified.rateContextMatches && current.baseRate !== null,
        sourceNote: "Corrected Workday paycheck evidence",
        auditCorrection: true,
      });
    });
    revalidatePath("/");
    revalidatePath("/payroll");
    revalidatePath(`/payroll/paychecks/${paycheckId}`);
    return {
      status: "saved",
      message: rateEvidence === "CONFLICT"
        ? "Paycheck correction saved. Rate evidence conflicts with an existing rate and will not be used for estimates."
        : rateEvidence === "NEEDS_REVIEW"
          ? "Paycheck correction saved. The corrected hourly rate is non-authoritative and requires explicit owner evidence review before estimates can use it."
        : rateEvidence === "NOT_ESTABLISHED"
          ? "Paycheck correction saved. No authoritative hourly rate was established; expected-gross estimates remain unavailable until supported rate evidence is reviewed."
          : "Paycheck correction saved.",
      paycheckId,
      rateEvidence,
      ...(rateEvidence === "CONFLICT" ? { code: "RATE_EVIDENCE_CONFLICT" as const } : {}),
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
