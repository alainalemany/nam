"use client";

import { useActionState } from "react";

import { saveMaintenanceRuleAction } from "./actions";
import { initialMaintenanceActionState } from "./validation";

type Props = {
  componentId: string;
  id?: string;
  initial?: {
    actionName: string;
    counterScope: "SERVICE_INTERVAL" | "COMPONENT_LIFECYCLE";
    thresholdValue: string;
    upperThresholdValue: string | null;
    repeatable: boolean;
    repeatIntervalValue: string | null;
    maximumRepeatCount: number | null;
    warningLeadValue: string | null;
    startsNewLifecycle: boolean;
    active: boolean;
    priority: number;
    sortOrder: number;
  };
};

export function MaintenanceRuleForm({ componentId, id, initial }: Props) {
  const [state, action, pending] = useActionState(
    saveMaintenanceRuleAction.bind(null, componentId, id ?? null),
    initialMaintenanceActionState,
  );
  const error = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={action} className="form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
      <div className="form-grid">
        <label>
          <span>Service action</span>
          <input defaultValue={initial?.actionName ?? ""} name="actionName" required />
          {error("actionName") ? <span className="field-error">{error("actionName")}</span> : null}
        </label>
        <label>
          <span>Counter scope</span>
          <select defaultValue={initial?.counterScope ?? "COMPONENT_LIFECYCLE"} name="counterScope" required>
            <option value="SERVICE_INTERVAL">Since this service action</option>
            <option value="COMPONENT_LIFECYCLE">Entire component lifecycle</option>
          </select>
          <span className="subtle">Interval service restarts only its own clock; lifecycle service follows total component life.</span>
        </label>
        <label>
          <span>Lower / exact threshold</span>
          <input defaultValue={initial?.thresholdValue ?? ""} min="0" name="thresholdValue" required step="0.01" type="number" />
          {error("thresholdValue") ? <span className="field-error">{error("thresholdValue")}</span> : null}
        </label>
        <label>
          <span>Upper threshold (window only)</span>
          <input defaultValue={initial?.upperThresholdValue ?? ""} min="0" name="upperThresholdValue" step="0.01" type="number" />
          {error("upperThresholdValue") ? <span className="field-error">{error("upperThresholdValue")}</span> : null}
        </label>
        <label>
          <span>Warning lead</span>
          <input defaultValue={initial?.warningLeadValue ?? ""} min="0" name="warningLeadValue" step="0.01" type="number" />
        </label>
        <label>
          <span>Repeat interval</span>
          <input defaultValue={initial?.repeatIntervalValue ?? ""} min="0.01" name="repeatIntervalValue" step="0.01" type="number" />
          {error("repeatIntervalValue") ? <span className="field-error">{error("repeatIntervalValue")}</span> : null}
        </label>
        <label>
          <span>Maximum repeat count</span>
          <input defaultValue={initial?.maximumRepeatCount ?? ""} min="1" name="maximumRepeatCount" type="number" />
        </label>
        <label>
          <span>Priority (lower first)</span>
          <input defaultValue={initial?.priority ?? 100} min="0" name="priority" type="number" />
        </label>
        <label>
          <span>Display order</span>
          <input defaultValue={initial?.sortOrder ?? 100} min="0" name="sortOrder" type="number" />
        </label>
      </div>
      <div className="form-grid">
        <label className="checkbox-row">
          <input defaultChecked={initial?.repeatable ?? false} name="repeatable" type="checkbox" />
          <span>Repeatable within one lifecycle</span>
        </label>
        <label className="checkbox-row">
          <input defaultChecked={initial?.startsNewLifecycle ?? false} name="startsNewLifecycle" type="checkbox" />
          <span>Replacement: starts a new component lifecycle</span>
        </label>
        <label className="checkbox-row">
          <input defaultChecked={initial?.active ?? true} name="active" type="checkbox" />
          <span>Active</span>
        </label>
      </div>
      <div className="form-actions">
        <a className="button secondary" href={`/reference-data/maintenance-components/${componentId}/edit`}>Cancel</a>
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : "Save Rule"}
        </button>
      </div>
    </form>
  );
}
