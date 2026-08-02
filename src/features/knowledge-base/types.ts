import type {
  EquipmentCategory,
  KnowledgeContentKind,
  KnowledgeContextKind,
  KnowledgeTrust,
  KnowledgeRecordLifecycle,
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

export type KnowledgeMutationTokens = Readonly<{
  expectedStateVersion: number;
  expectedCurrentRevisionId: string;
}>;

export type KnowledgeEditInput = Readonly<{
  knowledgeRecordId: string;
  expectedStateVersion: number;
  expectedCurrentRevisionId: string;
  contentKind: KnowledgeContentKind;
  changeSummary: string | null;
  title: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  contextKind: KnowledgeContextKind;
  mineId: string | null;
  equipmentId: string | null;
  externalReferences: readonly KnowledgeExternalReferenceInput[];
}>;

export type KnowledgeEditFormValues = Readonly<{
  expectedStateVersion: string;
  expectedCurrentRevisionId: string;
  contentKind: string;
  changeSummary: string;
  title: string;
  bodyMarkdown: string;
  safetyCaution: string;
  contextKind: string;
  mineId: string;
  equipmentId: string;
}>;

export type KnowledgeEditActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  requiresReload: boolean;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  values: KnowledgeEditFormValues;
  externalReferences: readonly KnowledgeExternalReferenceInput[];
}>;

export type KnowledgeReviewInput = Readonly<{
  knowledgeRecordId: string;
  expectedStateVersion: number;
  expectedCurrentRevisionId: string;
}>;

export type KnowledgeReviewActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  requiresReload: boolean;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  expectedStateVersion: string;
  expectedCurrentRevisionId: string;
  confirmed: boolean;
}>;

export type KnowledgeMutationResult = Readonly<{
  knowledgeRecordId: string;
  stateVersion: number;
  duplicate: boolean;
  revisionNumber?: number;
}>;

export type KnowledgeLifecycleOperation = "ARCHIVE" | "RESTORE" | "DELETE";

export type KnowledgeLifecycleInput = Readonly<{
  knowledgeRecordId: string;
  expectedStateVersion: number;
  expectedCurrentRevisionId: string;
}>;

export type KnowledgeDeleteInput = KnowledgeLifecycleInput & Readonly<{
  confirmationTitle: string;
}>;

export type KnowledgeLifecycleActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  requiresReload: boolean;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  expectedStateVersion: string;
  expectedCurrentRevisionId: string;
  confirmed: boolean;
  deleteConfirmation: string;
}>;

export type KnowledgeLifecycleResult = Readonly<{
  knowledgeRecordId: string;
  operation: KnowledgeLifecycleOperation;
  stateVersion: number | null;
  duplicate: boolean;
  revisionNumber?: number;
}>;

export type KnowledgeLifecycleControlsView = Readonly<{
  lifecycle: KnowledgeRecordLifecycle;
  trust: KnowledgeTrust;
  archivedAt: string | null;
  tokens: KnowledgeMutationTokens;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
  deleteConfirmationTitle: string;
}>;

export type KnowledgeEditPageData = Readonly<{
  id: string;
  mode: "EDIT_UNVERIFIED" | "REVISE_REVIEWED";
  revisionNumber: number;
  contentKind: KnowledgeContentKind;
  contentKindLabel: string;
  initialState: KnowledgeEditActionState;
  mines: readonly KnowledgeMineOption[];
  equipment: readonly KnowledgeEquipmentOption[];
  loadError: string | null;
}>;

export type KnowledgeDetailView = Readonly<{
  id: string;
  title: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  contentKind: KnowledgeContentKind;
  contentKindLabel: string;
  trust: KnowledgeTrust;
  trustLabel: "Unverified" | "Personally Reviewed";
  lifecycleLabel: "Active" | "Archived";
  lifecycle: KnowledgeRecordLifecycle;
  archivedAt: string | null;
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
  reviewedAt: string | null;
  revisionNumber: number;
  historyHref: string;
  mutationTokens: KnowledgeMutationTokens | null;
  lifecycleControls: KnowledgeLifecycleControlsView;
}>;

export type KnowledgeHistoryRevisionSummary = Readonly<{
  revisionNumber: number;
  href: string;
  isCurrent: boolean;
  designation: "Current Unverified" | "Current Personally Reviewed" | "Retained Reviewed";
  origin: "INITIAL" | "REVISED" | "RESTORED";
  contentKindLabel: string;
  trustLabel: "Unverified" | "Personally Reviewed";
  changeSummary: string | null;
  contextSummary: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}>;

export type KnowledgeHistoryView = Readonly<{
  id: string;
  title: string;
  lifecycleLabel: "Active" | "Archived";
  archivedAt: string | null;
  currentRevisionNumber: number;
  revisions: readonly KnowledgeHistoryRevisionSummary[];
}>;

export type KnowledgeHistoricalRevisionView = Readonly<{
  recordId: string;
  lifecycleLabel: "Active" | "Archived";
  archivedAt: string | null;
  revisionNumber: number;
  isCurrent: boolean;
  designation: "Current Unverified" | "Current Personally Reviewed" | "Retained Reviewed";
  title: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  contentKindLabel: string;
  trustLabel: "Unverified" | "Personally Reviewed";
  originLabel: "Initial" | "Revised" | "Restored";
  changeSummary: string | null;
  contextSummary: string;
  contextAvailability: string | null;
  externalReferences: readonly Readonly<{ sequence: number; label: string; url: string }>[];
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  currentHref: string;
  historyHref: string;
}>;
