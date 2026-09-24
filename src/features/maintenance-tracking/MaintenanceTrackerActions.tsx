"use client";

import { useActionState } from "react";

import {
  addManualMaintenanceAdjustmentAction,
  recordMaintenanceServiceAction,
} from "./actions";
import { initialMaintenanceActionState } from "./validation";

type Props = {
  trackerId: string;
  recordVersion: number;
  trackingUnit: string;
  defaultDate: string;
  defaultTime: string;
  rules: { id: string; actionName: string; context: string }[];
};

export function MaintenanceTrackerActions({
  trackerId,
  recordVersion,
  trackingUnit,
  defaultDate,
  defaultTime,
  rules,
}: Props) {
  const [adjustmentState, adjustmentAction, adjustmentPending] = useActionState(
    addManualMaintenanceAdjustmentAction.bind(null, trackerId),
    initialMaintenanceActionState,
  );
  const [serviceState, serviceAction, servicePending] = useActionState(
    recordMaintenanceServiceAction.bind(null, trackerId),
    initialMaintenanceActionState,
  );

  return (
    <div className="maintenance-action-grid">
      <form action={serviceAction} className="activity-card maintenance-service-form">
        <div>
          <p className="eyebrow">Operational maintenance</p>
          <h3>Record Service</h3>
          <p>Choose what occurred and when it actually happened. DDR runtime determines the interval and lifecycle values.</p>
        </div>
        {serviceState.status === "error" ? <div className="form-alert" role="alert">{serviceState.message}</div> : null}
        <input name="recordVersion" type="hidden" value={recordVersion} />
        <label><span>Action performed</span><select name="ruleId" required><option value="">Select action</option>{rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.actionName} · {rule.context}</option>)}</select></label>
        <div className="form-grid">
          <label><span>Effective date</span><input defaultValue={defaultDate} name="effectiveDate" required type="date" /></label>
          <label><span>Effective time</span><input defaultValue={defaultTime} name="effectiveTime" required type="time" /></label>
        </div>
        <label><span>Recorded by (optional)</span><input name="recordedBy" /></label>
        <label><span>Notes</span><textarea name="notes" rows={3} /></label>
        <button className="button primary" disabled={servicePending} type="submit">{servicePending ? "Recording..." : "Record Service"}</button>
      </form>

      <details className="activity-card maintenance-adjustment-panel">
        <summary><span><span className="eyebrow">Administrative exception</span><strong>Manual hour adjustment</strong></span></summary>
        <form action={adjustmentAction} className="form-stack">
          <p>Completed DDRs are the normal hour source. Use this only for an auditable correction not represented by DDR.</p>
          {adjustmentState.status === "error" ? <div className="form-alert" role="alert">{adjustmentState.message}</div> : null}
          <input name="recordVersion" type="hidden" value={recordVersion} />
          <label><span>{trackingUnit.toLocaleLowerCase()} to add</span><input min="0.01" name="adjustmentValue" required step="0.01" type="number" /></label>
          <div className="form-grid">
            <label><span>Effective date</span><input defaultValue={defaultDate} name="effectiveDate" required type="date" /></label>
            <label><span>Effective time</span><input defaultValue={defaultTime} name="effectiveTime" required type="time" /></label>
          </div>
          <label><span>Reason</span><textarea name="reason" required rows={3} /></label>
          <label><span>Recorded by (optional)</span><input name="recordedBy" /></label>
          <button className="button secondary" disabled={adjustmentPending} type="submit">{adjustmentPending ? "Recording..." : "Record Manual Adjustment"}</button>
        </form>
      </details>
    </div>
  );
}
