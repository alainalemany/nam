export type StopCardSelectOption = {
  id: string;
  label: string;
};

export type StopCardFormInitialValues = {
  observationDate?: string;
  category?: string;
  severity?: string;
  status?: string;
  mineId?: string;
  equipmentId?: string;
  location?: string;
  description?: string;
  correctiveAction?: string;
  createdBy?: string;
};
