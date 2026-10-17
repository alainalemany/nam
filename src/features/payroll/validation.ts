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

const extractionIssueSchema = z.object({
  code: z.enum([
    "MULTIPLE_REGULAR_ROWS",
    "MULTIPLE_REGULAR_RATES",
    "MULTIPLE_REGULAR_RATES_WITHOUT_EXPLICIT_DATES",
    "MISSING_REGULAR_HOURS",
    "MISSING_REGULAR_RATE",
    "MISSING_REGULAR_EARNINGS",
    "ZERO_HOUR_REGULAR_ROW",
    "REGULAR_HOURS_NOT_WHOLE_MINUTES",
    "RATE_EARNINGS_MISMATCH",
    "AMBIGUOUS_REGULAR_COLUMNS",
    "CURRENT_YTD_AMBIGUOUS",
    "ROW_DATE_RANGE_INVALID",
    "ROW_DATE_OUTSIDE_PAY_PERIOD",
    "PAY_PERIOD_RANGE_INVALID",
    "ADJUSTMENT_ONLY_DOCUMENT",
    "NO_REGULAR_RATE_OBSERVATIONS",
  ]),
  severity: z.enum(["INFO", "REVIEW_REQUIRED", "UNSUPPORTED"]),
  message: z.string().trim().min(1).max(500),
  observationSequence: z.number().int().positive().optional(),
});

const regularRateObservationSchema = z.object({
  sequence: z.number().int().positive(),
  rowIndex: z.number().int().nonnegative(),
  hourlyRate: z.string().max(40),
  regularHours: z.string().max(40),
  regularMinutes: z.number().int().nonnegative().optional(),
  regularEarnings: z.string().max(40),
  rowDateStart: dateOnly.optional(),
  rowDateEnd: dateOnly.optional(),
  payPeriodStart: z.union([dateOnly, z.literal("")]),
  payPeriodEnd: z.union([dateOnly, z.literal("")]),
  extractionBasis: z.literal("EXPLICIT_WORKDAY_REGULAR_ROW"),
  dateConfidence: z.enum(["EXPLICIT_ROW_RANGE", "PAY_PERIOD_ONLY", "UNKNOWN"]),
  issues: z.array(extractionIssueSchema).max(20),
  eligibleForVerification: z.boolean(),
});

const rateExtractionSchema = z.object({
  disposition: z.enum(["SUPPORTED", "REVIEW_REQUIRED", "UNSUPPORTED"]),
  observations: z.array(regularRateObservationSchema).max(50),
  issues: z.array(extractionIssueSchema).max(100),
});

export const paycheckInputSchema = z
  .object({
    importMode: z.enum(["PDF_IMPORT", "MANUAL_ENTRY", "CORRECTION"]),
    fingerprint: z.union([
      z.string().regex(/^[a-f\d]{64}$/, "Import fingerprint is invalid."),
      z.literal(""),
    ]),
    parserVersion: z.string().trim().min(1).max(80),
    evidenceEnvelope: z.string().trim().min(1).max(8_000).optional(),
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
    rateExtraction: rateExtractionSchema.optional(),
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
