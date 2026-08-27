"use client";

import { useActionState, useState } from "react";

import {
  equipmentCategoryOptions,
  equipmentInstrumentationTypeOptions,
  equipmentPowerTypeOptions,
  recordStatusOptions,
} from "./constants";
import { emptyEquipmentFormState, type EquipmentFormField, type EquipmentFormState } from "./validation";

type EquipmentFormInitialValues = {
  mineId?: string;
  displayName?: string;
  equipmentNumber?: string;
  category?: string;
  make?: string;
  model?: string;
  powerType?: string;
  instrumentationType?: string;
  hasDigitalAlarmScreen?: boolean;
  status?: string;
  notes?: string;
};

export type EquipmentMineOption = {
  id: string;
  label: string;
  cityLabel: string;
  mineType: string | null;
  status: string;
};

type EquipmentFormProps = {
  action: (
    previousState: EquipmentFormState,
    formData: FormData,
  ) => Promise<EquipmentFormState>;
  cancelHref: string;
  initialValues?: EquipmentFormInitialValues;
  mineOptions: EquipmentMineOption[];
  submitLabel: string;
};

function fieldError(
  state: EquipmentFormState,
  field: EquipmentFormField,
) {
  const error = state.fieldErrors[field]?.[0];

  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

export function EquipmentForm({
  action,
  cancelHref,
  initialValues,
  mineOptions,
  submitLabel,
}: EquipmentFormProps) {
  const [state, formAction, pending] = useActionState(action, emptyEquipmentFormState);
  const [mineId, setMineId] = useState(initialValues?.mineId ?? "");
  const selectedMine = mineOptions.find((mine) => mine.id === mineId);

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="location-heading">
        <h2 id="location-heading">Location</h2>
        <div className="form-grid">
          <label>
            <span>Mine</span>
            <select
              aria-invalid={state.fieldErrors.mineId ? true : undefined}
              name="mineId"
              value={mineId}
              onChange={(event) => setMineId(event.target.value)}
            >
              <option value="">Select Mine</option>
              {mineOptions.map((mine) => (
                <option
                  disabled={
                    mine.status !== "ACTIVE" && mine.id !== initialValues?.mineId
                  }
                  key={mine.id}
                  value={mine.id}
                >
                  {mine.label}{mine.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {fieldError(state, "mineId")}
          </label>
          <div className="checklist-derived-context full-width-field" aria-live="polite">
            <div>
              <span>City</span>
              <strong>{selectedMine?.cityLabel ?? "Derived from selected Mine"}</strong>
            </div>
            <div>
              <span>Mine type</span>
              <strong>
                {selectedMine
                  ? selectedMine.mineType ?? "Not set"
                  : "Derived from selected Mine"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="equipment-heading">
        <h2 id="equipment-heading">Equipment</h2>
        <div className="form-grid">
          <label>
            <span>Display name</span>
            <input
              name="displayName"
              defaultValue={initialValues?.displayName ?? ""}
              autoComplete="off"
            />
            {fieldError(state, "displayName")}
          </label>

          <label>
            <span>Equipment number</span>
            <input
              name="equipmentNumber"
              defaultValue={initialValues?.equipmentNumber ?? ""}
              autoComplete="off"
            />
            {fieldError(state, "equipmentNumber")}
          </label>

          <label>
            <span>Category</span>
            <select name="category" defaultValue={initialValues?.category ?? "DRAGLINE"}>
              {equipmentCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "category")}
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={initialValues?.status ?? "ACTIVE"}>
              {recordStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "status")}
          </label>

          <label>
            <span>Make</span>
            <input
              name="make"
              defaultValue={initialValues?.make ?? ""}
              autoComplete="off"
            />
            {fieldError(state, "make")}
          </label>

          <label>
            <span>Model</span>
            <input
              name="model"
              defaultValue={initialValues?.model ?? ""}
              autoComplete="off"
            />
            {fieldError(state, "model")}
          </label>

          <label>
            <span>Power type</span>
            <select name="powerType" defaultValue={initialValues?.powerType ?? ""}>
              <option value="">Not set</option>
              {equipmentPowerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "powerType")}
          </label>

          <label>
            <span>Instrumentation</span>
            <select
              name="instrumentationType"
              defaultValue={initialValues?.instrumentationType ?? ""}
            >
              <option value="">Not set</option>
              {equipmentInstrumentationTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "instrumentationType")}
          </label>
        </div>

        <label className="checkbox-row">
          <input
            name="hasDigitalAlarmScreen"
            type="checkbox"
            defaultChecked={initialValues?.hasDigitalAlarmScreen ?? false}
          />
          <span>Has digital alarm screen</span>
        </label>

        <label className="full-width-field">
          <span>Notes</span>
          <textarea name="notes" defaultValue={initialValues?.notes ?? ""} rows={5} />
          {fieldError(state, "notes")}
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
