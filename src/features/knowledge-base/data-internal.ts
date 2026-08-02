import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  knowledgeContentKindLabels,
  knowledgeCreateOptionLimit,
  knowledgeMaximumCautionLength,
  knowledgeMaximumMutableStateVersion,
  knowledgeMaximumTitleLength,
} from "./constants";
import {
  knowledgeIntegrityError,
  knowledgeNotEditableError,
} from "./errors";
import { parseKnowledgeMarkdown } from "./markdown";
import {
  codePointLength,
  normalizeHttpsUrl,
  normalizeTitleKey,
} from "./normalization";
import type {
  KnowledgeCreatePageData,
  KnowledgeDetailView,
  KnowledgeEditPageData,
} from "./types";

type KnowledgeDataClient = PrismaClient | Prisma.TransactionClient;

const detailSelect = {
  id: true,
  currentRevisionId: true,
  lifecycle: true,
  stateVersion: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  currentRevision: {
    select: {
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
        select: {
          sequence: true,
          label: true,
          url: true,
          normalizedUrl: true,
        },
        orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
  revisions: {
    select: { id: true, revisionNumber: true, trust: true },
    orderBy: [{ revisionNumber: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.KnowledgeRecordSelect;

type LoadedKnowledgeDetail = Prisma.KnowledgeRecordGetPayload<{
  select: typeof detailSelect;
}>;

function nonblank(value: string | null) {
  return value !== null && value.trim().length > 0;
}

function contextIsCoherent(revision: NonNullable<LoadedKnowledgeDetail["currentRevision"]>) {
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
    (revision.equipmentNumberSnapshot === null ||
      nonblank(revision.equipmentNumberSnapshot)) &&
    revision.equipmentCategorySnapshot !== null &&
    nonblank(revision.mineNameSnapshot) &&
    nonblank(revision.cityNameSnapshot) &&
    (revision.cityStateSnapshot === null || nonblank(revision.cityStateSnapshot))
  );
}

export function knowledgeDetailIsCoherent(record: LoadedKnowledgeDetail) {
  const revision = record.currentRevision;
  if (
    record.currentRevisionId === null ||
    !revision ||
    revision.id !== record.currentRevisionId ||
    revision.knowledgeRecordId !== record.id ||
    !(
      (record.lifecycle === "ACTIVE" && record.archivedAt === null) ||
      (record.lifecycle === "ARCHIVED" && record.archivedAt !== null)
    ) ||
    !Number.isSafeInteger(record.stateVersion) ||
    record.stateVersion < 1 ||
    revision.revisionNumber !== 1 ||
    revision.origin !== "INITIAL" ||
    !(
      (revision.trust === "UNVERIFIED" && revision.reviewedAt === null) ||
      (revision.trust === "PERSONALLY_REVIEWED" && revision.reviewedAt !== null)
    ) ||
    revision.changeSummary !== null ||
    record.revisions.length !== 1 ||
    record.revisions[0]?.id !== revision.id ||
    record.revisions[0]?.revisionNumber !== 1 ||
    record.revisions[0]?.trust !== revision.trust ||
    revision.title.trim().length === 0 ||
    codePointLength(revision.title) > knowledgeMaximumTitleLength ||
    revision.normalizedTitle !== normalizeTitleKey(revision.title) ||
    (revision.safetyCaution !== null &&
      (revision.safetyCaution.trim().length === 0 ||
        codePointLength(revision.safetyCaution) > knowledgeMaximumCautionLength)) ||
    !contextIsCoherent(revision)
  ) {
    return false;
  }
  try {
    parseKnowledgeMarkdown(revision.bodyMarkdown);
  } catch {
    return false;
  }
  const normalizedUrls = new Set<string>();
  return revision.externalReferences.every((reference, index) => {
    let normalized: string;
    try {
      normalized = normalizeHttpsUrl(reference.url);
    } catch {
      return false;
    }
    const valid =
      reference.sequence === index + 1 &&
      reference.label.trim().length > 0 &&
      reference.normalizedUrl === normalized &&
      !normalizedUrls.has(normalized);
    normalizedUrls.add(normalized);
    return valid;
  });
}

function contextView(
  revision: NonNullable<LoadedKnowledgeDetail["currentRevision"]>,
): KnowledgeDetailView["context"] {
  if (revision.contextKind === "GENERAL") {
    return { kind: "GENERAL", label: "General" };
  }
  const location = revision.cityStateSnapshot
    ? `${revision.cityNameSnapshot}, ${revision.cityStateSnapshot}`
    : revision.cityNameSnapshot;
  if (revision.contextKind === "MINE") {
    return {
      kind: "MINE",
      label: `${revision.mineNameSnapshot} — ${location}`,
      mineAvailable: revision.mineId !== null,
    };
  }
  const equipment = revision.equipmentNumberSnapshot
    ? `${revision.equipmentDisplayNameSnapshot} #${revision.equipmentNumberSnapshot}`
    : revision.equipmentDisplayNameSnapshot;
  return {
    kind: "EQUIPMENT",
    label: `${equipment} — ${revision.mineNameSnapshot}, ${location}`,
    equipmentAvailable: revision.equipmentId !== null,
  };
}

export function mapKnowledgeDetail(record: LoadedKnowledgeDetail): KnowledgeDetailView {
  if (!knowledgeDetailIsCoherent(record) || !record.currentRevision) {
    throw knowledgeIntegrityError();
  }
  const revision = record.currentRevision;
  return {
    id: record.id,
    title: revision.title,
    bodyMarkdown: revision.bodyMarkdown,
    safetyCaution: revision.safetyCaution,
    contentKind: revision.contentKind,
    contentKindLabel: knowledgeContentKindLabels[revision.contentKind],
    trust: revision.trust,
    trustLabel:
      revision.trust === "UNVERIFIED" ? "Unverified" : "Personally Reviewed",
    lifecycleLabel: record.lifecycle === "ACTIVE" ? "Active" : "Archived",
    context: contextView(revision),
    externalReferences: revision.externalReferences.map((reference) => ({
      sequence: reference.sequence,
      label: reference.label,
      url: reference.url,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    reviewedAt: revision.reviewedAt?.toISOString() ?? null,
    mutationTokens:
      record.lifecycle === "ACTIVE" &&
      revision.trust === "UNVERIFIED" &&
      record.stateVersion <= knowledgeMaximumMutableStateVersion
        ? {
            expectedStateVersion: record.stateVersion,
            expectedCurrentRevisionId: revision.id,
          }
        : null,
  };
}

export async function getKnowledgeDetailWithClient(
  client: KnowledgeDataClient,
  idInput: unknown,
) {
  const id = z.string().uuid().safeParse(idInput);
  if (!id.success) return null;
  const record = await client.knowledgeRecord.findUnique({
    where: { id: id.data },
    select: detailSelect,
  });
  return record ? mapKnowledgeDetail(record) : null;
}

export async function getKnowledgeCreatePageDataWithClient(
  client: KnowledgeDataClient,
): Promise<KnowledgeCreatePageData> {
  const [mines, equipment] = await Promise.all([
    client.mine.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, city: { select: { name: true, state: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: knowledgeCreateOptionLimit,
    }),
    client.equipment.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        displayName: true,
        equipmentNumber: true,
        mine: { select: { name: true } },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: knowledgeCreateOptionLimit,
    }),
  ]);
  return {
    mines: mines.map((mine) => ({
      id: mine.id,
      label: `${mine.name} — ${mine.city.name}${mine.city.state ? `, ${mine.city.state}` : ""}`,
    })),
    equipment: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} — ${item.mine.name}`,
    })),
    loadError: null,
  };
}

export async function getKnowledgeEditPageDataWithClient(
  client: KnowledgeDataClient,
  idInput: unknown,
): Promise<KnowledgeEditPageData | null> {
  const id = z.string().uuid().safeParse(idInput);
  if (!id.success) return null;
  const record = await client.knowledgeRecord.findUnique({
    where: { id: id.data },
    select: detailSelect,
  });
  if (!record) return null;
  if (!knowledgeDetailIsCoherent(record) || !record.currentRevision) {
    throw knowledgeIntegrityError();
  }
  if (record.lifecycle !== "ACTIVE") {
    throw knowledgeNotEditableError();
  }
  if (record.currentRevision.trust !== "UNVERIFIED") {
    throw knowledgeNotEditableError();
  }
  if (record.stateVersion > knowledgeMaximumMutableStateVersion) {
    throw knowledgeIntegrityError();
  }
  const options = await getKnowledgeCreatePageDataWithClient(client);
  const revision = record.currentRevision;
  const mines = [...options.mines];
  if (
    revision.contextKind === "MINE" &&
    revision.mineId &&
    !mines.some((option) => option.id === revision.mineId)
  ) {
    mines.push({
      id: revision.mineId,
      label: `${revision.mineNameSnapshot} — retained current context`,
    });
  }
  const equipment = [...options.equipment];
  if (
    revision.contextKind === "EQUIPMENT" &&
    revision.equipmentId &&
    !equipment.some((option) => option.id === revision.equipmentId)
  ) {
    const label = revision.equipmentNumberSnapshot
      ? `${revision.equipmentDisplayNameSnapshot} #${revision.equipmentNumberSnapshot}`
      : revision.equipmentDisplayNameSnapshot;
    equipment.push({
      id: revision.equipmentId,
      label: `${label} — retained current context`,
    });
  }
  return {
    id: record.id,
    contentKind: revision.contentKind,
    contentKindLabel: knowledgeContentKindLabels[revision.contentKind],
    initialState: {
      status: "idle",
      message: "",
      requiresReload: false,
      fieldErrors: {},
      values: {
        expectedStateVersion: String(record.stateVersion),
        expectedCurrentRevisionId: revision.id,
        title: revision.title,
        bodyMarkdown: revision.bodyMarkdown,
        safetyCaution: revision.safetyCaution ?? "",
        contextKind: revision.contextKind,
        mineId: revision.mineId ?? "",
        equipmentId: revision.equipmentId ?? "",
      },
      externalReferences: revision.externalReferences.map((reference) => ({
        label: reference.label,
        url: reference.url,
      })),
    },
    mines,
    equipment,
    loadError: options.loadError,
  };
}

export { detailSelect as knowledgeDetailSelect };
