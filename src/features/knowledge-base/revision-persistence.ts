import { prisma } from "@/lib/prisma";

import { mutateKnowledgeRecordWithDependencies } from "./revision-persistence-internal";
import type { KnowledgeEditInput } from "./types";

export function mutateKnowledgeRecord(input: KnowledgeEditInput) {
  return mutateKnowledgeRecordWithDependencies(input, { client: prisma });
}
