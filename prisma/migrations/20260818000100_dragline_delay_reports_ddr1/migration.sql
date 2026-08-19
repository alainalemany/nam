-- DDR-1: independent Draft Dragline Delay Report persistence.
CREATE TYPE "DraglineDelayReportStatus" AS ENUM ('DRAFT', 'COMPLETED');
CREATE TYPE "DraglineDelayCodeCategory" AS ENUM ('OPERATIONAL', 'MECHANICAL', 'ELECTRICAL');

CREATE TABLE "DraglineDelayReport" (
    "id" TEXT NOT NULL,
    "status" "DraglineDelayReportStatus" NOT NULL DEFAULT 'DRAFT',
    "operationalWorkDate" DATE NOT NULL,
    "shift" "ShiftType" NOT NULL,
    "equipmentId" TEXT,
    "equipmentDisplayName" TEXT NOT NULL,
    "equipmentNumber" TEXT,
    "equipmentCategory" "EquipmentCategory" NOT NULL,
    "mineName" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "cityState" TEXT,
    "startingHourMeter" INTEGER NOT NULL,
    "endingHourMeter" INTEGER,
    "supervisorId" TEXT,
    "supervisorDisplayName" TEXT,
    "supervisorEmployeeCode" TEXT,
    "downTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "runTimeMinutes" INTEGER NOT NULL DEFAULT 720,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraglineDelayReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReport_shift_check" CHECK ("shift" IN ('DAY', 'NIGHT')),
    CONSTRAINT "DraglineDelayReport_starting_meter_check" CHECK ("startingHourMeter" >= 0),
    CONSTRAINT "DraglineDelayReport_ending_meter_check" CHECK ("endingHourMeter" IS NULL OR "endingHourMeter" >= 0),
    CONSTRAINT "DraglineDelayReport_down_time_check" CHECK ("downTimeMinutes" BETWEEN 0 AND 720),
    CONSTRAINT "DraglineDelayReport_run_time_check" CHECK ("runTimeMinutes" BETWEEN 0 AND 720),
    CONSTRAINT "DraglineDelayReport_shift_total_check" CHECK ("downTimeMinutes" + "runTimeMinutes" = 720),
    CONSTRAINT "DraglineDelayReport_record_version_check" CHECK ("recordVersion" > 0)
);

CREATE TABLE "DraglineDelayReportOperator" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "employeeId" TEXT,
    "employeeDisplayName" TEXT NOT NULL,
    "employeeCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraglineDelayReportOperator_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReportOperator_sequence_check" CHECK ("sequence" > 0)
);

CREATE TABLE "DraglineDelayReportTimelineEntry" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startMinuteOffset" INTEGER NOT NULL,
    "delayCodeCatalogVersion" INTEGER NOT NULL,
    "delayCode" TEXT NOT NULL,
    "delayCodeDescription" TEXT NOT NULL,
    "delayCodeCategory" "DraglineDelayCodeCategory" NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER,
    "causesDowntime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraglineDelayReportTimelineEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DraglineDelayReportTimeline_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "DraglineDelayReportTimeline_start_check" CHECK ("startMinuteOffset" BETWEEN 0 AND 1799),
    CONSTRAINT "DraglineDelayReportTimeline_catalog_check" CHECK ("delayCodeCatalogVersion" > 0),
    CONSTRAINT "DraglineDelayReportTimeline_duration_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0),
    CONSTRAINT "DraglineDelayReportTimeline_downtime_check" CHECK (NOT "causesDowntime" OR "durationMinutes" IS NOT NULL)
);

CREATE UNIQUE INDEX "DraglineDelayReport_equipment_date_shift_key"
ON "DraglineDelayReport"("equipmentId", "operationalWorkDate", "shift");
CREATE INDEX "DraglineDelayReport_workDate_idx" ON "DraglineDelayReport"("operationalWorkDate");
CREATE INDEX "DraglineDelayReport_status_idx" ON "DraglineDelayReport"("status");
CREATE INDEX "DraglineDelayReport_supervisor_idx" ON "DraglineDelayReport"("supervisorId");

CREATE UNIQUE INDEX "DraglineDelayReportOperator_report_sequence_key"
ON "DraglineDelayReportOperator"("reportId", "sequence");
CREATE UNIQUE INDEX "DraglineDelayReportOperator_report_employee_key"
ON "DraglineDelayReportOperator"("reportId", "employeeId");
CREATE INDEX "DraglineDelayReportOperator_employee_idx"
ON "DraglineDelayReportOperator"("employeeId");

CREATE UNIQUE INDEX "DraglineDelayReportTimeline_report_sequence_key"
ON "DraglineDelayReportTimelineEntry"("reportId", "sequence");
CREATE INDEX "DraglineDelayReportTimeline_chronology_idx"
ON "DraglineDelayReportTimelineEntry"("reportId", "startMinuteOffset", "sequence");
CREATE INDEX "DraglineDelayReportTimeline_code_idx"
ON "DraglineDelayReportTimelineEntry"("delayCode");

ALTER TABLE "DraglineDelayReport"
ADD CONSTRAINT "DraglineDelayReport_equipment_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReport"
ADD CONSTRAINT "DraglineDelayReport_supervisor_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReportOperator"
ADD CONSTRAINT "DraglineDelayReportOperator_report_fkey"
FOREIGN KEY ("reportId") REFERENCES "DraglineDelayReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReportOperator"
ADD CONSTRAINT "DraglineDelayReportOperator_employee_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DraglineDelayReportTimelineEntry"
ADD CONSTRAINT "DraglineDelayReportTimelineEntry_report_fkey"
FOREIGN KEY ("reportId") REFERENCES "DraglineDelayReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
