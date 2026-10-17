import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  acquirePayrollEvidenceLock,
  rateSlotLockKey,
  rateTimelineLockKey,
} from "./evidence-review-locks";

export type RateObservationDraft = {
  sourceRowSequence: number;
  observedHourlyRate: string | null;
  regularMinutes: number | null;
  regularEarnings: string | null;
  observedDateStart: Date | null;
  observedDateEnd: Date | null;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  extractionBasis: "WORKDAY_REGULAR_ROW" | "MANUAL_ENTRY" | "PAYCHECK_CORRECTION";
  dateConfidence: "EXPLICIT_ROW_RANGE" | "PAY_PERIOD_ONLY" | "UNKNOWN";
  observationState: "SUPPORTED" | "REVIEW_REQUIRED" | "UNSUPPORTED";
  parserVersion: string;
};

export type RateObservationClassification =
  | "FIRST_RATE_CANDIDATE"
  | "REPEATED_SUPPORTING_OBSERVATION"
  | "CANDIDATE_INCREASE"
  | "CANDIDATE_DECREASE"
  | "MULTIPLE_RATE_SPLIT"
  | "SAME_DATE_CONFLICT"
  | "UNCERTAIN_EFFECTIVE_DATE_CHANGE"
  | "UNSUPPORTED_OBSERVATION"
  | "CORRECTED_OR_SUPERSEDED_OBSERVATION";

type IngestInput = {
  paycheckId: string;
  employeeId: string;
  evidenceRevision: number;
  observations: RateObservationDraft[];
  supersedePriorRevision: boolean;
  preserveExistingVerifiedRate?: boolean;
};

