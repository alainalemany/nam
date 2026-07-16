"use client";

import { useActionState } from "react";

import { saveFuelServicePersonAction } from "./actions";

const initialState = { ok: true, message: "" };

export function FuelServicePersonForm({
  id = null,
  initial,
}: {
  id?: string | null;
  initial?: { displayName: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveFuelServicePersonAction.bind(null, id), initialState);
  return (
    <form action={action} className="form-grid reference-form">
      {state.message ? <p className={state.ok ? "form-message success" : "form-message error"}>{state.message}</p> : null}
      <label><span>Display name</span><input defaultValue={initial?.displayName} maxLength={200} name="displayName" required /></label>
      <label className="checkbox-field"><input defaultChecked={initial?.active ?? true} name="active" type="checkbox" /><span>Available for new selections</span></label>
      <button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save Fuel Service Person"}</button>
    </form>
  );
}
