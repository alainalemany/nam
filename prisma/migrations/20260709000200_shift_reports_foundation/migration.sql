-- CreateEnum
CREATE TYPE "ShiftReportStatus" AS ENUM ('DRAFT', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ShiftReport" (
    "id" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "shift" "ShiftType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ShiftReportStatus" NOT NULL DEFAULT 'DRAFT',
    "mineId" TEXT,
    "equipmentId" TEXT,
    "location" TEXT,
    "summary" TEXT NOT NULL,
    "operationalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftReport_reportDate_idx" ON "ShiftReport"("reportDate");

-- CreateIndex
CREATE INDEX "ShiftReport_shift_idx" ON "ShiftReport"("shift");

-- CreateIndex
CREATE INDEX "ShiftReport_status_idx" ON "ShiftReport"("status");

-- CreateIndex
CREATE INDEX "ShiftReport_mineId_idx" ON "ShiftReport"("mineId");

-- CreateIndex
CREATE INDEX "ShiftReport_equipmentId_idx" ON "ShiftReport"("equipmentId");

-- AddForeignKey
ALTER TABLE "ShiftReport" ADD CONSTRAINT "ShiftReport_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftReport" ADD CONSTRAINT "ShiftReport_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
