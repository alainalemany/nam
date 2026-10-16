"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { reviewPayRateEvidenceAction, reviewTimesheetIdentityAction, resolvePayRateEvidenceCompetitorsAction } from "./evidence-review-actions";
import type { EvidenceReviewResult } from "./evidence-review-types";
import { employeeLabel, identityStatusLabels, provenanceLabels, rateStatusLabels } from "./evidence-review-presentation";

const idle: EvidenceReviewResult = { ok: false, code: "INVALID_TRANSITION", message: "" };

function messageFor(result: EvidenceReviewResult) {
  if (result.ok) return `${result.idempotencyReplay ? "This decision was already saved." : "Review decision saved with immutable history."} Authoritative state: ${result.newState}; version ${result.newVersion}; event ${result.auditEventId}.`;
  if (result.code === "STALE_REVIEW") return "This evidence changed. Refresh before making another decision.";
  if (result.code === "IDENTITY_CONFLICT" || result.code === "RATE_EVIDENCE_CONFLICT") return "The decision conflicts with newer authoritative evidence. Refresh and review the current state.";
  if (result.code === "UNAUTHORIZED_REVIEW") return "Your review authorization is unavailable or expired.";
  return result.message;
}

function ResultNotice({ result }: { result: EvidenceReviewResult }) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (result.ok || result.message) notice.current?.focus(); }, [result]);
  if (!result.ok && !result.message) return null;
  return <div ref={notice} className={`payroll-notice ${result.ok ? "" : "payroll-notice--error"}`} role={result.ok ? "status" : "alert"} tabIndex={-1}>{messageFor(result)}</div>;
}

function useReviewSubmission() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EvidenceReviewResult>(idle);
  const [token, setToken] = useState<string>();
  useEffect(() => { if (result.ok) router.refresh(); }, [result, router]);
  return {
    pending, result, token,
    begin() { const next = token ?? crypto.randomUUID(); setToken(next); return next; },
    reset() { setToken(undefined); setResult(idle); },
    submit(action: (state: EvidenceReviewResult, data: FormData) => Promise<EvidenceReviewResult>, payload: unknown) {
      const data = new FormData(); data.set("payload", JSON.stringify(payload));
      startTransition(async () => {
        try {
          setResult(await action(result, data));
        } catch {
          setResult({ ok: false, code: "INVALID_TRANSITION", message: "The request did not complete. Retry this unchanged submission safely, or refresh before changing the decision." });
        }
      });
    },
  };
}

type EmployeeChoice = { id: string; displayName: string; employeeCode: string | null; isActive: boolean };

