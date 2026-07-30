import { isCanonicalSupplyRequestDate } from "./validation";
import {
  equipmentCategoryOptions,
  optionLabel,
} from "../equipment/constants";

function usable(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function comparisonKey(value: string) {
  return value.replace(/\s+/gu, " ").toUpperCase();
}

export function supplyRequestEquipmentSnapshotLabel(
  displayNameInput: string | null | undefined,
  equipmentNumberInput: string | null | undefined,
) {
  const displayName = usable(displayNameInput);
  const equipmentNumber = usable(equipmentNumberInput);

  if (
    displayName &&
    equipmentNumber &&
    comparisonKey(displayName) !== comparisonKey(equipmentNumber)
  ) {
    return `${displayName} · ${equipmentNumber}`;
  }
  if (displayName) return displayName;
  if (equipmentNumber) return `Equipment ${equipmentNumber}`;
  return "Equipment unavailable";
}

export function supplyRequestStatusLabel(
  status: "REQUESTED" | "FULFILLED" | "CANCELLED",
) {
  if (status === "FULFILLED") return "Fulfilled";
  if (status === "CANCELLED") return "Cancelled";
  return "Requested";
}

export function supplyRequestChangeKindLabel(
  kind: "CREATED" | "FULFILLED" | "CANCELLED" | "CORRECTED",
) {
  if (kind === "FULFILLED") return "Fulfilled";
  if (kind === "CANCELLED") return "Cancelled";
  if (kind === "CORRECTED") return "Corrected";
  return "Created";
}

export function supplyRequestEquipmentCategoryLabel(category: string) {
  return optionLabel(equipmentCategoryOptions, category);
}

export function formatSupplyRequestDate(value: string) {
  if (!isCanonicalSupplyRequestDate(value)) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatSupplyRequestRecordedAt(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(value);
}

export function supplyRequestDerivedTitle(
  equipmentLabel: string,
  operationalWorkDate: string,
) {
  return `Supply Request — ${equipmentLabel} — ${formatSupplyRequestDate(
    operationalWorkDate,
  )}`;
}
