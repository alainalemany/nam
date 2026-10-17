"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { rejectPayRateBoundaryCandidateAction, verifyExactPayRateBoundaryAction } from "./evidence-review-actions";
import type { EvidenceReviewResult } from "./evidence-review-types";
import { formatRate } from "./evidence-review-presentation";
import { validateCandidateDate } from "./rate-history-presentation";

const idle: EvidenceReviewResult = { ok: false, code: "INVALID_TRANSITION", message: "" };

function resultMessage(result: EvidenceReviewResult) {
  if (result.ok) return `${result.idempotencyReplay ? "This exact decision was already saved." : "Decision saved with immutable history."} Authoritative candidate state: ${result.newState}; version ${result.newVersion}; event ${result.auditEventId}.`;
  if (result.code === "STALE_REVIEW") return "This candidate changed. Refresh and review the current evidence before deciding.";
  if (result.code === "RATE_EVIDENCE_CONFLICT") return "Conflicting evidence still covers this date. No boundary was created.";
  if (result.code === "UNAUTHORIZED_REVIEW") return "Your Payroll reviewer authorization is unavailable or expired.";
  if (result.code === "EVIDENCE_NOT_FOUND") return "The candidate or its authenticated evidence is no longer available.";
  if (result.code === "INVALID_IDEMPOTENCY_TOKEN") return "That request token belongs to a different decision. Refresh before changing the submission.";
  return result.message;
}
export type BoundaryDecisionCandidate = {
  id: string;
  status: string;
  evidenceVersion: number;
  observedHourlyRate: string;
  earliestEffectiveDate: string;
  latestEffectiveDate: string | null;
  previousRate: { hourlyRate: string; effectiveFrom: string } | null;
  affectedEntryCount: number;
  conflictCount: number;
  promotableObservationCount: number;
};

