import type { EquipmentCategory, EquipmentFuelMeterType, EquipmentFuelType, EquipmentPowerType } from "@prisma/client";

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
export const maxFuelEventCost = "999999999999.99";

export const equipmentFuelMeterTypeValues = [
  "HOURS",
  "ODOMETER",
  "NOT_APPLICABLE",
] as const satisfies readonly EquipmentFuelMeterType[];

export const equipmentFuelMeterTypeOptions = [
  { value: "HOURS", label: "Hours" },
  { value: "ODOMETER", label: "Odometer" },
  { value: "NOT_APPLICABLE", label: "Not Applicable" },
] as const;

export function fuelTypeLabel(value: EquipmentFuelType) {
  return equipmentFuelTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function meterTypeLabel(value: EquipmentFuelMeterType | null | undefined) {
  return equipmentFuelMeterTypeOptions.find((option) => option.value === value)?.label ?? "Not recorded";
}

export function equipmentCategoryLabel(value: EquipmentCategory) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatFuelDecimal(value: { toString(): string } | string | number) {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : value.toString();
  if (!raw.includes(".")) return raw;
  return raw.replace(/0+$/, "").replace(/\.$/, "");
}

export function formatFuelGallons(value: { toString(): string } | string | number) {
  return `${formatFuelDecimal(value)} gal`;
}

export function formatFuelCurrency(value: { toFixed(digits: number): string } | null | undefined) {
  return value ? `$${value.toFixed(2)}` : "Not recorded";
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
