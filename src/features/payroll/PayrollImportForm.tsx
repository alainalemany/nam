"use client";

import { AlertTriangle, CheckCircle2, FileUp, Keyboard } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  correctPaycheckAction,
  parsePaycheckAction,
  saveManualPaycheckAction,
  savePaycheckAction,
} from "./actions";
import { PAYROLL_PARSER_VERSION } from "./constants";
import { rateSubmissionMatchesExtraction } from "./rate-extraction";
import type { ParsedPaycheck, PayrollImportState } from "./types";

const emptyPaycheck: ParsedPaycheck = {
  importMode: "MANUAL_ENTRY",
  fingerprint: "",
  parserVersion: PAYROLL_PARSER_VERSION,
  periodStart: "",
  periodEnd: "",
  checkDate: "",
  regularHours: "0",
  overtimeHours: "0",
  baseRate: "",
  regularEarnings: "0.00",
  overtimeBaseEarnings: "0.00",
  overtimePremiumEarnings: "0.00",
  otherCashEarnings: "0.00",
  grossCashPay: "0.00",
  noncashImputedEarnings: "0.00",
  preTaxDeductions: "0.00",
  employeeTaxes: "0.00",
  postTaxDeductions: "0.00",
  adjustments: "0.00",
  netPay: "0.00",
  notes: "",
  warnings: [],
};

const initialState: PayrollImportState = { status: "idle", message: "" };

type EditableKey = Exclude<keyof ParsedPaycheck,
  "warnings" | "fingerprint" | "parserVersion" | "rateExtraction" | "importMode" | "evidenceEnvelope">;
const fields: Array<{ name: EditableKey; label: string; type?: string; step?: string; wide?: boolean }> = [
  { name: "periodStart", label: "Payroll period start", type: "date" },
  { name: "periodEnd", label: "Payroll period end", type: "date" },
  { name: "checkDate", label: "Official check date", type: "date" },
  { name: "regularHours", label: "Regular paid hours", type: "number", step: "0.01" },
  { name: "overtimeHours", label: "Overtime paid hours", type: "number", step: "0.01" },
  { name: "baseRate", label: "Base hourly rate", type: "number", step: "0.0001" },
  { name: "regularEarnings", label: "Regular earnings", type: "number", step: "0.01" },
  { name: "overtimeBaseEarnings", label: "Overtime 1X earnings", type: "number", step: "0.01" },
  { name: "overtimePremiumEarnings", label: "Overtime premium 0.5X", type: "number", step: "0.01" },
  { name: "otherCashEarnings", label: "Other cash earnings", type: "number", step: "0.01" },
  { name: "grossCashPay", label: "Gross cash pay", type: "number", step: "0.01" },
  { name: "noncashImputedEarnings", label: "Noncash imputed earnings", type: "number", step: "0.01" },
  { name: "preTaxDeductions", label: "Pre-tax deductions", type: "number", step: "0.01" },
  { name: "employeeTaxes", label: "Employee taxes", type: "number", step: "0.01" },
  { name: "postTaxDeductions", label: "Post-tax deductions", type: "number", step: "0.01" },
  { name: "adjustments", label: "Cash adjustments", type: "number", step: "0.01" },
  { name: "netPay", label: "Net pay", type: "number", step: "0.01" },
  { name: "notes", label: "Review notes", wide: true },
];

