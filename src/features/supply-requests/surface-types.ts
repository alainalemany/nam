export type SupplyRequestEquipmentOption = Readonly<{
  id: string;
  label: string;
  displayName: string;
  equipmentNumber: string | null;
  mineName: string;
  cityName: string;
  cityState: string | null;
}>;

export type SupplyRequestSupervisorOption = Readonly<{
  id: string;
  fullName: string;
  email: string;
}>;

export type SupplyRequestItemOption = Readonly<{
  id: string;
  itemNumber: string;
  description: string;
  unit: string;
}>;

export type SupplyRequestCreatePageData = Readonly<{
  equipment: readonly SupplyRequestEquipmentOption[];
  supervisors: readonly SupplyRequestSupervisorOption[];
  items: readonly SupplyRequestItemOption[];
  hasActiveEquipment: boolean;
  hasActiveSupervisors: boolean;
  hasActiveItems: boolean;
  loadError: string | null;
}>;

export type SupplyRequestSearchResult<T> = Readonly<{
  options: readonly T[];
  error: string | null;
}>;

export type SupplyRequestSelectedItemInput = Readonly<{
  supplyItemId: string;
  quantity: number;
}>;

export type SupplyRequestCreateFormValues = Readonly<{
  operationalWorkDate: string;
  submittedLocalDate: string;
  submittedLocalTime: string;
  equipmentId: string;
  supervisorId: string;
  notes: string;
  corporateSubmissionConfirmed: boolean;
}>;

export type SupplyRequestCreateActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  values: SupplyRequestCreateFormValues;
  items: readonly SupplyRequestSelectedItemInput[];
}>;

export type SupplyRequestDetailItem = Readonly<{
  id: string;
  sequence: number;
  itemNumber: string;
  description: string;
  quantity: number;
  unit: string;
}>;

export type SupplyRequestDetailView = Readonly<{
  supplyRequestId: string;
  namReference: string;
  versionId: string;
  versionNumber: number;
  changeKind: "CREATED" | "FULFILLED" | "CANCELLED" | "CORRECTED";
  status: "REQUESTED" | "FULFILLED" | "CANCELLED";
  operationalWorkDate: string;
  submittedLocalDate: string;
  submittedLocalTime: string;
  equipmentId: string | null;
  equipmentAvailable: boolean;
  equipmentLabel: string;
  equipmentDisplayName: string;
  equipmentNumber: string | null;
  equipmentCategory: string;
  mineName: string;
  cityName: string;
  cityState: string | null;
  requesterDisplayName: string;
  requesterEmployeeNumber: string;
  supervisorName: string;
  supervisorEmail: string;
  notes: string | null;
  items: readonly SupplyRequestDetailItem[];
  createdAtLabel: string;
  fulfillmentOperationalWorkDate: string | null;
  fulfilledLocalDate: string | null;
  fulfilledLocalTime: string | null;
  cancellationLocalDate: string | null;
  cancellationLocalTime: string | null;
  correctionReason: string | null;
}>;
