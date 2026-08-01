import { randomUUID } from "node:crypto";

import { KnowledgeRecordForm } from "@/features/knowledge-base/KnowledgeRecordForm";
import { getKnowledgeCreatePageData } from "@/features/knowledge-base/data";
import type { KnowledgeCreateActionState } from "@/features/knowledge-base/types";

export const dynamic = "force-dynamic";

export default async function NewKnowledgeRecordPage() {
  let pageData: Awaited<ReturnType<typeof getKnowledgeCreatePageData>>;
  try {
    pageData = await getKnowledgeCreatePageData();
  } catch {
    pageData = { mines: [], equipment: [], loadError: "Active Mine and Equipment options could not be loaded safely. Reload and try again." };
  }
  const initialState: KnowledgeCreateActionState = {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: {
      submissionKey: randomUUID(),
      contentKind: "FIELD_NOTE",
      title: "",
      bodyMarkdown: "",
      safetyCaution: "",
      contextKind: "GENERAL",
      mineId: "",
      equipmentId: "",
    },
    externalReferences: [],
  };
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Knowledge Base</p>
        <h1>Create Knowledge Record</h1>
        <p className="summary">Capture reusable personal operational knowledge that should outlive a single dated event.</p>
      </section>
      <KnowledgeRecordForm initialState={initialState} pageData={pageData} />
    </main>
  );
}
