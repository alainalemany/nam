-- AlterEnum
ALTER TYPE "DailyLogActivityType" ADD VALUE 'SUPPLY_REQUEST';

-- CreateEnum
CREATE TYPE "SupplyRequestDailyLogRole" AS ENUM ('SUBMISSION', 'FULFILLMENT');

-- CreateTable
CREATE TABLE "SupplyRequestDailyLogLink" (
    "id" TEXT NOT NULL,
    "supplyRequestId" TEXT NOT NULL,
    "dailyLogActivityId" TEXT NOT NULL,
    "role" "SupplyRequestDailyLogRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyRequestDailyLogLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestDailyLogLink_activity_key" ON "SupplyRequestDailyLogLink"("dailyLogActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequestDailyLogLink_request_role_key" ON "SupplyRequestDailyLogLink"("supplyRequestId", "role");

-- AddForeignKey
ALTER TABLE "SupplyRequestDailyLogLink"
ADD CONSTRAINT "SupplyRequestDailyLogLink_request_fkey"
FOREIGN KEY ("supplyRequestId") REFERENCES "SupplyRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestDailyLogLink"
ADD CONSTRAINT "SupplyRequestDailyLogLink_activity_fkey"
FOREIGN KEY ("dailyLogActivityId") REFERENCES "DailyLogActivity"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
