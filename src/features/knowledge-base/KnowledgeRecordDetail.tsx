import Link from "next/link";

import { knowledgeDisclaimer, knowledgeUnverifiedWarning } from "./constants";
import { KnowledgeMarkdown } from "./markdown";
import type { KnowledgeDetailView } from "./types";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function KnowledgeRecordDetail({ detail }: { detail: KnowledgeDetailView }) {
  return (
    <main className="page-stack knowledge-detail">
      <section className="page-header">
        <p className="eyebrow">Knowledge Base · {detail.contentKindLabel}</p>
        <h1>{detail.title}</h1>
        <div className="badge-row" aria-label="Record status">
          <span className="status-badge">Trust: {detail.trustLabel}</span>
          <span className="status-badge">Lifecycle: {detail.lifecycleLabel}</span>
        </div>
      </section>

      <section aria-labelledby="knowledge-warning-heading" className="panel notice-stack">
        <h2 id="knowledge-warning-heading">Authority and trust</h2>
        <p role="alert"><strong>{knowledgeUnverifiedWarning}</strong></p>
        <p>{knowledgeDisclaimer}</p>
      </section>

      <section aria-labelledby="knowledge-context-heading" className="panel">
        <h2 id="knowledge-context-heading">Context</h2>
        <p>{detail.context.label}</p>
        {detail.context.kind === "MINE" && !detail.context.mineAvailable ? <p>Live Mine record unavailable; retained display context shown.</p> : null}
        {detail.context.kind === "EQUIPMENT" && !detail.context.equipmentAvailable ? <p>Live Equipment record unavailable; retained display context shown.</p> : null}
      </section>

      {detail.safetyCaution ? (
        <section aria-labelledby="knowledge-caution-heading" className="panel notice-stack">
          <h2 id="knowledge-caution-heading">Personal safety caution</h2>
          <p>{detail.safetyCaution}</p>
          <p>This caution is personal operational knowledge, not official instruction.</p>
        </section>
      ) : null}

      <article aria-labelledby="knowledge-body-heading" className="panel knowledge-markdown">
        <h2 className="sr-only" id="knowledge-body-heading">Knowledge content</h2>
        <KnowledgeMarkdown source={detail.bodyMarkdown} />
      </article>

      {detail.externalReferences.length > 0 ? (
        <section aria-labelledby="knowledge-references-heading" className="panel">
          <h2 id="knowledge-references-heading">External references</h2>
          <ol>
            {detail.externalReferences.map((reference) => (
              <li key={reference.sequence}>
                <a href={reference.url} rel="noreferrer">{reference.label}</a>
              </li>
            ))}
          </ol>
          <p className="field-help">External references are not fetched, previewed, or verified by NAM.</p>
        </section>
      ) : null}

      <section aria-labelledby="knowledge-timestamps-heading" className="panel">
        <h2 id="knowledge-timestamps-heading">Record timestamps</h2>
        <dl>
          <dt>Created</dt><dd>{dateTime(detail.createdAt)}</dd>
          <dt>Updated</dt><dd>{dateTime(detail.updatedAt)}</dd>
        </dl>
      </section>

      <div className="inline-actions">
        <Link className="button secondary" href="/knowledge-base/new">Create another Knowledge Record</Link>
      </div>
    </main>
  );
}
