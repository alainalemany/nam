export type WorkAuthorizationSelectOption = {
  id: string;
  label: string;
};

export type WorkAuthorizationFormInitialValues = {
  shiftReportId?: string;
  status?: string;
  workType?: string;
  mineId?: string;
  equipmentId?: string;
  jobLocation?: string;
  workDescription?: string;
  startTime?: string;
  endTime?: string;
  crewWorkerCount?: string;
  contactName?: string;
  equipmentRequired?: string;
  personInChargeName?: string;
  lockoutRequired?: boolean;
  lockoutNotRequiredReason?: string;
  workplaceExamRequired?: boolean;
  confinedSpaceRequired?: boolean;
  lockoutTagoutRequired?: boolean;
  hotWorkRequired?: boolean;
  workingAtHeightsRequired?: boolean;
  stopCardJhaRequired?: boolean;
  jobCompleted?: boolean;
  permitsClosed?: boolean;
  guardsReplaced?: boolean;
  lockoutTagoutRemoved?: boolean;
  toolsRemoved?: boolean;
  housekeepingCompleted?: boolean;
  supervisorNotified?: boolean;
  completionNotes?: string;
};
