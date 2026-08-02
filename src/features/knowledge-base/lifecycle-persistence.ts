import { prisma } from "@/lib/prisma";

import {
  archiveKnowledgeRecordWithDependencies,
  deleteKnowledgeRecordWithDependencies,
  restoreKnowledgeRecordWithDependencies,
} from "./lifecycle-persistence-internal";
import type { KnowledgeDeleteInput, KnowledgeLifecycleInput } from "./types";

export function archiveKnowledgeRecord(input: KnowledgeLifecycleInput) {
  return archiveKnowledgeRecordWithDependencies(input, { client: prisma });
}

export function restoreKnowledgeRecord(input: KnowledgeLifecycleInput) {
  return restoreKnowledgeRecordWithDependencies(input, { client: prisma });
}

export function deleteKnowledgeRecord(input: KnowledgeDeleteInput) {
  return deleteKnowledgeRecordWithDependencies(input, { client: prisma });
}
