import type { EquipmentCategory, TimesheetStatus } from "@prisma/client";

export type TimesheetAllocationInput = {
  sequence: number;
  workCodeId: string;
  workOrderId?: string;
  allocatedMinutes: number;
  supportPersonIds: string[];
  notes?: string;
};

export type DailyTimeEntryInput = {
  workDate: string;
  clockIn: string;
  clockOut: string;
  unpaidBreakMinutes: number;
  primaryEquipmentId: string;
  workScheduleDailyAssignmentId?: string;
  notes?: string;
  allocations: TimesheetAllocationInput[];
};

export type WeeklyTimesheetInput = {
  payrollWeekStartDate: string;
  primaryEmployeeDisplayName: string;
  entries: DailyTimeEntryInput[];
};

export type TimesheetFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
};

export const emptyTimesheetFormState: TimesheetFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export type EquipmentSnapshot = {
  displayName: string;
  equipmentNumber: string | null;
  category: EquipmentCategory;
  mineName: string;
  cityName: string;
  cityState: string | null;
};

export type TimesheetFormOptions = {
  equipment: Array<{ id: string; label: string; active: boolean }>;
  workCodes: Array<{ id: string; label: string; active: boolean }>;
  workOrders: Array<{ id: string; label: string; active: boolean }>;
  supportPersonnel: Array<{ id: string; label: string; active: boolean }>;
  scheduleAssignments: Array<{
    id: string;
    workDate: string;
    label: string;
    primaryEmployeeKey: string;
  }>;
};

export type TimesheetListItem = {
  id: string;
  payrollWeekStartDate: Date;
  payrollWeekEndDate: Date;
  status: TimesheetStatus;
  primaryEmployeeDisplayName: string;
  workedMinutesTotal: number;
  regularMinutesTotal: number;
  overtimeMinutesTotal: number;
  entryCount: number;
};
