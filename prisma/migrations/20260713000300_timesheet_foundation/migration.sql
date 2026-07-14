-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateTable
CREATE TABLE "WeeklyTimesheet" (
    "id" TEXT NOT NULL,
    "payrollWeekStartDate" DATE NOT NULL,
    "payrollWeekEndDate" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryEmployeeDisplayName" TEXT NOT NULL,
    "primaryEmployeeKey" TEXT NOT NULL,
    "workedMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "regularMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTimesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTimeEntry" (
    "id" TEXT NOT NULL,
    "weeklyTimesheetId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "clockIn" TEXT NOT NULL,
    "clockOut" TEXT NOT NULL,
    "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL,
    "regularMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "primaryEquipmentId" TEXT,
    "primaryEquipmentDisplayNameSnapshot" TEXT NOT NULL,
    "primaryEquipmentNumberSnapshot" TEXT,
    "primaryEquipmentCategorySnapshot" "EquipmentCategory" NOT NULL,
    "primaryMineNameSnapshot" TEXT NOT NULL,
    "primaryCityNameSnapshot" TEXT NOT NULL,
    "primaryCityStateSnapshot" TEXT,
    "workScheduleDailyAssignmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAllocation" (
    "id" TEXT NOT NULL,
    "dailyTimeEntryId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "workCodeId" TEXT NOT NULL,
    "workCodeSnapshot" TEXT NOT NULL,
    "workCodeDescriptionSnapshot" TEXT NOT NULL,
    "workOrderId" TEXT,
    "workOrderSnapshot" TEXT,
    "workOrderDescriptionSnapshot" TEXT,
    "allocatedMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetWorkCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "equipmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetWorkCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetWorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "normalizedWorkOrderNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "equipmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetSupportPerson" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedIdentity" TEXT NOT NULL,
    "tradeOrRole" TEXT NOT NULL,
    "company" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetSupportPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAllocationSupportPerson" (
    "id" TEXT NOT NULL,
    "workAllocationId" TEXT NOT NULL,
    "supportPersonId" TEXT NOT NULL,
    "supportPersonDisplayNameSnapshot" TEXT NOT NULL,
    "supportPersonTradeOrRoleSnapshot" TEXT NOT NULL,
    "supportPersonCompanySnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAllocationSupportPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTimesheet_payrollWeekStartDate_primaryEmployeeKey_key" ON "WeeklyTimesheet"("payrollWeekStartDate", "primaryEmployeeKey");
CREATE INDEX "WeeklyTimesheet_payrollWeekStartDate_idx" ON "WeeklyTimesheet"("payrollWeekStartDate");
CREATE INDEX "WeeklyTimesheet_payrollWeekEndDate_idx" ON "WeeklyTimesheet"("payrollWeekEndDate");
CREATE INDEX "WeeklyTimesheet_status_idx" ON "WeeklyTimesheet"("status");
CREATE INDEX "WeeklyTimesheet_primaryEmployeeKey_idx" ON "WeeklyTimesheet"("primaryEmployeeKey");
CREATE UNIQUE INDEX "DailyTimeEntry_weeklyTimesheetId_workDate_key" ON "DailyTimeEntry"("weeklyTimesheetId", "workDate");
CREATE INDEX "DailyTimeEntry_workDate_idx" ON "DailyTimeEntry"("workDate");
CREATE INDEX "DailyTimeEntry_primaryEquipmentId_idx" ON "DailyTimeEntry"("primaryEquipmentId");
CREATE INDEX "DailyTimeEntry_workScheduleDailyAssignmentId_idx" ON "DailyTimeEntry"("workScheduleDailyAssignmentId");
CREATE UNIQUE INDEX "WorkAllocation_dailyTimeEntryId_sequence_key" ON "WorkAllocation"("dailyTimeEntryId", "sequence");
CREATE INDEX "WorkAllocation_workCodeId_idx" ON "WorkAllocation"("workCodeId");
CREATE INDEX "WorkAllocation_workOrderId_idx" ON "WorkAllocation"("workOrderId");
CREATE UNIQUE INDEX "TimesheetWorkCode_normalizedCode_key" ON "TimesheetWorkCode"("normalizedCode");
CREATE INDEX "TimesheetWorkCode_active_idx" ON "TimesheetWorkCode"("active");
CREATE INDEX "TimesheetWorkCode_equipmentId_idx" ON "TimesheetWorkCode"("equipmentId");
CREATE INDEX "TimesheetWorkCode_code_idx" ON "TimesheetWorkCode"("code");
CREATE UNIQUE INDEX "TimesheetWorkOrder_normalizedWorkOrderNumber_key" ON "TimesheetWorkOrder"("normalizedWorkOrderNumber");
CREATE INDEX "TimesheetWorkOrder_active_idx" ON "TimesheetWorkOrder"("active");
CREATE INDEX "TimesheetWorkOrder_equipmentId_idx" ON "TimesheetWorkOrder"("equipmentId");
CREATE INDEX "TimesheetWorkOrder_workOrderNumber_idx" ON "TimesheetWorkOrder"("workOrderNumber");
CREATE UNIQUE INDEX "TimesheetSupportPerson_normalizedIdentity_key" ON "TimesheetSupportPerson"("normalizedIdentity");
CREATE INDEX "TimesheetSupportPerson_active_idx" ON "TimesheetSupportPerson"("active");
CREATE INDEX "TimesheetSupportPerson_displayName_idx" ON "TimesheetSupportPerson"("displayName");
CREATE UNIQUE INDEX "WorkAllocationSupportPerson_workAllocationId_supportPersonId_key" ON "WorkAllocationSupportPerson"("workAllocationId", "supportPersonId");
CREATE INDEX "WorkAllocationSupportPerson_supportPersonId_idx" ON "WorkAllocationSupportPerson"("supportPersonId");

-- AddForeignKey
ALTER TABLE "DailyTimeEntry" ADD CONSTRAINT "DailyTimeEntry_weeklyTimesheetId_fkey" FOREIGN KEY ("weeklyTimesheetId") REFERENCES "WeeklyTimesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyTimeEntry" ADD CONSTRAINT "DailyTimeEntry_primaryEquipmentId_fkey" FOREIGN KEY ("primaryEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyTimeEntry" ADD CONSTRAINT "DailyTimeEntry_workScheduleDailyAssignmentId_fkey" FOREIGN KEY ("workScheduleDailyAssignmentId") REFERENCES "DailyAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkAllocation" ADD CONSTRAINT "WorkAllocation_dailyTimeEntryId_fkey" FOREIGN KEY ("dailyTimeEntryId") REFERENCES "DailyTimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAllocation" ADD CONSTRAINT "WorkAllocation_workCodeId_fkey" FOREIGN KEY ("workCodeId") REFERENCES "TimesheetWorkCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkAllocation" ADD CONSTRAINT "WorkAllocation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "TimesheetWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimesheetWorkCode" ADD CONSTRAINT "TimesheetWorkCode_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimesheetWorkOrder" ADD CONSTRAINT "TimesheetWorkOrder_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkAllocationSupportPerson" ADD CONSTRAINT "WorkAllocationSupportPerson_workAllocationId_fkey" FOREIGN KEY ("workAllocationId") REFERENCES "WorkAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAllocationSupportPerson" ADD CONSTRAINT "WorkAllocationSupportPerson_supportPersonId_fkey" FOREIGN KEY ("supportPersonId") REFERENCES "TimesheetSupportPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
