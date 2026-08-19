-- DDR-3: explicit completion and lightweight completed-report correction history.
ALTER TABLE "DraglineDelayReport"
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD CONSTRAINT "DraglineDelayReport_completion_state_check"
CHECK (
  ("status" = 'DRAFT' AND "completedAt" IS NULL)
  OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
);

CREATE TABLE "DraglineDelayReportCorrection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "previousRecordVersion" INTEGER NOT NULL,
    "resultingRecordVersion" INTEGER NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraglineDelayReportCorrection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReportCorrection_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "DraglineDelayReportCorrection_reason_check" CHECK (char_length("reason") BETWEEN 1 AND 1000 AND "reason" ~ '[^[:space:]]'),
    CONSTRAINT "DraglineDelayReportCorrection_version_check" CHECK ("previousRecordVersion" > 0 AND "resultingRecordVersion" = "previousRecordVersion" + 1)
);

CREATE UNIQUE INDEX "DraglineDelayReportCorrection_report_sequence_key"
ON "DraglineDelayReportCorrection"("reportId", "sequence");

CREATE UNIQUE INDEX "DraglineDelayReportCorrection_report_version_key"
ON "DraglineDelayReportCorrection"("reportId", "resultingRecordVersion");

ALTER TABLE "DraglineDelayReportCorrection"
ADD CONSTRAINT "DraglineDelayReportCorrection_report_fkey"
FOREIGN KEY ("reportId") REFERENCES "DraglineDelayReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
