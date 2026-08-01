import Link from "next/link";

import { KnowledgeRecordList } from "@/features/knowledge-base/KnowledgeRecordList";
import { getKnowledgeListPage } from "@/features/knowledge-base/list-data";
import {
  knowledgeListHref,
  parseKnowledgeListFilters,
  type KnowledgeListSearchParams,
} from "@/features/knowledge-base/list-params";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams?: Promise<KnowledgeListSearchParams>;
}) {
  const parsed = parseKnowledgeListFilters((await searchParams) ?? {});
  const result = await getKnowledgeListPage(parsed.filters);
  return (
    <main className="page-stack knowledge-list-page">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Personal Operational Knowledge</p>
          <h1 id="page-title">Knowledge Base</h1>
          <p className="summary">Find reusable personal field knowledge independently of dated operational records.</p>
        </div>
        <Link className="button primary" href="/knowledge-base/new">Create Knowledge Record</Link>
      </section>
      {result.status === "error" ? (
        <section className="panel" aria-labelledby="knowledge-list-unavailable">
          <div className="form-alert" role="alert">
            <h2 id="knowledge-list-unavailable">Knowledge Base unavailable</h2>
            <p>{result.message}</p>
            <Link className="button secondary" href={knowledgeListHref(parsed.filters)}>Try again</Link>
          </div>
        </section>
      ) : (
        <KnowledgeRecordList
          data={result}
          filters={parsed.filters}
          invalidParameters={parsed.invalidParameters}
        />
      )}
    </main>
  );
}
