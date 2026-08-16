"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createEmployeeAction, updateEmployeeAction } from "./actions";
import { emptyEmployeeFormState, type EmployeeFormValues } from "./types";

function FieldError({
  field,
  id,
  state,
}: {
  field: keyof EmployeeFormValues;
  id: string;
  state: typeof emptyEmployeeFormState;
}) {
  const message = state.fieldErrors[field]?.[0];
  return message ? <span className="field-error" id={id}>{message}</span> : null;
}

function errorAttributes(
  state: typeof emptyEmployeeFormState,
  field: keyof EmployeeFormValues,
  id: string,
) {
  return state.fieldErrors[field]?.[0]
    ? { "aria-describedby": id, "aria-invalid": true as const }
    : {};
}

export function EmployeeForm({
  id,
  initial,
}: {
  id?: string;
  initial?: EmployeeFormValues;
}) {
  const action = id ? updateEmployeeAction.bind(null, id) : createEmployeeAction;
  const [state, formAction, pending] = useActionState(action, emptyEmployeeFormState);
  const values = state.values ?? initial;

  return (
    <form action={formAction} className="panel form-stack">
      {state.message ? <div className="form-alert" role="alert">{state.message}</div> : null}
      <div className="form-grid">
        <div className="form-stack">
          <label htmlFor="employee-display-name">Display Name</label>
          <input
            {...errorAttributes(state, "displayName", "employee-display-name-error")}
            defaultValue={values?.displayName ?? ""}
            id="employee-display-name"
            maxLength={200}
            name="displayName"
            required
          />
          <FieldError field="displayName" id="employee-display-name-error" state={state} />
        </div>
        <div className="form-stack">
          <label htmlFor="employee-code">Employee Code</label>
          <input
            {...errorAttributes(state, "employeeCode", "employee-code-error")}
            defaultValue={values?.employeeCode ?? ""}
            id="employee-code"
            maxLength={100}
            name="employeeCode"
            placeholder="Optional"
          />
          <FieldError field="employeeCode" id="employee-code-error" state={state} />
        </div>
      </div>
      <div className="form-grid">
        <label className="checkbox-row">
          <input defaultChecked={values?.isActive ?? true} name="isActive" type="checkbox" />
          <span>Active — available for new selections</span>
        </label>
        <label className="checkbox-row">
          <input defaultChecked={values?.isSupervisor ?? false} name="isSupervisor" type="checkbox" />
          <span>Supervisor — eligible for Assigned By</span>
        </label>
      </div>
      <div className="inline-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : id ? "Save Employee" : "Create Employee"}
        </button>
        <Link className="button secondary" href="/employees">Cancel</Link>
      </div>
    </form>
  );
}
