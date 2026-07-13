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
