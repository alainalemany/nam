"use client";

import { useActionState } from "react";

import { createMaintenanceTrackerAction } from "./actions";
import { initialMaintenanceActionState } from "./validation";

type Props = {
  equipment: { id: string; label: string }[];
  components: { id: string; label: string }[];
  defaultDate: string;
  defaultTime: string;
};

export function MaintenanceTrackerForm({ equipment, components, defaultDate, defaultTime }: Props) {
  const [state, action, pending] = useActionState(
    createMaintenanceTrackerAction,
    initialMaintenanceActionState,
  );
  const error = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={action} className="form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
      <div className="form-grid">
        <label>
          <span>Equipment</span>
          <select name="equipmentId" required>
            <option value="">Select Equipment</option>
            {equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {error("equipmentId") ? <span className="field-error">{error("equipmentId")}</span> : null}
        </label>
        <label>
          <span>Tracked component</span>
          <select name="componentId" required>
            <option value="">Select Component</option>
            {components.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {error("componentId") ? <span className="field-error">{error("componentId")}</span> : null}
        </label>
        <label><span>Tracking start date</span><input defaultValue={defaultDate} name="trackingStartDate" required type="date" /></label>
        <label><span>Tracking start time</span><input defaultValue={defaultTime} name="trackingStartTime" required type="time" /></label>
        <label>
          <span>Installed component identity (optional)</span>
          <input name="installedComponentIdentity" />
        </label>
      </div>
      <p className="form-help">This is the operational start of the current installed component lifecycle. Completed DDR runtime after this point supplies operating hours automatically.</p>
      <label>
        <span>Notes</span>
        <textarea name="notes" rows={3} />
      </label>
      <div className="form-actions">
        <a className="button secondary" href="/maintenance">Cancel</a>
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Creating..." : "Create Tracker"}
        </button>
      </div>
    </form>
  );
}
