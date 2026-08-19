export type ParsedStation = Readonly<{
  stationNumber: number;
  offsetFeet: number;
  absoluteFeet: number;
}>;

export function parseStationNotation(value: string): ParsedStation {
  const match = /^(0|[1-9]\d*)\+(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Station must use station+offset notation, such as 50+30.");
  }

  const stationNumber = Number(match[1]);
  const offsetFeet = Number(match[2]);
  const absoluteFeet = stationNumber * 100 + offsetFeet;

  if (offsetFeet > 99 || !Number.isSafeInteger(absoluteFeet)) {
    throw new Error("Station is outside the supported range.");
  }

  return { stationNumber, offsetFeet, absoluteFeet };
}

export function formatStationNotation(absoluteFeet: number) {
  if (!Number.isSafeInteger(absoluteFeet) || absoluteFeet < 0) {
    throw new Error("Absolute station feet must be a nonnegative whole number.");
  }

  const stationNumber = Math.floor(absoluteFeet / 100);
  const offsetFeet = absoluteFeet % 100;
  return `${stationNumber}+${String(offsetFeet).padStart(2, "0")}`;
}

export function calculateStationAdvance(startAbsoluteFeet: number, endAbsoluteFeet: number) {
  if (
    !Number.isSafeInteger(startAbsoluteFeet) ||
    !Number.isSafeInteger(endAbsoluteFeet) ||
    startAbsoluteFeet < 0 ||
    endAbsoluteFeet < 0
  ) {
    throw new Error("Station values must be nonnegative whole feet.");
  }

  const advanceFeet = endAbsoluteFeet - startAbsoluteFeet;
  if (advanceFeet < 0) {
    throw new Error("Reverse station movement is not supported.");
  }

  return advanceFeet;
}
