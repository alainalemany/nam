import type {
  EquipmentCategory,
  OperationalSafetyChecklistMeterKind,
} from "@prisma/client";

import type {
  SafetyChecklistResponseCode,
  SafetyChecklistTemplateKey,
} from "./templates";

export type SafetyChecklistEquipmentOption = {
  id: string;
  label: string;
  displayName: string;
  equipmentNumber: string | null;
  category: EquipmentCategory;
  mineName: string;
  cityName: string;
  cityState: string | null;
  templateKey: SafetyChecklistTemplateKey;
  templateVersion: number;
  templateName: string;
};

export type SafetyChecklistFormInitialValues = {
  inspectionDate: string;
  shift: string;
  equipmentId: string;
  templateKey: SafetyChecklistTemplateKey | "";
  templateVersion: number;
  meterKind: OperationalSafetyChecklistMeterKind | "";
  startingMeter: string;
  operatorDisplayName: string;
  supervisorDisplayName: string;
  problemDescription: string;
  responses: Record<string, SafetyChecklistResponseCode>;
};
