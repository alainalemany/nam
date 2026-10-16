import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const money = z
  .string()
  .trim()
  .regex(/^-?\d+(?:\.\d{1,4})?$/, "Enter a valid amount.")
  .transform((value) => Number(value));
const nonnegativeMoney = money.refine((value) => value >= 0, "Amount cannot be negative.");
const hours = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Enter valid hours.")
  .transform((value) => Number(value))
  .refine((value) => value >= 0 && value <= 168, "Hours must be between 0 and 168.")
  .refine((value) => Number.isInteger(value * 60), "Hours must resolve to whole minutes.");

export const paycheckInputSchema = z
  .object({
    fingerprint: z.union([
      z.string().regex(/^[a-f\d]{64}$/, "Import fingerprint is invalid."),
      z.literal(""),
    ]),
    parserVersion: z.string().trim().min(1).max(80),
    periodStart: dateOnly,
    periodEnd: dateOnly,
    checkDate: dateOnly,
    regularHours: hours,
    overtimeHours: hours,
    baseRate: z.union([nonnegativeMoney, z.literal("").transform(() => undefined)]),
    regularEarnings: nonnegativeMoney,
    overtimeBaseEarnings: nonnegativeMoney,
    overtimePremiumEarnings: nonnegativeMoney,
    otherCashEarnings: nonnegativeMoney,
    grossCashPay: nonnegativeMoney,
    noncashImputedEarnings: nonnegativeMoney,
    preTaxDeductions: nonnegativeMoney,
    employeeTaxes: nonnegativeMoney,
    postTaxDeductions: nonnegativeMoney,
    adjustments: money,
    netPay: nonnegativeMoney,
    notes: z.string().trim().max(2_000),
    warnings: z.array(z.string().max(300)).max(20).default([]),
  })
  .superRefine((value, context) => {
    if (value.periodEnd < value.periodStart) {
      context.addIssue({ code: "custom", path: ["periodEnd"], message: "Period end must be on or after period start." });
    }
    const cashComponents =
      value.regularEarnings +
      value.overtimeBaseEarnings +
      value.overtimePremiumEarnings +
      value.otherCashEarnings +
      value.adjustments;
    if (Math.abs(cashComponents - value.grossCashPay) > 0.01) {
      context.addIssue({
        code: "custom",
        path: ["grossCashPay"],
        message: "Cash earnings and adjustments must reconcile to gross cash pay.",
      });
    }
  });

export type PaycheckInput = z.infer<typeof paycheckInputSchema>;
