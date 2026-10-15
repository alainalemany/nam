import type { PayrollStatus } from "./constants";

export type ParsedPaycheck = {
  fingerprint: string;
  parserVersion: string;
  periodStart: string;
  periodEnd: string;
  checkDate: string;
  regularHours: string;
  overtimeHours: string;
  baseRate: string;
  regularEarnings: string;
  overtimeBaseEarnings: string;
  overtimePremiumEarnings: string;
  otherCashEarnings: string;
  grossCashPay: string;
  noncashImputedEarnings: string;
  preTaxDeductions: string;
  employeeTaxes: string;
  postTaxDeductions: string;
  adjustments: string;
  netPay: string;
  notes: string;
  warnings: string[];
};

export type PayrollImportState = {
  status: "idle" | "error" | "review" | "saved";
  message: string;
  values?: ParsedPaycheck;
  paycheckId?: string;
  code?: "RATE_EVIDENCE_CONFLICT" | "PAY_RATE_PROVENANCE_MISMATCH";
  rateEvidence?: "VERIFIED" | "CONFLICT" | "NOT_ESTABLISHED";
};

export type PayrollCalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  status: PayrollStatus;
  statusLabel: string;
  scheduledLabel?: string;
  equipmentLabel?: string;
  timesheetMinutes?: number;
  payrollPeriodLabel?: string;
  paidEvidenceLabel?: string;
  evidenceLevel?: "aggregate";
  estimatedGross?: string;
  estimatedGrossStatus?: "AVAILABLE" | "UNAVAILABLE";
  estimatedGrossReason?: "MISSING_VERIFIED_RATE" | "RATE_EVIDENCE_CONFLICT";
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};
