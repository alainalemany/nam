import { identityStatusLabels, provenanceLabels, rateStatusLabels, formatReviewTimestamp } from "./evidence-review-presentation";

type TimesheetEvent = {
  id: string; sequence: number; decisionKind: string; previousStatus: string; newStatus: string;
  previousPrimaryEmployeeId: string | null; newPrimaryEmployeeId: string | null;
  previousEmployeeDisplayNameSnapshot: string | null; newEmployeeDisplayNameSnapshot: string | null;
  reviewerDisplayNameSnapshot: string; reviewerEmployeeCodeSnapshot: string | null;
  previousVersion: number; newVersion: number; reason: string; sourceEvidenceReference: string | null; createdAt: Date;
};

type RateEvent = {
  id: string; sequence: number; decisionKind: string; attributionKind: string;
  previousStatus: string | null; newStatus: string; previousProvenanceKind: string | null; newProvenanceKind: string;
  previousSourcePaycheckId: string | null; newSourcePaycheckId: string | null;
  reviewerDisplayNameSnapshot: string | null; reviewerEmployeeCodeSnapshot: string | null;
  initiatedByDisplayNameSnapshot: string | null; previousVersion: number; newVersion: number;
  reason: string; sourceEvidenceReference: string | null; createdAt: Date;
};

function TimelineShell({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  return <section className="review-history" aria-labelledby="review-history-heading"><h2 id="review-history-heading">Immutable review history</h2>{empty ? <p className="payroll-empty">No review decisions have been recorded.</p> : <ol className="review-timeline">{children}</ol>}</section>;
}

export function TimesheetReviewTimeline({ events }: { events: TimesheetEvent[] }) {
  return <TimelineShell empty={events.length === 0}>{events.map((event) => <li key={event.id} className="review-timeline-item"><div className="review-timeline-heading"><strong>{event.decisionKind.replaceAll("_", " ")}</strong><time dateTime={event.createdAt.toISOString()}>{formatReviewTimestamp(event.createdAt)}</time></div><p>{identityStatusLabels[event.previousStatus]} → {identityStatusLabels[event.newStatus]}</p><p>{event.previousEmployeeDisplayNameSnapshot ?? "No assigned Employee"} → {event.newEmployeeDisplayNameSnapshot ?? "No assigned Employee"}</p><p className="subtle">Reviewer: {event.reviewerDisplayNameSnapshot}{event.reviewerEmployeeCodeSnapshot ? ` (${event.reviewerEmployeeCodeSnapshot})` : ""} · Version {event.previousVersion} → {event.newVersion}</p><p>{event.reason}</p>{event.sourceEvidenceReference ? <p className="subtle">Evidence: {event.sourceEvidenceReference}</p> : null}</li>)}</TimelineShell>;
}

export function RateReviewTimeline({ events }: { events: RateEvent[] }) {
  return <TimelineShell empty={events.length === 0}>{events.map((event) => { const system = event.attributionKind === "PAYCHECK_CORRECTION_SYSTEM"; return <li key={event.id} className={`review-timeline-item${system ? " review-timeline-item--system" : ""}`}><div className="review-timeline-heading"><strong>{event.decisionKind.replaceAll("_", " ")}</strong><time dateTime={event.createdAt.toISOString()}>{formatReviewTimestamp(event.createdAt)}</time></div><span className="review-attribution">{system ? "Automatic Paycheck correction" : "Owner review decision"}</span><p>{event.previousStatus ? rateStatusLabels[event.previousStatus] : "Created"} → {rateStatusLabels[event.newStatus]}</p><p>{event.previousProvenanceKind ? provenanceLabels[event.previousProvenanceKind] : "No prior provenance"} → {provenanceLabels[event.newProvenanceKind]}</p><p className="subtle">{system ? `Initiated by ${event.initiatedByDisplayNameSnapshot ?? "authenticated Payroll user"}` : `Reviewer: ${event.reviewerDisplayNameSnapshot}`} · Version {event.previousVersion} → {event.newVersion}</p><p>{event.reason}</p>{event.sourceEvidenceReference ? <p className="subtle">Evidence: {event.sourceEvidenceReference}</p> : null}</li>; })}</TimelineShell>;
}
