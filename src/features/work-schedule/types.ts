import type {
  DailyAssignmentStatusValue,
  ShiftValue,
  WeeklyScheduleStatusValue,
} from "./constants";

export type WorkScheduleSelectOption = {
  id: string;
  label: string;
};

export type WorkScheduleAssignmentInitialValues = {
  assignmentDate: string;
  dayOfWeek: number;
  plannedStatus: DailyAssignmentStatusValue;
  plannedShift: ShiftValue;
  plannedEquipmentId?: string;
  actualStatus: DailyAssignmentStatusValue;
  actualShift: ShiftValue;
  actualEquipmentId?: string;
  plannedPrimaryDisplayName?: string;
  plannedPartnerDisplayName?: string;
  plannedPartnerUnknown?: boolean;
  actualPrimaryDisplayName?: string;
  actualPartnerDisplayName?: string;
  actualPartnerUnknown?: boolean;
  changeReason?: string;
  plannedNotes?: string;
  actualNotes?: string;
};

export type WorkScheduleFormInitialValues = {
  weekStartDate: string;
  status: WeeklyScheduleStatusValue;
  primaryEmployeeDisplayName: string;
  assignedByDisplayName: string;
  receivedAt?: string;
  sourceNote?: string;
  scheduleNotes?: string;
  assignments: WorkScheduleAssignmentInitialValues[];
};

