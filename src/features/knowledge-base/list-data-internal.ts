import type { Prisma, PrismaClient } from "@prisma/client";

import {
  knowledgeContentKindLabels,
  knowledgeListExcerptLength,
  knowledgeListOptionLimit,
  knowledgeListPageSize,
} from "./constants";
import { knowledgeIntegrityError } from "./errors";
import type { KnowledgeListFilters } from "./list-params";
import type {
  KnowledgeListOption,
  KnowledgeListPageReady,
  KnowledgeListRow,
} from "./list-types";
import { parseKnowledgeMarkdown, visibleMarkdownText } from "./markdown";
import { codePointLength, normalizeTitleKey } from "./normalization";

export function escapeKnowledgeContains(value: string) {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

export function buildKnowledgeListWhere(
  filters: KnowledgeListFilters,
): Prisma.KnowledgeRecordWhereInput {
  const current: Prisma.KnowledgeRecordRevisionWhereInput = {};
  if (filters.q) {
    const literal = escapeKnowledgeContains(filters.q);
    current.OR = [
      { title: { contains: literal, mode: "insensitive" } },
      { bodyMarkdown: { contains: literal, mode: "insensitive" } },
    ];
  }
  if (filters.kind) current.contentKind = filters.kind;
  if (filters.trust) current.trust = filters.trust;
  if (filters.context) current.contextKind = filters.context;
  if (filters.mineId) current.mineId = filters.mineId;
  if (filters.equipmentId) current.equipmentId = filters.equipmentId;

  const and: Prisma.KnowledgeRecordWhereInput[] = [
    { currentRevision: { is: current } },
  ];
  if (filters.lifecycle !== "ALL") and.unshift({ lifecycle: filters.lifecycle });
  return { AND: and };
}

export const knowledgeListCurrentRevisionSelect = {
  id: true,
  knowledgeRecordId: true,
  revisionNumber: true,
  origin: true,
  contentKind: true,
  trust: true,
  title: true,
  normalizedTitle: true,
  bodyMarkdown: true,
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
} satisfies Prisma.KnowledgeRecordRevisionSelect;

export const knowledgeListRootSelect = {
  id: true,
  currentRevisionId: true,
  lifecycle: true,
  stateVersion: true,
  archivedAt: true,
  updatedAt: true,
  currentRevision: { select: knowledgeListCurrentRevisionSelect },
} satisfies Prisma.KnowledgeRecordSelect;

type LoadedKnowledgeListRoot = Prisma.KnowledgeRecordGetPayload<{
  select: typeof knowledgeListRootSelect;
}>;

function nonblank(value: string | null, maximum?: number) {
  return (
    value !== null &&
    value.trim().length > 0 &&
    (maximum === undefined || codePointLength(value) <= maximum)
  );
}

function contextIsCoherent(
  revision: NonNullable<LoadedKnowledgeListRoot["currentRevision"]>,
) {
  if (revision.contextKind === "GENERAL") {
    return (
      revision.mineId === null &&
      revision.equipmentId === null &&
      revision.equipmentDisplayNameSnapshot === null &&
      revision.equipmentNumberSnapshot === null &&
      revision.equipmentCategorySnapshot === null &&
      revision.mineNameSnapshot === null &&
      revision.cityNameSnapshot === null &&
      revision.cityStateSnapshot === null
    );
  }
  if (revision.contextKind === "MINE") {
    return (
      revision.equipmentId === null &&
      revision.equipmentDisplayNameSnapshot === null &&
      revision.equipmentNumberSnapshot === null &&
      revision.equipmentCategorySnapshot === null &&
      nonblank(revision.mineNameSnapshot) &&
      nonblank(revision.cityNameSnapshot) &&
      (revision.cityStateSnapshot === null || nonblank(revision.cityStateSnapshot))
    );
  }
  return (
    nonblank(revision.equipmentDisplayNameSnapshot) &&
    (revision.equipmentNumberSnapshot === null || nonblank(revision.equipmentNumberSnapshot)) &&
    revision.equipmentCategorySnapshot !== null &&
    nonblank(revision.mineNameSnapshot) &&
    nonblank(revision.cityNameSnapshot) &&
    (revision.cityStateSnapshot === null || nonblank(revision.cityStateSnapshot))
  );
}

function revisionStateIsCoherent(
  revision: NonNullable<LoadedKnowledgeListRoot["currentRevision"]>,
) {
  const trustCoherent =
    (revision.trust === "UNVERIFIED" && revision.reviewedAt === null) ||
    (revision.trust === "PERSONALLY_REVIEWED" && revision.reviewedAt !== null);
  const originCoherent =
    (revision.origin === "INITIAL" &&
      revision.revisionNumber === 1 &&
      revision.changeSummary === null) ||
    (revision.origin === "REVISED" &&
      revision.revisionNumber > 1 &&
      nonblank(revision.changeSummary, 500)) ||
    (revision.origin === "RESTORED" &&
      revision.revisionNumber > 1 &&
      revision.changeSummary === null);
  return (
    Number.isSafeInteger(revision.revisionNumber) &&
    revision.revisionNumber > 0 &&
    trustCoherent &&
    originCoherent &&
    nonblank(revision.title, 160) &&
    nonblank(revision.normalizedTitle, 160) &&
    revision.normalizedTitle === normalizeTitleKey(revision.title) &&
    contextIsCoherent(revision)
  );
}

function contextDisplay(
  revision: NonNullable<LoadedKnowledgeListRoot["currentRevision"]>,
) {
  if (revision.contextKind === "GENERAL") {
    return { summary: "General", availability: null };
  }
  const city = `${revision.cityNameSnapshot}${
    revision.cityStateSnapshot ? `, ${revision.cityStateSnapshot}` : ""
  }`;
  if (revision.contextKind === "MINE") {
    return {
      summary: `${revision.mineNameSnapshot} — ${city}`,
      availability: revision.mineId === null ? "Mine unavailable" : null,
    };
  }
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

export function knowledgeListExcerpt(bodyMarkdown: string) {
  const parsed = parseKnowledgeMarkdown(bodyMarkdown);
  const visible = visibleMarkdownText(parsed.root).replace(/\s+([,.;:!?])/gu, "$1");
  const characters = Array.from(visible);
  return characters.length <= knowledgeListExcerptLength
    ? visible
    : `${characters.slice(0, knowledgeListExcerptLength - 1).join("")}…`;
}

export function mapKnowledgeListRow(
  record: LoadedKnowledgeListRoot,
): KnowledgeListRow {
  const revision = record.currentRevision;
  const lifecycleCoherent =
    (record.lifecycle === "ACTIVE" && record.archivedAt === null) ||
    (record.lifecycle === "ARCHIVED" && record.archivedAt !== null);
  if (
    !record.currentRevisionId ||
    !revision ||
    revision.id !== record.currentRevisionId ||
    revision.knowledgeRecordId !== record.id ||
    !lifecycleCoherent ||
    !Number.isSafeInteger(record.stateVersion) ||
    record.stateVersion < 1 ||
    !revisionStateIsCoherent(revision) ||
    Number.isNaN(record.updatedAt.getTime())
  ) {
    throw knowledgeIntegrityError();
  }
  const context = contextDisplay(revision);
  let excerpt: string;
  try {
    excerpt = knowledgeListExcerpt(revision.bodyMarkdown);
  } catch {
    throw knowledgeIntegrityError();
  }
  return {
    id: record.id,
    detailHref: `/knowledge-base/${encodeURIComponent(record.id)}`,
    title: revision.title,
    excerpt,
    contentKind: revision.contentKind,
    contentKindLabel: knowledgeContentKindLabels[revision.contentKind],
    trust: revision.trust,
    trustLabel:
      revision.trust === "UNVERIFIED" ? "Unverified" : "Personally Reviewed",
    lifecycle: record.lifecycle,
    lifecycleLabel: record.lifecycle === "ACTIVE" ? "Active" : "Archived",
    contextKind: revision.contextKind,
    contextSummary: context.summary,
    contextAvailability: context.availability,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function lifecycleScope(filters: KnowledgeListFilters): Prisma.KnowledgeRecordWhereInput {
  return filters.lifecycle === "ALL" ? {} : { lifecycle: filters.lifecycle };
}

async function mineOptions(
  transaction: Prisma.TransactionClient,
): Promise<readonly KnowledgeListOption[]> {
  const records = await transaction.mine.findMany({
    where: {
      OR: [
        { status: "ACTIVE" },
        { knowledgeRevisions: { some: { currentForRecord: { isNot: null } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      city: { select: { name: true, state: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: knowledgeListOptionLimit,
  });
  return records.map((mine) => ({
    id: mine.id,
    label: `${mine.name} — ${mine.city.name}${mine.city.state ? `, ${mine.city.state}` : ""}`,
    active: mine.status === "ACTIVE",
  }));
}

async function equipmentOptions(
  transaction: Prisma.TransactionClient,
): Promise<readonly KnowledgeListOption[]> {
  const records = await transaction.equipment.findMany({
    where: {
      OR: [
        { status: "ACTIVE" },
        { knowledgeRevisions: { some: { currentForRecord: { isNot: null } } } },
      ],
    },
    select: {
      id: true,
      displayName: true,
      equipmentNumber: true,
      status: true,
      mine: { select: { name: true } },
    },
    orderBy: [{ displayName: "asc" }, { equipmentNumber: "asc" }, { id: "asc" }],
    take: knowledgeListOptionLimit,
  });
  return records.map((equipment) => ({
    id: equipment.id,
    label: `${equipment.displayName}${equipment.equipmentNumber ? ` #${equipment.equipmentNumber}` : ""} — ${equipment.mine.name}`,
    active: equipment.status === "ACTIVE",
  }));
}

export async function getKnowledgeListPageWithClient(
  client: PrismaClient,
  filters: KnowledgeListFilters,
): Promise<KnowledgeListPageReady> {
  return client.$transaction(
    async (transaction) => {
      const where = buildKnowledgeListWhere(filters);
      const scope = lifecycleScope(filters);
      const invalidRoot = await transaction.knowledgeRecord.findFirst({
        where: {
          AND: [
            scope,
            {
              OR: [
                { currentRevisionId: null },
                { currentRevision: { is: null } },
              ],
            },
          ],
        },
        select: { id: true },
      });
      if (invalidRoot) throw knowledgeIntegrityError();

      const [matchingCount, totalCount, activeCount] = await Promise.all([
        transaction.knowledgeRecord.count({ where }),
        transaction.knowledgeRecord.count(),
        transaction.knowledgeRecord.count({ where: { lifecycle: "ACTIVE" } }),
      ]);
      const offset = BigInt(filters.page - 1) * BigInt(knowledgeListPageSize);
      const records =
        offset < BigInt(matchingCount)
          ? await transaction.knowledgeRecord.findMany({
              where,
              select: knowledgeListRootSelect,
              orderBy:
                filters.sort === "TITLE_ASC"
                  ? [
                      { currentRevision: { normalizedTitle: "asc" } },
                      { id: "asc" },
                    ]
                  : [{ updatedAt: "desc" }, { id: "desc" }],
              skip: Number(offset),
              take: knowledgeListPageSize,
            })
          : [];
      const [mines, equipment] = await Promise.all([
        mineOptions(transaction),
        equipmentOptions(transaction),
      ]);
      const pageCount = Math.ceil(matchingCount / knowledgeListPageSize);
      return {
        status: "ready",
        rows: records.map(mapKnowledgeListRow),
        mineOptions: mines,
        equipmentOptions: equipment,
        totalCount,
        activeCount,
        matchingCount,
        page: filters.page,
        pageCount,
        hasPreviousPage: filters.page > 1,
        hasNextPage:
          offset + BigInt(knowledgeListPageSize) < BigInt(matchingCount),
        outOfRange: filters.page > 1 && offset >= BigInt(matchingCount),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
