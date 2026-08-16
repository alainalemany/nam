import type {
  DailyAssignmentStatusValue,
  ShiftValue,
  WeeklyScheduleStatusValue,
} from "./constants";

export type WorkScheduleSelectOption = {
  id: string;
  label: string;
};

export type WorkScheduleEmployeeOption = WorkScheduleSelectOption & {
  employeeCode?: string;
  isActive: boolean;
  isSupervisor: boolean;
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
  plannedPrimaryEmployeeId?: string;
  plannedPrimaryDisplayName?: string;
  plannedPartnerEmployeeId?: string;
  plannedPartnerDisplayName?: string;
  plannedPartnerUnknown?: boolean;
  actualPrimaryEmployeeId?: string;
  actualPrimaryDisplayName?: string;
  actualPartnerEmployeeId?: string;
  actualPartnerDisplayName?: string;
  actualPartnerUnknown?: boolean;
  changeReason?: string;
  plannedNotes?: string;
  actualNotes?: string;
};

export type WorkScheduleFormInitialValues = {
  isNew: boolean;
  weekStartDate: string;
  status: WeeklyScheduleStatusValue;
  primaryEmployeeId?: string;
  primaryEmployeeDisplayName: string;
  assignedByEmployeeId?: string;
  assignedByDisplayName: string;
  receivedAt?: string;
  sourceNote?: string;
  scheduleNotes?: string;
  assignments: WorkScheduleAssignmentInitialValues[];
};

export type WorkScheduleDayViewCrewParticipant = {
  label: string;
  state: "known" | "unknown" | "not_recorded";
};

export type WorkScheduleDayViewAssignmentSummary = {
  equipment: string;
  notes?: string;
  partner: WorkScheduleDayViewCrewParticipant;
  shift: string;
  status: string;
};

export type WorkScheduleDayViewContext = {
  actual: WorkScheduleDayViewAssignmentSummary & {
    recorded: boolean;
  };
  assignedByDisplayName: string;
  assignmentDate: string;
  assignmentStatus: string;
  changed: boolean;
  detailHref: string;
  explanation?: string;
  outcome: "Scheduled" | "Matches Plan" | "Changed" | "Cancelled" | "Non-Working" | "Actual Not Recorded" | "Unknown";
  planned: WorkScheduleDayViewAssignmentSummary;
  primaryEmployeeDisplayName: string;
  scheduleId: string;
  weeklyStatus: string;
};
