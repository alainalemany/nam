import { formatReviewTimestamp } from "./evidence-review-presentation";
import { candidateStatusLabels } from "./rate-history-presentation";

type Event = {
  id: string;
  decisionKind: string;
  previousStatus: string;
  newStatus: string;
  previousVersion: number;
  newVersion: number;
  exactEffectiveDate: string | null;
  employeePayRateId: string | null;
  reviewerDisplayNameSnapshot: string;
  reviewerEmployeeCodeSnapshot: string | null;
  reason: string;
  sourceEvidenceReference: string | null;
  createdAt: string;
};

export function RateBoundaryTimeline({ createdAt, classification, events }: { createdAt: string; classification: string; events: Event[] }) {
  return <section className="review-history" aria-labelledby="boundary-history-heading"><h2 id="boundary-history-heading">Immutable candidate history</h2><ol className="review-timeline"><li className="review-timeline-item"><div className="review-timeline-heading"><strong>Candidate created · {classification}</strong><time dateTime={createdAt}>{formatReviewTimestamp(createdAt)}</time></div><span className="review-attribution">System classification</span><p>The parser-derived candidate was recorded for owner review. This is not an owner approval.</p></li>{events.map((event) => <li key={event.id} className="review-timeline-item"><div className="review-timeline-heading"><strong>{event.decisionKind.replaceAll("_", " ")}</strong><time dateTime={event.createdAt}>{formatReviewTimestamp(event.createdAt)}</time></div><span className="review-attribution">Owner review decision</span><p>{candidateStatusLabels[event.previousStatus]} → {candidateStatusLabels[event.newStatus]}</p>{event.exactEffectiveDate ? <p>Reviewer-selected exact date: {event.exactEffectiveDate}</p> : null}<p className="subtle">Reviewer: {event.reviewerDisplayNameSnapshot}{event.reviewerEmployeeCodeSnapshot ? ` (${event.reviewerEmployeeCodeSnapshot})` : ""} · Version {event.previousVersion} → {event.newVersion}</p><p>{event.reason}</p>{event.sourceEvidenceReference ? <p className="subtle">Evidence reference: {event.sourceEvidenceReference}</p> : null}</li>)}</ol></section>;
}
