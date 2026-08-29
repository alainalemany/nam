import type {
  EquipmentCategory,
  EquipmentFuelMeterType,
  EquipmentFuelType,
  EquipmentPowerType,
  RecordStatus,
} from "@prisma/client";

export type EquipmentFuelGasStationOption = {
  id: string;
  label: string;
  name: string;
  address: string | null;
  cityName: string;
  cityState: string | null;
  postalCode: string | null;
  isActive: boolean;
};

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
  gasStationId?: string;
  pricePerGallon?: string;
  meterType?: EquipmentFuelMeterType | "";
  meterReading?: string;
  receiptReference?: string;
  notes: string;
  tankFills: EquipmentFuelTankFillInitialValue[];
};

export type EquipmentFuelEventSubmittedValues = {
  operationalWorkDate: string;
  eventTime: string;
  equipmentId: string;
  fuelType: string;
  gasStationId: string;
  pricePerGallon: string;
  meterType: string;
  meterReading: string;
  receiptReference: string;
  notes: string;
  tankFills: EquipmentFuelTankFillValue[];
};
