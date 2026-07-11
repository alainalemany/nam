import type { DefectStatusValue } from "./constants";

export type DefectSelectOption = {
  id: string;
  label: string;
};

export type DefectFormInitialValues = {
  reportedDate?: string;
  equipmentId?: string;
  sourceDailyInspectionId?: string;
  severity?: string;
  priority?: string;
  status?: DefectStatusValue;
  title?: string;
  description?: string;
  correctiveAction?: string;
  resolutionSummary?: string;
};
