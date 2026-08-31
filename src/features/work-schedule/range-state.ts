export type ScheduleRangeSubmittedValues = {
  startDate: string;
  endDate: string;
  status: string;
  primaryEmployeeId: string;
  assignedByEmployeeId: string;
  receivedAt: string;
  sourceNote: string;
  scheduleNotes: string;
  overwriteConflicts: boolean;
  assignments: Array<Record<string, string | boolean>>;
};

export type ScheduleRangeFormState = {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors: Record<string, string[]>;
  assignmentErrors: Record<number, Record<string, string[]>>;
  conflictDates: string[];
  submittedValues?: ScheduleRangeSubmittedValues;
};

export const emptyScheduleRangeFormState: ScheduleRangeFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  assignmentErrors: {},
  conflictDates: [],
};
