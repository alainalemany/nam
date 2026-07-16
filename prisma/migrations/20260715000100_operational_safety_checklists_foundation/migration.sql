-- CreateEnum
CREATE TYPE "OperationalSafetyChecklistTemplate" AS ENUM ('DRAGLINE_INSPECTION', 'MOBILE_INSPECTION');

-- CreateEnum
CREATE TYPE "OperationalSafetyChecklistMeterKind" AS ENUM ('HOURS');

-- CreateEnum
CREATE TYPE "OperationalSafetyChecklistItemSection" AS ENUM ('METADATA', 'INSPECTION');

-- CreateEnum
CREATE TYPE "OperationalSafetyChecklistResponseSet" AS ENUM ('CONDITION_FOUR', 'CONDITION_THREE', 'YES_NO', 'PRESENCE_THREE');

-- CreateEnum
CREATE TYPE "OperationalSafetyChecklistResponseCode" AS ENUM ('OK', 'NEEDS_REPAIR', 'PREVIOUSLY_NOTED', 'NOT_APPLICABLE', 'YES', 'NO', 'PRESENT', 'NOT_PRESENT');

-- CreateTable
CREATE TABLE "OperationalSafetyChecklist" (
    "id" TEXT NOT NULL,
    "inspectionDate" DATE NOT NULL,
    "shift" "ShiftType" NOT NULL,
    "equipmentId" TEXT,
    "equipmentDisplayName" TEXT NOT NULL,
    "equipmentNumber" TEXT,
    "equipmentCategory" "EquipmentCategory" NOT NULL,
    "mineName" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "cityState" TEXT,
    "templateKey" "OperationalSafetyChecklistTemplate" NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templateName" TEXT NOT NULL,
    "meterKind" "OperationalSafetyChecklistMeterKind" NOT NULL,
    "startingMeter" INTEGER NOT NULL,
    "operatorDisplayName" TEXT NOT NULL,
    "supervisorDisplayName" TEXT NOT NULL,
    "problemDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalSafetyChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalSafetyChecklistResponse" (
    "id" TEXT NOT NULL,
    "operationalSafetyChecklistId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "itemOrder" INTEGER NOT NULL,
    "itemSection" "OperationalSafetyChecklistItemSection" NOT NULL,
    "requiredMarker" TEXT,
    "responseSet" "OperationalSafetyChecklistResponseSet" NOT NULL,
    "responseCode" "OperationalSafetyChecklistResponseCode" NOT NULL,
    "responseLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalSafetyChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SafetyChecklist_equipment_date_shift_key" ON "OperationalSafetyChecklist"("equipmentId", "inspectionDate", "shift");

-- CreateIndex
CREATE INDEX "SafetyChecklist_date_idx" ON "OperationalSafetyChecklist"("inspectionDate");

-- CreateIndex
CREATE INDEX "SafetyChecklist_shift_idx" ON "OperationalSafetyChecklist"("shift");

-- CreateIndex
CREATE INDEX "SafetyChecklist_equipment_idx" ON "OperationalSafetyChecklist"("equipmentId");

-- CreateIndex
CREATE INDEX "SafetyChecklist_template_idx" ON "OperationalSafetyChecklist"("templateKey");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyChecklistResponse_parent_item_key" ON "OperationalSafetyChecklistResponse"("operationalSafetyChecklistId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyChecklistResponse_parent_order_key" ON "OperationalSafetyChecklistResponse"("operationalSafetyChecklistId", "itemOrder");

-- CreateIndex
CREATE INDEX "SafetyChecklistResponse_code_idx" ON "OperationalSafetyChecklistResponse"("responseCode");

-- CreateIndex
CREATE INDEX "SafetyChecklistResponse_item_idx" ON "OperationalSafetyChecklistResponse"("itemKey");

-- AddForeignKey
ALTER TABLE "OperationalSafetyChecklist" ADD CONSTRAINT "SafetyChecklist_equipment_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSafetyChecklistResponse" ADD CONSTRAINT "SafetyChecklistResponse_parent_fkey" FOREIGN KEY ("operationalSafetyChecklistId") REFERENCES "OperationalSafetyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
