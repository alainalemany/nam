"use client";

import { AlertTriangle, CheckCircle2, FileUp, Keyboard } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { correctPaycheckAction, parsePaycheckAction, savePaycheckAction } from "./actions";
import { PAYROLL_PARSER_VERSION } from "./constants";
import type { ParsedPaycheck, PayrollImportState } from "./types";

const emptyPaycheck: ParsedPaycheck = {
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

type EditableKey = Exclude<keyof ParsedPaycheck, "warnings" | "fingerprint" | "parserVersion">;
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

export function PaycheckReviewEditor({ initial, paycheckId }: { initial: ParsedPaycheck; paycheckId?: string }) {
  const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState(paycheckId ? correctPaycheckAction : savePaycheckAction, initialState);
  if (state.status === "saved") {
    const rateConflict = state.code === "RATE_EVIDENCE_CONFLICT";
    return <div className="payroll-empty">{rateConflict ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<strong>{rateConflict ? "Paycheck saved — rate review required" : "Paycheck saved"}</strong><span>{rateConflict ? state.message : "Reconciliation has been recalculated from the current source records."}</span><Link className="button primary" href={state.paycheckId ? `/payroll/paychecks/${state.paycheckId}` : "/payroll"}>View Paycheck</Link></div>;
  }
  return <form className="grid gap-5" action={action}>
    {paycheckId ? <input type="hidden" name="paycheckId" value={paycheckId} /> : null}
    <input type="hidden" name="payload" value={JSON.stringify(values)} />
    {values.warnings.length ? <div className="payroll-notice payroll-notice--warning"><strong>Review required</strong><ul>{values.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
    <div className="payroll-notice">Workday&apos;s Overtime 1X and Overtime Premium 0.5X represent the same overtime hours. Confirm hours once; earnings remain separate.{paycheckId ? " The original import fingerprint remains as provenance." : ""}</div>
    <div className="payroll-form-grid">
      {fields.map((field) => <label className={field.wide ? "payroll-field--wide" : undefined} key={field.name}>{field.label}{field.name === "notes" ? <textarea rows={3} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input required={field.name !== "baseRate"} type={field.type} step={field.step} min={field.name === "adjustments" ? undefined : "0"} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}
    </div>
    {state.status === "error" ? <div className="payroll-notice payroll-notice--error" role="alert">{state.message}</div> : null}
    <div className="payroll-actions"><button className="button primary" disabled={pending} type="submit">{pending ? "Saving…" : paycheckId ? "Save Correction" : "Confirm and Save"}</button><Link className="button secondary" href={paycheckId ? `/payroll/paychecks/${paycheckId}` : "/payroll"}>Cancel</Link></div>
  </form>;
}

export function PayrollImportForm() {
  const [state, action, pending] = useActionState(parsePaycheckAction, initialState);
  const [manual, setManual] = useState(false);
  if (state.status === "review" && state.values) return <PaycheckReviewEditor key={state.values.fingerprint} initial={state.values} />;
  if (manual) return <PaycheckReviewEditor initial={emptyPaycheck} />;
  return <div className="grid gap-5">
    <form className="grid gap-4" action={action}>
      <label className="payroll-import-dropzone"><FileUp aria-hidden="true" /><strong>Select a Workday payslip PDF</strong><span>Readable text is extracted in memory. The PDF and raw text are not retained.</span><input name="payslip" type="file" accept="application/pdf,.pdf" required /></label>
      {state.status === "error" ? <div className="payroll-notice payroll-notice--error" role="alert">{state.message}</div> : null}
      <button className="button primary" disabled={pending} type="submit">{pending ? "Reading PDF…" : "Extract for Review"}</button>
    </form>
    <button className="button secondary" type="button" onClick={() => setManual(true)}><Keyboard size={16} aria-hidden="true" /> Enter Manually</button>
  </div>;
}
