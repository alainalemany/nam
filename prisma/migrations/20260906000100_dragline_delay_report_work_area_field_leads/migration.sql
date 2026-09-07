-- DDR Work Area, Cut Context, and Field Lead refinements.
CREATE TYPE "DraglineDelayReportCutType" AS ENUM (
    'PRODUCTION',
    'KEY_CUT',
    'FACE_CUT',
    'BOX_CUT',
    'EXTENDED_KEY_CUT',
    'OTHER'
);

ALTER TABLE "DraglineDelayReport"
ADD COLUMN "cutType" "DraglineDelayReportCutType",
ADD COLUMN "cutNote" TEXT,
ADD COLUMN "dayShiftFieldLeadId" TEXT,
ADD COLUMN "dayShiftFieldLeadDisplayName" TEXT,
ADD COLUMN "dayShiftFieldLeadEmployeeCode" TEXT,
ADD COLUMN "nightShiftFieldLeadId" TEXT,
ADD COLUMN "nightShiftFieldLeadDisplayName" TEXT,
ADD COLUMN "nightShiftFieldLeadEmployeeCode" TEXT,
ADD CONSTRAINT "DraglineDelayReport_cut_note_check"
CHECK (
  "cutNote" IS NULL
  OR (char_length("cutNote") BETWEEN 1 AND 1000 AND "cutNote" ~ '[^[:space:]]')
);

-- Station Start and Station End are independently optional. Their individual
-- nonnegative checks remain in place; only the obsolete pair constraint is removed.
ALTER TABLE "DraglineDelayReport"
DROP CONSTRAINT "DraglineDelayReport_station_pair_check";

CREATE INDEX "DraglineDelayReport_day_shift_field_lead_idx"
ON "DraglineDelayReport"("dayShiftFieldLeadId");

CREATE INDEX "DraglineDelayReport_night_shift_field_lead_idx"
ON "DraglineDelayReport"("nightShiftFieldLeadId");

ALTER TABLE "DraglineDelayReport"
ADD CONSTRAINT "DraglineDelayReport_day_shift_field_lead_fkey"
FOREIGN KEY ("dayShiftFieldLeadId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReport"
ADD CONSTRAINT "DraglineDelayReport_night_shift_field_lead_fkey"
FOREIGN KEY ("nightShiftFieldLeadId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
