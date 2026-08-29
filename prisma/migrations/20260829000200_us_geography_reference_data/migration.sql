-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- AlterTable: nullable canonical fields preserve every existing City row and ID.
ALTER TABLE "City"
    ADD COLUMN "stateId" TEXT,
    ADD COLUMN "normalizedKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "State_abbreviation_key" ON "State"("abbreviation");
CREATE UNIQUE INDEX "State_normalizedKey_key" ON "State"("normalizedKey");
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");
CREATE INDEX "State_status_idx" ON "State"("status");
CREATE UNIQUE INDEX "City_stateId_normalizedKey_key" ON "City"("stateId", "normalizedKey");
CREATE INDEX "City_stateId_idx" ON "City"("stateId");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_stateId_fkey"
    FOREIGN KEY ("stateId") REFERENCES "State"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
