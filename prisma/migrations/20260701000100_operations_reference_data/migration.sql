-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM (
    'DRAGLINE',
    'TRACTOR',
    'FORKLIFT',
    'WORK_TRUCK',
    'CABLE_SYSTEM',
    'CABLE_POLE',
    'CABLE_HANDLING_TOOL',
    'SUPPORT_TOOL',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "EquipmentPowerType" AS ENUM (
    'ELECTRIC',
    'DIESEL',
    'GASOLINE',
    'HYBRID',
    'OTHER',
    'UNKNOWN'
);

-- CreateEnum
CREATE TYPE "EquipmentInstrumentationType" AS ENUM (
    'DIGITAL_ALARM_SCREEN',
    'SENSOR_DISPLAY',
    'PHYSICAL_GAUGES',
    'OPERATOR_OBSERVED',
    'MIXED',
    'UNKNOWN'
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mine" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "parentEquipmentId" TEXT,
    "equipmentNumber" TEXT,
    "displayName" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "powerType" "EquipmentPowerType",
    "instrumentationType" "EquipmentInstrumentationType",
    "hasDigitalAlarmScreen" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_name_state_key" ON "City"("name", "state");

-- CreateIndex
CREATE INDEX "City_status_idx" ON "City"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Mine_cityId_name_key" ON "Mine"("cityId", "name");

-- CreateIndex
CREATE INDEX "Mine_status_idx" ON "Mine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_mineId_displayName_key" ON "Equipment"("mineId", "displayName");

-- CreateIndex
CREATE INDEX "Equipment_mineId_idx" ON "Equipment"("mineId");

-- CreateIndex
CREATE INDEX "Equipment_category_idx" ON "Equipment"("category");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- AddForeignKey
ALTER TABLE "Mine" ADD CONSTRAINT "Mine_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_mineId_fkey" FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_parentEquipmentId_fkey" FOREIGN KEY ("parentEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
