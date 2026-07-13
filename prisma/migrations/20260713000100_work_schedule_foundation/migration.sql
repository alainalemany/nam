-- CreateEnum
CREATE TYPE "WeeklyScheduleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DailyAssignmentStatus" AS ENUM ('SCHEDULED', 'NON_WORKING', 'UNKNOWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentCrewPhase" AS ENUM ('PLANNED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "AssignmentCrewRole" AS ENUM ('PRIMARY_EMPLOYEE', 'PARTNER');

-- CreateTable
CREATE TABLE "WeeklySchedule" (
    "id" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "status" "WeeklyScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryEmployeeDisplayName" TEXT NOT NULL,
    "assignedByDisplayName" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "sourceNote" TEXT,
    "scheduleNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAssignment" (
    "id" TEXT NOT NULL,
    "weeklyScheduleId" TEXT NOT NULL,
    "assignmentDate" DATE NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "plannedStatus" "DailyAssignmentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "plannedShift" "ShiftType" NOT NULL DEFAULT 'UNKNOWN',
    "plannedEquipmentId" TEXT,
    "plannedEquipmentDisplayName" TEXT,
    "plannedEquipmentNumber" TEXT,
    "plannedEquipmentCategory" "EquipmentCategory",
    "plannedMineName" TEXT,
    "plannedCityName" TEXT,
    "plannedCityState" TEXT,
    "actualStatus" "DailyAssignmentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "actualShift" "ShiftType" NOT NULL DEFAULT 'UNKNOWN',
    "actualEquipmentId" TEXT,
    "actualEquipmentDisplayName" TEXT,
    "actualEquipmentNumber" TEXT,
    "actualEquipmentCategory" "EquipmentCategory",
    "actualMineName" TEXT,
    "actualCityName" TEXT,
    "actualCityState" TEXT,
    "changeReason" TEXT,
    "plannedNotes" TEXT,
    "actualNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentCrewMember" (
    "id" TEXT NOT NULL,
    "dailyAssignmentId" TEXT NOT NULL,
    "phase" "AssignmentCrewPhase" NOT NULL,
    "role" "AssignmentCrewRole" NOT NULL,
    "displayName" TEXT,
    "isUnknown" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentCrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySchedule_weekStartDate_primaryEmployeeDisplayName_key" ON "WeeklySchedule"("weekStartDate", "primaryEmployeeDisplayName");

-- CreateIndex
CREATE INDEX "WeeklySchedule_weekStartDate_idx" ON "WeeklySchedule"("weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklySchedule_weekEndDate_idx" ON "WeeklySchedule"("weekEndDate");

-- CreateIndex
CREATE INDEX "WeeklySchedule_status_idx" ON "WeeklySchedule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAssignment_weeklyScheduleId_assignmentDate_key" ON "DailyAssignment"("weeklyScheduleId", "assignmentDate");

-- CreateIndex
CREATE INDEX "DailyAssignment_assignmentDate_idx" ON "DailyAssignment"("assignmentDate");

-- CreateIndex
CREATE INDEX "DailyAssignment_plannedEquipmentId_idx" ON "DailyAssignment"("plannedEquipmentId");

-- CreateIndex
CREATE INDEX "DailyAssignment_actualEquipmentId_idx" ON "DailyAssignment"("actualEquipmentId");

-- CreateIndex
CREATE INDEX "DailyAssignment_plannedStatus_idx" ON "DailyAssignment"("plannedStatus");

-- CreateIndex
CREATE INDEX "DailyAssignment_actualStatus_idx" ON "DailyAssignment"("actualStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentCrewMember_dailyAssignmentId_phase_role_key" ON "AssignmentCrewMember"("dailyAssignmentId", "phase", "role");

-- CreateIndex
CREATE INDEX "AssignmentCrewMember_phase_idx" ON "AssignmentCrewMember"("phase");

-- CreateIndex
CREATE INDEX "AssignmentCrewMember_role_idx" ON "AssignmentCrewMember"("role");

-- AddForeignKey
ALTER TABLE "DailyAssignment" ADD CONSTRAINT "DailyAssignment_weeklyScheduleId_fkey" FOREIGN KEY ("weeklyScheduleId") REFERENCES "WeeklySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAssignment" ADD CONSTRAINT "DailyAssignment_plannedEquipmentId_fkey" FOREIGN KEY ("plannedEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAssignment" ADD CONSTRAINT "DailyAssignment_actualEquipmentId_fkey" FOREIGN KEY ("actualEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentCrewMember" ADD CONSTRAINT "AssignmentCrewMember_dailyAssignmentId_fkey" FOREIGN KEY ("dailyAssignmentId") REFERENCES "DailyAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
