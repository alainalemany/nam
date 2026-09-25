-- Preserve truthful date-only historical lifecycle anchors without assigning a
-- fabricated service time. Existing service events remain exact-time events.
CREATE TYPE "MaintenanceServiceEventKind" AS ENUM ('SERVICE', 'LIFECYCLE_INITIALIZATION');

ALTER TABLE "MaintenanceServiceEvent"
    ADD COLUMN "eventKind" "MaintenanceServiceEventKind" NOT NULL DEFAULT 'SERVICE',
    ADD COLUMN "effectiveDate" DATE,
    ADD COLUMN "machineMeterSnapshot" DECIMAL(12,2),
    ALTER COLUMN "effectiveAt" DROP NOT NULL,
    ALTER COLUMN "intervalValueAtService" DROP NOT NULL,
    ALTER COLUMN "lifecycleValueAtService" DROP NOT NULL,
    ALTER COLUMN "varianceValueSnapshot" DROP NOT NULL;

ALTER TABLE "MaintenanceServiceEvent"
    DROP CONSTRAINT "MaintenanceServiceEvent_value_check",
    DROP CONSTRAINT "MaintenanceServiceEvent_lifecycle_check";

ALTER TABLE "MaintenanceServiceEvent"
    ADD CONSTRAINT "MaintenanceServiceEvent_value_check" CHECK (
        "targetValueSnapshot" >= 0
        AND ("intervalValueAtService" IS NULL OR "intervalValueAtService" >= 0)
        AND ("lifecycleValueAtService" IS NULL OR "lifecycleValueAtService" >= 0)
    ),
    ADD CONSTRAINT "MaintenanceServiceEvent_lifecycle_check" CHECK (
        "lifecycleNumber" > 0
        AND (
            ("eventKind" = 'SERVICE' AND "serviceSequence" > 0)
            OR
            ("eventKind" = 'LIFECYCLE_INITIALIZATION' AND "serviceSequence" = 0)
        )
    ),
    ADD CONSTRAINT "MaintenanceServiceEvent_boundary_check" CHECK (
        ("eventKind" = 'SERVICE' AND "effectiveAt" IS NOT NULL AND "effectiveDate" IS NULL)
        OR
        (
            "eventKind" = 'LIFECYCLE_INITIALIZATION'
            AND "effectiveAt" IS NULL
            AND "effectiveDate" IS NOT NULL
            AND "startsNewLifecycleSnapshot" = true
        )
    ),
    ADD CONSTRAINT "MaintenanceServiceEvent_initialization_values_check" CHECK (
        "eventKind" = 'SERVICE'
        OR (
            "intervalValueAtService" IS NULL
            AND "lifecycleValueAtService" IS NULL
            AND "varianceValueSnapshot" IS NULL
        )
    ),
    ADD CONSTRAINT "MaintenanceServiceEvent_meter_check" CHECK (
        "machineMeterSnapshot" IS NULL OR "machineMeterSnapshot" >= 0
    );

CREATE INDEX "MaintenanceServiceEvent_tracker_effective_date_idx"
    ON "MaintenanceServiceEvent"("trackerId", "effectiveDate");
