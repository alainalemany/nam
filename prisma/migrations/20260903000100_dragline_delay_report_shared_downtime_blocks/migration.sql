-- Additive DDR Shared Downtime Blocks: one downtime interval with ordered coded activities.
CREATE TABLE "DraglineDelayReportDowntimeBlock" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startMinuteOffset" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraglineDelayReportDowntimeBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReportDowntimeBlock_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "DraglineDelayReportDowntimeBlock_start_check" CHECK ("startMinuteOffset" BETWEEN 0 AND 2879),
    CONSTRAINT "DraglineDelayReportDowntimeBlock_duration_check" CHECK ("durationMinutes" > 0),
    CONSTRAINT "DraglineDelayReportDowntimeBlock_description_check" CHECK ("description" IS NULL OR (char_length("description") BETWEEN 1 AND 1000 AND "description" ~ '[^[:space:]]'))
);

CREATE TABLE "DraglineDelayReportDowntimeBlockActivity" (
    "id" TEXT NOT NULL,
    "downtimeBlockId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "delayCodeCatalogVersion" INTEGER NOT NULL,
    "delayCode" TEXT NOT NULL,
    "delayCodeDescription" TEXT NOT NULL,
    "delayCodeCategory" "DraglineDelayCodeCategory" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_catalog_check" CHECK ("delayCodeCatalogVersion" > 0),
    CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_shift_change_check" CHECK ("delayCode" <> '13'),
    CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_description_check" CHECK ("description" IS NULL OR (char_length("description") BETWEEN 1 AND 1000 AND "description" ~ '[^[:space:]]'))
);

CREATE UNIQUE INDEX "DraglineDelayReportDowntimeBlock_report_sequence_key"
ON "DraglineDelayReportDowntimeBlock"("reportId", "sequence");
CREATE INDEX "DraglineDelayReportDowntimeBlock_chronology_idx"
ON "DraglineDelayReportDowntimeBlock"("reportId", "startMinuteOffset", "sequence");
CREATE UNIQUE INDEX "DraglineDelayReportDowntimeBlockActivity_block_sequence_key"
ON "DraglineDelayReportDowntimeBlockActivity"("downtimeBlockId", "sequence");
CREATE INDEX "DraglineDelayReportDowntimeBlockActivity_code_idx"
ON "DraglineDelayReportDowntimeBlockActivity"("delayCode");

ALTER TABLE "DraglineDelayReportDowntimeBlock"
ADD CONSTRAINT "DraglineDelayReportDowntimeBlock_report_fkey"
FOREIGN KEY ("reportId") REFERENCES "DraglineDelayReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReportDowntimeBlockActivity"
ADD CONSTRAINT "DraglineDelayReportDowntimeBlockActivity_block_fkey"
FOREIGN KEY ("downtimeBlockId") REFERENCES "DraglineDelayReportDowntimeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
