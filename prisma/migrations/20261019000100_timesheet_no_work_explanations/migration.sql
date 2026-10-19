CREATE TYPE "TimesheetNoWorkReason" AS ENUM ('SHIFT_CANCELED', 'COVERED_BY_COWORKER');

CREATE TABLE "TimesheetNoWorkEntry" (
    "id" TEXT NOT NULL,
    "weeklyTimesheetId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "reason" "TimesheetNoWorkReason" NOT NULL,
    "workScheduleDailyAssignmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetNoWorkEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimesheetNoWorkEntry_week_date_key"
  ON "TimesheetNoWorkEntry"("weeklyTimesheetId", "workDate");
CREATE INDEX "TimesheetNoWorkEntry_workDate_idx"
  ON "TimesheetNoWorkEntry"("workDate");
CREATE INDEX "TimesheetNoWorkEntry_reason_idx"
  ON "TimesheetNoWorkEntry"("reason");
CREATE INDEX "TimesheetNoWorkEntry_assignment_idx"
  ON "TimesheetNoWorkEntry"("workScheduleDailyAssignmentId");

ALTER TABLE "TimesheetNoWorkEntry"
  ADD CONSTRAINT "TimesheetNoWorkEntry_weeklyTimesheet_fkey"
  FOREIGN KEY ("weeklyTimesheetId") REFERENCES "WeeklyTimesheet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimesheetNoWorkEntry"
  ADD CONSTRAINT "TimesheetNoWorkEntry_assignment_fkey"
  FOREIGN KEY ("workScheduleDailyAssignmentId") REFERENCES "DailyAssignment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
