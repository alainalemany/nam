import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { parsePayrollDateOnly } from "./date-only";
import {
  acquirePayrollEvidenceLock,
  rateSlotLockKey,
  rateTimelineLockKey,
} from "./evidence-review-locks";
import {
  EvidenceReviewError,
  type EvidenceReviewerActor,
  type EvidenceReviewSuccess,
} from "./evidence-review-types";
import type {
  PayRateBoundaryRejectionInput,
  PayRateBoundaryVerificationInput,
} from "./evidence-review-validation";
import { reclassifyPayRateTimeline } from "./rate-observations";

type Dependencies = {
  client?: PrismaClient;
  hooks?: {
    afterCandidateUpdate?: (transaction: Prisma.TransactionClient) => Promise<void>;
    beforeCommit?: (transaction: Prisma.TransactionClient) => Promise<void>;
  };
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

type BoundaryDecisionInput = PayRateBoundaryVerificationInput | PayRateBoundaryRejectionInput;

function requestDigest(input: BoundaryDecisionInput) {
  return createHash("sha256").update(JSON.stringify(stableValue({
    domain: "pay-rate-boundary",
    input,
  }))).digest("hex");
}

function invalid(message: string): never {
  throw new EvidenceReviewError("INVALID_TRANSITION", message);
}

async function priorBoundaryDecision(
  tx: Prisma.TransactionClient,
  actor: EvidenceReviewerActor,
  input: BoundaryDecisionInput,
  digest: string,
) {
  const [timesheetEvents, rateEvents, boundaryEvents] = await Promise.all([
    tx.timesheetIdentityReviewEvent.findMany({
      where: { reviewerEmployeeId: actor.employeeId, requestToken: input.requestToken },
    }),
    tx.payRateEvidenceReviewEvent.findMany({
      where: { reviewerEmployeeId: actor.employeeId, requestToken: input.requestToken },
    }),
    tx.payRateBoundaryDecisionEvent.findMany({
      where: { reviewerEmployeeId: actor.employeeId, requestToken: input.requestToken },
    }),
  ]);
  if (timesheetEvents.length > 0 || rateEvents.length > 0) {
    throw new EvidenceReviewError("INVALID_IDEMPOTENCY_TOKEN", "That review token was already used for a different decision.");
  }
  if (boundaryEvents.length === 0) return undefined;
  const event = boundaryEvents.find((item) => item.candidateId === input.candidateId);
  if (!event || boundaryEvents.some((item) => item.requestDigest !== digest)) {
    throw new EvidenceReviewError("INVALID_IDEMPOTENCY_TOKEN", "That review token was already used for a different decision.");
  }
  return {
    ok: true as const,
    targetId: event.candidateId,
    newState: event.newStatus,
    newVersion: event.newVersion,
    auditEventId: event.id,
    idempotencyReplay: true,
  };
}

export async function verifyExactPayRateBoundary(
  actor: EvidenceReviewerActor,
  input: PayRateBoundaryVerificationInput,
  dependencies: Dependencies = {},
): Promise<EvidenceReviewSuccess> {
  const client = dependencies.client ?? prisma;
  const digest = requestDigest(input);
  let exactEffectiveDate: Date;
  try {
    exactEffectiveDate = parsePayrollDateOnly(input.exactEffectiveDate);
  } catch {
    invalid("The exact effective date must be a real calendar date in YYYY-MM-DD format.");
  }
  try {
    return await client.$transaction(async (tx) => {
      await acquirePayrollEvidenceLock(tx, "review-request", `${actor.employeeId}:${input.requestToken}`);
      const replay = await priorBoundaryDecision(tx, actor, input, digest);
      if (replay) return replay;

      const initial = await tx.payRateBoundaryCandidate.findUnique({
        where: { id: input.candidateId },
        include: { observations: { include: { observation: true } } },
      });
      if (!initial) throw new EvidenceReviewError("EVIDENCE_NOT_FOUND", "Rate-boundary evidence was not found.");

      const paycheckIds = [...new Set(initial.observations.map((item) => item.observation.sourcePaycheckId))].sort();
      for (const paycheckId of paycheckIds) {
        await acquirePayrollEvidenceLock(tx, "paycheck", paycheckId);
      }
      await acquirePayrollEvidenceLock(tx, "rate-timeline", rateTimelineLockKey(initial.employeeId));
      await acquirePayrollEvidenceLock(tx, "rate-slot", rateSlotLockKey(initial.employeeId, exactEffectiveDate));
      await tx.$queryRaw`SELECT "id" FROM "PayRateBoundaryCandidate" WHERE "id" = ${initial.id} FOR UPDATE`;

      const current = await tx.payRateBoundaryCandidate.findUnique({
        where: { id: initial.id },
        include: {
          observations: {
            include: {
              observation: {
                include: {
                  supersession: true,
                  sourcePaycheck: { select: { evidenceRevision: true, reviewStatus: true } },
                },
              },
            },
          },
          decisionEvents: { select: { sequence: true } },
        },
      });
      if (!current) throw new EvidenceReviewError("EVIDENCE_NOT_FOUND", "Rate-boundary evidence was not found.");
      if (current.status !== "OPEN" || current.evidenceVersion !== input.expectedEvidenceVersion) {
        throw new EvidenceReviewError("STALE_REVIEW", "Rate-boundary evidence changed before this decision was saved.");
      }
      if (
        exactEffectiveDate < current.earliestEffectiveDate ||
        (current.latestEffectiveDate && exactEffectiveDate > current.latestEffectiveDate)
      ) {
        invalid("The exact effective date must be inside the authenticated evidence window.");
      }

      const supportedObservations = current.observations
        .map((item) => item.observation)
        .filter((observation) =>
          observation.supersession === null &&
          observation.extractionBasis === "WORKDAY_REGULAR_ROW" &&
          observation.observationState === "SUPPORTED" &&
          observation.sourcePaycheck.reviewStatus === "CONFIRMED" &&
          observation.sourcePaycheckEvidenceRevision === observation.sourcePaycheck.evidenceRevision &&
          observation.observedHourlyRate?.equals(current.observedHourlyRate));
      if (supportedObservations.length === 0) {
        invalid("An exact boundary requires active authenticated Workday rate observations.");
      }
      if (!supportedObservations.some((observation) => {
        const evidenceStart = observation.observedDateStart ?? observation.payPeriodStart;
        const evidenceEnd = observation.observedDateEnd ?? observation.payPeriodEnd;
        return exactEffectiveDate >= evidenceStart && exactEffectiveDate <= evidenceEnd;
      })) {
        invalid("The exact effective date must be covered by active authenticated Workday evidence.");
      }

      const competingRate = await tx.employeePayRate.findFirst({
        where: {
          employeeId: current.employeeId,
          effectiveFrom: exactEffectiveDate,
          verificationStatus: "VERIFIED",
        },
      });
      if (competingRate) {
        throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "A verified rate already occupies that Employee and effective date.");
      }
      const competingCandidate = await tx.payRateBoundaryCandidate.findFirst({
        where: {
          id: { not: current.id },
          employeeId: current.employeeId,
          status: "OPEN",
          observedHourlyRate: { not: current.observedHourlyRate },
          earliestEffectiveDate: { lte: exactEffectiveDate },
          OR: [
            { latestEffectiveDate: null },
            { latestEffectiveDate: { gte: exactEffectiveDate } },
          ],
        },
      });
      if (competingCandidate) {
        throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "Conflicting open observations cover that effective date and require explicit resolution.");
      }

      const primaryObservation = [...supportedObservations].sort((left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))[0];
      const rate = await tx.employeePayRate.create({
        data: {
          employeeId: current.employeeId,
          effectiveFrom: exactEffectiveDate,
          hourlyRate: current.observedHourlyRate,
          sourceNote: "Owner-verified exact boundary supported by authenticated Workday rate observations",
          sourcePaycheckId: primaryObservation.sourcePaycheckId,
          verificationStatus: "VERIFIED",
          provenanceKind: "PAYCHECK",
          evidenceVersion: 1,
        },
      });
      const updated = await tx.payRateBoundaryCandidate.updateMany({
        where: { id: current.id, status: "OPEN", evidenceVersion: current.evidenceVersion },
        data: {
          status: "RESOLVED",
          resolvedEmployeePayRateId: rate.id,
          evidenceVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new EvidenceReviewError("STALE_REVIEW", "Rate-boundary evidence changed before this decision was saved.");
      }
      await dependencies.hooks?.afterCandidateUpdate?.(tx);
      await reclassifyPayRateTimeline(tx, current.employeeId);

      for (const [index, observation] of supportedObservations.entries()) {
        await tx.payRateObservationSupport.create({
          data: {
            employeePayRateId: rate.id,
            observationId: observation.id,
            supportKind: index === 0 ? "PRIMARY" : "REINFORCING",
          },
        });
      }
      const newVersion = current.evidenceVersion + 1;
      const event = await tx.payRateBoundaryDecisionEvent.create({
        data: {
          candidateId: current.id,
          sequence: Math.max(0, ...current.decisionEvents.map((item) => item.sequence)) + 1,
          decisionKind: "VERIFIED_EXACT_BOUNDARY",
          previousStatus: current.status,
          newStatus: "RESOLVED",
          previousVersion: current.evidenceVersion,
          newVersion,
          exactEffectiveDate,
          employeePayRateId: rate.id,
          reviewerEmployeeId: actor.employeeId,
          reviewerDisplayNameSnapshot: actor.displayName,
          reviewerEmployeeCodeSnapshot: actor.employeeCode,
          reason: input.reason,
          sourceEvidenceReference: input.sourceEvidenceReference ?? null,
          requestToken: input.requestToken,
          requestDigest: digest,
        },
      });
      await dependencies.hooks?.beforeCommit?.(tx);
      return {
        ok: true,
        targetId: current.id,
        newState: "RESOLVED",
        newVersion,
        auditEventId: event.id,
        idempotencyReplay: false,
      };
    });
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      ? JSON.stringify(error.meta?.target ?? "")
      : "";
    if (target.includes("employeeId") && target.includes("effectiveFrom")) {
      throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "A verified rate already occupies that Employee and effective date.");
    }
    throw error;
  }
}

