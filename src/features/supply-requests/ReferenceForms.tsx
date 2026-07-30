"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createSupervisorReferenceAction,
  createSupplyItemReferenceAction,
  updateSupervisorReferenceAction,
  updateSupplyItemReferenceAction,
} from "./reference-actions";
import { emptyReferenceActionState } from "./reference-action-state";

function FieldError({
  state,
  field,
  id,
}: {
  state: typeof emptyReferenceActionState;
  field: string;
  id: string;
}) {
  const message = state.fieldErrors[field]?.[0];
  return message ? (
    <span className="field-error" id={id}>
      {message}
    </span>
  ) : null;
}

function fieldErrorAttributes(
  state: typeof emptyReferenceActionState,
  field: string,
  id: string,
) {
  return state.fieldErrors[field]?.[0]
    ? { "aria-describedby": id, "aria-invalid": true as const }
    : {};
}

export function SupplyItemReferenceForm({
  id,
  initial,
}: {
  id?: string;
  initial?: {
    itemNumber: string;
    description: string;
    unitOfMeasure: string;
  };
}) {
  const action = id
    ? updateSupplyItemReferenceAction.bind(null, id)
    : createSupplyItemReferenceAction;
  const [state, formAction, pending] = useActionState(
    action,
    emptyReferenceActionState,
  );
  return (
    <form action={formAction} className="panel form-stack">
      {state.message ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}
      <div className="form-grid">
        <div className="form-stack">
          <label htmlFor="supply-item-number">Item Number</label>
          <input
            {...fieldErrorAttributes(
              state,
              "itemNumber",
              "supply-item-number-error",
            )}
            defaultValue={state.values.itemNumber ?? initial?.itemNumber ?? ""}
            id="supply-item-number"
            maxLength={100}
            name="itemNumber"
            required
          />
          <FieldError
            id="supply-item-number-error"
            state={state}
            field="itemNumber"
          />
        </div>
        <div className="form-stack">
          <label htmlFor="supply-item-description">Description</label>
          <input
            {...fieldErrorAttributes(
              state,
              "description",
              "supply-item-description-error",
            )}
            defaultValue={state.values.description ?? initial?.description ?? ""}
            id="supply-item-description"
            maxLength={500}
            name="description"
            required
          />
          <FieldError
            id="supply-item-description-error"
            state={state}
            field="description"
          />
        </div>
        <div className="form-stack">
          <label htmlFor="supply-item-unit">Unit</label>
          <input
            {...fieldErrorAttributes(
              state,
              "unitOfMeasure",
              "supply-item-unit-error",
            )}
            defaultValue={
              state.values.unitOfMeasure ?? initial?.unitOfMeasure ?? ""
            }
            id="supply-item-unit"
            maxLength={100}
            name="unitOfMeasure"
            required
          />
          <FieldError
            id="supply-item-unit-error"
            state={state}
            field="unitOfMeasure"
          />
        </div>
      </div>
      <div className="inline-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : id ? "Save Supply Item" : "Create Supply Item"}
        </button>
        <Link className="button secondary" href="/supply-requests/items">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function SupervisorReferenceForm({
  id,
  initial,
}: {
  id?: string;
  initial?: { fullName: string; email: string };
}) {
  const action = id
    ? updateSupervisorReferenceAction.bind(null, id)
    : createSupervisorReferenceAction;
  const [state, formAction, pending] = useActionState(
    action,
    emptyReferenceActionState,
  );
  return (
    <form action={formAction} className="panel form-stack">
      {state.message ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}
      <div className="form-grid">
        <div className="form-stack">
          <label htmlFor="supervisor-full-name">Full name</label>
          <input
            {...fieldErrorAttributes(
              state,
              "fullName",
              "supervisor-full-name-error",
            )}
            defaultValue={state.values.fullName ?? initial?.fullName ?? ""}
            id="supervisor-full-name"
            maxLength={200}
            name="fullName"
            required
          />
          <FieldError
            id="supervisor-full-name-error"
            state={state}
            field="fullName"
          />
        </div>
        <div className="form-stack">
          <label htmlFor="supervisor-email">Email</label>
          <input
            {...fieldErrorAttributes(
              state,
              "email",
              "supervisor-email-error",
            )}
            defaultValue={state.values.email ?? initial?.email ?? ""}
            id="supervisor-email"
            maxLength={320}
            name="email"
            required
            type="email"
          />
          <FieldError
            id="supervisor-email-error"
            state={state}
            field="email"
          />
        </div>
      </div>
      <div className="inline-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : id ? "Save Supervisor" : "Create Supervisor"}
        </button>
        <Link className="button secondary" href="/supply-requests/supervisors">
          Cancel
        </Link>
      </div>
    </form>
  );
}
