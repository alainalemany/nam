import Link from "next/link";

import {
  knowledgeDisclaimer,
  knowledgeHistoryReadOnlyExplanation,
  knowledgePersonalReviewExplanation,
  knowledgeUnverifiedWarning,
} from "./constants";
import { KnowledgeMarkdown } from "./markdown";
import type { KnowledgeHistoricalRevisionView } from "./types";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function KnowledgeHistoricalRevision({ revision }: { revision: KnowledgeHistoricalRevisionView }) {
  const relationships = revision.relationships ?? { sourceDailyLog: null, relatedDefect: null };
  return (
    <main className="page-stack knowledge-revision-page">
      <section className="page-header">
        <p className="eyebrow">Knowledge Base · {revision.designation}</p>
        <h1>{revision.title}</h1>
        <p>Revision {revision.revisionNumber} · {revision.originLabel} · {revision.contentKindLabel}</p>
        <div aria-label="Revision status" className="badge-row">
          <span className="status-badge">Authority: {revision.designation}</span>
          <span className="status-badge">Trust: {revision.trustLabel}</span>
          <span className="status-badge">Record lifecycle: {revision.lifecycleLabel}</span>
        </div>
      </section>
      <section aria-labelledby="knowledge-revision-authority" className="panel notice-stack">
        <h2 id="knowledge-revision-authority">Authority and review limits</h2>
        {revision.trustLabel === "Unverified" ? <p role="alert"><strong>{knowledgeUnverifiedWarning}</strong></p> : null}
        <p>{knowledgePersonalReviewExplanation}</p>
        <p>{knowledgeHistoryReadOnlyExplanation}</p>
        {revision.lifecycleLabel === "Archived" ? <p>The owning personal Knowledge Record is Archived; this revision remains read-only.</p> : null}
        <p>{knowledgeDisclaimer}</p>
      </section>
      {revision.changeSummary ? <section className="panel" aria-labelledby="knowledge-revision-summary"><h2 id="knowledge-revision-summary">Change summary</h2><p>{revision.changeSummary}</p></section> : null}
      <section className="panel" aria-labelledby="knowledge-revision-context"><h2 id="knowledge-revision-context">Context</h2><p>{revision.contextSummary}</p>{revision.contextAvailability ? <p>{revision.contextAvailability}; retained snapshot shown.</p> : null}</section>
      <section className="panel knowledge-relationships" aria-labelledby="knowledge-revision-relationships">
        <h2 id="knowledge-revision-relationships">Provenance relationships</h2>
        <dl>
          <dt>Source Daily Log</dt><dd>{relationships.sourceDailyLog ? (relationships.sourceDailyLog.available && relationships.sourceDailyLog.href ? <Link href={relationships.sourceDailyLog.href}>{relationships.sourceDailyLog.date} · {relationships.sourceDailyLog.shift}</Link> : <>{relationships.sourceDailyLog.date} · {relationships.sourceDailyLog.shift} — Daily Log unavailable (retained snapshot)</>) : "None"}</dd>
          <dt>Related Defect</dt><dd>{relationships.relatedDefect ? (relationships.relatedDefect.available && relationships.relatedDefect.href ? <Link href={relationships.relatedDefect.href}>{relationships.relatedDefect.title} · reported {relationships.relatedDefect.reportedDate}</Link> : <>{relationships.relatedDefect.title} · reported {relationships.relatedDefect.reportedDate} — Defect unavailable (retained snapshot)</>) : "None"}</dd>
        </dl>
        <p className="field-help">Linked for navigation and provenance only. This retained revision is read-only.</p>
      </section>
      {revision.safetyCaution ? <section className="panel notice-stack" aria-labelledby="knowledge-revision-caution"><h2 id="knowledge-revision-caution">Personal safety caution</h2><p>{revision.safetyCaution}</p></section> : null}
      <article className="panel knowledge-markdown" aria-labelledby="knowledge-revision-body"><h2 className="sr-only" id="knowledge-revision-body">Revision content</h2><KnowledgeMarkdown source={revision.bodyMarkdown} /></article>
      {revision.externalReferences.length ? <section className="panel" aria-labelledby="knowledge-revision-references"><h2 id="knowledge-revision-references">External references</h2><ol>{revision.externalReferences.map((reference) => <li key={reference.sequence}><a href={reference.url} rel="noreferrer">{reference.label}</a></li>)}</ol></section> : null}
      <section className="panel" aria-labelledby="knowledge-revision-timestamps"><h2 id="knowledge-revision-timestamps">Revision timestamps</h2><dl><dt>Created</dt><dd>{dateTime(revision.createdAt)}</dd><dt>Updated</dt><dd>{dateTime(revision.updatedAt)}</dd>{revision.reviewedAt ? <><dt>Personally reviewed</dt><dd>{dateTime(revision.reviewedAt)}</dd></> : null}</dl></section>
      <nav aria-label="Knowledge revision navigation" className="inline-actions">
        <Link className="button primary" href={revision.currentHref}>Current Knowledge Record</Link>
        <Link className="button secondary" href={revision.historyHref}>Revision history</Link>
      </nav>
    </main>
  );
}
