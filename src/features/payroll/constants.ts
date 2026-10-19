export const PAYROLL_PARSER_VERSION = "workday-v1.3.0";
export const PAYROLL_TIME_ZONE = "America/New_York";
export const MAX_PAYSLIP_BYTES = 10 * 1024 * 1024;
export const PAYROLL_REGULAR_MINUTES = 2_400;

export const payrollStatusLabels = {
  RECONCILED: "Aggregate match",
  AWAITING_PAYROLL: "Awaiting Payroll",
  MISSING_TIMESHEET: "Missing Timesheet",
  DISCREPANCY: "Discrepancy",
  NEEDS_REVIEW: "Needs Review",
  FTO_REQUESTED: "FTO requested",
  FTO_APPROVED: "FTO approved",
  SHIFT_CANCELED: "Shift canceled",
  COVERED_BY_COWORKER: "Covered by coworker",
  SCHEDULED_OFF: "Scheduled off",
  OFF: "Off",
} as const;

export type PayrollStatus = keyof typeof payrollStatusLabels;
