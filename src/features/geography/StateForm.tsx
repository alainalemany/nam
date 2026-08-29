"use client";

import Link from "next/link";
import { useActionState } from "react";

import { emptyGeographyActionState, type GeographyActionState } from "./validation";

export function StateForm({ action, initial }: {
  action: (state: GeographyActionState, formData: FormData) => Promise<GeographyActionState>;
  initial?: { name: string; abbreviation: string };
}) {
  const [state, formAction, pending] = useActionState(action, emptyGeographyActionState);
  const value = (name: "name" | "abbreviation") => state.status === "error" ? state.values[name] ?? "" : initial?.[name] ?? "";
  const error = (name: string) => state.fieldErrors[name]?.[0];
  const attributes = (name: string) => error(name)
    ? { "aria-describedby": `state-${name}-error`, "aria-invalid": true as const }
    : {};
  return <form action={formAction} className="panel form-stack">
    {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
    <div className="form-grid">
      <label><span>State name</span><input {...attributes("name")} defaultValue={value("name")} maxLength={100} name="name" required />{error("name") ? <span className="field-error" id="state-name-error">{error("name")}</span> : null}</label>
      <label><span>Abbreviation</span><input {...attributes("abbreviation")} defaultValue={value("abbreviation")} maxLength={2} name="abbreviation" required />{error("abbreviation") ? <span className="field-error" id="state-abbreviation-error">{error("abbreviation")}</span> : null}</label>
    </div>
    <div className="inline-actions"><button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save State"}</button><Link className="button secondary" href="/reference-data/states">Cancel</Link></div>
  </form>;
}
