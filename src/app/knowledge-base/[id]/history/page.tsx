import { notFound } from "next/navigation";

import { KnowledgeHistory } from "@/features/knowledge-base/KnowledgeHistory";
import { getKnowledgeHistory } from "@/features/knowledge-base/history-data";

export const dynamic = "force-dynamic";

export default async function KnowledgeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let history: Awaited<ReturnType<typeof getKnowledgeHistory>>;
  try {
    history = await getKnowledgeHistory(id);
  } catch {
    return <main className="page-stack knowledge-history-page"><section className="panel" role="alert"><h1>Knowledge history unavailable</h1><p>The retained revision state could not be loaded safely.</p><a className="button secondary" href="/knowledge-base">Return to Knowledge Base</a></section></main>;
  }
  if (!history) notFound();
  return <KnowledgeHistory history={history} />;
}
