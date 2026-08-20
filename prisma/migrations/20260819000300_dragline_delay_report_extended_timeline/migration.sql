ALTER TABLE "DraglineDelayReportTimelineEntry"
DROP CONSTRAINT "DraglineDelayReportTimeline_start_check";

ALTER TABLE "DraglineDelayReportTimelineEntry"
ADD CONSTRAINT "DraglineDelayReportTimeline_start_check"
CHECK ("startMinuteOffset" BETWEEN 0 AND 2879);