export function PaycheckReviewEditor({ initial, paycheckId, canReviewRateHistory = false }: { initial: ParsedPaycheck; paycheckId?: string; canReviewRateHistory?: boolean }) {
  const [values, setValues] = useState(initial);
  const submitAction = paycheckId
    ? correctPaycheckAction
    : initial.importMode === "PDF_IMPORT"
      ? savePaycheckAction
      : saveManualPaycheckAction;
  const [state, action, pending] = useActionState(submitAction, initialState);
  const rateExtraction = values.rateExtraction;
  const extractedRateIsAmbiguous = Boolean(rateExtraction && rateExtraction.disposition !== "SUPPORTED");
  const correctionRateContextUnchanged = values.importMode === "CORRECTION" &&
    values.periodStart === initial.periodStart &&
    values.periodEnd === initial.periodEnd &&
    values.regularHours === initial.regularHours &&
    values.baseRate === initial.baseRate &&
    values.regularEarnings === initial.regularEarnings;
  const rateWillBeEstablished = values.importMode === "PDF_IMPORT"
    ? Boolean(rateExtraction && values.baseRate && rateSubmissionMatchesExtraction(
        rateExtraction,
        {
          regularHours: values.regularHours,
          hourlyRate: values.baseRate,
          regularEarnings: values.regularEarnings,
        },
      ))
    : correctionRateContextUnchanged && Boolean(values.baseRate);
  if (state.status === "saved") {
    const rateConflict = state.code === "RATE_EVIDENCE_CONFLICT";
    const rateNeedsReview = state.rateEvidence === "NEEDS_REVIEW";
    const rateNotEstablished = state.rateEvidence === "NOT_ESTABLISHED" || rateNeedsReview;
    return <div className="payroll-empty">{rateConflict || rateNotEstablished ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<strong>{rateConflict || rateNeedsReview ? "Paycheck saved — rate review required" : rateNotEstablished ? "Paycheck saved — rate not established" : "Paycheck saved — verified rate evidence recorded"}</strong><span>{rateConflict ? "Conflicting rate evidence was retained for explicit review; no tentative rate was made authoritative." : rateNeedsReview ? "A new or uncertain rate observation was retained for explicit review; no tentative rate was made authoritative." : rateNotEstablished ? state.message : "Authenticated evidence either established a trusted boundary or added support to the existing verified rate. Reconciliation has been recalculated."}</span><div className="payroll-actions"><Link className="button primary" href={state.paycheckId ? `/payroll/paychecks/${state.paycheckId}` : "/payroll"}>View Paycheck</Link>{canReviewRateHistory ? <Link className="button secondary" href="/payroll/rate-history">View Rate History</Link> : null}</div></div>;
  }
  return <form className="grid gap-5" action={action}>
    {paycheckId ? <input type="hidden" name="paycheckId" value={paycheckId} /> : null}
    <input type="hidden" name="payload" value={JSON.stringify(values)} />
    {values.warnings.length ? <div className="payroll-notice payroll-notice--warning"><strong>Review required</strong><ul>{values.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
    {values.importMode === "MANUAL_ENTRY" ? <div className="payroll-notice payroll-notice--warning"><strong>Manual paycheck entry</strong><p>The Paycheck can be saved, but manually entered numbers do not establish verified hourly-rate evidence. Use the owner evidence-review workflow for independently supported rates.</p></div> : null}
    {values.importMode === "CORRECTION" ? <div className="payroll-notice"><strong>Controlled correction</strong><p>An unchanged rate context can preserve an existing linked verified rate only after the server checks that evidence. Editing its period, regular hours, rate, or regular earnings saves the Paycheck with its rate withheld for explicit evidence review.</p>{!rateWillBeEstablished ? <p role="status"><strong>Rate review required:</strong> this correction will not create replacement verified-rate evidence.</p> : null}</div> : null}
    {rateExtraction ? <section className="payroll-notice" aria-labelledby="regular-rate-observations">
      <strong id="regular-rate-observations">Regular-rate observations</strong>
      <p>{rateExtraction.disposition === "SUPPORTED" ? "The supported Workday rows agree. Editing extracted hours, rate, or regular earnings breaks that evidence match until the original values are restored." : "The document contains ambiguous or unsupported rate evidence. You may enter a review-only rate or leave it blank. The Paycheck can be saved, but an entered rate requires explicit evidence review and will not be verified by this import."}</p>
      <ol>{rateExtraction.observations.map((observation) => <li key={`${observation.sequence}-${observation.rowIndex}`}><strong>Row {observation.sequence}</strong>: hours {observation.regularHours || "not identified"}; rate {observation.hourlyRate || "not identified"}; earnings {observation.regularEarnings || "not identified"}; date evidence {observation.rowDateStart && observation.rowDateEnd ? `${observation.rowDateStart} to ${observation.rowDateEnd}` : "pay period only"}.</li>)}</ol>
      {!rateWillBeEstablished ? <p role="status"><strong>Hourly rate withheld:</strong> saving this review will not create authoritative rate evidence.</p> : null}
    </section> : null}
    <div className="payroll-notice">Workday&apos;s Overtime 1X and Overtime Premium 0.5X represent the same overtime hours. Confirm hours once; earnings remain separate.{paycheckId ? " The original import fingerprint remains as provenance." : ""}</div>
    <div className="payroll-form-grid">
      {fields.map((field) => <label className={field.wide ? "payroll-field--wide" : undefined} key={field.name}>{field.name === "baseRate" && extractedRateIsAmbiguous ? "Base hourly rate (review only)" : field.label}{field.name === "notes" ? <textarea rows={3} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input required={field.name !== "baseRate"} type={field.type} step={field.step} min={field.name === "adjustments" ? undefined : "0"} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}
    </div>
    {state.status === "error" ? <div className="payroll-notice payroll-notice--error" role="alert">{state.message}</div> : null}
    <div className="payroll-actions"><button className="button primary" disabled={pending} type="submit">{pending ? "Saving…" : paycheckId ? "Save Correction" : "Confirm and Save"}</button><Link className="button secondary" href={paycheckId ? `/payroll/paychecks/${paycheckId}` : "/payroll"}>Cancel</Link></div>
  </form>;
}

export function PayrollImportForm({ canReviewRateHistory = false }: { canReviewRateHistory?: boolean }) {
  const [state, action, pending] = useActionState(parsePaycheckAction, initialState);
  const [manual, setManual] = useState(false);
  if (state.status === "review" && state.values) return <PaycheckReviewEditor key={state.values.fingerprint} initial={state.values} canReviewRateHistory={canReviewRateHistory} />;
  if (manual) return <PaycheckReviewEditor initial={emptyPaycheck} canReviewRateHistory={canReviewRateHistory} />;
  return <div className="grid gap-5">
    <form className="grid gap-4" action={action}>
      <label className="payroll-import-dropzone"><FileUp aria-hidden="true" /><strong>Select a Workday payslip PDF</strong><span>Readable text is extracted in memory. The PDF and raw text are not retained.</span><input name="payslip" type="file" accept="application/pdf,.pdf" required /></label>
      {state.status === "error" ? <div className="payroll-notice payroll-notice--error" role="alert">{state.message}</div> : null}
      <button className="button primary" disabled={pending} type="submit">{pending ? "Reading PDF…" : "Extract for Review"}</button>
    </form>
    <button className="button secondary" type="button" onClick={() => setManual(true)}><Keyboard size={16} aria-hidden="true" /> Enter Manually</button>
  </div>;
}
