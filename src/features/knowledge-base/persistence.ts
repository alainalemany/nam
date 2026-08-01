import { prisma } from "@/lib/prisma";

import { createKnowledgeRecordWithDependencies } from "./persistence-internal";
import type { KnowledgeCreateInput } from "./types";

export function createKnowledgeRecord(input: KnowledgeCreateInput) {
  return createKnowledgeRecordWithDependencies(input, { client: prisma });
}
