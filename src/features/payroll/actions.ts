"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { addDays, parseDateOnly } from "@/features/timesheets/calculations";
import { prisma } from "@/lib/prisma";

import {
  clearPayrollSession,
  establishPayrollSession,
  requirePayrollPrincipal,
} from "./auth";
import { extractPaycheckPdf } from "./parser";
import { manualPaycheckFingerprint } from "./fingerprint";
import type { PayrollImportState } from "./types";
import { payrollUnlockClientKey, payrollUnlockRateLimiter } from "./unlock-rate-limit";
import { paycheckInputSchema } from "./validation";

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
  await requirePayrollPrincipal();
  const file = formData.get("payslip");
  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a Workday PDF to continue." };
  }
  try {
    const values = await extractPaycheckPdf(file);
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
  const sourceFingerprint = value.fingerprint || manualPaycheckFingerprint(
    principal.employeeId,
    {
      periodStart: value.periodStart,
      periodEnd: value.periodEnd,
      checkDate: value.checkDate,
      grossCashPay: value.grossCashPay,
      netPay: value.netPay,
    },
  );
  try {
    const paycheckId = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.paycheck.findUnique({
        where: {
          employeeId_sourceFingerprint: {
            employeeId: principal.employeeId,
            sourceFingerprint,
          },
        },
      });
      if (duplicate) {
        return duplicate.id;
      }
      const periodStart = parseDateOnly(value.periodStart);
      const periodEnd = parseDateOnly(value.periodEnd);
      const checkDate = parseDateOnly(value.checkDate);
      const expectedCheckDate = addDays(periodEnd, 5);
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
          baseRate: value.baseRate == null ? null : new Prisma.Decimal(value.baseRate),
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
          parserVersion: value.parserVersion,
          reviewStatus: "CONFIRMED",
          notes: value.notes || null,
        },
      });
      if (value.baseRate != null) {
        await tx.employeePayRate.upsert({
          where: {
            employeeId_effectiveFrom: {
              employeeId: principal.employeeId,
              effectiveFrom: periodStart,
            },
          },
          create: {
            employeeId: principal.employeeId,
            effectiveFrom: periodStart,
            hourlyRate: new Prisma.Decimal(value.baseRate),
            sourceNote: "Imported Workday paycheck evidence",
          },
          update: {},
        });
      }
      return paycheck.id;
    });
    revalidatePath("/");
    revalidatePath("/payroll");
    return { status: "saved", message: "Paycheck saved.", paycheckId };
  } catch (error) {
    const known = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    return {
      status: "error",
      message: known
        ? "A paycheck already exists for this payroll period. Open it to make a controlled correction."
        : "Paycheck could not be saved. No payroll values were changed.",
    };
  }
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
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.paycheck.findFirst({
        where: { id: paycheckId, employeeId: principal.employeeId },
        include: { payrollPeriod: true },
      });
      if (!current) throw new Error("ACCESS_DENIED");
      const periodStart = parseDateOnly(value.periodStart);
      const periodEnd = parseDateOnly(value.periodEnd);
      const checkDate = parseDateOnly(value.checkDate);
      await tx.payrollPeriod.update({
        where: { id: current.payrollPeriodId },
        data: {
          periodStart,
          periodEnd,
          expectedCheckDate: addDays(periodEnd, 5),
          actualCheckDate: checkDate,
        },
      });
      await tx.paycheck.update({
        where: { id: current.id },
        data: {
          checkDate,
          regularPaidMinutes: Math.round(value.regularHours * 60),
          overtimePaidMinutes: Math.round(value.overtimeHours * 60),
          baseRate: value.baseRate == null ? null : new Prisma.Decimal(value.baseRate),
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
      if (value.baseRate != null) {
        await tx.employeePayRate.upsert({
          where: { employeeId_effectiveFrom: { employeeId: principal.employeeId, effectiveFrom: periodStart } },
          create: { employeeId: principal.employeeId, effectiveFrom: periodStart, hourlyRate: new Prisma.Decimal(value.baseRate), sourceNote: "Corrected Workday paycheck evidence" },
          update: { hourlyRate: new Prisma.Decimal(value.baseRate), sourceNote: "Corrected Workday paycheck evidence" },
        });
      }
    });
    revalidatePath("/");
    revalidatePath("/payroll");
    revalidatePath(`/payroll/paychecks/${paycheckId}`);
    return { status: "saved", message: "Paycheck correction saved.", paycheckId };
  } catch (error) {
    const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    return {
      status: "error",
      message: conflict
        ? "Those dates conflict with another payroll period. No correction was saved."
        : "Paycheck correction could not be saved.",
    };
  }
}
