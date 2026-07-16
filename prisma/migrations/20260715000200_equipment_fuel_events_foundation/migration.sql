-- CreateEnum
CREATE TYPE "EquipmentFuelType" AS ENUM ('DIESEL', 'OFF_ROAD_DIESEL', 'GASOLINE');

-- CreateTable
CREATE TABLE "FuelServicePerson" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelServicePerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentFuelEvent" (
    "id" TEXT NOT NULL,
    "operationalWorkDate" DATE NOT NULL,
    "eventTime" TEXT NOT NULL,
    "equipmentId" TEXT,
    "equipmentDisplayName" TEXT NOT NULL,
    "equipmentNumber" TEXT,
    "equipmentCategory" "EquipmentCategory" NOT NULL,
    "mineName" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "cityState" TEXT,
    "fuelType" "EquipmentFuelType" NOT NULL,
    "totalGallons" INTEGER NOT NULL,
    "fuelServicePersonId" TEXT,
    "fuelServicePersonDisplayNameSnapshot" TEXT,
    "dailyLogActivityId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentFuelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentFuelEventTankFill" (
    "id" TEXT NOT NULL,
    "equipmentFuelEventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "tankLabel" TEXT NOT NULL,
    "normalizedTankLabel" TEXT NOT NULL,
    "gallons" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentFuelEventTankFill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuelServicePerson_normalizedKey_key" ON "FuelServicePerson"("normalizedKey");

-- CreateIndex
CREATE INDEX "FuelServicePerson_active_idx" ON "FuelServicePerson"("active");

-- CreateIndex
CREATE INDEX "FuelServicePerson_displayName_idx" ON "FuelServicePerson"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "FuelEvent_dailyLogActivity_key" ON "EquipmentFuelEvent"("dailyLogActivityId");

-- CreateIndex
CREATE INDEX "FuelEvent_workDate_idx" ON "EquipmentFuelEvent"("operationalWorkDate");

-- CreateIndex
CREATE INDEX "FuelEvent_equipment_idx" ON "EquipmentFuelEvent"("equipmentId");

-- CreateIndex
CREATE INDEX "FuelEvent_fuelType_idx" ON "EquipmentFuelEvent"("fuelType");

-- CreateIndex
CREATE INDEX "FuelEvent_servicePerson_idx" ON "EquipmentFuelEvent"("fuelServicePersonId");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTankFill_event_sequence_key" ON "EquipmentFuelEventTankFill"("equipmentFuelEventId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTankFill_event_label_key" ON "EquipmentFuelEventTankFill"("equipmentFuelEventId", "normalizedTankLabel");

-- CreateIndex
CREATE INDEX "FuelTankFill_event_idx" ON "EquipmentFuelEventTankFill"("equipmentFuelEventId");

-- AddForeignKey
ALTER TABLE "EquipmentFuelEvent" ADD CONSTRAINT "FuelEvent_equipment_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFuelEvent" ADD CONSTRAINT "FuelEvent_servicePerson_fkey" FOREIGN KEY ("fuelServicePersonId") REFERENCES "FuelServicePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFuelEvent" ADD CONSTRAINT "FuelEvent_dailyLogActivity_fkey" FOREIGN KEY ("dailyLogActivityId") REFERENCES "DailyLogActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFuelEventTankFill" ADD CONSTRAINT "FuelTankFill_event_fkey" FOREIGN KEY ("equipmentFuelEventId") REFERENCES "EquipmentFuelEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
