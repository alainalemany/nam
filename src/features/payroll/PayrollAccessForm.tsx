"use client";

import { useActionState } from "react";

import { unlockPayrollAction } from "./actions";

export function PayrollAccessForm() {
  const [state, action, pending] = useActionState(unlockPayrollAction, { ok: true, message: "" });
  return <form className="payroll-access-form" action={action}><label>Payroll access key<input name="accessKey" type="password" autoComplete="current-password" required /></label>{state.message ? <div className="payroll-notice payroll-notice--error" role="alert">{state.message}</div> : null}<button className="button primary" disabled={pending} type="submit">{pending ? "Unlocking…" : "Unlock Payroll"}</button></form>;
}
