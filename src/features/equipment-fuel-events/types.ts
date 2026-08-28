import type {
  EquipmentCategory,
  EquipmentFuelType,
  EquipmentPowerType,
  RecordStatus,
} from "@prisma/client";

export type EquipmentFuelEquipmentOption = {
  id: string;
  label: string;
  displayName: string;
  equipmentNumber: string | null;
  category: EquipmentCategory;
  powerType: EquipmentPowerType | null;
  status: RecordStatus;
  mineName: string;
  cityName: string;
  cityState: string | null;
};

export type EquipmentFuelTankFillValue = {
  clientRowId: string;
  sequence: number;
  tankLabel: string;
  gallons: string;
};

export type EquipmentFuelTankFillInitialValue = Omit<
  EquipmentFuelTankFillValue,
  "clientRowId"
>;

export type EquipmentFuelEventFormInitialValues = {
  operationalWorkDate: string;
  eventTime: string;
  equipmentId: string;
  fuelType: EquipmentFuelType;
  notes: string;
  tankFills: EquipmentFuelTankFillInitialValue[];
};

export type EquipmentFuelEventSubmittedValues = {
  operationalWorkDate: string;
  eventTime: string;
  equipmentId: string;
  fuelType: string;
  notes: string;
  tankFills: EquipmentFuelTankFillValue[];
};
