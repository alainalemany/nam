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

export type FuelServicePersonOption = {
  id: string;
  displayName: string;
  active: boolean;
};

export type FuelDailyLogActivityOption = {
  id: string;
  label: string;
  activityDate: string;
  equipmentId: string | null;
};

export type EquipmentFuelFormContext = {
  dailyLogActivities: FuelDailyLogActivityOption[];
  tankLabelSuggestions: string[];
};

export type EquipmentFuelTankFillValue = {
  sequence: number;
  tankLabel: string;
  gallons: string;
};

export type EquipmentFuelEventFormInitialValues = {
  operationalWorkDate: string;
  eventTime: string;
  equipmentId: string;
  fuelType: EquipmentFuelType;
  fuelServicePersonId: string;
  dailyLogActivityId: string;
  notes: string;
  tankFills: EquipmentFuelTankFillValue[];
};
