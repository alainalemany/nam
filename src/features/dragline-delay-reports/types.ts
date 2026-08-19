import type { DraglineDelayCodeCategory } from "./catalog";
import type { DraglineDelayReportShift } from "./time";

export type DraglineEquipmentOption = {
  id: string;
  mineId: string;
  label: string;
  displayName: string;
  equipmentNumber: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  mineName: string;
  cityName: string;
  cityState: string | null;
};

export type DraglineLakeOption = {
  id: string;
  mineId: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
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

export type DraglineDelayReportGroundCheckFormRow = {
  clientId: string;
  id?: string;
  startTime: string;
  dayOffset: 0 | 1;
};

export type DraglineDelayReportFormInitialValues = {
  operationalWorkDate: string;
  shift: DraglineDelayReportShift;
  equipmentId: string;
  startingHourMeter: string;
  endingHourMeter: string;
  supervisorId: string;
  lakeId: string;
  normalDiggingBuckets: string;
  benchfillBuckets: string;
  stationStart: string;
  stationEnd: string;
  depthFeet: string;
  fuelGallons: string;
  cableDragFeet: string;
  hoistFeet: string;
  comments: string;
  safetyItemsFound: string;
  actionTaken: string;
  recordVersion?: number;
  operators: DraglineDelayReportOperatorFormRow[];
  timelineEntries: DraglineDelayReportTimelineFormRow[];
  groundChecks: DraglineDelayReportGroundCheckFormRow[];
};
