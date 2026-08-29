export function normalizeGeographyText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizeGeographyKey(value: string) {
  return normalizeGeographyText(value).toLocaleLowerCase("en-US");
}

export function normalizeStateAbbreviation(value: string) {
  return normalizeGeographyText(value).toUpperCase();
}

export function cityStateAbbreviation(city: {
  state?: string | null;
  stateReference?: { abbreviation: string } | null;
}) {
  return city.stateReference?.abbreviation ?? city.state ?? null;
}

export function cityDisplayLabel(city: {
  name: string;
  state?: string | null;
  stateReference?: { abbreviation: string } | null;
}) {
  const abbreviation = cityStateAbbreviation(city);
  return `${city.name}${abbreviation ? `, ${abbreviation}` : ""}`;
}
