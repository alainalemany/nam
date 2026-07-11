"use client";

import { useActionState } from "react";

import {
  availableDefectStatusOptions,
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  optionLabel,
} from "./constants";
import type { DefectFormInitialValues, DefectSelectOption } from "./types";
import {
  emptyDefectFormState,
  type DefectFormField,
  type DefectFormState,
} from "./validation";

type DefectFormProps = {
  action: (previousState: DefectFormState, formData: FormData) => Promise<DefectFormState>;
  cancelHref: string;
  equipmentOptions: DefectSelectOption[];
  initialValues?: DefectFormInitialValues;
  inspectionOptions: DefectSelectOption[];
  submitLabel: string;
};

function fieldError(state: DefectFormState, field: DefectFormField) {
  const error = state.fieldErrors[field]?.[0];
  return error ? <p className="field-error">{error}</p> : null;
}

export function DefectForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  inspectionOptions,
  submitLabel,
}: DefectFormProps) {
  const [state, formAction, pending] = useActionState(action, emptyDefectFormState);
  const currentStatus = initialValues?.status;
  const statusOptions = currentStatus
    ? availableDefectStatusOptions(currentStatus)
    : defectStatusOptions.filter((option) => option.value === "OPEN");

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}

      <section className="form-section" aria-labelledby="defect-details-heading">
        <h2 id="defect-details-heading">Defect details</h2>
        <div className="form-grid">
          <label>
            <span>Reported date</span>
            <input name="reportedDate" type="date" defaultValue={initialValues?.reportedDate ?? ""} />
            {fieldError(state, "reportedDate")}
          </label>
          <label>
            <span>Equipment</span>
            <select name="equipmentId" defaultValue={initialValues?.equipmentId ?? ""}>
              <option value="">Select equipment</option>
              {equipmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {fieldError(state, "equipmentId")}
          </label>
          <label>
            <span>Severity</span>
            <select name="severity" defaultValue={initialValues?.severity ?? "MEDIUM"}>
              {defectSeverityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {fieldError(state, "severity")}
          </label>
          <label>
            <span>Priority</span>
            <select name="priority" defaultValue={initialValues?.priority ?? "MEDIUM"}>
              {defectPriorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {fieldError(state, "priority")}
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={currentStatus ?? "OPEN"}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="subtle">Current: {optionLabel(defectStatusOptions, currentStatus ?? "OPEN")}</span>
            {fieldError(state, "status")}
          </label>
          <label>
            <span>Source Daily Inspection</span>
            <select name="sourceDailyInspectionId" defaultValue={initialValues?.sourceDailyInspectionId ?? ""}>
              <option value="">Created directly</option>
              {inspectionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {fieldError(state, "sourceDailyInspectionId")}
          </label>
        </div>

        <label className="full-width-field">
          <span>Title</span>
          <input name="title" type="text" defaultValue={initialValues?.title ?? ""} />
          {fieldError(state, "title")}
        </label>
        <label className="full-width-field">
          <span>Description</span>
          <textarea name="description" rows={5} defaultValue={initialValues?.description ?? ""} />
          {fieldError(state, "description")}
        </label>
        <label className="full-width-field">
          <span>Corrective action</span>
          <textarea name="correctiveAction" rows={4} defaultValue={initialValues?.correctiveAction ?? ""} />
          {fieldError(state, "correctiveAction")}
        </label>
        <label className="full-width-field">
          <span>Resolution summary</span>
          <textarea name="resolutionSummary" rows={4} defaultValue={initialValues?.resolutionSummary ?? ""} />
          <span className="subtle">Required when moving the defect to Resolved.</span>
          {fieldError(state, "resolutionSummary")}
        </label>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>Cancel</a>
        <button className="button primary" type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
