import Link from "next/link";
import { notFound } from "next/navigation";

import { KnowledgeRecordEditForm } from "@/features/knowledge-base/KnowledgeRecordEditForm";
import { getKnowledgeEditPageData } from "@/features/knowledge-base/data";
import { KnowledgeBaseError } from "@/features/knowledge-base/errors";

export const dynamic = "force-dynamic";

export default async function EditKnowledgeRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let pageData: Awaited<ReturnType<typeof getKnowledgeEditPageData>>;
  try {
    pageData = await getKnowledgeEditPageData(id);
  } catch (error) {
    if (
      error instanceof KnowledgeBaseError &&
      ["RECORD_NOT_EDITABLE", "REVISION_NUMBER_EXHAUSTED"].includes(error.code)
    ) {
      return (
        <main className="page-stack knowledge-edit-page">
          <section className="panel" role="status">
            <h1>Knowledge Record is read-only</h1>
            <p>{error.message}</p>
            <Link className="button secondary" href={`/knowledge-base/${encodeURIComponent(id)}`}>Return to Knowledge Record</Link>
          </section>
        </main>
      );
    }
    return (
      <main className="page-stack knowledge-edit-page">
        <section className="panel" role="alert">
          <h1>Knowledge Record unavailable</h1>
          <p>The current record state could not be loaded safely. No alternate revision was selected.</p>
          <Link className="button secondary" href="/knowledge-base">Return to Knowledge Base</Link>
        </section>
      </main>
    );
  }
  if (!pageData) notFound();
  return (
    <main className="page-stack knowledge-edit-page">
      <section className="page-header">
        <p className="eyebrow">Knowledge Base · Revision {pageData.revisionNumber}</p>
        <h1>{pageData.mode === "REVISE_REVIEWED" ? "Create a New Unverified Revision" : "Edit Unverified Knowledge Record"}</h1>
        <p className="summary">{pageData.mode === "REVISE_REVIEWED"
          ? "Change Personally Reviewed material without losing its retained reviewed history."
          : "Update the current Unverified material in place."}</p>
      </section>
      <KnowledgeRecordEditForm pageData={pageData} />
    </main>
  );
}