export async function rejectPayRateBoundaryCandidate(
  actor: EvidenceReviewerActor,
  input: PayRateBoundaryRejectionInput,
  dependencies: Dependencies = {},
): Promise<EvidenceReviewSuccess> {
  const client = dependencies.client ?? prisma;
  const digest = requestDigest(input);
  return client.$transaction(async (tx) => {
    await acquirePayrollEvidenceLock(tx, "review-request", `${actor.employeeId}:${input.requestToken}`);
    const replay = await priorBoundaryDecision(tx, actor, input, digest);
    if (replay) return replay;

    const initial = await tx.payRateBoundaryCandidate.findUnique({
      where: { id: input.candidateId },
      include: { observations: { include: { observation: true } } },
    });
    if (!initial) throw new EvidenceReviewError("EVIDENCE_NOT_FOUND", "Rate-boundary evidence was not found.");

    const paycheckIds = [...new Set(initial.observations.map((item) =>
      item.observation.sourcePaycheckId))].sort();
    for (const paycheckId of paycheckIds) {
      await acquirePayrollEvidenceLock(tx, "paycheck", paycheckId);
    }
    await acquirePayrollEvidenceLock(tx, "rate-timeline", rateTimelineLockKey(initial.employeeId));
    await tx.$queryRaw`SELECT "id" FROM "PayRateBoundaryCandidate" WHERE "id" = ${initial.id} FOR UPDATE`;

    const current = await tx.payRateBoundaryCandidate.findUnique({
      where: { id: initial.id },
      include: { decisionEvents: { select: { sequence: true } } },
    });
    if (!current) throw new EvidenceReviewError("EVIDENCE_NOT_FOUND", "Rate-boundary evidence was not found.");
    if (current.status !== "OPEN" || current.evidenceVersion !== input.expectedEvidenceVersion) {
      throw new EvidenceReviewError("STALE_REVIEW", "Rate-boundary evidence changed before this decision was saved.");
    }

    const updated = await tx.payRateBoundaryCandidate.updateMany({
      where: { id: current.id, status: "OPEN", evidenceVersion: current.evidenceVersion },
      data: { status: "REJECTED", evidenceVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new EvidenceReviewError("STALE_REVIEW", "Rate-boundary evidence changed before this decision was saved.");
    }
    await dependencies.hooks?.afterCandidateUpdate?.(tx);
    await reclassifyPayRateTimeline(tx, current.employeeId);

    const newVersion = current.evidenceVersion + 1;
    const event = await tx.payRateBoundaryDecisionEvent.create({
      data: {
        candidateId: current.id,
        sequence: Math.max(0, ...current.decisionEvents.map((item) => item.sequence)) + 1,
        decisionKind: "REJECTED",
        previousStatus: "OPEN",
        newStatus: "REJECTED",
        previousVersion: current.evidenceVersion,
        newVersion,
        reviewerEmployeeId: actor.employeeId,
        reviewerDisplayNameSnapshot: actor.displayName,
        reviewerEmployeeCodeSnapshot: actor.employeeCode,
        reason: input.reason,
        sourceEvidenceReference: input.sourceEvidenceReference ?? null,
        requestToken: input.requestToken,
        requestDigest: digest,
      },
    });
    await dependencies.hooks?.beforeCommit?.(tx);
    return {
      ok: true,
      targetId: current.id,
      newState: "REJECTED",
      newVersion,
      auditEventId: event.id,
      idempotencyReplay: false,
    };
  });
}
