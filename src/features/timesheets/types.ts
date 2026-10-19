import type { EquipmentCategory, TimesheetIdentityStatus, TimesheetStatus } from "@prisma/client";

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

export type TimesheetLeaveEntryInput = {
  workDate: string;
  leaveType: "FTO";
  requestedMinutes: number;
  workScheduleDailyAssignmentId?: string;
  notes?: string;
};

export type WeeklyTimesheetInput = {
  payrollWeekStartDate: string;
  primaryEmployeeId?: string;
  primaryEmployeeDisplayName: string;
  entries: DailyTimeEntryInput[];
  leaveEntries: TimesheetLeaveEntryInput[];
};

export type TimesheetFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
  code?: "IDENTITY_REVIEW_REQUIRED";
};

export type TimesheetMutationState = {
  ok: boolean;
  message: string;
  code?: "IDENTITY_REVIEW_REQUIRED";
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
  employees: Array<{
    id: string;
    label: string;
    active: boolean;
  }>;
  equipment: Array<{ id: string; label: string; active: boolean }>;
  workCodes: Array<{ id: string; label: string; active: boolean; equipmentId: string | null }>;
  workOrders: Array<{ id: string; label: string; active: boolean }>;
  supportPersonnel: Array<{ id: string; label: string; active: boolean }>;
  scheduleAssignments: Array<{
    id: string;
    workDate: string;
    label: string;
    selectable: boolean;
    leaveSelectable: boolean;
    warning?: string;
    leaveWarning?: string;
  }>;
};

export type TimesheetClipboardPayload = {
  version: 1;
  sourceDate: string;
  kind: "ALLOCATION" | "DAY";
  allocation?: TimesheetAllocationInput;
  workedEntry?: Omit<DailyTimeEntryInput, "workDate" | "workScheduleDailyAssignmentId">;
  leaveEntry?: Omit<TimesheetLeaveEntryInput, "workDate" | "workScheduleDailyAssignmentId">;
};

export type TimesheetListItem = {
  id: string;
  payrollWeekStartDate: Date;
  payrollWeekEndDate: Date;
  status: TimesheetStatus;
  primaryEmployeeIdentityStatus: TimesheetIdentityStatus;
  primaryEmployeeDisplayName: string;
  workedMinutesTotal: number;
  regularMinutesTotal: number;
  overtimeMinutesTotal: number;
  entryCount: number;
  entries: TimesheetHistoryEntrySummary[];
  leaveEntryCount: number;
  leaveEntries: TimesheetHistoryLeaveSummary[];
};

export type TimesheetHistoryLeaveSummary = {
  id: string;
  workDate: Date;
  requestedMinutes: number;
  approvalStatus: string;
  paymentStatus: string;
};

export type TimesheetHistoryEntrySummary = {
  id: string;
  workDate: Date;
  equipmentCategory: EquipmentCategory;
  equipmentIdentity: string;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  allocationSummaries: string[];
};

export type TimesheetHistoryResult = {
  items: TimesheetListItem[];
  totalCount: number;
  matchingCount: number;
  page: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type TimesheetHistoryFilterOption = {
  id: string;
  label: string;
  active: boolean;
};

export type TimesheetHistoryFilterOptions = {
  equipment: TimesheetHistoryFilterOption[];
  workCodes: TimesheetHistoryFilterOption[];
  workOrders: TimesheetHistoryFilterOption[];
  supportPersonnel: TimesheetHistoryFilterOption[];
};

export type TimesheetDayViewAllocation = {
  allocatedMinutes: number;
  allocatedTime: string;
  sequence: number;
  supportPersonnel: string[];
  workCode: string;
  workOrder?: string;
};

export type TimesheetDayViewContext = {
  kind: "WORKED";
  allocatedMinutes: number;
  allocatedTime: string;
  allocationStatus: "Balanced" | "Underallocated" | "Overallocated";
  allocationStatusLabel: string;
  allocations: TimesheetDayViewAllocation[];
  breakMinutes: number;
  breakTime: string;
  clockIn: string;
  clockOut: string;
  detailHref: string;
  equipment: string;
  overtimeMinutes: number;
  overtimeTime: string;
  primaryEmployeeDisplayName: string;
  regularMinutes: number;
  regularTime: string;
  status: "Draft" | "Completed";
  timesheetId: string;
  workDate: string;
  workedMinutes: number;
  workedTime: string;
};

export type TimesheetLeaveDayViewContext = {
  kind: "FTO";
  approvalStatus: "Requested" | "Approved" | "Denied" | "Cancelled";
  detailHref: string;
  notes?: string;
  paymentStatus: "Unverified" | "Paid" | "Unpaid";
  primaryEmployeeDisplayName: string;
  requestedMinutes: number;
  requestedTime: string;
  status: "Draft" | "Completed";
  timesheetId: string;
  workDate: string;
};
