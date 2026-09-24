"use client";

import { useActionState } from "react";

import { saveMaintenanceComponentAction } from "./actions";
import { initialMaintenanceActionState } from "./validation";

type Props = {
  id?: string;
  initial?: {
    name: string;
    description: string | null;
    trackingUnit: string;
    active: boolean;
    sortOrder: number;
  };
};

export function MaintenanceComponentForm({ id, initial }: Props) {
  const [state, action, pending] = useActionState(
    saveMaintenanceComponentAction.bind(null, id ?? null),
    initialMaintenanceActionState,
  );
  const error = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={action} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">{state.message}</div>
      ) : null}
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input defaultValue={initial?.name ?? ""} name="name" required />
          {error("name") ? <span className="field-error">{error("name")}</span> : null}
        </label>
        <label>
          <span>Tracking unit</span>
          <input defaultValue={initial?.trackingUnit ?? "HOURS"} name="trackingUnit" required />
          {error("trackingUnit") ? <span className="field-error">{error("trackingUnit")}</span> : null}
        </label>
        <label>
          <span>Display order</span>
          <input defaultValue={initial?.sortOrder ?? 100} min="0" name="sortOrder" type="number" />
        </label>
        <label className="checkbox-row">
          <input defaultChecked={initial?.active ?? true} name="active" type="checkbox" />
          <span>Active</span>
        </label>
      </div>
      <label>
        <span>Description</span>
        <textarea defaultValue={initial?.description ?? ""} name="description" rows={4} />
      </label>
      <div className="form-actions">
        <a className="button secondary" href="/reference-data/maintenance-components">Cancel</a>
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save Component"}
        </button>
      </div>
    </form>
  );
}
