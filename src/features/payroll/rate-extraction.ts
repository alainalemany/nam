import type { RateExtractionResult } from "./types";

const DECIMAL_VALUE = /^-?\d+(?:\.\d{1,4})?$/u;

function decimalUnits(value: string, scale: number) {
  if (!DECIMAL_VALUE.test(value)) return undefined;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  if (fraction.length > scale) return undefined;
  const units = BigInt(whole) * BigInt(10) ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0"));
  return negative ? -units : units;
}

function divideRoundHalfUp(value: bigint, divisor: bigint): bigint {
  if (value < 0) return -divideRoundHalfUp(-value, divisor);
  return (value + divisor / BigInt(2)) / divisor;
}

function formatUnits(value: bigint, scale: number) {
  const negative = value < 0;
  const absolute = negative ? -value : value;
  const divisor = BigInt(10) ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function normalizedDecimalKey(value: string) {
  return decimalUnits(value, 4)?.toString();
}

export function positiveDecimal(value: string) {
  const units = decimalUnits(value, 4);
  return units !== undefined && units > 0;
}

export function decimalHoursToMinutes(value: string) {
  const units = decimalUnits(value, 4);
  if (units === undefined || units < 0) return undefined;
  const numerator = units * BigInt(60);
  const divisor = BigInt(10_000);
  if (numerator % divisor !== BigInt(0)) return undefined;
  return Number(numerator / divisor);
}

export function sumDecimalValues(values: string[]) {
  if (values.length === 0) return "";
  const scale = Math.max(
    2,
    ...values.map((value) => Math.min(4, value.split(".")[1]?.length ?? 0)),
  );
  let total = BigInt(0);
  for (const value of values) {
    const units = decimalUnits(value, scale);
    if (units === undefined) return "";
    total += units;
  }
  return formatUnits(total, scale);
}

export function assessRegularRateConsistency(
  hours: string,
  hourlyRate: string,
  regularEarnings: string,
  toleranceCents = 1,
) {
  const hourUnits = decimalUnits(hours, 4);
  const rateUnits = decimalUnits(hourlyRate, 4);
  const earningUnits = decimalUnits(regularEarnings, 4);
  if (hourUnits === undefined || rateUnits === undefined || earningUnits === undefined) {
    return undefined;
  }

  // Hours and rate each use four fractional digits, so their product has eight.
  // Divide by 10^6 to round the dollar product to cents.
  const expectedCents = divideRoundHalfUp(hourUnits * rateUnits, BigInt(1_000_000));
  const actualCents = divideRoundHalfUp(earningUnits, BigInt(100));
  const difference = expectedCents > actualCents
    ? expectedCents - actualCents
    : actualCents - expectedCents;
  return {
    consistent: difference <= BigInt(toleranceCents),
    expectedEarnings: formatUnits(expectedCents, 2),
    differenceCents: Number(difference),
  };
}

export function rateSubmissionMatchesExtraction(
  extraction: RateExtractionResult,
  submitted: { regularHours: string; hourlyRate: string; regularEarnings: string },
) {
  if (
    extraction.disposition !== "SUPPORTED" ||
    extraction.observations.length === 0 ||
    extraction.issues.some((issue) => issue.severity !== "INFO") ||
    extraction.observations.some((observation) =>
      !observation.eligibleForVerification ||
      observation.issues.some((issue) => issue.severity !== "INFO"))
  ) return false;

  const observedRates = new Set(
    extraction.observations.map((observation) => normalizedDecimalKey(observation.hourlyRate)),
  );
  const observedHours = sumDecimalValues(
    extraction.observations.map((observation) => observation.regularHours),
  );
  const observedEarnings = sumDecimalValues(
    extraction.observations.map((observation) => observation.regularEarnings),
  );
  const consistency = assessRegularRateConsistency(
    submitted.regularHours,
    submitted.hourlyRate,
    submitted.regularEarnings,
  );
  return observedRates.size === 1 &&
    observedRates.has(normalizedDecimalKey(submitted.hourlyRate)) &&
    normalizedDecimalKey(observedHours) === normalizedDecimalKey(submitted.regularHours) &&
    normalizedDecimalKey(observedEarnings) === normalizedDecimalKey(submitted.regularEarnings) &&
    consistency?.consistent === true;
}
