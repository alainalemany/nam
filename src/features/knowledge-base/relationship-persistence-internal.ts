import { Prisma, type ShiftType } from "@prisma/client";

import { knowledgeMaximumDefectTitleSnapshotLength } from "./constants";
import {
  knowledgeDailyLogNotFoundError,
  knowledgeDefectNotFoundError,
  knowledgeIntegrityError,
  knowledgeInvalidRelationshipError,
} from "./errors";
import { codePointLength, normalizeSingleLineText } from "./normalization";
import type { KnowledgeCreateInput, KnowledgeEditInput } from "./types";

type Transaction = Prisma.TransactionClient;

export type KnowledgeRelationshipData = Readonly<{
  sourceDailyLogId: string | null;
  sourceDailyLogDateSnapshot: Date | null;
  sourceDailyLogShiftSnapshot: ShiftType | null;
  relatedDefectId: string | null;
  relatedDefectTitleSnapshot: string | null;
  relatedDefectReportedDateSnapshot: Date | null;
}>;

export type KnowledgeRelationshipRevision = KnowledgeRelationshipData;

const clearedDailyLog = {
  sourceDailyLogId: null,
  sourceDailyLogDateSnapshot: null,
  sourceDailyLogShiftSnapshot: null,
} as const;

const clearedDefect = {
  relatedDefectId: null,
  relatedDefectTitleSnapshot: null,
  relatedDefectReportedDateSnapshot: null,
} as const;

export function retainedKnowledgeRelationshipData(
  revision: KnowledgeRelationshipRevision,
): KnowledgeRelationshipData {
  return {
    sourceDailyLogId: revision.sourceDailyLogId ?? null,
    sourceDailyLogDateSnapshot: revision.sourceDailyLogDateSnapshot ?? null,
    sourceDailyLogShiftSnapshot: revision.sourceDailyLogShiftSnapshot ?? null,
    relatedDefectId: revision.relatedDefectId ?? null,
    relatedDefectTitleSnapshot: revision.relatedDefectTitleSnapshot ?? null,
    relatedDefectReportedDateSnapshot: revision.relatedDefectReportedDateSnapshot ?? null,
  };
}

export function knowledgeRelationshipDataIsCoherent(
  relationship: KnowledgeRelationshipRevision,
) {
  const normalized = retainedKnowledgeRelationshipData(relationship);
  const dailyLogAbsent = normalized.sourceDailyLogId === null &&
    normalized.sourceDailyLogDateSnapshot === null &&
    normalized.sourceDailyLogShiftSnapshot === null;
  const dailyLogRetained = normalized.sourceDailyLogDateSnapshot !== null &&
    normalized.sourceDailyLogShiftSnapshot !== null;
  const defectAbsent = normalized.relatedDefectId === null &&
    normalized.relatedDefectTitleSnapshot === null &&
    normalized.relatedDefectReportedDateSnapshot === null;
  const defectRetained = normalized.relatedDefectTitleSnapshot !== null &&
    normalized.relatedDefectTitleSnapshot ===
      normalizeSingleLineText(normalized.relatedDefectTitleSnapshot) &&
    codePointLength(normalized.relatedDefectTitleSnapshot) <=
      knowledgeMaximumDefectTitleSnapshotLength &&
    normalized.relatedDefectReportedDateSnapshot !== null;
  return (dailyLogAbsent || dailyLogRetained) && (defectAbsent || defectRetained);
}

