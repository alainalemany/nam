-- CreateTable
CREATE TABLE "TrackedMaintenanceComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "trackingUnit" TEXT NOT NULL DEFAULT 'HOURS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedMaintenanceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "MaintenanceCounterScope" AS ENUM ('SERVICE_INTERVAL', 'COMPONENT_LIFECYCLE');

-- CreateTable
CREATE TABLE "MaintenanceRule" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "counterScope" "MaintenanceCounterScope" NOT NULL DEFAULT 'COMPONENT_LIFECYCLE',
    "thresholdValue" DECIMAL(12,2) NOT NULL,
    "upperThresholdValue" DECIMAL(12,2),
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "repeatIntervalValue" DECIMAL(12,2),
    "maximumRepeatCount" INTEGER,
    "warningLeadValue" DECIMAL(12,2),
    "startsNewLifecycle" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MaintenanceRule_threshold_check" CHECK ("thresholdValue" >= 0),
    CONSTRAINT "MaintenanceRule_window_check" CHECK ("upperThresholdValue" IS NULL OR "upperThresholdValue" >= "thresholdValue"),
    CONSTRAINT "MaintenanceRule_warning_check" CHECK ("warningLeadValue" IS NULL OR "warningLeadValue" >= 0),
    CONSTRAINT "MaintenanceRule_repeat_check" CHECK (
        ("repeatable" = false AND "repeatIntervalValue" IS NULL AND "maximumRepeatCount" IS NULL)
        OR
        ("repeatable" = true AND "repeatIntervalValue" IS NOT NULL AND "repeatIntervalValue" > 0)
    ),
    CONSTRAINT "MaintenanceRule_maximum_check" CHECK ("maximumRepeatCount" IS NULL OR "maximumRepeatCount" > 0)
);

-- CreateTable
CREATE TABLE "EquipmentMaintenanceTracker" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "trackingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedComponentIdentity" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentMaintenanceTracker_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EquipmentMaintenanceTracker_version_check" CHECK ("recordVersion" > 0)
);

-- CreateTable
CREATE TABLE "MaintenanceCounterEntry" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "adjustmentValue" DECIMAL(12,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceCounterEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MaintenanceCounterEntry_adjustment_check" CHECK ("adjustmentValue" > 0),
    CONSTRAINT "MaintenanceCounterEntry_reason_check" CHECK (length(trim("reason")) > 0)
);

