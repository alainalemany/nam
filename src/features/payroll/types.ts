import type { PayrollStatus } from "./constants";

export type PayrollExtractionIssueSeverity = "INFO" | "REVIEW_REQUIRED" | "UNSUPPORTED";

export type PayrollExtractionIssueCode =
  | "MULTIPLE_REGULAR_ROWS"
  | "MULTIPLE_REGULAR_RATES"
  | "MULTIPLE_REGULAR_RATES_WITHOUT_EXPLICIT_DATES"
  | "MISSING_REGULAR_HOURS"
  | "MISSING_REGULAR_RATE"
  | "MISSING_REGULAR_EARNINGS"
  | "ZERO_HOUR_REGULAR_ROW"
  | "REGULAR_HOURS_NOT_WHOLE_MINUTES"
  | "RATE_EARNINGS_MISMATCH"
  | "AMBIGUOUS_REGULAR_COLUMNS"
  | "CURRENT_YTD_AMBIGUOUS"
  | "ROW_DATE_RANGE_INVALID"
  | "ROW_DATE_OUTSIDE_PAY_PERIOD"
  | "PAY_PERIOD_RANGE_INVALID"
  | "ADJUSTMENT_ONLY_DOCUMENT"
  | "NO_REGULAR_RATE_OBSERVATIONS";

export type PayrollExtractionIssue = {
  code: PayrollExtractionIssueCode;
  severity: PayrollExtractionIssueSeverity;
  message: string;
  observationSequence?: number;
};

export type RegularRateObservation = {
  sequence: number;
  rowIndex: number;
  hourlyRate: string;
  regularHours: string;
  regularMinutes?: number;
  regularEarnings: string;
  rowDateStart?: string;
  rowDateEnd?: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  extractionBasis: "EXPLICIT_WORKDAY_REGULAR_ROW";
  dateConfidence: "EXPLICIT_ROW_RANGE" | "PAY_PERIOD_ONLY" | "UNKNOWN";
  issues: PayrollExtractionIssue[];
  eligibleForVerification: boolean;
};

export type RateExtractionResult = {
  disposition: "SUPPORTED" | "REVIEW_REQUIRED" | "UNSUPPORTED";
  observations: RegularRateObservation[];
  issues: PayrollExtractionIssue[];
};

export type ParsedPaycheck = {
  importMode: "PDF_IMPORT" | "MANUAL_ENTRY" | "CORRECTION";
  fingerprint: string;
  parserVersion: string;
  evidenceEnvelope?: string;
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
  rateExtraction?: RateExtractionResult;
};

export type PayrollImportState = {
  status: "idle" | "error" | "review" | "saved";
  message: string;
  values?: ParsedPaycheck;
  paycheckId?: string;
  code?:
    | "RATE_EVIDENCE_CONFLICT"
    | "PAY_RATE_PROVENANCE_MISMATCH"
    | "PREVIEW_EXPIRED"
    | "PREVIEW_INVALID"
    | "PREVIEW_STALE";
  rateEvidence?: "VERIFIED" | "CONFLICT" | "NEEDS_REVIEW" | "NOT_ESTABLISHED";
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
  ftoRequestedMinutes?: number;
  ftoEvidenceLabel?: string;
  noWorkReason?: "SHIFT_CANCELED" | "COVERED_BY_COWORKER";
  noWorkLabel?: string;
  noWorkNotes?: string;
  payrollPeriodLabel?: string;
  paidEvidenceLabel?: string;
  evidenceLevel?: "aggregate";
  estimatedGross?: string;
  estimatedGrossStatus?: "AVAILABLE" | "UNAVAILABLE";
  estimatedGrossReason?: "MISSING_VERIFIED_RATE" | "RATE_EVIDENCE_CONFLICT" | "RATE_CHANGE_UNCERTAINTY";
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};
