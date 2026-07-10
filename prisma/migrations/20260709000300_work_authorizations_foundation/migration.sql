-- CreateEnum
CREATE TYPE "WorkAuthorizationStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkAuthorizationWorkType" AS ENUM ('MAINTENANCE', 'ELECTRICAL', 'MECHANICAL', 'PREVENTIVE_MAINTENANCE', 'BREAKDOWN', 'HOT_WORK', 'WORKING_AT_HEIGHTS', 'LOCKOUT_TAGOUT', 'OTHER');

-- CreateTable
CREATE TABLE "WorkAuthorization" (
    "id" TEXT NOT NULL,
    "shiftReportId" TEXT NOT NULL,
    "status" "WorkAuthorizationStatus" NOT NULL DEFAULT 'DRAFT',
    "workType" "WorkAuthorizationWorkType" NOT NULL,
    "mineId" TEXT,
    "equipmentId" TEXT,
    "jobLocation" TEXT,
    "workDescription" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "crewWorkerCount" INTEGER,
    "contactName" TEXT,
    "equipmentRequired" TEXT,
    "personInChargeName" TEXT,
    "lockoutRequired" BOOLEAN NOT NULL DEFAULT true,
    "lockoutNotRequiredReason" TEXT,
    "workplaceExamRequired" BOOLEAN NOT NULL DEFAULT false,
    "confinedSpaceRequired" BOOLEAN NOT NULL DEFAULT false,
    "lockoutTagoutRequired" BOOLEAN NOT NULL DEFAULT true,
    "hotWorkRequired" BOOLEAN NOT NULL DEFAULT false,
    "workingAtHeightsRequired" BOOLEAN NOT NULL DEFAULT false,
    "stopCardJhaRequired" BOOLEAN NOT NULL DEFAULT false,
    "jobCompleted" BOOLEAN NOT NULL DEFAULT false,
    "permitsClosed" BOOLEAN NOT NULL DEFAULT false,
    "guardsReplaced" BOOLEAN NOT NULL DEFAULT false,
    "lockoutTagoutRemoved" BOOLEAN NOT NULL DEFAULT false,
    "toolsRemoved" BOOLEAN NOT NULL DEFAULT false,
    "housekeepingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "supervisorNotified" BOOLEAN NOT NULL DEFAULT false,
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkAuthorization_shiftReportId_idx" ON "WorkAuthorization"("shiftReportId");

-- CreateIndex
CREATE INDEX "WorkAuthorization_status_idx" ON "WorkAuthorization"("status");

-- CreateIndex
CREATE INDEX "WorkAuthorization_workType_idx" ON "WorkAuthorization"("workType");

-- CreateIndex
CREATE INDEX "WorkAuthorization_mineId_idx" ON "WorkAuthorization"("mineId");

-- CreateIndex
CREATE INDEX "WorkAuthorization_equipmentId_idx" ON "WorkAuthorization"("equipmentId");

-- AddForeignKey
ALTER TABLE "WorkAuthorization" ADD CONSTRAINT "WorkAuthorization_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAuthorization" ADD CONSTRAINT "WorkAuthorization_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAuthorization" ADD CONSTRAINT "WorkAuthorization_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
