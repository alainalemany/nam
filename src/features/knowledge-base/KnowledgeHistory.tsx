import Link from "next/link";

import {
  knowledgeDisclaimer,
  knowledgeHistoryReadOnlyExplanation,
  knowledgePersonalReviewExplanation,
  knowledgeUnverifiedWarning,
} from "./constants";
import type { KnowledgeHistoryView } from "./types";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function KnowledgeHistory({ history }: { history: KnowledgeHistoryView }) {
  const includesUnverified = history.revisions.some((revision) => revision.trustLabel === "Unverified");
  return (
    <main className="page-stack knowledge-history-page">
      <section className="page-header">
        <p className="eyebrow">Knowledge Base · Retained history</p>
        <h1>Revision history: {history.title}</h1>
        <p>{knowledgeHistoryReadOnlyExplanation}</p>
      </section>
      <section aria-labelledby="knowledge-history-authority" className="panel notice-stack">
        <h2 id="knowledge-history-authority">Authority and review limits</h2>
        {includesUnverified ? <p role="alert"><strong>{knowledgeUnverifiedWarning}</strong></p> : null}
        <p>{knowledgePersonalReviewExplanation}</p>
        <p>{knowledgeDisclaimer}</p>
      </section>
      <ol aria-label="Knowledge Record revisions" className="knowledge-history-list">
        {history.revisions.map((revision) => (
          <li className="panel" key={revision.revisionNumber}>
            <article aria-labelledby={`knowledge-history-revision-${revision.revisionNumber}`}>
              <p className="eyebrow">{revision.designation}</p>
              <h2 id={`knowledge-history-revision-${revision.revisionNumber}`}>
                <Link href={revision.href}>Revision {revision.revisionNumber}</Link>
              </h2>
              <dl>
                <dt>Origin</dt><dd>{revision.origin === "INITIAL" ? "Initial" : revision.origin === "REVISED" ? "Revised" : "Restored"}</dd>
                <dt>Kind</dt><dd>{revision.contentKindLabel}</dd>
                <dt>Trust</dt><dd>{revision.trustLabel}</dd>
                <dt>Context</dt><dd>{revision.contextSummary}</dd>
                {revision.changeSummary ? <><dt>Change summary</dt><dd>{revision.changeSummary}</dd></> : null}
                <dt>Created</dt><dd>{dateTime(revision.createdAt)}</dd>
                <dt>Updated</dt><dd>{dateTime(revision.updatedAt)}</dd>
                {revision.reviewedAt ? <><dt>Personally reviewed</dt><dd>{dateTime(revision.reviewedAt)}</dd></> : null}
              </dl>
            </article>
          </li>
        ))}
      </ol>
      <Link className="button secondary" href={`/knowledge-base/${encodeURIComponent(history.id)}`}>Return to current Knowledge Record</Link>
    </main>
  );
}
