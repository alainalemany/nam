-- DDR-2: canonical Lake reference and Draft production/end-of-shift facts.
CREATE TABLE "Lake" (
    "id" TEXT NOT NULL,
    "mineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lake_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Lake_name_check" CHECK (char_length("name") BETWEEN 1 AND 120 AND "name" ~ '[^[:space:]]'),
    CONSTRAINT "Lake_notes_check" CHECK ("notes" IS NULL OR (char_length("notes") BETWEEN 1 AND 1000 AND "notes" ~ '[^[:space:]]'))
);

ALTER TABLE "DraglineDelayReport"
ADD COLUMN "lakeId" TEXT,
ADD COLUMN "lakeDisplayNameSnapshot" TEXT,
ADD COLUMN "normalDiggingBuckets" INTEGER,
ADD COLUMN "benchfillBuckets" INTEGER,
ADD COLUMN "stationStartFeet" INTEGER,
ADD COLUMN "stationEndFeet" INTEGER,
ADD COLUMN "depthFeet" INTEGER,
ADD COLUMN "fuelGallons" INTEGER,
ADD COLUMN "cableDragFeet" INTEGER,
ADD COLUMN "hoistFeet" INTEGER,
ADD COLUMN "comments" TEXT,
ADD COLUMN "safetyItemsFound" TEXT,
ADD COLUMN "actionTaken" TEXT,
ADD CONSTRAINT "DraglineDelayReport_normal_buckets_check" CHECK ("normalDiggingBuckets" IS NULL OR "normalDiggingBuckets" >= 0),
ADD CONSTRAINT "DraglineDelayReport_benchfill_buckets_check" CHECK ("benchfillBuckets" IS NULL OR "benchfillBuckets" >= 0),
ADD CONSTRAINT "DraglineDelayReport_station_pair_check" CHECK (("stationStartFeet" IS NULL) = ("stationEndFeet" IS NULL)),
ADD CONSTRAINT "DraglineDelayReport_station_start_check" CHECK ("stationStartFeet" IS NULL OR "stationStartFeet" >= 0),
ADD CONSTRAINT "DraglineDelayReport_station_end_check" CHECK ("stationEndFeet" IS NULL OR "stationEndFeet" >= 0),
ADD CONSTRAINT "DraglineDelayReport_depth_check" CHECK ("depthFeet" IS NULL OR "depthFeet" >= 0),
ADD CONSTRAINT "DraglineDelayReport_fuel_check" CHECK ("fuelGallons" IS NULL OR "fuelGallons" >= 0),
ADD CONSTRAINT "DraglineDelayReport_cable_drag_check" CHECK ("cableDragFeet" IS NULL OR "cableDragFeet" >= 0),
ADD CONSTRAINT "DraglineDelayReport_hoist_check" CHECK ("hoistFeet" IS NULL OR "hoistFeet" >= 0),
ADD CONSTRAINT "DraglineDelayReport_comments_check" CHECK ("comments" IS NULL OR (char_length("comments") BETWEEN 1 AND 5000 AND "comments" ~ '[^[:space:]]')),
ADD CONSTRAINT "DraglineDelayReport_safety_items_check" CHECK ("safetyItemsFound" IS NULL OR (char_length("safetyItemsFound") BETWEEN 1 AND 5000 AND "safetyItemsFound" ~ '[^[:space:]]')),
ADD CONSTRAINT "DraglineDelayReport_action_taken_check" CHECK ("actionTaken" IS NULL OR (char_length("actionTaken") BETWEEN 1 AND 5000 AND "actionTaken" ~ '[^[:space:]]'));

CREATE TABLE "DraglineDelayReportGroundCheck" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startMinuteOffset" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraglineDelayReportGroundCheck_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReportGroundCheck_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "DraglineDelayReportGroundCheck_start_check" CHECK ("startMinuteOffset" BETWEEN 0 AND 1799)
);

CREATE UNIQUE INDEX "Lake_mine_name_key" ON "Lake"("mineId", "name");
CREATE INDEX "Lake_mine_idx" ON "Lake"("mineId");
CREATE INDEX "Lake_status_idx" ON "Lake"("status");
CREATE INDEX "DraglineDelayReport_lake_idx" ON "DraglineDelayReport"("lakeId");
CREATE UNIQUE INDEX "DraglineDelayReportGroundCheck_report_sequence_key"
ON "DraglineDelayReportGroundCheck"("reportId", "sequence");
CREATE INDEX "DraglineDelayReportGroundCheck_chronology_idx"
ON "DraglineDelayReportGroundCheck"("reportId", "startMinuteOffset", "sequence");

ALTER TABLE "Lake"
ADD CONSTRAINT "Lake_mine_fkey"
FOREIGN KEY ("mineId") REFERENCES "Mine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReport"
ADD CONSTRAINT "DraglineDelayReport_lake_fkey"
FOREIGN KEY ("lakeId") REFERENCES "Lake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReportGroundCheck"
ADD CONSTRAINT "DraglineDelayReportGroundCheck_report_fkey"
FOREIGN KEY ("reportId") REFERENCES "DraglineDelayReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