function dateKey(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function normalizedDecimal(value: string | null) {
  return value === null ? null : new Prisma.Decimal(value).toFixed(4);
}

export function payRateObservationDigest(input: RateObservationDraft) {
  return createHash("sha256").update(JSON.stringify({
    sourceRowSequence: input.sourceRowSequence,
    observedHourlyRate: normalizedDecimal(input.observedHourlyRate),
    regularMinutes: input.regularMinutes,
    regularEarnings: normalizedDecimal(input.regularEarnings),
    observedDateStart: dateKey(input.observedDateStart),
    observedDateEnd: dateKey(input.observedDateEnd),
    payPeriodStart: dateKey(input.payPeriodStart),
    payPeriodEnd: dateKey(input.payPeriodEnd),
    extractionBasis: input.extractionBasis,
    dateConfidence: input.dateConfidence,
    observationState: input.observationState,
    parserVersion: input.parserVersion,
  })).digest("hex");
}

export function payRateObservationBounds(observation: {
  dateConfidence: string;
  observedDateStart: Date | null;
  observedDateEnd: Date | null;
  payPeriodStart: Date;
  payPeriodEnd: Date;
}) {
  if (
    observation.dateConfidence === "EXPLICIT_ROW_RANGE" &&
    observation.observedDateStart &&
    observation.observedDateEnd
  ) {
    return {
      earliestEffectiveDate: observation.observedDateStart,
      latestEffectiveDate: observation.observedDateEnd,
    };
  }
  return {
    earliestEffectiveDate: observation.payPeriodStart,
    latestEffectiveDate: observation.payPeriodEnd,
  };
}

async function addClassifications(
  tx: Prisma.TransactionClient,
  observationId: string,
  kinds: Iterable<RateObservationClassification>,
) {
  const uniqueKinds = [...new Set(kinds)];
  if (uniqueKinds.length === 0) return;
  await tx.payRateObservationClassification.createMany({
    data: uniqueKinds.map((kind) => ({ observationId, kind })),
    skipDuplicates: true,
  });
}

async function attachToCandidate(
  tx: Prisma.TransactionClient,
  observation: {
    id: string;
    employeeId: string;
    observedHourlyRate: Prisma.Decimal | null;
    dateConfidence: string;
    observedDateStart: Date | null;
    observedDateEnd: Date | null;
    payPeriodStart: Date;
    payPeriodEnd: Date;
  },
  afterDate?: Date,
) {
  if (!observation.observedHourlyRate) return undefined;
  const existingLink = await tx.payRateBoundaryCandidateObservation.findFirst({
    where: {
      observationId: observation.id,
      candidate: { status: "OPEN" },
    },
    include: { candidate: true },
  });
  if (existingLink) return existingLink.candidate;

  const bounds = payRateObservationBounds(observation);
  let candidate = await tx.payRateBoundaryCandidate.findFirst({
    where: {
      employeeId: observation.employeeId,
      observedHourlyRate: observation.observedHourlyRate,
      status: "OPEN",
      ...(afterDate ? { earliestEffectiveDate: { gte: afterDate } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!candidate) {
    candidate = await tx.payRateBoundaryCandidate.create({
      data: {
        employeeId: observation.employeeId,
        observedHourlyRate: observation.observedHourlyRate,
        ...bounds,
      },
    });
  } else if (candidate.latestEffectiveDate) {
    const isEarlierDisjointEvidence = bounds.latestEffectiveDate < candidate.earliestEffectiveDate;
    const overlapsCurrentWindow = bounds.earliestEffectiveDate <= candidate.latestEffectiveDate &&
      bounds.latestEffectiveDate >= candidate.earliestEffectiveDate;
    const nextEarliest = isEarlierDisjointEvidence
      ? bounds.earliestEffectiveDate
      : new Date(Math.max(candidate.earliestEffectiveDate.getTime(), bounds.earliestEffectiveDate.getTime()));
    const nextLatest = isEarlierDisjointEvidence
      ? bounds.latestEffectiveDate
      : new Date(Math.min(candidate.latestEffectiveDate.getTime(), bounds.latestEffectiveDate.getTime()));
    const shouldRefineWindow = isEarlierDisjointEvidence || (overlapsCurrentWindow && (
      nextEarliest > candidate.earliestEffectiveDate || nextLatest < candidate.latestEffectiveDate
    ));
    if (shouldRefineWindow) {
      candidate = await tx.payRateBoundaryCandidate.update({
        where: { id: candidate.id },
        data: {
          earliestEffectiveDate: nextEarliest,
          latestEffectiveDate: nextLatest,
          evidenceVersion: { increment: 1 },
        },
      });
    }
  }
  await tx.payRateBoundaryCandidateObservation.create({
    data: { candidateId: candidate.id, observationId: observation.id },
  });
  return candidate;
}

type TemporalSignal = {
  date: Date;
  hourlyRate: Prisma.Decimal;
  kind: "VERIFIED_BOUNDARY" | "OPEN_CANDIDATE" | "RESOLVED_CANDIDATE";
};

async function latestTemporalSignal(
  tx: Prisma.TransactionClient,
  employeeId: string,
  latestEvidenceDate: Date,
) {
  const [rates, candidates] = await Promise.all([
    tx.employeePayRate.findMany({
      where: {
        employeeId,
        verificationStatus: "VERIFIED",
        effectiveFrom: { lte: latestEvidenceDate },
      },
      select: { effectiveFrom: true, hourlyRate: true },
    }),
    tx.payRateBoundaryCandidate.findMany({
      where: {
        employeeId,
        status: { in: ["OPEN", "RESOLVED"] },
        earliestEffectiveDate: { lte: latestEvidenceDate },
      },
      include: {
        resolvedEmployeePayRate: { select: { effectiveFrom: true, hourlyRate: true } },
      },
    }),
  ]);
  const signals: TemporalSignal[] = [
    ...rates.map((rate) => ({
      date: rate.effectiveFrom,
      hourlyRate: rate.hourlyRate,
      kind: "VERIFIED_BOUNDARY" as const,
    })),
    ...candidates.map((candidate) => ({
      date: candidate.resolvedEmployeePayRate?.effectiveFrom ?? candidate.earliestEffectiveDate,
      hourlyRate: candidate.resolvedEmployeePayRate?.hourlyRate ?? candidate.observedHourlyRate,
      kind: candidate.status === "OPEN" ? "OPEN_CANDIDATE" as const : "RESOLVED_CANDIDATE" as const,
    })),
  ];
  if (signals.length === 0) return undefined;
  const latestDate = Math.max(...signals.map((signal) => signal.date.getTime()));
  return signals
    .filter((signal) => signal.date.getTime() === latestDate)
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

export function classifyPayRateDirection(observed: Prisma.Decimal, prior: Prisma.Decimal) {
  if (observed.greaterThan(prior)) return "CANDIDATE_INCREASE" as const;
  if (observed.lessThan(prior)) return "CANDIDATE_DECREASE" as const;
  return undefined;
}

export async function reclassifyPayRateTimeline(
  tx: Prisma.TransactionClient,
  employeeId: string,
) {
  const observations = await tx.payRateObservation.findMany({
    where: {
      employeeId,
      supersession: null,
      observedHourlyRate: { not: null },
      regularMinutes: { gt: 0 },
      regularEarnings: { not: null },
      observationState: { not: "UNSUPPORTED" },
      boundaryCandidates: {
        none: { candidate: { status: "REJECTED" } },
      },
    },
    orderBy: [
      { payPeriodStart: "asc" },
      { sourcePaycheckEvidenceRevision: "asc" },
      { sourceRowSequence: "asc" },
      { id: "asc" },
    ],
  });

  for (const observation of observations) {
    const bounds = payRateObservationBounds(observation);
    const latestSignals = await latestTemporalSignal(tx, employeeId, bounds.latestEffectiveDate);
    const conflictingSignal = latestSignals?.find((signal) =>
      !signal.hourlyRate.equals(observation.observedHourlyRate!));
    if (!conflictingSignal) continue;

    const classifications = new Set<RateObservationClassification>();
    const direction = classifyPayRateDirection(observation.observedHourlyRate!, conflictingSignal.hourlyRate);
    if (direction) classifications.add(direction);
    if (observation.dateConfidence !== "EXPLICIT_ROW_RANGE") {
      classifications.add("UNCERTAIN_EFFECTIVE_DATE_CHANGE");
    }
    if (latestSignals!.length > 1) classifications.add("SAME_DATE_CONFLICT");
    await addClassifications(tx, observation.id, classifications);

    const activeVerified = await tx.employeePayRate.findFirst({
      where: {
        employeeId,
        verificationStatus: "VERIFIED",
        effectiveFrom: { lte: bounds.earliestEffectiveDate },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    const onlyPendingContradiction = conflictingSignal.kind === "OPEN_CANDIDATE" &&
      activeVerified?.hourlyRate.equals(observation.observedHourlyRate!) === true;
    if (!onlyPendingContradiction) {
      await attachToCandidate(tx, observation, conflictingSignal.date);
    }
  }
}

async function supersedePriorObservations(
  tx: Prisma.TransactionClient,
  input: IngestInput,
  replacements: Array<{ id: string; sourceRowSequence: number }>,
) {
  if (!input.supersedePriorRevision || replacements.length === 0) return;
  const prior = await tx.payRateObservation.findMany({
    where: {
      sourcePaycheckId: input.paycheckId,
      sourcePaycheckEvidenceRevision: { lt: input.evidenceRevision },
      supersession: null,
    },
    select: { id: true, sourceRowSequence: true },
    orderBy: [{ sourcePaycheckEvidenceRevision: "desc" }, { sourceRowSequence: "asc" }],
  });
  if (prior.length === 0) return;

  for (const oldObservation of prior) {
    const replacement = replacements.find((item) => item.sourceRowSequence === oldObservation.sourceRowSequence) ?? replacements[0];
    await tx.payRateObservationSupersession.create({
      data: {
        priorObservationId: oldObservation.id,
        replacementObservationId: replacement.id,
      },
    });
    await addClassifications(tx, oldObservation.id, ["CORRECTED_OR_SUPERSEDED_OBSERVATION"]);
    await addClassifications(tx, replacement.id, ["CORRECTED_OR_SUPERSEDED_OBSERVATION"]);
  }

  const candidateIds = await tx.payRateBoundaryCandidateObservation.findMany({
    where: { observationId: { in: prior.map((item) => item.id) } },
    select: { candidateId: true },
    distinct: ["candidateId"],
  });
  for (const { candidateId } of candidateIds.sort((left, right) => left.candidateId.localeCompare(right.candidateId))) {
    const candidate = await tx.payRateBoundaryCandidate.findUnique({
      where: { id: candidateId },
      include: {
        observations: {
          include: { observation: { include: { supersession: true } } },
        },
      },
    });
    if (
      candidate?.status === "OPEN" &&
      candidate.observations.length > 0 &&
      candidate.observations.every((link) => link.observation.supersession !== null)
    ) {
      await tx.payRateBoundaryCandidate.update({
        where: { id: candidate.id },
        data: { status: "SUPERSEDED", evidenceVersion: { increment: 1 } },
      });
    }
  }
}

export async function ingestPayRateObservations(
  tx: Prisma.TransactionClient,
  input: IngestInput,
) {
  await acquirePayrollEvidenceLock(tx, "paycheck", input.paycheckId);
  await acquirePayrollEvidenceLock(tx, "rate-timeline", rateTimelineLockKey(input.employeeId));

  const paycheck = await tx.paycheck.findUnique({
    where: { id: input.paycheckId },
    select: { employeeId: true, evidenceRevision: true, reviewStatus: true },
  });
  if (
    !paycheck ||
    paycheck.employeeId !== input.employeeId ||
    paycheck.evidenceRevision !== input.evidenceRevision ||
    paycheck.reviewStatus !== "CONFIRMED"
  ) {
    throw new Error("PAY_RATE_OBSERVATION_SOURCE_INVALID");
  }

  const orderedDrafts = [...input.observations]
    .sort((left, right) => left.sourceRowSequence - right.sourceRowSequence);
  const existing = await tx.payRateObservation.findMany({
    where: {
      sourcePaycheckId: input.paycheckId,
      sourcePaycheckEvidenceRevision: input.evidenceRevision,
    },
    include: { classifications: true, rateSupports: true, boundaryCandidates: true },
    orderBy: { sourceRowSequence: "asc" },
  });
  if (existing.length > 0) {
    if (
      existing.length !== input.observations.length ||
      existing.some((item, index) => {
        const draft = orderedDrafts[index];
        return !draft ||
          item.sourceRowSequence !== draft.sourceRowSequence ||
          item.observationDigest !== payRateObservationDigest(draft);
      })
    ) {
      throw new Error("PAY_RATE_OBSERVATION_REVISION_CONFLICT");
    }
    return existing;
  }

  const created = [];
  for (const observation of orderedDrafts) {
    created.push(await tx.payRateObservation.create({
      data: {
        employeeId: input.employeeId,
        sourcePaycheckId: input.paycheckId,
        sourcePaycheckEvidenceRevision: input.evidenceRevision,
        sourceRowSequence: observation.sourceRowSequence,
        observedHourlyRate: observation.observedHourlyRate === null ? null : new Prisma.Decimal(observation.observedHourlyRate),
        regularMinutes: observation.regularMinutes,
        regularEarnings: observation.regularEarnings === null ? null : new Prisma.Decimal(observation.regularEarnings),
        observedDateStart: observation.observedDateStart,
        observedDateEnd: observation.observedDateEnd,
        payPeriodStart: observation.payPeriodStart,
        payPeriodEnd: observation.payPeriodEnd,
        extractionBasis: observation.extractionBasis,
        dateConfidence: observation.dateConfidence,
        observationState: observation.observationState,
        parserVersion: observation.parserVersion,
        observationDigest: payRateObservationDigest(observation),
      },
    }));
  }

  await supersedePriorObservations(tx, input, created);

  const verifiedRates = await tx.employeePayRate.findMany({
    where: { employeeId: input.employeeId, verificationStatus: "VERIFIED" },
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
  });
  const distinctBatchRates = new Set(
    created.flatMap((item) => item.observedHourlyRate ? [item.observedHourlyRate.toFixed(4)] : []),
  );

  for (const observation of created) {
    const classifications = new Set<RateObservationClassification>();
    if (
      observation.observationState === "UNSUPPORTED" ||
      observation.observedHourlyRate === null ||
      observation.regularMinutes === null ||
      observation.regularMinutes === 0 ||
      observation.regularEarnings === null
    ) {
      classifications.add("UNSUPPORTED_OBSERVATION");
      await addClassifications(tx, observation.id, classifications);
      continue;
    }

    const bounds = payRateObservationBounds(observation);
    const activeAtStart = [...verifiedRates]
      .reverse()
      .find((rate) => rate.effectiveFrom <= bounds.earliestEffectiveDate);
    const latestSignals = await latestTemporalSignal(
      tx,
      input.employeeId,
      bounds.latestEffectiveDate,
    );
    const contradictorySignal = latestSignals?.find((signal) =>
      !signal.hourlyRate.equals(observation.observedHourlyRate!));
    const boundariesInRange = verifiedRates.filter((rate) =>
      rate.effectiveFrom >= bounds.earliestEffectiveDate &&
      rate.effectiveFrom <= bounds.latestEffectiveDate);
    const differentBoundaryInRange = boundariesInRange.some((rate) =>
      !rate.hourlyRate.equals(observation.observedHourlyRate!));
    const competingCandidates = await tx.payRateBoundaryCandidate.findMany({
      where: {
        employeeId: input.employeeId,
        status: "OPEN",
        observedHourlyRate: { not: observation.observedHourlyRate },
        earliestEffectiveDate: { lte: bounds.latestEffectiveDate },
        OR: [
          { latestEffectiveDate: null },
          { latestEffectiveDate: { gte: bounds.earliestEffectiveDate } },
        ],
      },
      include: { observations: { select: { observationId: true } } },
    });

    if (distinctBatchRates.size > 1) classifications.add("MULTIPLE_RATE_SPLIT");
    if (differentBoundaryInRange || competingCandidates.length > 0) {
      classifications.add("SAME_DATE_CONFLICT");
      for (const competingObservationId of competingCandidates.flatMap((candidate) =>
        candidate.observations.map((link) => link.observationId))) {
        await addClassifications(tx, competingObservationId, ["SAME_DATE_CONFLICT"]);
      }
    }

    const pendingReturnToVerifiedRate = distinctBatchRates.size === 1 &&
      contradictorySignal?.kind === "OPEN_CANDIDATE" &&
      activeAtStart?.hourlyRate.equals(observation.observedHourlyRate) === true;
    if (pendingReturnToVerifiedRate) {
      const direction = classifyPayRateDirection(observation.observedHourlyRate, contradictorySignal.hourlyRate);
      if (direction) classifications.add(direction);
      if (observation.dateConfidence !== "EXPLICIT_ROW_RANGE") {
        classifications.add("UNCERTAIN_EFFECTIVE_DATE_CHANGE");
      }
      await addClassifications(tx, observation.id, classifications);
      continue;
    }

    const unchangedCorrection = input.preserveExistingVerifiedRate === true &&
      observation.extractionBasis === "PAYCHECK_CORRECTION" &&
      activeAtStart?.hourlyRate.equals(observation.observedHourlyRate) === true &&
      !differentBoundaryInRange &&
      !contradictorySignal &&
      distinctBatchRates.size === 1;
    if (unchangedCorrection) {
      classifications.add("REPEATED_SUPPORTING_OBSERVATION");
      await addClassifications(tx, observation.id, classifications);
      continue;
    }

    const canReinforce = observation.extractionBasis === "WORKDAY_REGULAR_ROW" &&
      observation.observationState === "SUPPORTED" &&
      activeAtStart?.hourlyRate.equals(observation.observedHourlyRate) === true &&
      !differentBoundaryInRange &&
      distinctBatchRates.size === 1;
    if (canReinforce) {
      classifications.add("REPEATED_SUPPORTING_OBSERVATION");
      await tx.payRateObservationSupport.create({
        data: {
          employeePayRateId: activeAtStart!.id,
          observationId: observation.id,
          supportKind: "REINFORCING",
        },
      });
      await addClassifications(tx, observation.id, classifications);
      continue;
    }

    const openSameRate = await tx.payRateBoundaryCandidate.findFirst({
      where: {
        employeeId: input.employeeId,
        observedHourlyRate: observation.observedHourlyRate,
        status: "OPEN",
      },
    });
    if (openSameRate) {
      classifications.add("REPEATED_SUPPORTING_OBSERVATION");
    } else if (!activeAtStart && !contradictorySignal) {
      classifications.add("FIRST_RATE_CANDIDATE");
    } else {
      const direction = classifyPayRateDirection(
        observation.observedHourlyRate,
        contradictorySignal?.hourlyRate ?? activeAtStart!.hourlyRate,
      );
      if (direction) classifications.add(direction);
      else classifications.add("SAME_DATE_CONFLICT");
    }
    if (observation.dateConfidence !== "EXPLICIT_ROW_RANGE") {
      classifications.add("UNCERTAIN_EFFECTIVE_DATE_CHANGE");
    }
    await attachToCandidate(tx, observation, contradictorySignal?.date);
    await addClassifications(tx, observation.id, classifications);
  }

  await reclassifyPayRateTimeline(tx, input.employeeId);

  return tx.payRateObservation.findMany({
    where: { id: { in: created.map((item) => item.id) } },
    include: { classifications: true, rateSupports: true, boundaryCandidates: true },
    orderBy: { sourceRowSequence: "asc" },
  });
}

export async function supersedePaycheckRateEvidenceForCorrection(
  tx: Prisma.TransactionClient,
  input: { paycheckId: string; employeeId: string; evidenceRevision: number },
) {
  await acquirePayrollEvidenceLock(tx, "paycheck", input.paycheckId);
  await acquirePayrollEvidenceLock(tx, "rate-timeline", rateTimelineLockKey(input.employeeId));
  const linkedRates = await tx.employeePayRate.findMany({
    where: {
      verificationStatus: { in: ["NEEDS_REVIEW", "VERIFIED", "CONFLICT"] },
      OR: [
        { sourcePaycheckId: input.paycheckId, provenanceKind: "PAYCHECK" },
        { provenanceCandidatePaycheckId: input.paycheckId },
      ],
    },
    include: { reviewEvents: { select: { sequence: true } } },
    orderBy: [{ evidenceVersion: "desc" }, { createdAt: "desc" }],
  });
  if (linkedRates.some((rate) => rate.employeeId !== input.employeeId)) {
    throw new Error("PAY_RATE_PROVENANCE_MISMATCH");
  }
  const supersedable = linkedRates.filter((rate) =>
    rate.provenanceKind === "PAYCHECK" &&
    rate.sourcePaycheckId === input.paycheckId &&
    (rate.verificationStatus === "VERIFIED" || rate.verificationStatus === "CONFLICT"));
  for (const slotKey of [...new Set(supersedable.map((rate) =>
    rateSlotLockKey(rate.employeeId, rate.effectiveFrom)))].sort()) {
    await acquirePayrollEvidenceLock(tx, "rate-slot", slotKey);
  }
  if (linkedRates.length > 0) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "EmployeePayRate" WHERE "id" IN (${Prisma.join(linkedRates.map((rate) => rate.id).sort())}) ORDER BY "id" FOR UPDATE`,
    );
  }
  if (supersedable.length === 0) return 0;
  const initiator = await tx.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, displayName: true, employeeCode: true },
  });
  if (!initiator) throw new Error("ACCESS_DENIED");
  const correctionToken = randomUUID();
  const correctionDigest = createHash("sha256").update(JSON.stringify({
    paycheckId: input.paycheckId,
    evidenceRevision: input.evidenceRevision,
  })).digest("hex");

  for (const rate of supersedable.sort((left, right) => left.id.localeCompare(right.id))) {
    const updated = await tx.employeePayRate.updateMany({
      where: {
        id: rate.id,
        evidenceVersion: rate.evidenceVersion,
        verificationStatus: rate.verificationStatus,
      },
      data: { verificationStatus: "SUPERSEDED", evidenceVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new Error("STALE_RATE_EVIDENCE");
    await tx.payRateEvidenceReviewEvent.create({
      data: {
        employeePayRateId: rate.id,
        sequence: Math.max(0, ...rate.reviewEvents.map((event) => event.sequence)) + 1,
        decisionKind: "PAYCHECK_CORRECTION_SUPERSEDED",
        attributionKind: "PAYCHECK_CORRECTION_SYSTEM",
        previousStatus: rate.verificationStatus,
        newStatus: "SUPERSEDED",
        previousProvenanceKind: rate.provenanceKind,
        newProvenanceKind: rate.provenanceKind,
        previousSourcePaycheckId: rate.sourcePaycheckId,
        newSourcePaycheckId: rate.sourcePaycheckId,
        previousVersion: rate.evidenceVersion,
        newVersion: rate.evidenceVersion + 1,
        initiatedByEmployeeId: initiator.id,
        initiatedByDisplayNameSnapshot: initiator.displayName,
        initiatedByEmployeeCodeSnapshot: initiator.employeeCode,
        reason: "Automatic supersession caused by an authenticated Paycheck correction.",
        sourceEvidenceReference: `Paycheck correction ${input.paycheckId}`,
        requestToken: correctionToken,
        requestDigest: correctionDigest,
      },
    });
  }
  return supersedable.length;
}
