"use client";

import { useActionState } from "react";

import {
  dailyInspectionConditionOptions,
  dailyInspectionStatusOptions,
  shiftOptions,
} from "./constants";
import type {
  DailyInspectionFormInitialValues,
  DailyInspectionSelectOption,
} from "./types";
import {
  emptyDailyInspectionFormState,
  type DailyInspectionFormField,
  type DailyInspectionFormState,
} from "./validation";

type DailyInspectionFormProps = {
  action: (
    previousState: DailyInspectionFormState,
    formData: FormData,
  ) => Promise<DailyInspectionFormState>;
  cancelHref: string;
  equipmentOptions: DailyInspectionSelectOption[];
  initialValues?: DailyInspectionFormInitialValues;
  mineOptions: DailyInspectionSelectOption[];
  submitLabel: string;
};

function fieldError(state: DailyInspectionFormState, field: DailyInspectionFormField) {
  const error = state.fieldErrors[field]?.[0];

  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

export function DailyInspectionForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  mineOptions,
  submitLabel,
}: DailyInspectionFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    emptyDailyInspectionFormState,
  );

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="daily-inspection-heading">
        <h2 id="daily-inspection-heading">Daily Inspection</h2>
        <div className="form-grid">
          <label>
            <span>Inspection date</span>
            <input
              name="inspectionDate"
              type="date"
              defaultValue={initialValues?.inspectionDate ?? ""}
            />
            {fieldError(state, "inspectionDate")}
          </label>

          <label>
            <span>Shift</span>
            <select name="shift" defaultValue={initialValues?.shift ?? "UNKNOWN"}>
              {shiftOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "shift")}
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
              <option value="">Select equipment</option>
              {equipmentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "equipmentId")}
          </label>

          <label>
            <span>Equipment hours</span>
            <input
              name="equipmentHours"
              type="number"
              min="0"
              step="0.1"
              defaultValue={initialValues?.equipmentHours ?? ""}
            />
            {fieldError(state, "equipmentHours")}
          </label>

          <label>
            <span>Condition</span>
            <select
              name="condition"
              defaultValue={initialValues?.condition ?? "SATISFACTORY"}
            >
              {dailyInspectionConditionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "condition")}
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={initialValues?.status ?? "COMPLETED"}>
              {dailyInspectionStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "status")}
          </label>

          <label className="checkbox-row">
            <input
              name="defectsIdentified"
              type="checkbox"
              defaultChecked={initialValues?.defectsIdentified ?? false}
            />
            <span>Defects identified</span>
          </label>
        </div>

        <label className="full-width-field">
          <span>Findings</span>
          <textarea
            name="findings"
            defaultValue={initialValues?.findings ?? ""}
            rows={4}
          />
          {fieldError(state, "findings")}
        </label>

        <label className="full-width-field">
          <span>Notes</span>
          <textarea name="notes" defaultValue={initialValues?.notes ?? ""} rows={4} />
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
