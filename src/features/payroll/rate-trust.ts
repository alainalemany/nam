import type { Prisma } from "@prisma/client";

import { dateInputValue } from "@/features/timesheets/calculations";

export type RateSelectionEvidence = {
  effectiveFrom: Date;
  hourlyRate: Prisma.Decimal;
  verificationStatus: string;
  provenanceKind: string;
};

export function effectiveRateForDate(
  rates: RateSelectionEvidence[],
  openCandidates: Array<{ earliestEffectiveDate: Date }>,
  date: string,
) {
  if (openCandidates.some((candidate) => dateInputValue(candidate.earliestEffectiveDate) <= date)) {
    return { status: "UNAVAILABLE" as const, reason: "RATE_CHANGE_UNCERTAINTY" as const };
  }
  const eligible = rates.filter((rate) => dateInputValue(rate.effectiveFrom) <= date);
  const latestDate = eligible.reduce<string | undefined>((latest, rate) => {
    const candidate = dateInputValue(rate.effectiveFrom);
    return !latest || candidate > latest ? candidate : latest;
  }, undefined);
  if (!latestDate) {
    return { status: "UNAVAILABLE" as const, reason: "MISSING_VERIFIED_RATE" as const };
  }
  const latest = eligible.filter((rate) => dateInputValue(rate.effectiveFrom) === latestDate);
  if (latest.some((rate) => rate.verificationStatus === "CONFLICT")) {
    return { status: "UNAVAILABLE" as const, reason: "RATE_EVIDENCE_CONFLICT" as const };
  }
  const verified = latest.find((rate) =>
    rate.verificationStatus === "VERIFIED" &&
    (rate.provenanceKind === "PAYCHECK" || rate.provenanceKind === "INDEPENDENT"));
  return verified
    ? { status: "AVAILABLE" as const, hourlyRate: verified.hourlyRate.toString() }
    : { status: "UNAVAILABLE" as const, reason: "MISSING_VERIFIED_RATE" as const };
}
