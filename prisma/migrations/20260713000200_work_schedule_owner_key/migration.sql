-- Add normalized owner key for Work Schedule uniqueness.
ALTER TABLE "WeeklySchedule" ADD COLUMN "primaryEmployeeKey" TEXT;

UPDATE "WeeklySchedule"
SET "primaryEmployeeKey" = lower(regexp_replace(trim("primaryEmployeeDisplayName"), '[[:space:]]+', ' ', 'g'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "WeeklySchedule"
    GROUP BY "weekStartDate", "primaryEmployeeKey"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Work Schedule owner/week combinations exist after normalization.';
  END IF;
END $$;

ALTER TABLE "WeeklySchedule" ALTER COLUMN "primaryEmployeeKey" SET NOT NULL;

DROP INDEX "WeeklySchedule_weekStartDate_primaryEmployeeDisplayName_key";

CREATE UNIQUE INDEX "WeeklySchedule_weekStartDate_primaryEmployeeKey_key"
ON "WeeklySchedule"("weekStartDate", "primaryEmployeeKey");
