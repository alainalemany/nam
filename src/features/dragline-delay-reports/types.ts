import type { DraglineDelayCodeCategory } from "./catalog";
import type { DraglineDelayReportShift } from "./time";

export type DraglineEquipmentOption = {
  id: string;
  label: string;
  displayName: string;
  equipmentNumber: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  mineName: string;
  cityName: string;
  cityState: string | null;
};

export type DraglineEmployeeOption = {
  id: string;
  label: string;
  displayName: string;
  employeeCode: string | null;
  isActive: boolean;
  isSupervisor: boolean;
};

export type DraglineDelayReportOperatorFormRow = {
  clientId: string;
  id?: string;
  employeeId: string;
};

export type DraglineDelayReportTimelineFormRow = {
  clientId: string;
  id?: string;
  startTime: string;
  dayOffset: 0 | 1;
  delayCode: string;
  description: string;
  durationMinutes: string;
  causesDowntime: boolean;
  category?: DraglineDelayCodeCategory;
};

export type DraglineDelayReportFormInitialValues = {
  operationalWorkDate: string;
  shift: DraglineDelayReportShift;
  equipmentId: string;
  startingHourMeter: string;
  endingHourMeter: string;
  supervisorId: string;
  recordVersion?: number;
  operators: DraglineDelayReportOperatorFormRow[];
  timelineEntries: DraglineDelayReportTimelineFormRow[];
};
