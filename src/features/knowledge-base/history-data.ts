import { prisma } from "@/lib/prisma";

import {
  getKnowledgeHistoricalRevisionWithClient,
  getKnowledgeHistoryWithClient,
} from "./history-data-internal";

export function getKnowledgeHistory(id: unknown) {
  return getKnowledgeHistoryWithClient(prisma, id);
}

export function getKnowledgeHistoricalRevision(id: unknown, revisionNumber: unknown) {
  return getKnowledgeHistoricalRevisionWithClient(prisma, id, revisionNumber);
}
