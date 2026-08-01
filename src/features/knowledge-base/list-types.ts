import type {
  KnowledgeContentKind,
  KnowledgeContextKind,
  KnowledgeRecordLifecycle,
  KnowledgeTrust,
} from "@prisma/client";

export type KnowledgeListOption = Readonly<{
  id: string;
  label: string;
  active: boolean;
}>;

export type KnowledgeListRow = Readonly<{
  id: string;
  detailHref: string;
  title: string;
  excerpt: string;
  contentKind: KnowledgeContentKind;
  contentKindLabel: string;
  trust: KnowledgeTrust;
  trustLabel: string;
  lifecycle: KnowledgeRecordLifecycle;
  lifecycleLabel: string;
  contextKind: KnowledgeContextKind;
  contextSummary: string;
  contextAvailability: string | null;
  updatedAt: string;
}>;

export type KnowledgeListPageReady = Readonly<{
  status: "ready";
  rows: readonly KnowledgeListRow[];
  mineOptions: readonly KnowledgeListOption[];
  equipmentOptions: readonly KnowledgeListOption[];
  totalCount: number;
  activeCount: number;
  matchingCount: number;
  page: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  outOfRange: boolean;
}>;

export type KnowledgeListPageResult =
  | KnowledgeListPageReady
  | Readonly<{
      status: "error";
      message: string;
    }>;
