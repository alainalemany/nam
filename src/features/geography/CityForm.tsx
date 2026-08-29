"use client";

import Link from "next/link";
import { useActionState } from "react";

import { emptyGeographyActionState, type GeographyActionState } from "./validation";

export function CityForm({ action, states, initial }: {
  action: (state: GeographyActionState, formData: FormData) => Promise<GeographyActionState>;
  states: Array<{ id: string; name: string; abbreviation: string; status: string }>;
  initial?: { name: string; stateId: string };
}) {
  const [state, formAction, pending] = useActionState(action, emptyGeographyActionState);
  const value = (name: "name" | "stateId") => state.status === "error" ? state.values[name] ?? "" : initial?.[name] ?? "";
  const error = (name: string) => state.fieldErrors[name]?.[0];
  const attributes = (name: string) => error(name)
    ? { "aria-describedby": `city-${name}-error`, "aria-invalid": true as const }
    : {};
  return <form action={formAction} className="panel form-stack">
    {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
    <div className="form-grid">
      <label><span>City name</span><input {...attributes("name")} defaultValue={value("name")} maxLength={200} name="name" required />{error("name") ? <span className="field-error" id="city-name-error">{error("name")}</span> : null}</label>
      <label><span>State</span><select {...attributes("stateId")} defaultValue={value("stateId")} name="stateId" required><option value="">Select State</option>{states.map((item) => <option disabled={item.status !== "ACTIVE" && item.id !== initial?.stateId} key={item.id} value={item.id}>{item.name} ({item.abbreviation}){item.status !== "ACTIVE" ? " (inactive)" : ""}</option>)}</select>{error("stateId") ? <span className="field-error" id="city-stateId-error">{error("stateId")}</span> : null}</label>
    </div>
    <div className="inline-actions"><button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save City"}</button><Link className="button secondary" href="/reference-data/cities">Cancel</Link></div>
  </form>;
}
