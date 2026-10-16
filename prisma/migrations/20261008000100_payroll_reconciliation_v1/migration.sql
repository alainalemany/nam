-- Payroll reconciliation stores structured reviewed evidence only. Uploaded
-- PDFs and raw extracted text are intentionally not persisted.
CREATE TYPE "PayrollReviewStatus" AS ENUM ('CONFIRMED', 'NEEDS_REVIEW');

ALTER TABLE "WeeklyTimesheet" ADD COLUMN "primaryEmployeeId" TEXT;

UPDATE "WeeklyTimesheet" AS wt
SET "primaryEmployeeId" = e."id"
FROM "Employee" AS e
WHERE wt."primaryEmployeeKey" = lower(regexp_replace(trim(e."displayName"), '[[:space:]]+', ' ', 'g'));

CREATE TABLE "PayrollPeriod" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "expectedCheckDate" DATE NOT NULL,
  "actualCheckDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Paycheck" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "checkDate" DATE NOT NULL,
  "regularPaidMinutes" INTEGER NOT NULL,
  "overtimePaidMinutes" INTEGER NOT NULL,
  "baseRate" DECIMAL(10,4),
  "regularEarnings" DECIMAL(12,2) NOT NULL,
  "overtimeBaseEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "overtimePremiumEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "otherCashEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grossCashPay" DECIMAL(12,2) NOT NULL,
  "noncashImputedEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "preTaxDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "employeeTaxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "postTaxDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "adjustments" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netPay" DECIMAL(12,2) NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "reviewStatus" "PayrollReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "notes" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correctedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Paycheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeePayRate" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "hourlyRate" DECIMAL(10,4) NOT NULL,
  "sourceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePayRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyTimesheet_primaryEmployeeId_idx" ON "WeeklyTimesheet"("primaryEmployeeId");
CREATE UNIQUE INDEX "PayrollPeriod_employee_period_key" ON "PayrollPeriod"("employeeId", "periodStart", "periodEnd");
CREATE INDEX "PayrollPeriod_employee_dates_idx" ON "PayrollPeriod"("employeeId", "periodStart", "periodEnd");
CREATE UNIQUE INDEX "Paycheck_payrollPeriodId_key" ON "Paycheck"("payrollPeriodId");
CREATE UNIQUE INDEX "Paycheck_employee_fingerprint_key" ON "Paycheck"("employeeId", "sourceFingerprint");
CREATE INDEX "Paycheck_employee_checkDate_idx" ON "Paycheck"("employeeId", "checkDate");
CREATE UNIQUE INDEX "EmployeePayRate_employee_effective_key" ON "EmployeePayRate"("employeeId", "effectiveFrom");
CREATE INDEX "EmployeePayRate_employee_effective_idx" ON "EmployeePayRate"("employeeId", "effectiveFrom");

ALTER TABLE "WeeklyTimesheet" ADD CONSTRAINT "WeeklyTimesheet_primaryEmployee_fkey"
  FOREIGN KEY ("primaryEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_employee_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Paycheck" ADD CONSTRAINT "Paycheck_employee_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Paycheck" ADD CONSTRAINT "Paycheck_payrollPeriod_fkey"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeePayRate" ADD CONSTRAINT "EmployeePayRate_employee_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