-- CreateTable
CREATE TABLE "MaintenanceServiceEvent" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "ruleId" TEXT,
    "componentNameSnapshot" TEXT NOT NULL,
    "trackingUnitSnapshot" TEXT NOT NULL,
    "actionNameSnapshot" TEXT NOT NULL,
    "counterScopeSnapshot" "MaintenanceCounterScope" NOT NULL,
    "thresholdSnapshot" DECIMAL(12,2) NOT NULL,
    "upperThresholdSnapshot" DECIMAL(12,2),
    "warningLeadSnapshot" DECIMAL(12,2),
    "repeatIntervalSnapshot" DECIMAL(12,2),
    "maximumRepeatSnapshot" INTEGER,
    "startsNewLifecycleSnapshot" BOOLEAN NOT NULL,
    "targetValueSnapshot" DECIMAL(12,2) NOT NULL,
    "intervalValueAtService" DECIMAL(12,2) NOT NULL,
    "lifecycleValueAtService" DECIMAL(12,2) NOT NULL,
    "varianceValueSnapshot" DECIMAL(12,2) NOT NULL,
    "lifecycleNumber" INTEGER NOT NULL,
    "serviceSequence" INTEGER NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceServiceEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MaintenanceServiceEvent_value_check" CHECK ("targetValueSnapshot" >= 0 AND "intervalValueAtService" >= 0 AND "lifecycleValueAtService" >= 0),
    CONSTRAINT "MaintenanceServiceEvent_lifecycle_check" CHECK ("lifecycleNumber" > 0 AND "serviceSequence" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedMaintenanceComponent_normalizedName_key" ON "TrackedMaintenanceComponent"("normalizedName");
CREATE INDEX "TrackedMaintenanceComponent_active_order_idx" ON "TrackedMaintenanceComponent"("active", "sortOrder");
CREATE INDEX "TrackedMaintenanceComponent_name_idx" ON "TrackedMaintenanceComponent"("name");
CREATE UNIQUE INDEX "MaintenanceRule_component_order_key" ON "MaintenanceRule"("componentId", "sortOrder");
CREATE INDEX "MaintenanceRule_component_active_priority_idx" ON "MaintenanceRule"("componentId", "active", "priority");
CREATE UNIQUE INDEX "EquipmentMaintenanceTracker_equipment_component_key" ON "EquipmentMaintenanceTracker"("equipmentId", "componentId");
CREATE INDEX "EquipmentMaintenanceTracker_equipment_active_idx" ON "EquipmentMaintenanceTracker"("equipmentId", "active");
CREATE INDEX "EquipmentMaintenanceTracker_component_active_idx" ON "EquipmentMaintenanceTracker"("componentId", "active");
CREATE INDEX "MaintenanceCounterEntry_tracker_effective_idx" ON "MaintenanceCounterEntry"("trackerId", "effectiveAt");
CREATE INDEX "MaintenanceServiceEvent_tracker_effective_idx" ON "MaintenanceServiceEvent"("trackerId", "effectiveAt");
CREATE INDEX "MaintenanceServiceEvent_rule_idx" ON "MaintenanceServiceEvent"("ruleId");

-- AddForeignKey
ALTER TABLE "MaintenanceRule" ADD CONSTRAINT "MaintenanceRule_component_fkey"
    FOREIGN KEY ("componentId") REFERENCES "TrackedMaintenanceComponent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquipmentMaintenanceTracker" ADD CONSTRAINT "EquipmentMaintenanceTracker_equipment_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EquipmentMaintenanceTracker" ADD CONSTRAINT "EquipmentMaintenanceTracker_component_fkey"
    FOREIGN KEY ("componentId") REFERENCES "TrackedMaintenanceComponent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceCounterEntry" ADD CONSTRAINT "MaintenanceCounterEntry_tracker_fkey"
    FOREIGN KEY ("trackerId") REFERENCES "EquipmentMaintenanceTracker"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceServiceEvent" ADD CONSTRAINT "MaintenanceServiceEvent_tracker_fkey"
    FOREIGN KEY ("trackerId") REFERENCES "EquipmentMaintenanceTracker"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceServiceEvent" ADD CONSTRAINT "MaintenanceServiceEvent_rule_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "MaintenanceRule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the first configurable component catalog. The seed statements are
-- conflict-safe if they are reused after these tables already exist.
INSERT INTO "TrackedMaintenanceComponent" (
    "id", "name", "normalizedName", "description", "trackingUnit", "active", "sortOrder", "updatedAt"
) VALUES
    ('maintenance_component_drag_cable', 'Drag Cable', 'drag cable', 'Dragline drag cable lifecycle and service tracking.', 'HOURS', true, 10, CURRENT_TIMESTAMP),
    ('maintenance_component_hoist_cable', 'Hoist Cable', 'hoist cable', 'Dragline hoist cable lifecycle and service tracking.', 'HOURS', true, 20, CURRENT_TIMESTAMP),
    ('maintenance_component_teeth', 'Teeth', 'teeth', 'Dragline teeth operating-hour replacement tracking.', 'HOURS', true, 30, CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO NOTHING;

INSERT INTO "MaintenanceRule" (
    "id", "componentId", "actionName", "counterScope", "thresholdValue", "upperThresholdValue",
    "repeatable", "repeatIntervalValue", "maximumRepeatCount", "warningLeadValue",
    "startsNewLifecycle", "active", "priority", "sortOrder", "updatedAt"
) SELECT
    seed."id", component."id", seed."actionName", seed."counterScope"::"MaintenanceCounterScope", seed."thresholdValue", seed."upperThresholdValue",
    seed."repeatable", seed."repeatIntervalValue", seed."maximumRepeatCount", seed."warningLeadValue",
    seed."startsNewLifecycle", true, seed."priority", seed."sortOrder", CURRENT_TIMESTAMP
FROM (
    VALUES
        ('maintenance_rule_drag_resocket', 'drag cable', 'Resocket', 'SERVICE_INTERVAL', 150.00::DECIMAL, NULL::DECIMAL, true, 150.00::DECIMAL, NULL::INTEGER, 25.00::DECIMAL, false, 20, 10),
        ('maintenance_rule_drag_replace', 'drag cable', 'Change / Replace', 'COMPONENT_LIFECYCLE', 1300.00::DECIMAL, 1400.00::DECIMAL, false, NULL::DECIMAL, NULL::INTEGER, 100.00::DECIMAL, true, 10, 20),
        ('maintenance_rule_hoist_resocket', 'hoist cable', 'Resocket', 'SERVICE_INTERVAL', 500.00::DECIMAL, NULL::DECIMAL, true, 500.00::DECIMAL, 4, 50.00::DECIMAL, false, 20, 10),
        ('maintenance_rule_hoist_replace', 'hoist cable', 'Change / Replace', 'COMPONENT_LIFECYCLE', 1500.00::DECIMAL, NULL::DECIMAL, false, NULL::DECIMAL, NULL::INTEGER, 100.00::DECIMAL, true, 10, 20),
        ('maintenance_rule_teeth_replace', 'teeth', 'Change / Replace', 'COMPONENT_LIFECYCLE', 750.00::DECIMAL, NULL::DECIMAL, false, NULL::DECIMAL, NULL::INTEGER, 75.00::DECIMAL, true, 10, 10)
) AS seed(
    "id", "componentName", "actionName", "counterScope", "thresholdValue", "upperThresholdValue",
    "repeatable", "repeatIntervalValue", "maximumRepeatCount", "warningLeadValue",
    "startsNewLifecycle", "priority", "sortOrder"
)
JOIN "TrackedMaintenanceComponent" component
  ON component."normalizedName" = seed."componentName"
ON CONFLICT ("componentId", "sortOrder") DO NOTHING;
