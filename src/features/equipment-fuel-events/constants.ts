import type { EquipmentFuelType, EquipmentPowerType } from "@prisma/client";

export const equipmentFuelTypeValues = [
  "DIESEL",
  "OFF_ROAD_DIESEL",
  "GASOLINE",
] as const satisfies readonly EquipmentFuelType[];

export const equipmentFuelTypeOptions = [
  { value: "DIESEL", label: "Diesel" },
  { value: "OFF_ROAD_DIESEL", label: "Off-road Diesel" },
  { value: "GASOLINE", label: "Gasoline" },
] as const;

export const maxTankFills = 10;
export const maxGallonsPerFill = 999_999;
export const maxEventGallons = 9_999_990;

export function fuelTypeLabel(value: EquipmentFuelType) {
  return equipmentFuelTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function compatibleFuelTypes(powerType: EquipmentPowerType | null) {
  if (powerType === "ELECTRIC") return [];
  if (powerType === "DIESEL") return ["DIESEL", "OFF_ROAD_DIESEL"] as const;
  if (powerType === "GASOLINE") return ["GASOLINE"] as const;
  return equipmentFuelTypeValues;
}

export function isFuelTypeCompatible(
  powerType: EquipmentPowerType | null,
  fuelType: EquipmentFuelType,
) {
  return compatibleFuelTypes(powerType).includes(fuelType as never);
}