export function TimesheetIdentityReviewForm({ timesheet, employees }: { timesheet: { id: string; identityVersion: number; primaryEmployeeIdentityStatus: string; primaryEmployeeId: string | null }; employees: EmployeeChoice[] }) {
  const submission = useReviewSubmission();
  const confirmation = useRef<HTMLDivElement>(null);
  const [decision, setDecision] = useState(""); const [employeeId, setEmployeeId] = useState(""); const [reason, setReason] = useState(""); const [reference, setReference] = useState(""); const [confirming, setConfirming] = useState(false);
  useEffect(() => { if (confirming) confirmation.current?.focus(); }, [confirming]);
  const decisions = timesheet.primaryEmployeeIdentityStatus === "OWNER_VERIFIED"
    ? [["REOPEN_UNCERTAINTY", "Reopen uncertain ownership"], ["CORRECT_OWNER", "Correct verified owner"]]
    : timesheet.primaryEmployeeIdentityStatus === "NEEDS_REVIEW"
      ? [["VERIFY_OWNER", "Verify ownership"], ["REVIEW_UNASSIGNED", "Mark reviewed/unassigned"]]
      : timesheet.primaryEmployeeIdentityStatus === "REVIEWED_UNASSIGNED" ? [["VERIFY_OWNER", "Verify ownership"]] : [];
  const requiresEmployee = decision === "VERIFY_OWNER" || decision === "CORRECT_OWNER";
  const selected = employees.find((employee) => employee.id === employeeId);
  function changed() { setConfirming(false); submission.reset(); }
  const valid = reason.trim().length > 0 && (!requiresEmployee || Boolean(employeeId));
  function submit() {
    const requestToken = submission.begin();
    submission.submit(reviewTimesheetIdentityAction, { decision, timesheetId: timesheet.id, expectedIdentityVersion: timesheet.identityVersion, ...(requiresEmployee ? { employeeId } : {}), reason, ...(reference.trim() ? { sourceEvidenceReference: reference } : {}), requestToken });
  }
  return <section className="review-decision-card" aria-labelledby="identity-decision-heading"><h2 id="identity-decision-heading">Review decision</h2><ResultNotice result={submission.result} /><div className="review-form-grid"><label>Decision<select value={decision} onChange={(event) => { setDecision(event.target.value); changed(); }}><option value="">Select a decision</option>{decisions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{requiresEmployee ? <label>Canonical Employee<select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); changed(); }}><option value="">Select an Employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}</select>{selected?.isActive === false ? <span className="field-warning">Inactive historical Employee — confirm the evidence carefully.</span> : null}<span className="field-help">Historical candidates are never preselected.</span></label> : null}<label>Reason<textarea maxLength={1000} required value={reason} onChange={(event) => { setReason(event.target.value); changed(); }} /></label><label>Supporting evidence reference <span className="subtle">(optional)</span><input maxLength={500} value={reference} onChange={(event) => { setReference(event.target.value); changed(); }} /></label></div>{confirming ? <div ref={confirmation} className="review-confirmation" role="group" aria-label="Confirm identity decision" tabIndex={-1}><h3>Confirm this change</h3><dl><div><dt>Status</dt><dd>{identityStatusLabels[timesheet.primaryEmployeeIdentityStatus]} → {decision === "REVIEW_UNASSIGNED" ? identityStatusLabels.REVIEWED_UNASSIGNED : decision === "REOPEN_UNCERTAINTY" ? identityStatusLabels.NEEDS_REVIEW : identityStatusLabels.OWNER_VERIFIED}</dd></div><div><dt>Employee</dt><dd>{timesheet.primaryEmployeeId ?? "Unassigned"} → {requiresEmployee ? employeeId : "Unassigned"}</dd></div></dl><p>Original name and identity snapshots remain unchanged. An immutable event will record this decision.</p><div className="inline-actions"><button className="button primary" disabled={submission.pending} onClick={submit} type="button">{submission.pending ? "Saving…" : "Confirm and save"}</button><button className="button secondary" disabled={submission.pending} onClick={() => setConfirming(false)} type="button">Back</button></div></div> : <button className="button primary" disabled={!valid || !decision} onClick={() => setConfirming(true)} type="button">Review proposed change</button>}</section>;
}

type RateChoice = { id: string; evidenceVersion: number; verificationStatus: string; hourlyRate: string };
type PaycheckChoice = { id: string; reviewStatus: string; baseRate: string | null; periodStart: string; checkDate: string };

