import type {
  EquipmentCategory,
  KnowledgeContentKind,
  KnowledgeContextKind,
} from "@prisma/client";

export type KnowledgeExternalReferenceInput = Readonly<{
  label: string;
  url: string;
}>;

export type KnowledgeCreateInput = Readonly<{
  submissionKey: string;
  contentKind: KnowledgeContentKind;
  title: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  contextKind: KnowledgeContextKind;
  mineId: string | null;
  equipmentId: string | null;
  externalReferences: readonly KnowledgeExternalReferenceInput[];
}>;

export type KnowledgeCreateFormValues = Readonly<{
  submissionKey: string;
  contentKind: string;
  title: string;
  bodyMarkdown: string;
  safetyCaution: string;
  contextKind: string;
  mineId: string;
  equipmentId: string;
}>;

export type KnowledgeCreateActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  values: KnowledgeCreateFormValues;
  externalReferences: readonly KnowledgeExternalReferenceInput[];
}>;

export type KnowledgeMineOption = Readonly<{
  id: string;
  label: string;
}>;

export type KnowledgeEquipmentOption = Readonly<{
  id: string;
  label: string;
}>;

export type KnowledgeCreatePageData = Readonly<{
  mines: readonly KnowledgeMineOption[];
  equipment: readonly KnowledgeEquipmentOption[];
  loadError: string | null;
}>;

export type KnowledgeContextSnapshot =
  | Readonly<{ kind: "GENERAL" }>
  | Readonly<{
      kind: "MINE";
      mineId: string;
      mineName: string;
      cityName: string;
      cityState: string | null;
    }>
  | Readonly<{
      kind: "EQUIPMENT";
      equipmentId: string;
      equipmentDisplayName: string;
      equipmentNumber: string | null;
      equipmentCategory: EquipmentCategory;
      mineId: string;
      mineName: string;
      cityName: string;
      cityState: string | null;
    }>;

export type KnowledgeCreateResult = Readonly<{
  knowledgeRecordId: string;
  duplicate: boolean;
}>;

export type KnowledgeDetailView = Readonly<{
  id: string;
  title: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  contentKind: KnowledgeContentKind;
  contentKindLabel: string;
  trustLabel: "Unverified";
  lifecycleLabel: "Active";
  context:
    | Readonly<{ kind: "GENERAL"; label: "General" }>
    | Readonly<{
        kind: "MINE";
        label: string;
        mineAvailable: boolean;
      }>
    | Readonly<{
        kind: "EQUIPMENT";
        label: string;
        equipmentAvailable: boolean;
      }>;
  externalReferences: readonly Readonly<{
    sequence: number;
    label: string;
    url: string;
  }>[];
  createdAt: string;
  updatedAt: string;
}>;
