CREATE TYPE "TimesheetLeaveType" AS ENUM ('FTO');
CREATE TYPE "TimesheetLeaveApprovalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED');
CREATE TYPE "TimesheetLeavePaymentStatus" AS ENUM ('UNVERIFIED', 'PAID', 'UNPAID');

CREATE TABLE "TimesheetLeaveEntry" (
    "id" TEXT NOT NULL,
    "weeklyTimesheetId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "leaveType" "TimesheetLeaveType" NOT NULL DEFAULT 'FTO',
    "requestedMinutes" INTEGER NOT NULL,
    "approvalStatus" "TimesheetLeaveApprovalStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentStatus" "TimesheetLeavePaymentStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "workScheduleDailyAssignmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetLeaveEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TimesheetLeaveEntry_requestedMinutes_check"
      CHECK ("requestedMinutes" > 0 AND "requestedMinutes" <= 1440)
);

CREATE UNIQUE INDEX "TimesheetLeaveEntry_week_date_type_key"
  ON "TimesheetLeaveEntry"("weeklyTimesheetId", "workDate", "leaveType");
CREATE INDEX "TimesheetLeaveEntry_workDate_idx"
  ON "TimesheetLeaveEntry"("workDate");
CREATE INDEX "TimesheetLeaveEntry_evidence_status_idx"
  ON "TimesheetLeaveEntry"("approvalStatus", "paymentStatus");
CREATE INDEX "TimesheetLeaveEntry_assignment_idx"
  ON "TimesheetLeaveEntry"("workScheduleDailyAssignmentId");

ALTER TABLE "TimesheetLeaveEntry"
  ADD CONSTRAINT "TimesheetLeaveEntry_weeklyTimesheet_fkey"
  FOREIGN KEY ("weeklyTimesheetId") REFERENCES "WeeklyTimesheet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimesheetLeaveEntry"
  ADD CONSTRAINT "TimesheetLeaveEntry_assignment_fkey"
  FOREIGN KEY ("workScheduleDailyAssignmentId") REFERENCES "DailyAssignment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
