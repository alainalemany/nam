import { prisma } from "@/lib/prisma";

import { getKnowledgeListPageWithClient } from "./list-data-internal";
import type { KnowledgeListFilters } from "./list-params";
import type { KnowledgeListPageResult } from "./list-types";

export async function getKnowledgeListPage(
  filters: KnowledgeListFilters,
): Promise<KnowledgeListPageResult> {
  try {
    return await getKnowledgeListPageWithClient(prisma, filters);
  } catch {
    return {
      status: "error",
      message: "Knowledge Base records are temporarily unavailable. Try loading this page again.",
    };
  }
}
