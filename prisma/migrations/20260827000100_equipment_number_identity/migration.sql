-- Equipment display names are descriptive and may repeat. A supplied Equipment
-- Number is the operational identity and must be unique across Equipment.
DROP INDEX "Equipment_mineId_displayName_key";

CREATE UNIQUE INDEX "Equipment_equipmentNumber_key"
ON "Equipment"("equipmentNumber");
