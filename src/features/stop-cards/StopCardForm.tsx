"use client";

import { useActionState } from "react";

import {
  stopCardCategoryOptions,
  stopCardSeverityOptions,
  stopCardStatusOptions,
} from "./constants";
import type { StopCardFormInitialValues, StopCardSelectOption } from "./types";
import {
  emptyStopCardFormState,
  type StopCardFormField,
  type StopCardFormState,
} from "./validation";

type StopCardFormProps = {
  action: (
    previousState: StopCardFormState,
    formData: FormData,
  ) => Promise<StopCardFormState>;
  cancelHref: string;
  equipmentOptions: StopCardSelectOption[];
  initialValues?: StopCardFormInitialValues;
  mineOptions: StopCardSelectOption[];
  submitLabel: string;
};

function fieldError(state: StopCardFormState, field: StopCardFormField) {
  const error = state.fieldErrors[field]?.[0];

  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

export function StopCardForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  mineOptions,
  submitLabel,
}: StopCardFormProps) {
  const [state, formAction, pending] = useActionState(action, emptyStopCardFormState);

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="stop-card-heading">
        <h2 id="stop-card-heading">STOP Card</h2>
        <div className="form-grid">
          <label>
            <span>Observation date</span>
            <input
              name="observationDate"
              type="date"
              defaultValue={initialValues?.observationDate ?? ""}
            />
            {fieldError(state, "observationDate")}
          </label>

          <label>
            <span>Category</span>
            <select name="category" defaultValue={initialValues?.category ?? "HAZARD_OBSERVATION"}>
              {stopCardCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "category")}
          </label>

          <label>
            <span>Severity</span>
            <select name="severity" defaultValue={initialValues?.severity ?? "MEDIUM"}>
              {stopCardSeverityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "severity")}
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={initialValues?.status ?? "OPEN"}>
              {stopCardStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "status")}
          </label>

          <label>
            <span>Mine</span>
            <select name="mineId" defaultValue={initialValues?.mineId ?? ""}>
              <option value="">Not set</option>
              {mineOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "mineId")}
          </label>

          <label>
            <span>Equipment</span>
            <select name="equipmentId" defaultValue={initialValues?.equipmentId ?? ""}>
              <option value="">Not set</option>
              {equipmentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "equipmentId")}
          </label>

          <label>
            <span>Location</span>
            <input
              name="location"
              defaultValue={initialValues?.location ?? ""}
              autoComplete="off"
            />
            {fieldError(state, "location")}
          </label>

          <label>
            <span>Created by</span>
            <input
              name="createdBy"
              defaultValue={initialValues?.createdBy ?? ""}
              autoComplete="off"
            />
            {fieldError(state, "createdBy")}
          </label>
        </div>

        <label className="full-width-field">
          <span>Description</span>
          <textarea
            name="description"
            defaultValue={initialValues?.description ?? ""}
            rows={4}
          />
          {fieldError(state, "description")}
        </label>

        <label className="full-width-field">
          <span>Corrective action</span>
          <textarea
            name="correctiveAction"
            defaultValue={initialValues?.correctiveAction ?? ""}
            rows={4}
          />
          {fieldError(state, "correctiveAction")}
        </label>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>
          Cancel
        </a>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
