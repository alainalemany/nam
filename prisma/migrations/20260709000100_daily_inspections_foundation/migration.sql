-- CreateEnum
CREATE TYPE "DailyInspectionCondition" AS ENUM (
    'SATISFACTORY',
    'NEEDS_ATTENTION',
    'UNSAFE',
    'NOT_APPLICABLE'
);

-- CreateEnum
CREATE TYPE "DailyInspectionStatus" AS ENUM (
    'COMPLETED',
    'FOLLOW_UP_NEEDED',
    'ARCHIVED'
);

-- CreateTable
CREATE TABLE "DailyInspection" (
    "id" TEXT NOT NULL,
    "inspectionDate" DATE NOT NULL,
    "shift" "ShiftType" NOT NULL DEFAULT 'UNKNOWN',
    "mineId" TEXT,
    "equipmentId" TEXT,
    "equipmentHours" DOUBLE PRECISION,
    "condition" "DailyInspectionCondition" NOT NULL,
    "status" "DailyInspectionStatus" NOT NULL DEFAULT 'COMPLETED',
    "findings" TEXT NOT NULL,
    "defectsIdentified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyInspection_inspectionDate_idx" ON "DailyInspection"("inspectionDate");

-- CreateIndex
CREATE INDEX "DailyInspection_shift_idx" ON "DailyInspection"("shift");

-- CreateIndex
CREATE INDEX "DailyInspection_mineId_idx" ON "DailyInspection"("mineId");

-- CreateIndex
CREATE INDEX "DailyInspection_equipmentId_idx" ON "DailyInspection"("equipmentId");

-- CreateIndex
CREATE INDEX "DailyInspection_condition_idx" ON "DailyInspection"("condition");

-- CreateIndex
CREATE INDEX "DailyInspection_status_idx" ON "DailyInspection"("status");

-- CreateIndex
CREATE INDEX "DailyInspection_defectsIdentified_idx" ON "DailyInspection"("defectsIdentified");

-- AddForeignKey
ALTER TABLE "DailyInspection" ADD CONSTRAINT "DailyInspection_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyInspection" ADD CONSTRAINT "DailyInspection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
