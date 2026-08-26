ALTER TABLE "DraglineDelayReport"
DROP CONSTRAINT "DraglineDelayReport_station_pair_check";

ALTER TABLE "DraglineDelayReport"
ADD CONSTRAINT "DraglineDelayReport_station_pair_check"
CHECK ("stationEndFeet" IS NULL OR "stationStartFeet" IS NOT NULL);
