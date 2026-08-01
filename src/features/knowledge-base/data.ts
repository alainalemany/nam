import { prisma } from "@/lib/prisma";

import {
  getKnowledgeCreatePageDataWithClient,
  getKnowledgeDetailWithClient,
} from "./data-internal";

export async function getKnowledgeCreatePageData() {
  try {
    return await getKnowledgeCreatePageDataWithClient(prisma);
  } catch {
    return { mines: [], equipment: [], loadError: "Reference options are temporarily unavailable." } as const;
  }
}

export function getKnowledgeDetail(id: unknown) {
  return getKnowledgeDetailWithClient(prisma, id);
}
