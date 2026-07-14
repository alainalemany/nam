"use client";

import { useActionState } from "react";

import {
  saveSupportPersonAction,
  saveWorkCodeAction,
  saveWorkOrderAction,
} from "./actions";

type EquipmentOption = { id: string; label: string; active: boolean };

const initialState = { ok: true, message: "" };

export function WorkCodeForm({
  id = null,
  equipment,
  initial,
}: {
  id?: string | null;
  equipment: EquipmentOption[];
  initial?: { code: string; description: string; category: string; equipmentId: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveWorkCodeAction.bind(null, id), initialState);
  return (
    <form action={action} className="form-grid reference-form">
      {state.message ? <p className={state.ok ? "form-message success" : "form-message error"}>{state.message}</p> : null}
      <label><span>Code</span><input name="code" defaultValue={initial?.code} required /></label>
      <label><span>Description</span><input name="description" defaultValue={initial?.description} required /></label>
      <label><span>Category</span><input name="category" defaultValue={initial?.category} /></label>
      <EquipmentSelect equipment={equipment} defaultValue={initial?.equipmentId} />
      <ActiveCheckbox defaultChecked={initial?.active ?? true} />
      <button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save Work Code"}</button>
    </form>
  );
}

export function WorkOrderForm({
  id = null,
  equipment,
  initial,
}: {
  id?: string | null;
  equipment: EquipmentOption[];
  initial?: { workOrderNumber: string; description: string; equipmentId: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveWorkOrderAction.bind(null, id), initialState);
  return (
    <form action={action} className="form-grid reference-form">
      {state.message ? <p className={state.ok ? "form-message success" : "form-message error"}>{state.message}</p> : null}
      <label><span>Work Order number</span><input name="workOrderNumber" defaultValue={initial?.workOrderNumber} required /></label>
      <label><span>Description</span><input name="description" defaultValue={initial?.description} required /></label>
      <EquipmentSelect equipment={equipment} defaultValue={initial?.equipmentId} />
      <ActiveCheckbox defaultChecked={initial?.active ?? true} />
      <button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save Work Order"}</button>
    </form>
  );
}

export function SupportPersonForm({
  id = null,
  initial,
}: {
  id?: string | null;
  initial?: { displayName: string; tradeOrRole: string; company: string; notes: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveSupportPersonAction.bind(null, id), initialState);
  return (
    <form action={action} className="form-grid reference-form">
      {state.message ? <p className={state.ok ? "form-message success" : "form-message error"}>{state.message}</p> : null}
      <label><span>Display name</span><input name="displayName" defaultValue={initial?.displayName} required /></label>
      <label><span>Trade or role</span><input name="tradeOrRole" defaultValue={initial?.tradeOrRole} required /></label>
      <label><span>Company or employer</span><input name="company" defaultValue={initial?.company} /></label>
      <label><span>Notes</span><textarea name="notes" defaultValue={initial?.notes} rows={2} /></label>
      <ActiveCheckbox defaultChecked={initial?.active ?? true} />
      <button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save Support Person"}</button>
    </form>
  );
}

function EquipmentSelect({ equipment, defaultValue = "" }: { equipment: EquipmentOption[]; defaultValue?: string }) {
  return (
    <label>
      <span>Equipment (optional)</span>
      <select name="equipmentId" defaultValue={defaultValue}>
        <option value="">No Equipment association</option>
        {equipment.map((item) => <option disabled={!item.active && item.id !== defaultValue} key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
  );
}

function ActiveCheckbox({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="checkbox-field">
      <input name="active" type="checkbox" defaultChecked={defaultChecked} />
      <span>Available for new selections</span>
    </label>
  );
}

