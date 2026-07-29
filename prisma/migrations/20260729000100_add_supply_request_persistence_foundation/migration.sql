-- CreateEnum
CREATE TYPE "SupplyRequestStatus" AS ENUM ('REQUESTED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplyRequestVersionChangeKind" AS ENUM ('CREATED', 'FULFILLED', 'CANCELLED', 'CORRECTED');

-- CreateTable
CREATE TABLE "SupplyItem" (
    "id" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "normalizedItemNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequestSupervisor" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequestSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequestReferenceCounter" (
    "referenceYear" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequestReferenceCounter_pkey" PRIMARY KEY ("referenceYear")
);

-- CreateTable
CREATE TABLE "SupplyRequest" (
    "id" TEXT NOT NULL,
    "namReference" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceSequence" INTEGER NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequestVersion" (
    "id" TEXT NOT NULL,
    "supplyRequestId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeKind" "SupplyRequestVersionChangeKind" NOT NULL,
    "status" "SupplyRequestStatus" NOT NULL,
    "operationalWorkDate" DATE NOT NULL,
    "submittedLocalDate" DATE NOT NULL,
    "submittedLocalTime" TEXT NOT NULL,
    "equipmentId" TEXT,
    "equipmentDisplayNameSnapshot" TEXT NOT NULL,
    "equipmentNumberSnapshot" TEXT,
    "equipmentCategorySnapshot" "EquipmentCategory" NOT NULL,
    "mineNameSnapshot" TEXT NOT NULL,
    "cityNameSnapshot" TEXT NOT NULL,
    "cityStateSnapshot" TEXT,
    "requesterDisplayNameSnapshot" TEXT NOT NULL,
    "requesterEmployeeNumberSnapshot" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "supervisorNameSnapshot" TEXT NOT NULL,
    "supervisorEmailSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "fulfillmentOperationalWorkDate" DATE,
    "fulfilledLocalDate" DATE,
    "fulfilledLocalTime" TEXT,
    "fulfillmentNote" TEXT,
    "cancelledLocalDate" DATE,
    "cancelledLocalTime" TEXT,
    "cancellationReason" TEXT,
    "correctionReason" TEXT,
    "correctedByDisplayNameSnapshot" TEXT,
    "correctionLocalDate" DATE,
    "correctionLocalTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyRequestVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequestVersionItem" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "supplyItemId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "itemNumberSnapshot" TEXT NOT NULL,
    "normalizedItemNumberSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "unitOfMeasureSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyRequestVersionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplyItem_normalizedItemNumber_key" ON "SupplyItem"("normalizedItemNumber");

-- CreateIndex
CREATE INDEX "SupplyItem_active_idx" ON "SupplyItem"("active");

-- CreateIndex
CREATE INDEX "SupplyItem_itemNumber_idx" ON "SupplyItem"("itemNumber");

-- CreateIndex
CREATE INDEX "SupplyItem_description_idx" ON "SupplyItem"("description");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestSupervisor_normalizedEmail_key" ON "SupplyRequestSupervisor"("normalizedEmail");

-- CreateIndex
CREATE INDEX "SupplyRequestSupervisor_active_idx" ON "SupplyRequestSupervisor"("active");

-- CreateIndex
CREATE INDEX "SupplyRequestSupervisor_fullName_idx" ON "SupplyRequestSupervisor"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequest_namReference_key" ON "SupplyRequest"("namReference");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequest_year_sequence_key" ON "SupplyRequest"("referenceYear", "referenceSequence");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequest_current_owner_key" ON "SupplyRequest"("currentVersionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestVersion_request_version_key" ON "SupplyRequestVersion"("supplyRequestId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestVersion_id_request_key" ON "SupplyRequestVersion"("id", "supplyRequestId");

-- CreateIndex
CREATE INDEX "SupplyRequestVersion_workDate_idx" ON "SupplyRequestVersion"("operationalWorkDate");

-- CreateIndex
CREATE INDEX "SupplyRequestVersion_status_idx" ON "SupplyRequestVersion"("status");

-- CreateIndex
CREATE INDEX "SupplyRequestVersion_equipment_idx" ON "SupplyRequestVersion"("equipmentId");

-- CreateIndex
CREATE INDEX "SupplyRequestVersion_supervisor_idx" ON "SupplyRequestVersion"("supervisorId");

-- CreateIndex
CREATE INDEX "SupplyRequestVersion_submitted_idx" ON "SupplyRequestVersion"("submittedLocalDate", "submittedLocalTime");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestVersionItem_version_sequence_key" ON "SupplyRequestVersionItem"("versionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestVersionItem_version_item_key" ON "SupplyRequestVersionItem"("versionId", "supplyItemId");

-- CreateIndex
CREATE INDEX "SupplyRequestVersionItem_supplyItem_idx" ON "SupplyRequestVersionItem"("supplyItemId");

-- AddForeignKey
ALTER TABLE "SupplyRequestVersion"
ADD CONSTRAINT "SupplyRequestVersion_request_fkey"
FOREIGN KEY ("supplyRequestId") REFERENCES "SupplyRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestVersion"
ADD CONSTRAINT "SupplyRequestVersion_equipment_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestVersion"
ADD CONSTRAINT "SupplyRequestVersion_supervisor_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "SupplyRequestSupervisor"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestVersionItem"
ADD CONSTRAINT "SupplyRequestVersionItem_version_fkey"
FOREIGN KEY ("versionId") REFERENCES "SupplyRequestVersion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestVersionItem"
ADD CONSTRAINT "SupplyRequestVersionItem_supplyItem_fkey"
FOREIGN KEY ("supplyItemId") REFERENCES "SupplyItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest"
ADD CONSTRAINT "SupplyRequest_currentVersion_owner_fkey"
FOREIGN KEY ("currentVersionId", "id")
REFERENCES "SupplyRequestVersion"("id", "supplyRequestId")
ON DELETE RESTRICT ON UPDATE CASCADE;
