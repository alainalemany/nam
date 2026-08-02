import { notFound } from "next/navigation";

import { KnowledgeHistoricalRevision } from "@/features/knowledge-base/KnowledgeHistoricalRevision";
import { getKnowledgeHistoricalRevision } from "@/features/knowledge-base/history-data";

export const dynamic = "force-dynamic";

export default async function KnowledgeHistoricalRevisionPage({ params }: { params: Promise<{ id: string; revisionNumber: string }> }) {
  const { id, revisionNumber } = await params;
  let revision: Awaited<ReturnType<typeof getKnowledgeHistoricalRevision>>;
  try {
    revision = await getKnowledgeHistoricalRevision(id, revisionNumber);
  } catch {
    return <main className="page-stack knowledge-revision-page"><section className="panel" role="alert"><h1>Knowledge revision unavailable</h1><p>The requested revision could not be loaded safely.</p><a className="button secondary" href="/knowledge-base">Return to Knowledge Base</a></section></main>;
  }
  if (!revision) notFound();
  return <KnowledgeHistoricalRevision revision={revision} />;
}
