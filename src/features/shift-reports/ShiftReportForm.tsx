"use client";

import { useActionState } from "react";

import { shiftOptions, shiftReportStatusOptions } from "./constants";
import type { ShiftReportFormInitialValues, ShiftReportSelectOption } from "./types";
import {
  emptyShiftReportFormState,
  type ShiftReportFormField,
  type ShiftReportFormState,
} from "./validation";

type ShiftReportFormProps = {
  action: (
    previousState: ShiftReportFormState,
    formData: FormData,
  ) => Promise<ShiftReportFormState>;
  cancelHref: string;
  equipmentOptions: ShiftReportSelectOption[];
  initialValues?: ShiftReportFormInitialValues;
  mineOptions: ShiftReportSelectOption[];
  submitLabel: string;
};

function fieldError(state: ShiftReportFormState, field: ShiftReportFormField) {
  const error = state.fieldErrors[field]?.[0];

  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

export function ShiftReportForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  mineOptions,
  submitLabel,
}: ShiftReportFormProps) {
  const [state, formAction, pending] = useActionState(action, emptyShiftReportFormState);

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="shift-report-heading">
        <h2 id="shift-report-heading">Shift Report</h2>
        <div className="form-grid">
          <label>
            <span>Report date</span>
            <input
              name="reportDate"
              type="date"
              defaultValue={initialValues?.reportDate ?? ""}
            />
            {fieldError(state, "reportDate")}
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
            <span>Status</span>
            <select name="status" defaultValue={initialValues?.status ?? "DRAFT"}>
              {shiftReportStatusOptions.map((option) => (
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
              type="text"
              defaultValue={initialValues?.location ?? ""}
            />
            {fieldError(state, "location")}
          </label>
        </div>

        <label className="full-width-field">
          <span>Shift summary</span>
          <textarea name="summary" defaultValue={initialValues?.summary ?? ""} rows={4} />
          {fieldError(state, "summary")}
        </label>

        <label className="full-width-field">
          <span>Operational notes</span>
          <textarea
            name="operationalNotes"
            defaultValue={initialValues?.operationalNotes ?? ""}
            rows={4}
          />
          {fieldError(state, "operationalNotes")}
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
