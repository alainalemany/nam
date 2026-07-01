export type DailyLogSelectOption = {
  id: string;
  label: string;
};

export type DailyLogFormActivity = {
  activityType?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  equipmentId?: string;
  location?: string;
  contractorCompany?: string;
  personName?: string;
  notes?: string;
};

export type DailyLogFormInitialValues = {
  logDate?: string;
  shift?: string;
  mineId?: string;
  primaryEquipmentId?: string;
  summary?: string;
  weatherConditions?: string;
  generalNotes?: string;
  activities?: DailyLogFormActivity[];
};
