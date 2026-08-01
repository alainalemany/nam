import { notFound } from "next/navigation";

import { KnowledgeRecordDetail } from "@/features/knowledge-base/KnowledgeRecordDetail";
import { getKnowledgeDetail } from "@/features/knowledge-base/data";

export const dynamic = "force-dynamic";

export default async function KnowledgeRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail: Awaited<ReturnType<typeof getKnowledgeDetail>>;
  try {
    detail = await getKnowledgeDetail(id);
  } catch {
    return (
      <main className="page-stack">
        <section className="panel" role="alert">
          <h1>Knowledge Record unavailable</h1>
          <p>The current record state could not be loaded safely. No alternate revision was selected.</p>
          <a className="button secondary" href="/knowledge-base/new">Create Knowledge Record</a>
        </section>
      </main>
    );
  }
  if (!detail) notFound();
  return <KnowledgeRecordDetail detail={detail} />;
}
