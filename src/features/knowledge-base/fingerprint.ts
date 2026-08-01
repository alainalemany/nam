import { createHash } from "node:crypto";

import { knowledgeFingerprintDomain } from "./constants";
import type {
  KnowledgeContextSnapshot,
  KnowledgeCreateInput,
  KnowledgeExternalReferenceInput,
} from "./types";

export type KnowledgeCanonicalCreatePayload = Readonly<{
  formatVersion: typeof knowledgeFingerprintDomain;
  contentKind: KnowledgeCreateInput["contentKind"];
  title: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  context: Readonly<{
    kind: KnowledgeCreateInput["contextKind"];
    mineId: string | null;
    equipmentId: string | null;
    equipmentDisplayName: string | null;
    equipmentNumber: string | null;
    equipmentCategory: string | null;
    mineName: string | null;
    cityName: string | null;
    cityState: string | null;
  }>;
  externalReferences: readonly KnowledgeExternalReferenceInput[];
}>;

function canonicalContext(context: KnowledgeContextSnapshot) {
  if (context.kind === "GENERAL") {
    return {
      kind: context.kind,
      mineId: null,
      equipmentId: null,
      equipmentDisplayName: null,
      equipmentNumber: null,
      equipmentCategory: null,
      mineName: null,
      cityName: null,
      cityState: null,
    } as const;
  }
  if (context.kind === "MINE") {
    return {
      kind: context.kind,
      mineId: context.mineId,
      equipmentId: null,
      equipmentDisplayName: null,
      equipmentNumber: null,
      equipmentCategory: null,
      mineName: context.mineName,
      cityName: context.cityName,
      cityState: context.cityState,
    } as const;
  }
  return {
    kind: context.kind,
    mineId: context.mineId,
    equipmentId: context.equipmentId,
    equipmentDisplayName: context.equipmentDisplayName,
    equipmentNumber: context.equipmentNumber,
    equipmentCategory: context.equipmentCategory,
    mineName: context.mineName,
    cityName: context.cityName,
    cityState: context.cityState,
  } as const;
}

export function canonicalKnowledgeCreatePayload(
  input: KnowledgeCreateInput,
  context: KnowledgeContextSnapshot,
): KnowledgeCanonicalCreatePayload {
  return {
    formatVersion: knowledgeFingerprintDomain,
    contentKind: input.contentKind,
    title: input.title,
    bodyMarkdown: input.bodyMarkdown,
    safetyCaution: input.safetyCaution,
    context: canonicalContext(context),
    externalReferences: input.externalReferences.map((reference) => ({
      label: reference.label,
      url: reference.url,
    })),
  };
}

export function serializeCanonicalKnowledgeCreatePayload(
  payload: KnowledgeCanonicalCreatePayload,
) {
  return JSON.stringify(payload);
}

export function fingerprintKnowledgeCreatePayload(
  input: KnowledgeCreateInput,
  context: KnowledgeContextSnapshot,
) {
  const serialized = serializeCanonicalKnowledgeCreatePayload(
    canonicalKnowledgeCreatePayload(input, context),
  );
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
