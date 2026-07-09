export type ShiftReportSelectOption = {
  id: string;
  label: string;
};

export type ShiftReportFormInitialValues = {
  reportDate?: string;
  shift?: string;
  status?: string;
  mineId?: string;
  equipmentId?: string;
  location?: string;
  summary?: string;
  operationalNotes?: string;
};