export function RateBoundaryDecisionForm({ candidate }: { candidate: BoundaryDecisionCandidate }) {
  const router = useRouter();
  const confirmation = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EvidenceReviewResult>(idle);
  const [decision, setDecision] = useState<"verify" | "reject" | "">("");
  const [exactDate, setExactDate] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [requestToken, setRequestToken] = useState<string>();
  const dateError = decision === "verify" ? validateCandidateDate(exactDate, candidate.earliestEffectiveDate, candidate.latestEffectiveDate) : undefined;

  useEffect(() => { if (confirming) confirmation.current?.focus(); }, [confirming]);
  useEffect(() => { if (result.ok || result.message) notice.current?.focus(); }, [result]);
  useEffect(() => { if (result.ok) router.refresh(); }, [result, router]);

  function changed() {
    setConfirming(false);
    setRequestToken(undefined);
    setResult(idle);
  }

  function submit() {
    const token = requestToken ?? crypto.randomUUID();
    setRequestToken(token);
    const payload = decision === "verify" ? {
      decision: "VERIFY_EXACT_BOUNDARY",
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      exactEffectiveDate: exactDate,
      reason,
      ...(reference.trim() ? { sourceEvidenceReference: reference } : {}),
      requestToken: token,
    } : {
      decision: "REJECT_BOUNDARY_CANDIDATE",
      candidateId: candidate.id,
      expectedEvidenceVersion: candidate.evidenceVersion,
      reason,
      ...(reference.trim() ? { sourceEvidenceReference: reference } : {}),
      requestToken: token,
    };
    const data = new FormData();
    data.set("payload", JSON.stringify(payload));
    const action = decision === "verify" ? verifyExactPayRateBoundaryAction : rejectPayRateBoundaryCandidateAction;
    startTransition(async () => {
      try { setResult(await action(result, data)); }
      catch { setResult({ ok: false, code: "INVALID_TRANSITION", message: "The request outcome is uncertain. Retry this unchanged confirmation with the same token, or refresh before changing the decision." }); }
    });
  }

  if (candidate.status !== "OPEN") return <section className="review-decision-card"><h2>Decision complete</h2><p>This candidate is {candidate.status.toLowerCase()} and cannot accept another transition. Its evidence and immutable history remain available.</p></section>;
  if (result.ok) return <section className="review-decision-card rate-decision-success" aria-labelledby="rate-decision-complete"><h2 id="rate-decision-complete">Decision complete</h2><div ref={notice} className="payroll-notice" role="status" tabIndex={-1}>{resultMessage(result)}</div><p>{result.newState === "RESOLVED" ? "The server created a verified exact boundary from eligible authenticated evidence." : "The proposed boundary was rejected. No observations were deleted."}</p><p>Expected gross becomes available only where the refreshed server state confirms no other unresolved candidate or conflict applies.</p><a className="button primary" href="/payroll/rate-history">Return to refreshed rate history</a></section>;

  const valid = decision !== "" && reason.trim().length > 0 && (decision !== "verify" || (!dateError && candidate.promotableObservationCount > 0));
  return <section className="review-decision-card" aria-labelledby="boundary-decision-heading"><h2 id="boundary-decision-heading">Candidate decision</h2><p className="subtle">Reviewer-only. The backend independently validates authorization, version, evidence eligibility, date bounds, conflicts, and request idempotency.</p>{result.message ? <div ref={notice} className="payroll-notice payroll-notice--error" role="alert" tabIndex={-1}>{resultMessage(result)}</div> : null}{candidate.promotableObservationCount === 0 ? <div className="payroll-notice payroll-notice--error" role="alert"><strong>Promotion unavailable</strong><p>No active authenticated Workday observation is eligible to support an exact boundary. Evidence may still be rejected without deletion.</p></div> : null}<div className="rate-decision-choice" role="radiogroup" aria-label="Candidate decision"><label><input type="radio" name="decision" disabled={candidate.promotableObservationCount === 0} checked={decision === "verify"} onChange={() => { setDecision("verify"); changed(); }} /> Confirm exact effective date</label><label><input type="radio" name="decision" checked={decision === "reject"} onChange={() => { setDecision("reject"); changed(); }} /> Reject proposed boundary</label></div>{decision ? <div className="review-form-grid">{decision === "verify" ? <label>Exact effective date<input aria-describedby={dateError && exactDate ? "exact-date-help exact-date-error" : "exact-date-help"} type="date" min={candidate.earliestEffectiveDate} max={candidate.latestEffectiveDate ?? undefined} value={exactDate} onChange={(event) => { setExactDate(event.target.value); changed(); }} /><span id="exact-date-help" className="field-help">No date is preselected. Choose a document-supported date inside the candidate window.</span>{dateError && exactDate ? <span id="exact-date-error" className="field-warning" role="alert">{dateError}</span> : null}</label> : <div className="payroll-notice payroll-notice--warning"><strong>Reject the boundary, not the evidence</strong><p>All source observations and history remain retained. Rejection does not verify a competing rate.</p></div>}<label>Reason<textarea required maxLength={1000} value={reason} onChange={(event) => { setReason(event.target.value); changed(); }} /></label><label>Evidence reference <span className="subtle">(optional)</span><input maxLength={500} value={reference} onChange={(event) => { setReference(event.target.value); changed(); }} /><span className="field-help">Enter only a retained document identifier or date, never sensitive document contents.</span></label></div> : null}{confirming ? <div ref={confirmation} className="review-confirmation" role="group" aria-label="Confirm rate boundary decision" tabIndex={-1}><h3>{decision === "verify" ? "Confirm verified boundary" : "Confirm candidate rejection"}</h3>{decision === "verify" ? <dl><div><dt>Previous verified rate</dt><dd>{candidate.previousRate ? formatRate(candidate.previousRate.hourlyRate) : "None"}</dd></div><div><dt>Proposed rate</dt><dd>{formatRate(candidate.observedHourlyRate)}</dd></div><div><dt>Exact effective date</dt><dd>{exactDate}</dd></div><div><dt>Affected worked dates shown</dt><dd>{candidate.affectedEntryCount}</dd></div><div><dt>Other open conflicts</dt><dd>{candidate.conflictCount}</dd></div></dl> : <p>The candidate will be rejected without deleting its observations. Other unresolved candidates remain open.</p>}<p>{reason}</p><div className="inline-actions"><button className="button primary" disabled={pending} onClick={submit} type="button">{pending ? "Saving…" : decision === "verify" ? "Confirm exact boundary" : "Confirm rejection"}</button><button className="button secondary" disabled={pending} onClick={() => setConfirming(false)} type="button">Back</button></div></div> : <button className="button primary" disabled={!valid} onClick={() => setConfirming(true)} type="button">Review proposed decision</button>}</section>;
}
