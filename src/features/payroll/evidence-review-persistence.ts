import "server-only";

import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { acquirePayrollEvidenceLock, rateSlotLockKey } from "./evidence-review-locks";
import {
  EvidenceReviewError,
  type EvidenceReviewerActor,
  type EvidenceReviewSuccess,
} from "./evidence-review-types";
import type {
  PayRateEvidenceResolutionInput,
  PayRateEvidenceReviewInput,
  TimesheetIdentityReviewInput,
} from "./evidence-review-validation";

type Transaction = Prisma.TransactionClient;

export type EvidenceReviewPersistenceHooks = {
  afterTargetUpdate?: (transaction: Transaction) => Promise<void>;
  beforeCommit?: (transaction: Transaction) => Promise<void>;
};

type Dependencies = {
  client?: PrismaClient;
  hooks?: EvidenceReviewPersistenceHooks;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function reviewRequestDigest(domain: "timesheet" | "rate", input: unknown) {
  return createHash("sha256").update(canonicalJson({ domain, input })).digest("hex");
}

function replayMismatch(): never {
  throw new EvidenceReviewError(
    "INVALID_IDEMPOTENCY_TOKEN",
    "That submission token was already used for a different review decision.",
  );
}

async function existingOperation(
  transaction: Transaction,
  reviewerEmployeeId: string,
  requestToken: string,
) {
  const [timesheetEvents, rateEvents] = await Promise.all([
    transaction.timesheetIdentityReviewEvent.findMany({
      where: { reviewerEmployeeId, requestToken },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    transaction.payRateEvidenceReviewEvent.findMany({
      where: { reviewerEmployeeId, requestToken },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return { timesheetEvents, rateEvents };
}

function assertReplayDigest(events: Array<{ requestDigest: string }>, digest: string) {
  if (events.some((event) => event.requestDigest !== digest)) replayMismatch();
}

function nextSequence(events: Array<{ sequence: number }>) {
  return (events.reduce((maximum, event) => Math.max(maximum, event.sequence), 0)) + 1;
}

function notFound(): never {
  throw new EvidenceReviewError("EVIDENCE_NOT_FOUND", "The evidence record could not be found.");
}

function stale(): never {
  throw new EvidenceReviewError("STALE_REVIEW", "This evidence changed after it was loaded. Reload and review the current state.");
}

function invalidTransition(): never {
  throw new EvidenceReviewError("INVALID_TRANSITION", "That review transition is not allowed from the current state.");
}

function isTrustedIdentity(status: string) {
  return status === "EXPLICIT_SELECTION" || status === "OWNER_VERIFIED";
}

export async function reviewTimesheetIdentity(
  actor: EvidenceReviewerActor,
  input: TimesheetIdentityReviewInput,
  dependencies: Dependencies = {},
): Promise<EvidenceReviewSuccess> {
  const client = dependencies.client ?? prisma;
  const digest = reviewRequestDigest("timesheet", input);
  try {
    return await client.$transaction(async (transaction) => {
      await acquirePayrollEvidenceLock(transaction, "review-request", `${actor.employeeId}:${input.requestToken}`);
      const priorOperation = await existingOperation(transaction, actor.employeeId, input.requestToken);
      if (priorOperation.rateEvents.length > 0) replayMismatch();
      if (priorOperation.timesheetEvents.length > 0) {
        assertReplayDigest(priorOperation.timesheetEvents, digest);
        const event = priorOperation.timesheetEvents.find(
          (candidate) => candidate.weeklyTimesheetId === input.timesheetId,
        );
        if (!event) replayMismatch();
        return {
          ok: true,
          targetId: event.weeklyTimesheetId,
          newState: event.newStatus,
          newVersion: event.newVersion,
          auditEventId: event.id,
          idempotencyReplay: true,
        };
      }

      await acquirePayrollEvidenceLock(transaction, "timesheet", input.timesheetId);
      const current = await transaction.weeklyTimesheet.findUnique({
        where: { id: input.timesheetId },
        include: {
          primaryEmployee: { select: { id: true, displayName: true, employeeCode: true } },
          identityReviewEvents: { select: { sequence: true } },
        },
      });
      if (!current) notFound();
      if (current.identityVersion !== input.expectedIdentityVersion) stale();

      let newStatus: "OWNER_VERIFIED" | "REVIEWED_UNASSIGNED" | "NEEDS_REVIEW";
      let decisionKind: "OWNER_VERIFIED" | "REVIEWED_UNASSIGNED" | "REOPENED_UNCERTAINTY" | "OWNER_CORRECTED";
      let newEmployee: { id: string; displayName: string; employeeCode: string | null } | null = null;

      if (input.decision === "VERIFY_OWNER") {
        if (!(["NEEDS_REVIEW", "REVIEWED_UNASSIGNED"] as string[]).includes(current.primaryEmployeeIdentityStatus)) {
          invalidTransition();
        }
        newEmployee = await transaction.employee.findUnique({
          where: { id: input.employeeId },
          select: { id: true, displayName: true, employeeCode: true },
        });
        if (!newEmployee) notFound();
        newStatus = "OWNER_VERIFIED";
        decisionKind = "OWNER_VERIFIED";
      } else if (input.decision === "REVIEW_UNASSIGNED") {
        if (current.primaryEmployeeIdentityStatus !== "NEEDS_REVIEW") invalidTransition();
        newStatus = "REVIEWED_UNASSIGNED";
        decisionKind = "REVIEWED_UNASSIGNED";
      } else if (input.decision === "REOPEN_UNCERTAINTY") {
        if (current.primaryEmployeeIdentityStatus !== "OWNER_VERIFIED") invalidTransition();
        newStatus = "NEEDS_REVIEW";
        decisionKind = "REOPENED_UNCERTAINTY";
      } else {
        if (current.primaryEmployeeIdentityStatus !== "OWNER_VERIFIED") invalidTransition();
        newEmployee = await transaction.employee.findUnique({
          where: { id: input.employeeId },
          select: { id: true, displayName: true, employeeCode: true },
        });
        if (!newEmployee) notFound();
        if (newEmployee.id === current.primaryEmployeeId) invalidTransition();
        newStatus = "OWNER_VERIFIED";
        decisionKind = "OWNER_CORRECTED";
      }

      const newVersion = current.identityVersion + 1;
      const updated = await transaction.weeklyTimesheet.updateMany({
        where: {
          id: current.id,
          identityVersion: current.identityVersion,
          primaryEmployeeIdentityStatus: current.primaryEmployeeIdentityStatus,
          primaryEmployeeId: current.primaryEmployeeId,
        },
        data: {
          primaryEmployeeIdentityStatus: newStatus,
          primaryEmployeeId: newEmployee?.id ?? null,
          identityVersion: newVersion,
        },
      });
      if (updated.count !== 1) stale();
      await dependencies.hooks?.afterTargetUpdate?.(transaction);

      const event = await transaction.timesheetIdentityReviewEvent.create({
        data: {
          weeklyTimesheetId: current.id,
          sequence: nextSequence(current.identityReviewEvents),
          decisionKind,
          previousStatus: current.primaryEmployeeIdentityStatus,
          newStatus,
          previousPrimaryEmployeeId: current.primaryEmployeeId,
          previousEmployeeDisplayNameSnapshot: current.primaryEmployee?.displayName ?? null,
          previousEmployeeCodeSnapshot: current.primaryEmployee?.employeeCode ?? null,
          newPrimaryEmployeeId: newEmployee?.id ?? null,
          newEmployeeDisplayNameSnapshot: newEmployee?.displayName ?? null,
          newEmployeeCodeSnapshot: newEmployee?.employeeCode ?? null,
          previousVersion: current.identityVersion,
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
      await dependencies.hooks?.beforeCommit?.(transaction);
      return {
        ok: true,
        targetId: current.id,
        newState: newStatus,
        newVersion,
        auditEventId: event.id,
        idempotencyReplay: false,
      };
    });
  } catch (error) {
    const uniqueTarget =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? JSON.stringify(error.meta?.target ?? "")
        : "";
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (uniqueTarget.includes("WeeklyTimesheet_trusted_employee_week_key") ||
        (uniqueTarget.includes("primaryEmployeeId") && uniqueTarget.includes("payrollWeekStartDate")))
    ) {
      throw new EvidenceReviewError(
        "IDENTITY_CONFLICT",
        "A trusted Timesheet already exists for that Employee and payroll week.",
      );
    }
    throw error;
  }
}

type RateRecord = Awaited<ReturnType<typeof loadRate>>;

async function loadRate(transaction: Transaction, id: string) {
  return transaction.employeePayRate.findUnique({
    where: { id },
    include: { reviewEvents: { select: { sequence: true } } },
  });
}

async function lockRateRows(transaction: Transaction, ids: string[]) {
  if (ids.length === 0) return;
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "EmployeePayRate" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`,
  );
}

async function validatePaycheckProvenance(
  transaction: Transaction,
  rate: NonNullable<RateRecord>,
  paycheckId: string,
) {
  const paycheck = await transaction.paycheck.findUnique({
    where: { id: paycheckId },
    include: { payrollPeriod: true },
  });
  if (!paycheck) notFound();
  if (
    paycheck.reviewStatus !== "CONFIRMED" ||
    paycheck.employeeId !== rate.employeeId ||
    paycheck.baseRate === null ||
    !paycheck.baseRate.equals(rate.hourlyRate) ||
    paycheck.payrollPeriod.periodStart.getTime() !== rate.effectiveFrom.getTime()
  ) {
    throw new EvidenceReviewError(
      "INVALID_TRANSITION",
      "The selected Paycheck does not provide confirmed matching Employee, rate, and period-start evidence.",
    );
  }
  return paycheck;
}

function rateDecisionData(input: PayRateEvidenceReviewInput, current: NonNullable<RateRecord>) {
  switch (input.decision) {
    case "VERIFY_PAYCHECK":
      if (!["NEEDS_REVIEW", "CONFLICT"].includes(current.verificationStatus)) invalidTransition();
      return { status: "VERIFIED" as const, provenance: "PAYCHECK" as const, paycheckId: input.sourcePaycheckId, kind: "VERIFIED_PAYCHECK" as const };
    case "VERIFY_INDEPENDENT":
      if (!["NEEDS_REVIEW", "CONFLICT"].includes(current.verificationStatus)) invalidTransition();
      return { status: "VERIFIED" as const, provenance: "INDEPENDENT" as const, paycheckId: null, kind: "VERIFIED_INDEPENDENT" as const };
    case "MARK_CONFLICT":
      if (!["NEEDS_REVIEW", "VERIFIED"].includes(current.verificationStatus)) invalidTransition();
      return { status: "CONFLICT" as const, provenance: current.provenanceKind, paycheckId: current.sourcePaycheckId, kind: "MARKED_CONFLICT" as const };
    case "EXCLUDE":
      if (!["NEEDS_REVIEW", "VERIFIED", "CONFLICT"].includes(current.verificationStatus)) invalidTransition();
      return { status: "EXCLUDED" as const, provenance: current.provenanceKind, paycheckId: current.sourcePaycheckId, kind: "EXCLUDED" as const };
    case "REOPEN_REVIEW":
      if (!["VERIFIED", "CONFLICT", "SUPERSEDED", "EXCLUDED"].includes(current.verificationStatus)) invalidTransition();
      return { status: "NEEDS_REVIEW" as const, provenance: "UNKNOWN" as const, paycheckId: null, kind: "REOPENED_REVIEW" as const };
  }
}

async function createRateEvent(
  transaction: Transaction,
  actor: EvidenceReviewerActor,
  current: NonNullable<RateRecord>,
  next: {
    status: "NEEDS_REVIEW" | "VERIFIED" | "CONFLICT" | "SUPERSEDED" | "EXCLUDED";
    provenance: "UNKNOWN" | "PAYCHECK" | "INDEPENDENT";
    paycheckId: string | null;
    kind: "VERIFIED_PAYCHECK" | "VERIFIED_INDEPENDENT" | "MARKED_CONFLICT" | "EXCLUDED" | "REOPENED_REVIEW" | "SUPERSEDED";
  },
  reason: string,
  sourceEvidenceReference: string | undefined,
  requestToken: string,
  digest: string,
) {
  const newVersion = current.evidenceVersion + 1;
  const updated = await transaction.employeePayRate.updateMany({
    where: {
      id: current.id,
      evidenceVersion: current.evidenceVersion,
      verificationStatus: current.verificationStatus,
      provenanceKind: current.provenanceKind,
      sourcePaycheckId: current.sourcePaycheckId,
    },
    data: {
      verificationStatus: next.status,
      provenanceKind: next.provenance,
      sourcePaycheckId: next.paycheckId,
      evidenceVersion: newVersion,
    },
  });
  if (updated.count !== 1) stale();
  const event = await transaction.payRateEvidenceReviewEvent.create({
    data: {
      employeePayRateId: current.id,
      sequence: nextSequence(current.reviewEvents),
      decisionKind: next.kind,
      previousStatus: current.verificationStatus,
      newStatus: next.status,
      previousProvenanceKind: current.provenanceKind,
      newProvenanceKind: next.provenance,
      previousSourcePaycheckId: current.sourcePaycheckId,
      newSourcePaycheckId: next.paycheckId,
      previousVersion: current.evidenceVersion,
      newVersion,
      reviewerEmployeeId: actor.employeeId,
      reviewerDisplayNameSnapshot: actor.displayName,
      reviewerEmployeeCodeSnapshot: actor.employeeCode,
      reason,
      sourceEvidenceReference: sourceEvidenceReference ?? null,
      requestToken,
      requestDigest: digest,
    },
  });
  return { event, newVersion };
}

export async function reviewPayRateEvidence(
  actor: EvidenceReviewerActor,
  input: PayRateEvidenceReviewInput,
  dependencies: Dependencies = {},
): Promise<EvidenceReviewSuccess> {
  const client = dependencies.client ?? prisma;
  const digest = reviewRequestDigest("rate", input);
  try {
    return await client.$transaction(async (transaction) => {
      await acquirePayrollEvidenceLock(transaction, "review-request", `${actor.employeeId}:${input.requestToken}`);
      const priorOperation = await existingOperation(transaction, actor.employeeId, input.requestToken);
      if (priorOperation.timesheetEvents.length > 0) replayMismatch();
      if (priorOperation.rateEvents.length > 0) {
        assertReplayDigest(priorOperation.rateEvents, digest);
        const event = priorOperation.rateEvents.find((candidate) => candidate.employeePayRateId === input.rateId);
        if (!event) replayMismatch();
        return { ok: true, targetId: event.employeePayRateId, newState: event.newStatus, newVersion: event.newVersion, auditEventId: event.id, idempotencyReplay: true };
      }

      const initial = await loadRate(transaction, input.rateId);
      if (!initial) notFound();
      const paycheckIds = [initial.sourcePaycheckId, input.decision === "VERIFY_PAYCHECK" ? input.sourcePaycheckId : null]
        .filter((id): id is string => Boolean(id)).sort();
      for (const paycheckId of [...new Set(paycheckIds)]) {
        await acquirePayrollEvidenceLock(transaction, "paycheck", paycheckId);
      }
      await acquirePayrollEvidenceLock(transaction, "rate-slot", rateSlotLockKey(initial.employeeId, initial.effectiveFrom));
      await lockRateRows(transaction, [initial.id]);
      const current = await loadRate(transaction, initial.id);
      if (!current) notFound();
      if (current.evidenceVersion !== input.expectedEvidenceVersion) stale();
      const next = rateDecisionData(input, current);
      if (input.decision === "VERIFY_PAYCHECK") {
        await validatePaycheckProvenance(transaction, current, input.sourcePaycheckId);
      }
      if (next.status === "VERIFIED") {
        const competitor = await transaction.employeePayRate.findFirst({
          where: {
            id: { not: current.id },
            employeeId: current.employeeId,
            effectiveFrom: current.effectiveFrom,
            verificationStatus: { in: ["NEEDS_REVIEW", "VERIFIED", "CONFLICT"] },
          },
        });
        if (competitor) {
          throw new EvidenceReviewError(
            "RATE_EVIDENCE_CONFLICT",
            "Competing active rate evidence must be resolved explicitly in one transaction.",
          );
        }
      }
      const saved = await createRateEvent(
        transaction,
        actor,
        current,
        next,
        input.reason,
        input.sourceEvidenceReference,
        input.requestToken,
        digest,
      );
      await dependencies.hooks?.afterTargetUpdate?.(transaction);
      await dependencies.hooks?.beforeCommit?.(transaction);
      return { ok: true, targetId: current.id, newState: next.status, newVersion: saved.newVersion, auditEventId: saved.event.id, idempotencyReplay: false };
    });
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      ? JSON.stringify(error.meta?.target ?? "")
      : "";
    if (target.includes("employeeId") && target.includes("effectiveFrom")) {
      throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "Verified rate evidence already occupies this Employee and effective date.");
    }
    throw error;
  }
}

function resolutionDisposition(
  disposition: PayRateEvidenceResolutionInput["competitors"][number]["disposition"],
  current: NonNullable<RateRecord>,
) {
  if (!["NEEDS_REVIEW", "VERIFIED", "CONFLICT"].includes(current.verificationStatus)) invalidTransition();
  if (disposition === "CONFLICT") {
    return { status: "CONFLICT" as const, provenance: current.provenanceKind, paycheckId: current.sourcePaycheckId, kind: "MARKED_CONFLICT" as const };
  }
  if (disposition === "EXCLUDED") {
    return { status: "EXCLUDED" as const, provenance: current.provenanceKind, paycheckId: current.sourcePaycheckId, kind: "EXCLUDED" as const };
  }
  return { status: "SUPERSEDED" as const, provenance: current.provenanceKind, paycheckId: current.sourcePaycheckId, kind: "SUPERSEDED" as const };
}

export async function resolvePayRateEvidenceCompetitors(
  actor: EvidenceReviewerActor,
  input: PayRateEvidenceResolutionInput,
  dependencies: Dependencies = {},
): Promise<EvidenceReviewSuccess> {
  const client = dependencies.client ?? prisma;
  const digest = reviewRequestDigest("rate", input);
  const suppliedIds = [input.selectedRateId, ...input.competitors.map((item) => item.rateId)].sort();
  try {
    return await client.$transaction(async (transaction) => {
      await acquirePayrollEvidenceLock(transaction, "review-request", `${actor.employeeId}:${input.requestToken}`);
      const priorOperation = await existingOperation(transaction, actor.employeeId, input.requestToken);
      if (priorOperation.timesheetEvents.length > 0) replayMismatch();
      if (priorOperation.rateEvents.length > 0) {
        assertReplayDigest(priorOperation.rateEvents, digest);
        const event = priorOperation.rateEvents.find((candidate) => candidate.employeePayRateId === input.selectedRateId);
        if (!event || priorOperation.rateEvents.length !== suppliedIds.length) replayMismatch();
        return { ok: true, targetId: event.employeePayRateId, newState: event.newStatus, newVersion: event.newVersion, auditEventId: event.id, idempotencyReplay: true };
      }

      const initialRates = await transaction.employeePayRate.findMany({ where: { id: { in: suppliedIds } } });
      if (initialRates.length !== suppliedIds.length) notFound();
      const selectedInitial = initialRates.find((rate) => rate.id === input.selectedRateId)!;
      const paycheckIds = [
        input.sourcePaycheckId,
        ...initialRates.map((rate) => rate.sourcePaycheckId),
      ].filter((id): id is string => Boolean(id)).sort();
      for (const paycheckId of [...new Set(paycheckIds)]) {
        await acquirePayrollEvidenceLock(transaction, "paycheck", paycheckId);
      }
      await acquirePayrollEvidenceLock(transaction, "rate-slot", rateSlotLockKey(selectedInitial.employeeId, selectedInitial.effectiveFrom));
      await lockRateRows(transaction, suppliedIds);

      const rates = await Promise.all(suppliedIds.map((id) => loadRate(transaction, id)));
      if (rates.some((rate) => !rate)) notFound();
      const currentRates = rates as Array<NonNullable<RateRecord>>;
      if (currentRates.some((rate) => rate.employeeId !== selectedInitial.employeeId || rate.effectiveFrom.getTime() !== selectedInitial.effectiveFrom.getTime())) {
        throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "All resolved evidence must belong to one Employee and effective date.");
      }
      const activeRates = await transaction.employeePayRate.findMany({
        where: {
          employeeId: selectedInitial.employeeId,
          effectiveFrom: selectedInitial.effectiveFrom,
          verificationStatus: { in: ["NEEDS_REVIEW", "VERIFIED", "CONFLICT"] },
        },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (activeRates.map((rate) => rate.id).join("\0") !== suppliedIds.join("\0")) {
        throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "Every active competing rate must receive an explicit disposition.");
      }
      const selected = currentRates.find((rate) => rate.id === input.selectedRateId)!;
      if (selected.evidenceVersion !== input.selectedExpectedEvidenceVersion || !["NEEDS_REVIEW", "CONFLICT"].includes(selected.verificationStatus)) stale();
      for (const competitor of input.competitors) {
        const rate = currentRates.find((candidate) => candidate.id === competitor.rateId)!;
        if (rate.evidenceVersion !== competitor.expectedEvidenceVersion) stale();
      }

      const selectedNext = input.selectedProvenance === "PAYCHECK"
        ? { status: "VERIFIED" as const, provenance: "PAYCHECK" as const, paycheckId: input.sourcePaycheckId!, kind: "VERIFIED_PAYCHECK" as const }
        : { status: "VERIFIED" as const, provenance: "INDEPENDENT" as const, paycheckId: null, kind: "VERIFIED_INDEPENDENT" as const };
      if (input.selectedProvenance === "PAYCHECK") {
        await validatePaycheckProvenance(transaction, selected, input.sourcePaycheckId!);
      }

      for (const competitor of [...input.competitors].sort((left, right) => left.rateId.localeCompare(right.rateId))) {
        const rate = currentRates.find((candidate) => candidate.id === competitor.rateId)!;
        await createRateEvent(transaction, actor, rate, resolutionDisposition(competitor.disposition, rate), input.reason, input.sourceEvidenceReference, input.requestToken, digest);
      }
      const saved = await createRateEvent(transaction, actor, selected, selectedNext, input.reason, input.sourceEvidenceReference, input.requestToken, digest);
      await dependencies.hooks?.afterTargetUpdate?.(transaction);
      await dependencies.hooks?.beforeCommit?.(transaction);
      return { ok: true, targetId: selected.id, newState: selectedNext.status, newVersion: saved.newVersion, auditEventId: saved.event.id, idempotencyReplay: false };
    });
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      ? JSON.stringify(error.meta?.target ?? "")
      : "";
    if (target.includes("employeeId") && target.includes("effectiveFrom")) {
      throw new EvidenceReviewError("RATE_EVIDENCE_CONFLICT", "Verified rate evidence already occupies this Employee and effective date.");
    }
    throw error;
  }
}
