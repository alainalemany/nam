-- Historically used Work Orders are retired through inactivation, not deletion.
ALTER TABLE "WorkAllocation"
DROP CONSTRAINT "WorkAllocation_workOrderId_fkey";

ALTER TABLE "WorkAllocation"
ADD CONSTRAINT "WorkAllocation_workOrderId_fkey"
FOREIGN KEY ("workOrderId") REFERENCES "TimesheetWorkOrder"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
