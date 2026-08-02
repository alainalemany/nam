export const knowledgeContentKinds = [
  "FIELD_NOTE",
  "TROUBLESHOOTING",
  "PROCEDURE",
  "SAFETY_REMINDER",
  "REFERENCE",
] as const;

export const knowledgeContentKindLabels = {
  FIELD_NOTE: "Field Note",
  TROUBLESHOOTING: "Troubleshooting",
  PROCEDURE: "Procedure",
  SAFETY_REMINDER: "Safety Reminder",
  REFERENCE: "Reference",
} as const;

export const knowledgeContextKinds = ["GENERAL", "MINE", "EQUIPMENT"] as const;

export const knowledgeContextKindLabels = {
  GENERAL: "General",
  MINE: "Mine",
  EQUIPMENT: "Equipment",
} as const;

export const knowledgeDisclaimer =
  "Personal operational knowledge for reference only. It is not corporate, manufacturer, engineering, MSHA, or site approval. Verify against current official manuals, procedures, lockout/tagout requirements, and site rules before acting.";

export const knowledgeUnverifiedWarning =
  "Unverified field knowledge — do not treat as instruction; confirm before use.";

export const knowledgeFingerprintDomain = "nam.knowledge-base.create.v1";
export const knowledgeCreateMaximumAttempts = 3;
export const knowledgeMaximumTitleLength = 160;
export const knowledgeMaximumBodyLength = 50_000;
export const knowledgeMaximumCautionLength = 2_000;
export const knowledgeMaximumExternalReferences = 10;
export const knowledgeMaximumExternalReferenceLabelLength = 120;
export const knowledgeMaximumExternalReferenceUrlLength = 2_048;
export const knowledgeMaximumIdentifierLength = 191;
export const knowledgeCreateOptionLimit = 250;
export const knowledgeMarkdownMaximumDepth = 32;
export const knowledgeMarkdownMaximumNodes = 10_000;
export const knowledgeListPageSize = 50;
export const knowledgeListMaximumSearchLength = 200;
export const knowledgeListExcerptLength = 240;
export const knowledgeListMaximumPage = 42_949_672;
export const knowledgeListOptionLimit = 500;
export const knowledgeMaximumMutableStateVersion = 2_147_483_646;

export const knowledgePersonalReviewExplanation =
  "Personal review means only that you reread this material and personally consider it useful. It is not corporate, management, manufacturer, engineering, MSHA, site, or another person's approval.";

export const knowledgeReviewedReadOnlyExplanation =
  "Personally Reviewed material is read-only until a later reviewed-revision workflow is implemented.";
