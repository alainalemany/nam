import { addDateKeyDays, zonedDateTime } from "@/lib/zoned-date-time";

export type MaintenanceEventBoundary = {
  effectiveAt?: Date | null;
  effectiveDate?: Date | null;
};

export function maintenanceDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function maintenanceDateOnlyCalculationBoundary(effectiveDate: Date) {
  const nextOperationalDate = addDateKeyDays(maintenanceDateKey(effectiveDate), 1);
  return zonedDateTime(nextOperationalDate, 5);
}

export function maintenanceEventBoundaryAt(event: MaintenanceEventBoundary) {
  if (event.effectiveAt && !event.effectiveDate) return event.effectiveAt;
  if (!event.effectiveAt && event.effectiveDate) {
    return maintenanceDateOnlyCalculationBoundary(event.effectiveDate);
  }
  throw new Error("Maintenance event must have exactly one effective-time boundary.");
}
