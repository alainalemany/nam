-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DefectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "reportedDate" DATE NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "sourceDailyInspectionId" TEXT,
    "severity" "DefectSeverity" NOT NULL,
    "priority" "DefectPriority" NOT NULL,
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "correctiveAction" TEXT,
    "resolutionSummary" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Defect_reportedDate_idx" ON "Defect"("reportedDate");

-- CreateIndex
CREATE INDEX "Defect_equipmentId_idx" ON "Defect"("equipmentId");

-- CreateIndex
CREATE INDEX "Defect_sourceDailyInspectionId_idx" ON "Defect"("sourceDailyInspectionId");

-- CreateIndex
CREATE INDEX "Defect_status_idx" ON "Defect"("status");

-- CreateIndex
CREATE INDEX "Defect_severity_idx" ON "Defect"("severity");

-- CreateIndex
CREATE INDEX "Defect_priority_idx" ON "Defect"("priority");

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_sourceDailyInspectionId_fkey" FOREIGN KEY ("sourceDailyInspectionId") REFERENCES "DailyInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
