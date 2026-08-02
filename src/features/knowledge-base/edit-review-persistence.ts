import { prisma } from "@/lib/prisma";

import {
  reviewKnowledgeRecordWithDependencies,
  updateUnverifiedKnowledgeRecordWithDependencies,
} from "./edit-review-persistence-internal";
import type { KnowledgeEditInput, KnowledgeReviewInput } from "./types";

export function updateUnverifiedKnowledgeRecord(input: KnowledgeEditInput) {
  return updateUnverifiedKnowledgeRecordWithDependencies(input, { client: prisma });
}

export function reviewKnowledgeRecord(input: KnowledgeReviewInput) {
  return reviewKnowledgeRecordWithDependencies(input, { client: prisma });
}
