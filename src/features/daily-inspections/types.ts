export type DailyInspectionSelectOption = {
  id: string;
  label: string;
};

export type DailyInspectionFormInitialValues = {
  inspectionDate?: string;
  shift?: string;
  mineId?: string;
  equipmentId?: string;
  equipmentHours?: string;
  condition?: string;
  status?: string;
  findings?: string;
  defectsIdentified?: boolean;
  notes?: string;
};
