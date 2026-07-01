-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT', 'SWING', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DailyLogActivityType" AS ENUM (
    'DRAGLINE_MOVE',
    'CUT',
    'GREASING',
    'SCHEDULED_PM',
    'EQUIPMENT_ALARM',
    'SENSOR_OBSERVATION',
    'EQUIPMENT_OBSERVATION',
    'WORK_ORDER',
    'WORK_AUTHORIZATION',
    'LOCKOUT_TAGOUT',
    'HOT_WORK',
    'WORKING_AT_HEIGHTS',
    'CONTRACTOR_ESCORT',
    'MAINTENANCE_OBSERVATION',
    'FUEL_SERVICE',
    'DELAY',
    'PRODUCTION_NOTE',
    'SAFETY_OBSERVATION',
    'GENERAL_NOTE'
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "shift" "ShiftType" NOT NULL DEFAULT 'UNKNOWN',
    "mineId" TEXT,
    "primaryEquipmentId" TEXT,
    "summary" TEXT,
    "weatherConditions" TEXT,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLogActivity" (
    "id" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "sequence" INTEGER NOT NULL,
    "activityType" "DailyLogActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "equipmentId" TEXT,
    "location" TEXT,
    "contractorCompany" TEXT,
    "personName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLogActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyLog_logDate_idx" ON "DailyLog"("logDate");

-- CreateIndex
CREATE INDEX "DailyLog_shift_idx" ON "DailyLog"("shift");

-- CreateIndex
CREATE INDEX "DailyLog_mineId_idx" ON "DailyLog"("mineId");

-- CreateIndex
CREATE INDEX "DailyLog_primaryEquipmentId_idx" ON "DailyLog"("primaryEquipmentId");

-- CreateIndex
CREATE INDEX "DailyLogActivity_dailyLogId_idx" ON "DailyLogActivity"("dailyLogId");

-- CreateIndex
CREATE INDEX "DailyLogActivity_activityDate_idx" ON "DailyLogActivity"("activityDate");

-- CreateIndex
CREATE INDEX "DailyLogActivity_activityType_idx" ON "DailyLogActivity"("activityType");

-- CreateIndex
CREATE INDEX "DailyLogActivity_equipmentId_idx" ON "DailyLogActivity"("equipmentId");

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_primaryEquipmentId_fkey" FOREIGN KEY ("primaryEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLogActivity" ADD CONSTRAINT "DailyLogActivity_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "DailyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLogActivity" ADD CONSTRAINT "DailyLogActivity_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
