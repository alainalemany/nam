-- CreateEnum
CREATE TYPE "StopCardCategory" AS ENUM (
    'HAZARD_OBSERVATION',
    'UNSAFE_CONDITION',
    'UNSAFE_ACT',
    'NEAR_MISS',
    'POSITIVE_OBSERVATION',
    'CORRECTIVE_ACTION',
    'GENERAL_SAFETY'
);

-- CreateEnum
CREATE TYPE "StopCardSeverity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- CreateEnum
CREATE TYPE "StopCardStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'CLOSED',
    'ARCHIVED'
);

-- CreateTable
CREATE TABLE "StopCard" (
    "id" TEXT NOT NULL,
    "observationDate" DATE NOT NULL,
    "category" "StopCardCategory" NOT NULL,
    "severity" "StopCardSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "StopCardStatus" NOT NULL DEFAULT 'OPEN',
    "mineId" TEXT,
    "equipmentId" TEXT,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "correctiveAction" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StopCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StopCard_observationDate_idx" ON "StopCard"("observationDate");

-- CreateIndex
CREATE INDEX "StopCard_category_idx" ON "StopCard"("category");

-- CreateIndex
CREATE INDEX "StopCard_severity_idx" ON "StopCard"("severity");

-- CreateIndex
CREATE INDEX "StopCard_status_idx" ON "StopCard"("status");

-- CreateIndex
CREATE INDEX "StopCard_mineId_idx" ON "StopCard"("mineId");

-- CreateIndex
CREATE INDEX "StopCard_equipmentId_idx" ON "StopCard"("equipmentId");

-- AddForeignKey
ALTER TABLE "StopCard" ADD CONSTRAINT "StopCard_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopCard" ADD CONSTRAINT "StopCard_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
