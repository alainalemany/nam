export function normalizeMaintenanceName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function normalizeTrackingUnit(value: string) {
  return value.trim().replace(/\s+/g, "_").toLocaleUpperCase("en-US");
}
