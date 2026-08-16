-- Add the small canonical employee reference used by Work Schedule.
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSupervisor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WeeklySchedule"
ADD COLUMN "primaryEmployeeId" TEXT,
ADD COLUMN "assignedByEmployeeId" TEXT;

ALTER TABLE "AssignmentCrewMember"
ADD COLUMN "employeeId" TEXT;

CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");
CREATE INDEX "Employee_isSupervisor_isActive_idx" ON "Employee"("isSupervisor", "isActive");
CREATE INDEX "Employee_displayName_idx" ON "Employee"("displayName");

CREATE UNIQUE INDEX "WeeklySchedule_weekStartDate_primaryEmployeeId_key"
ON "WeeklySchedule"("weekStartDate", "primaryEmployeeId");
CREATE INDEX "WeeklySchedule_primaryEmployeeKey_idx" ON "WeeklySchedule"("primaryEmployeeKey");
CREATE INDEX "WeeklySchedule_primaryEmployeeId_idx" ON "WeeklySchedule"("primaryEmployeeId");
CREATE INDEX "WeeklySchedule_assignedByEmployeeId_idx" ON "WeeklySchedule"("assignedByEmployeeId");
CREATE INDEX "AssignmentCrewMember_employeeId_idx" ON "AssignmentCrewMember"("employeeId");

DROP INDEX "WeeklySchedule_weekStartDate_primaryEmployeeKey_key";

ALTER TABLE "WeeklySchedule"
ADD CONSTRAINT "WeeklySchedule_primaryEmployeeId_fkey"
FOREIGN KEY ("primaryEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklySchedule"
ADD CONSTRAINT "WeeklySchedule_assignedByEmployeeId_fkey"
FOREIGN KEY ("assignedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssignmentCrewMember"
ADD CONSTRAINT "AssignmentCrewMember_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Controlled-pilot reference record. Employee code 911601 is already the
-- server-owned requester identity used by Supply Requests.
INSERT INTO "Employee" (
    "id",
    "employeeCode",
    "displayName",
    "isActive",
    "isSupervisor",
    "updatedAt"
) VALUES (
    'employee_911601',
    '911601',
    'Alain Alemany Arana',
    true,
    false,
    CURRENT_TIMESTAMP
);
