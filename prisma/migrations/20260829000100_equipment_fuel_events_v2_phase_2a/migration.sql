-- CreateEnum
CREATE TYPE "EquipmentFuelMeterType" AS ENUM ('HOURS', 'ODOMETER', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "GasStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "address" TEXT,
    "cityId" TEXT NOT NULL,
    "postalCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GasStation_pkey" PRIMARY KEY ("id")
);

-- AlterTable: existing INTEGER gallon values convert exactly to scale-three Decimal.
ALTER TABLE "EquipmentFuelEvent"
    ALTER COLUMN "totalGallons" TYPE DECIMAL(12,3)
        USING "totalGallons"::DECIMAL(12,3),
    ADD COLUMN "gasStationId" TEXT,
    ADD COLUMN "gasStationNameSnapshot" TEXT,
    ADD COLUMN "gasStationAddressSnapshot" TEXT,
    ADD COLUMN "gasStationCitySnapshot" TEXT,
    ADD COLUMN "gasStationStateSnapshot" TEXT,
    ADD COLUMN "gasStationPostalCodeSnapshot" TEXT,
    ADD COLUMN "pricePerGallon" DECIMAL(10,3),
    ADD COLUMN "totalCost" DECIMAL(14,2),
    ADD COLUMN "meterType" "EquipmentFuelMeterType",
    ADD COLUMN "meterReading" DECIMAL(14,3),
    ADD COLUMN "receiptReference" TEXT;

ALTER TABLE "EquipmentFuelEventTankFill"
    ALTER COLUMN "gallons" TYPE DECIMAL(12,3)
        USING "gallons"::DECIMAL(12,3);

-- CreateIndex
CREATE UNIQUE INDEX "GasStation_normalizedKey_key" ON "GasStation"("normalizedKey");
CREATE INDEX "GasStation_city_idx" ON "GasStation"("cityId");
CREATE INDEX "GasStation_isActive_idx" ON "GasStation"("isActive");
CREATE INDEX "GasStation_name_idx" ON "GasStation"("name");
CREATE INDEX "FuelEvent_gasStation_idx" ON "EquipmentFuelEvent"("gasStationId");

-- AddForeignKey
ALTER TABLE "GasStation" ADD CONSTRAINT "GasStation_city_fkey"
    FOREIGN KEY ("cityId") REFERENCES "City"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquipmentFuelEvent" ADD CONSTRAINT "FuelEvent_gasStation_fkey"
    FOREIGN KEY ("gasStationId") REFERENCES "GasStation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
