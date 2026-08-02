import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  knowledgeContentKindLabels,
  knowledgeMaximumCautionLength,
  knowledgeMaximumChangeSummaryLength,
  knowledgeMaximumExternalReferences,
  knowledgeMaximumExternalReferenceLabelLength,
  knowledgeMaximumTitleLength,
} from "./constants";
import { knowledgeIntegrityError } from "./errors";
import { parseKnowledgeMarkdown } from "./markdown";
import {
  codePointLength,
  normalizeHttpsUrl,
  normalizeSingleLineText,
  normalizeTitleKey,
} from "./normalization";
import type {
  KnowledgeHistoricalRevisionView,
  KnowledgeHistoryRevisionSummary,
  KnowledgeHistoryView,
} from "./types";

type Client = PrismaClient | Prisma.TransactionClient;

export const knowledgeHistoryRevisionSelect = {
  id: true,
  knowledgeRecordId: true,
  revisionNumber: true,
  origin: true,
  contentKind: true,
  trust: true,
  title: true,
  normalizedTitle: true,
  bodyMarkdown: true,
  safetyCaution: true,
  contextKind: true,
  mineId: true,
  equipmentId: true,
  equipmentDisplayNameSnapshot: true,
  equipmentNumberSnapshot: true,
  equipmentCategorySnapshot: true,
  mineNameSnapshot: true,
  cityNameSnapshot: true,
  cityStateSnapshot: true,
  changeSummary: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  externalReferences: {
    select: { sequence: true, label: true, url: true, normalizedUrl: true },
    orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.KnowledgeRecordRevisionSelect;

export const knowledgeHistoryRootSelect = {
  id: true,
  currentRevisionId: true,
  lifecycle: true,
  archivedAt: true,
  stateVersion: true,
  revisions: {
    select: knowledgeHistoryRevisionSelect,
    orderBy: [{ revisionNumber: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.KnowledgeRecordSelect;

type Root = Prisma.KnowledgeRecordGetPayload<{ select: typeof knowledgeHistoryRootSelect }>;
type Revision = Root["revisions"][number];

function nonblank(value: string | null, maximum?: number) {
  return value !== null && value.trim().length > 0 &&
    (maximum === undefined || codePointLength(value) <= maximum);
}

function validChangeSummary(value: string | null) {
  return value !== null && value.length > 0 &&
    value === normalizeSingleLineText(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    codePointLength(value) <= knowledgeMaximumChangeSummaryLength;
}

function context(revision: Revision) {
  if (revision.contextKind === "GENERAL") {
    if (
      revision.mineId !== null || revision.equipmentId !== null ||
      revision.equipmentDisplayNameSnapshot !== null ||
      revision.equipmentNumberSnapshot !== null ||
      revision.equipmentCategorySnapshot !== null ||
      revision.mineNameSnapshot !== null || revision.cityNameSnapshot !== null ||
      revision.cityStateSnapshot !== null
    ) return null;
    return { summary: "General", availability: null };
  }
  if (!nonblank(revision.mineNameSnapshot) || !nonblank(revision.cityNameSnapshot) ||
      (revision.cityStateSnapshot !== null && !nonblank(revision.cityStateSnapshot))) return null;
  const city = `${revision.cityNameSnapshot}${revision.cityStateSnapshot ? `, ${revision.cityStateSnapshot}` : ""}`;
  if (revision.contextKind === "MINE") {
    if (revision.equipmentId !== null || revision.equipmentDisplayNameSnapshot !== null ||
        revision.equipmentNumberSnapshot !== null || revision.equipmentCategorySnapshot !== null) return null;
    return {
      summary: `${revision.mineNameSnapshot} — ${city}`,
      availability: revision.mineId === null ? "Mine unavailable" : null,
    };
  }
  if (!nonblank(revision.equipmentDisplayNameSnapshot) ||
      (revision.equipmentNumberSnapshot !== null && !nonblank(revision.equipmentNumberSnapshot)) ||
      revision.equipmentCategorySnapshot === null) return null;
  const equipment = revision.equipmentNumberSnapshot
    ? `${revision.equipmentDisplayNameSnapshot} #${revision.equipmentNumberSnapshot}`
    : revision.equipmentDisplayNameSnapshot;
  const unavailable = [
    revision.equipmentId === null ? "Equipment unavailable" : null,
    revision.mineId === null ? "Mine unavailable" : null,
  ].filter(Boolean);
  return {
    summary: `${equipment} — ${revision.mineNameSnapshot}, ${city}`,
    availability: unavailable.length ? unavailable.join("; ") : null,
  };
}

function revisionIsCoherent(revision: Revision) {
  const origin =
    (revision.origin === "INITIAL" && revision.revisionNumber === 1 && revision.changeSummary === null) ||
    (revision.origin === "REVISED" && revision.revisionNumber > 1 &&
      validChangeSummary(revision.changeSummary)) ||
    (revision.origin === "RESTORED" && revision.revisionNumber > 1 && revision.changeSummary === null);
  const trust =
    (revision.trust === "UNVERIFIED" && revision.reviewedAt === null) ||
    (revision.trust === "PERSONALLY_REVIEWED" && revision.reviewedAt !== null);
  if (!Number.isSafeInteger(revision.revisionNumber) || revision.revisionNumber < 1 ||
      !origin || !trust || !nonblank(revision.title, knowledgeMaximumTitleLength) ||
      revision.title !== normalizeSingleLineText(revision.title) ||
      revision.normalizedTitle !== normalizeTitleKey(revision.title) ||
      (revision.safetyCaution !== null && !nonblank(revision.safetyCaution, knowledgeMaximumCautionLength)) ||
      !context(revision)) return false;
  try { parseKnowledgeMarkdown(revision.bodyMarkdown); } catch { return false; }
  if (revision.externalReferences.length > knowledgeMaximumExternalReferences) {
    return false;
  }
  const urls = new Set<string>();
  return revision.externalReferences.every((reference, index) => {
    try {
      const normalized = normalizeHttpsUrl(reference.url);
      const valid = reference.sequence === index + 1 &&
        nonblank(reference.label, knowledgeMaximumExternalReferenceLabelLength) &&
        reference.label === normalizeSingleLineText(reference.label) &&
        reference.normalizedUrl === normalized && !urls.has(normalized);
      urls.add(normalized);
      return valid;
    } catch { return false; }
  });
}

export function knowledgeHistoryIsCoherent(root: Root) {
  const lifecycle =
    (root.lifecycle === "ACTIVE" && root.archivedAt === null) ||
    (root.lifecycle === "ARCHIVED" && root.archivedAt !== null);
  if (!root.currentRevisionId || !lifecycle || !Number.isSafeInteger(root.stateVersion) ||
      root.stateVersion < 1 || root.revisions.length < 1) return false;
  return root.revisions.every((revision, index) =>
    revision.knowledgeRecordId === root.id && revision.revisionNumber === index + 1 &&
    revisionIsCoherent(revision) &&
    (revision.id === root.currentRevisionId ||
      revision.trust === "PERSONALLY_REVIEWED")) &&
    root.revisions.at(-1)?.id === root.currentRevisionId;
}

function designation(revision: Revision, currentRevisionId: string) {
  if (revision.id !== currentRevisionId) {
    return "Retained Reviewed" as const;
  }
  return revision.trust === "UNVERIFIED"
    ? "Current Unverified" as const
    : "Current Personally Reviewed" as const;
}

function summary(root: Root, revision: Revision): KnowledgeHistoryRevisionSummary {
  const contextView = context(revision);
  if (!contextView) throw knowledgeIntegrityError();
  return {
    revisionNumber: revision.revisionNumber,
    href: `/knowledge-base/${encodeURIComponent(root.id)}/history/${revision.revisionNumber}`,
    isCurrent: revision.id === root.currentRevisionId,
    designation: designation(revision, root.currentRevisionId!),
    origin: revision.origin,
    contentKindLabel: knowledgeContentKindLabels[revision.contentKind],
    trustLabel: revision.trust === "UNVERIFIED" ? "Unverified" : "Personally Reviewed",
    changeSummary: revision.changeSummary,
    contextSummary: contextView.summary,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    reviewedAt: revision.reviewedAt?.toISOString() ?? null,
  };
}

export function mapKnowledgeHistory(root: Root): KnowledgeHistoryView {
  if (!knowledgeHistoryIsCoherent(root)) throw knowledgeIntegrityError();
  const current = root.revisions.at(-1)!;
  return {
    id: root.id,
    title: current.title,
    lifecycleLabel: root.lifecycle === "ACTIVE" ? "Active" : "Archived",
    archivedAt: root.archivedAt?.toISOString() ?? null,
    currentRevisionNumber: current.revisionNumber,
    revisions: [...root.revisions].reverse().map((revision) => summary(root, revision)),
  };
}

export function mapKnowledgeHistoricalRevision(root: Root, revisionNumber: number): KnowledgeHistoricalRevisionView | null {
  if (!knowledgeHistoryIsCoherent(root)) throw knowledgeIntegrityError();
  const revision = root.revisions.find((candidate) => candidate.revisionNumber === revisionNumber);
  if (!revision) return null;
  const contextView = context(revision);
  if (!contextView) throw knowledgeIntegrityError();
  return {
    recordId: root.id,
    lifecycleLabel: root.lifecycle === "ACTIVE" ? "Active" : "Archived",
    archivedAt: root.archivedAt?.toISOString() ?? null,
    revisionNumber,
    isCurrent: revision.id === root.currentRevisionId,
    designation: designation(revision, root.currentRevisionId!),
    title: revision.title,
    bodyMarkdown: revision.bodyMarkdown,
    safetyCaution: revision.safetyCaution,
    contentKindLabel: knowledgeContentKindLabels[revision.contentKind],
    trustLabel: revision.trust === "UNVERIFIED" ? "Unverified" : "Personally Reviewed",
    originLabel: revision.origin === "INITIAL" ? "Initial" : revision.origin === "REVISED" ? "Revised" : "Restored",
    changeSummary: revision.changeSummary,
    contextSummary: contextView.summary,
    contextAvailability: contextView.availability,
    externalReferences: revision.externalReferences.map(({ sequence, label, url }) => ({ sequence, label, url })),
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    reviewedAt: revision.reviewedAt?.toISOString() ?? null,
    currentHref: `/knowledge-base/${encodeURIComponent(root.id)}`,
    historyHref: `/knowledge-base/${encodeURIComponent(root.id)}/history`,
  };
}

export async function getKnowledgeHistoryWithClient(client: Client, idInput: unknown) {
  const id = z.string().uuid().safeParse(idInput);
  if (!id.success) return null;
  const root = await client.knowledgeRecord.findUnique({ where: { id: id.data.toLowerCase() }, select: knowledgeHistoryRootSelect });
  return root ? mapKnowledgeHistory(root) : null;
}

export async function getKnowledgeHistoricalRevisionWithClient(
  client: Client,
  idInput: unknown,
  revisionNumberInput: unknown,
) {
  const id = z.string().uuid().safeParse(idInput);
  if (!id.success || typeof revisionNumberInput !== "string" || !/^[1-9][0-9]*$/u.test(revisionNumberInput)) return null;
  const revisionNumber = Number(revisionNumberInput);
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber > 2_147_483_647) return null;
  const root = await client.knowledgeRecord.findUnique({ where: { id: id.data.toLowerCase() }, select: knowledgeHistoryRootSelect });
  return root ? mapKnowledgeHistoricalRevision(root, revisionNumber) : null;
}
