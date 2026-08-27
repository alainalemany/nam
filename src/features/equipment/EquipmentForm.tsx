"use client";

import { useActionState, useEffect, useState } from "react";

import {
  equipmentCategoryOptions,
  equipmentInstrumentationTypeOptions,
  equipmentPowerTypeOptions,
  recordStatusOptions,
} from "./constants";
import {
  emptyEquipmentFormState,
  type EquipmentFormField,
  type EquipmentFormState,
  type EquipmentFormValues,
} from "./validation";

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
  const [values, setValues] = useState<EquipmentFormValues>(() => ({
    mineId: initialValues?.mineId ?? "",
    displayName: initialValues?.displayName ?? "",
    equipmentNumber: initialValues?.equipmentNumber ?? "",
    category: initialValues?.category ?? "DRAGLINE",
    make: initialValues?.make ?? "",
    model: initialValues?.model ?? "",
    powerType: initialValues?.powerType ?? "",
    instrumentationType: initialValues?.instrumentationType ?? "",
    hasDigitalAlarmScreen: initialValues?.hasDigitalAlarmScreen ?? false,
    status: initialValues?.status ?? "ACTIVE",
    notes: initialValues?.notes ?? "",
  }));

  useEffect(() => {
    if (state.values) {
      setValues(state.values);
    }
  }, [state.values]);

  function updateValue<Field extends keyof EquipmentFormValues>(
    field: Field,
    value: EquipmentFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  const selectedMine = mineOptions.find((mine) => mine.id === values.mineId);

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
              value={values.mineId}
              onChange={(event) => updateValue("mineId", event.target.value)}
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
              value={values.displayName}
              onChange={(event) => updateValue("displayName", event.target.value)}
              autoComplete="off"
            />
            {fieldError(state, "displayName")}
          </label>

          <label>
            <span>Equipment number</span>
            <input
              name="equipmentNumber"
              value={values.equipmentNumber}
              onChange={(event) => updateValue("equipmentNumber", event.target.value)}
              autoComplete="off"
            />
            {fieldError(state, "equipmentNumber")}
          </label>

          <label>
            <span>Category</span>
            <select
              name="category"
              value={values.category}
              onChange={(event) => updateValue("category", event.target.value)}
            >
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
            <select
              name="status"
              value={values.status}
              onChange={(event) => updateValue("status", event.target.value)}
            >
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
              value={values.make}
              onChange={(event) => updateValue("make", event.target.value)}
              autoComplete="off"
            />
            {fieldError(state, "make")}
          </label>

          <label>
            <span>Model</span>
            <input
              name="model"
              value={values.model}
              onChange={(event) => updateValue("model", event.target.value)}
              autoComplete="off"
            />
            {fieldError(state, "model")}
          </label>

          <label>
            <span>Power type</span>
            <select
              name="powerType"
              value={values.powerType}
              onChange={(event) => updateValue("powerType", event.target.value)}
            >
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
              value={values.instrumentationType}
              onChange={(event) =>
                updateValue("instrumentationType", event.target.value)
              }
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
            checked={values.hasDigitalAlarmScreen}
            onChange={(event) =>
              updateValue("hasDigitalAlarmScreen", event.target.checked)
            }
          />
          <span>Has digital alarm screen</span>
        </label>

        <label className="full-width-field">
          <span>Notes</span>
          <textarea
            name="notes"
            value={values.notes}
            onChange={(event) => updateValue("notes", event.target.value)}
            rows={5}
          />
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