export function PayRateEvidenceReviewForm({ rate, paychecks, competitors }: { rate: RateChoice & { provenanceKind: string; sourcePaycheckId: string | null }; paychecks: PaycheckChoice[]; competitors: RateChoice[] }) {
  const submission = useReviewSubmission();
  const confirmation = useRef<HTMLDivElement>(null);
  const [decision, setDecision] = useState(""); const [sourcePaycheckId, setSourcePaycheckId] = useState(""); const [reason, setReason] = useState(""); const [reference, setReference] = useState(""); const [confirming, setConfirming] = useState(false); const [resolve, setResolve] = useState(false);
  useEffect(() => { if (confirming) confirmation.current?.focus(); }, [confirming]);
  const [dispositions, setDispositions] = useState<Record<string, "CONFLICT" | "EXCLUDED" | "SUPERSEDED">>(() => Object.fromEntries(competitors.map((item) => [item.id, "CONFLICT"])));
  const allowed = useMemo(() => rate.verificationStatus === "NEEDS_REVIEW" ? [["VERIFY_PAYCHECK", "Verify from Paycheck"], ["VERIFY_INDEPENDENT", "Verify independent evidence"], ["MARK_CONFLICT", "Mark conflict"], ["EXCLUDE", "Exclude evidence"]] : rate.verificationStatus === "CONFLICT" ? [["VERIFY_PAYCHECK", "Verify from Paycheck"], ["VERIFY_INDEPENDENT", "Verify independent evidence"], ["EXCLUDE", "Exclude evidence"], ["REOPEN_REVIEW", "Reopen review"]] : rate.verificationStatus === "VERIFIED" ? [["MARK_CONFLICT", "Mark conflict"], ["EXCLUDE", "Exclude evidence"], ["REOPEN_REVIEW", "Reopen review"]] : [["REOPEN_REVIEW", "Reopen review"]], [rate.verificationStatus]);
  const needsPaycheck = decision === "VERIFY_PAYCHECK"; const needsReference = decision === "VERIFY_INDEPENDENT";
  function changed() { setConfirming(false); submission.reset(); }
  const valid = reason.trim().length > 0 && (!needsPaycheck || sourcePaycheckId) && (!needsReference || reference.trim().length > 0);
  function submit() {
    const requestToken = submission.begin();
    if (resolve) submission.submit(resolvePayRateEvidenceCompetitorsAction, { decision: "RESOLVE_COMPETITORS", selectedRateId: rate.id, selectedExpectedEvidenceVersion: rate.evidenceVersion, selectedProvenance: needsPaycheck ? "PAYCHECK" : "INDEPENDENT", ...(needsPaycheck ? { sourcePaycheckId } : {}), competitors: competitors.map((item) => ({ rateId: item.id, expectedEvidenceVersion: item.evidenceVersion, disposition: dispositions[item.id] })), reason, ...(reference.trim() ? { sourceEvidenceReference: reference } : {}), requestToken });
    else submission.submit(reviewPayRateEvidenceAction, { decision, rateId: rate.id, expectedEvidenceVersion: rate.evidenceVersion, ...(needsPaycheck ? { sourcePaycheckId } : {}), reason, ...(reference.trim() ? { sourceEvidenceReference: reference } : {}), requestToken });
  }
  return <section className="review-decision-card" aria-labelledby="rate-decision-heading"><h2 id="rate-decision-heading">Review decision</h2><ResultNotice result={submission.result} /><div className="review-form-grid"><label>Decision<select value={decision} onChange={(event) => { setDecision(event.target.value); setResolve(false); changed(); }}><option value="">Select a decision</option>{allowed.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{needsPaycheck ? <label>Supporting Paycheck<select value={sourcePaycheckId} onChange={(event) => { setSourcePaycheckId(event.target.value); changed(); }}><option value="">Select confirmed evidence</option>{paychecks.map((paycheck) => <option key={paycheck.id} value={paycheck.id}>{paycheck.periodStart} · {paycheck.checkDate} · {paycheck.baseRate ?? "No rate"} · {paycheck.reviewStatus}</option>)}</select></label> : null}<label>Reason<textarea maxLength={1000} required value={reason} onChange={(event) => { setReason(event.target.value); changed(); }} /></label><label>Evidence reference {needsReference ? "(required)" : "(optional)"}<input maxLength={500} required={needsReference} value={reference} onChange={(event) => { setReference(event.target.value); changed(); }} /><span className="field-help">Use a document identifier or date; do not enter sensitive contents.</span></label>{competitors.length > 0 && (decision === "VERIFY_PAYCHECK" || decision === "VERIFY_INDEPENDENT") ? <fieldset><legend>Competing evidence</legend><label className="review-check"><input type="checkbox" checked={resolve} onChange={(event) => { setResolve(event.target.checked); changed(); }} /> Resolve every active competitor atomically</label>{resolve ? competitors.map((item) => <label key={item.id}>{item.hourlyRate} · {rateStatusLabels[item.verificationStatus]}<select value={dispositions[item.id]} onChange={(event) => { setDispositions({ ...dispositions, [item.id]: event.target.value as typeof dispositions[string] }); changed(); }}><option value="CONFLICT">Conflict</option><option value="EXCLUDED">Excluded</option><option value="SUPERSEDED">Superseded</option></select></label>) : <p className="field-warning">Verification may conflict with an existing same-date rate. Use atomic resolution to disposition every competitor explicitly.</p>}</fieldset> : null}</div>{confirming ? <div ref={confirmation} className="review-confirmation" role="group" aria-label="Confirm rate decision" tabIndex={-1}><h3>Confirm this change</h3><p>{rateStatusLabels[rate.verificationStatus]} / {provenanceLabels[rate.provenanceKind]} → {decision.replaceAll("_", " ")}</p>{resolve ? <ul>{competitors.map((item) => <li key={item.id}>{item.id}: {dispositions[item.id]}</li>)}</ul> : null}<p>All evidence rows remain preserved. Each changed row receives an immutable event.</p><div className="inline-actions"><button className="button primary" disabled={submission.pending} onClick={submit} type="button">{submission.pending ? "Saving…" : "Confirm and save"}</button><button className="button secondary" disabled={submission.pending} onClick={() => setConfirming(false)} type="button">Back</button></div></div> : <button className="button primary" disabled={!valid || !decision || (resolve && competitors.length === 0)} onClick={() => setConfirming(true)} type="button">Review proposed change</button>}</section>;
}
