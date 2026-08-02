-- AddColumns
ALTER TABLE "KnowledgeRecordRevision"
  ADD COLUMN "sourceDailyLogId" TEXT,
  ADD COLUMN "sourceDailyLogDateSnapshot" DATE,
  ADD COLUMN "sourceDailyLogShiftSnapshot" "ShiftType",
  ADD COLUMN "relatedDefectId" TEXT,
  ADD COLUMN "relatedDefectTitleSnapshot" TEXT,
  ADD COLUMN "relatedDefectReportedDateSnapshot" DATE;

-- AddConstraints
ALTER TABLE "KnowledgeRecordRevision"
  ADD CONSTRAINT "KnowledgeRevision_sourceDailyLog_shape_check"
  CHECK (
    (
      "sourceDailyLogId" IS NULL
      AND "sourceDailyLogDateSnapshot" IS NULL
      AND "sourceDailyLogShiftSnapshot" IS NULL
    )
    OR (
      "sourceDailyLogDateSnapshot" IS NOT NULL
      AND "sourceDailyLogShiftSnapshot" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "KnowledgeRevision_relatedDefect_shape_check"
  CHECK (
    (
      "relatedDefectId" IS NULL
      AND "relatedDefectTitleSnapshot" IS NULL
      AND "relatedDefectReportedDateSnapshot" IS NULL
    )
    OR (
      "relatedDefectTitleSnapshot" IS NOT NULL
      AND "relatedDefectTitleSnapshot" ~ '[^[:space:]]'
      AND char_length("relatedDefectTitleSnapshot") <= 200
      AND "relatedDefectReportedDateSnapshot" IS NOT NULL
    )
  );

-- CreateIndexes
CREATE INDEX "KnowledgeRevision_sourceDailyLog_idx"
  ON "KnowledgeRecordRevision"("sourceDailyLogId");

CREATE INDEX "KnowledgeRevision_relatedDefect_idx"
  ON "KnowledgeRecordRevision"("relatedDefectId");

-- AddForeignKeys
ALTER TABLE "KnowledgeRecordRevision"
  ADD CONSTRAINT "KnowledgeRecordRevision_sourceDailyLog_fkey"
  FOREIGN KEY ("sourceDailyLogId") REFERENCES "DailyLog"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRecordRevision"
  ADD CONSTRAINT "KnowledgeRecordRevision_relatedDefect_fkey"
  FOREIGN KEY ("relatedDefectId") REFERENCES "Defect"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