function datesMatch(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

export function knowledgeRelationshipDataMatches(
  revision: KnowledgeRelationshipRevision,
  expected: KnowledgeRelationshipData,
) {
  const actual = retainedKnowledgeRelationshipData(revision);
  return actual.sourceDailyLogId === expected.sourceDailyLogId &&
    datesMatch(actual.sourceDailyLogDateSnapshot, expected.sourceDailyLogDateSnapshot) &&
    actual.sourceDailyLogShiftSnapshot === expected.sourceDailyLogShiftSnapshot &&
    actual.relatedDefectId === expected.relatedDefectId &&
    actual.relatedDefectTitleSnapshot === expected.relatedDefectTitleSnapshot &&
    datesMatch(
      actual.relatedDefectReportedDateSnapshot,
      expected.relatedDefectReportedDateSnapshot,
    );
}

export function retainedKnowledgeRelationshipMatches(
  revision: KnowledgeRelationshipRevision,
  expected: KnowledgeRelationshipData,
) {
  const actual = retainedKnowledgeRelationshipData(revision);
  const dailyLogIdMatches = actual.sourceDailyLogId === expected.sourceDailyLogId ||
    (expected.sourceDailyLogId !== null && actual.sourceDailyLogId === null);
  const defectIdMatches = actual.relatedDefectId === expected.relatedDefectId ||
    (expected.relatedDefectId !== null && actual.relatedDefectId === null);
  return dailyLogIdMatches && defectIdMatches &&
    datesMatch(actual.sourceDailyLogDateSnapshot, expected.sourceDailyLogDateSnapshot) &&
    actual.sourceDailyLogShiftSnapshot === expected.sourceDailyLogShiftSnapshot &&
    actual.relatedDefectTitleSnapshot === expected.relatedDefectTitleSnapshot &&
    datesMatch(
      actual.relatedDefectReportedDateSnapshot,
      expected.relatedDefectReportedDateSnapshot,
    );
}

async function resolveDailyLog(
  transaction: Transaction,
  id: string,
) {
  const rows = await transaction.$queryRaw<ReadonlyArray<{
    id: string;
    logDate: Date;
    shift: ShiftType;
  }>>(Prisma.sql`
    SELECT "id", "logDate", "shift"
    FROM "DailyLog"
    WHERE "id" = ${id}
    FOR KEY SHARE
  `);
  const row = rows[0];
  if (!row) throw knowledgeDailyLogNotFoundError();
  return {
    sourceDailyLogId: row.id,
    sourceDailyLogDateSnapshot: row.logDate,
    sourceDailyLogShiftSnapshot: row.shift,
  } as const;
}

async function resolveDefect(
  transaction: Transaction,
  id: string,
) {
  const rows = await transaction.$queryRaw<ReadonlyArray<{
    id: string;
    title: string;
    reportedDate: Date;
  }>>(Prisma.sql`
    SELECT "id", "title", "reportedDate"
    FROM "Defect"
    WHERE "id" = ${id}
    FOR KEY SHARE
  `);
  const row = rows[0];
  if (!row) throw knowledgeDefectNotFoundError();
  const title = normalizeSingleLineText(row.title);
  if (
    !title ||
    codePointLength(title) > knowledgeMaximumDefectTitleSnapshotLength
  ) throw knowledgeIntegrityError();
  return {
    relatedDefectId: row.id,
    relatedDefectTitleSnapshot: title,
    relatedDefectReportedDateSnapshot: row.reportedDate,
  } as const;
}

export async function resolveKnowledgeCreateRelationships(
  transaction: Transaction,
  input: Pick<KnowledgeCreateInput, "sourceDailyLogId" | "relatedDefectId">,
): Promise<KnowledgeRelationshipData> {
  const dailyLog = input.sourceDailyLogId
    ? await resolveDailyLog(transaction, input.sourceDailyLogId)
    : clearedDailyLog;
  const defect = input.relatedDefectId
    ? await resolveDefect(transaction, input.relatedDefectId)
    : clearedDefect;
  return { ...dailyLog, ...defect };
}

export async function resolveKnowledgeEditRelationships(
  transaction: Transaction,
  revision: KnowledgeRelationshipRevision,
  input: Pick<
    KnowledgeEditInput,
    | "sourceDailyLogId"
    | "relatedDefectId"
    | "retainUnavailableSourceDailyLog"
    | "retainUnavailableRelatedDefect"
  >,
): Promise<KnowledgeRelationshipData> {
  if (!knowledgeRelationshipDataIsCoherent(revision)) throw knowledgeIntegrityError();

  let dailyLog: Pick<KnowledgeRelationshipData,
    "sourceDailyLogId" | "sourceDailyLogDateSnapshot" | "sourceDailyLogShiftSnapshot">;
  if (input.sourceDailyLogId) {
    const resolved = await resolveDailyLog(transaction, input.sourceDailyLogId);
    dailyLog = revision.sourceDailyLogId === input.sourceDailyLogId
      ? {
          sourceDailyLogId: revision.sourceDailyLogId,
          sourceDailyLogDateSnapshot: revision.sourceDailyLogDateSnapshot,
          sourceDailyLogShiftSnapshot: revision.sourceDailyLogShiftSnapshot,
        }
      : resolved;
  } else if (
    input.retainUnavailableSourceDailyLog &&
    revision.sourceDailyLogId === null &&
    revision.sourceDailyLogDateSnapshot !== null &&
    revision.sourceDailyLogShiftSnapshot !== null
  ) {
    dailyLog = {
      sourceDailyLogId: null,
      sourceDailyLogDateSnapshot: revision.sourceDailyLogDateSnapshot,
      sourceDailyLogShiftSnapshot: revision.sourceDailyLogShiftSnapshot,
    };
  } else {
    if (input.retainUnavailableSourceDailyLog) {
      throw knowledgeInvalidRelationshipError("The unavailable source Daily Log cannot be retained from this state.");
    }
    dailyLog = clearedDailyLog;
  }

  let defect: Pick<KnowledgeRelationshipData,
    "relatedDefectId" | "relatedDefectTitleSnapshot" | "relatedDefectReportedDateSnapshot">;
  if (input.relatedDefectId) {
    const resolved = await resolveDefect(transaction, input.relatedDefectId);
    defect = revision.relatedDefectId === input.relatedDefectId
      ? {
          relatedDefectId: revision.relatedDefectId,
          relatedDefectTitleSnapshot: revision.relatedDefectTitleSnapshot,
          relatedDefectReportedDateSnapshot: revision.relatedDefectReportedDateSnapshot,
        }
      : resolved;
  } else if (
    input.retainUnavailableRelatedDefect &&
    revision.relatedDefectId === null &&
    revision.relatedDefectTitleSnapshot !== null &&
    revision.relatedDefectReportedDateSnapshot !== null
  ) {
    defect = {
      relatedDefectId: null,
      relatedDefectTitleSnapshot: revision.relatedDefectTitleSnapshot,
      relatedDefectReportedDateSnapshot: revision.relatedDefectReportedDateSnapshot,
    };
  } else {
    if (input.retainUnavailableRelatedDefect) {
      throw knowledgeInvalidRelationshipError("The unavailable related Defect cannot be retained from this state.");
    }
    defect = clearedDefect;
  }

  return { ...dailyLog, ...defect };
}
