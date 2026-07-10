"use client";

import { useActionState } from "react";

import {
  workAuthorizationStatusOptions,
  workAuthorizationWorkTypeOptions,
} from "./constants";
import type {
  WorkAuthorizationFormInitialValues,
  WorkAuthorizationSelectOption,
} from "./types";
import {
  emptyWorkAuthorizationFormState,
  type WorkAuthorizationFormField,
  type WorkAuthorizationFormState,
} from "./validation";

type WorkAuthorizationFormProps = {
  action: (
    previousState: WorkAuthorizationFormState,
    formData: FormData,
  ) => Promise<WorkAuthorizationFormState>;
  cancelHref: string;
  equipmentOptions: WorkAuthorizationSelectOption[];
  initialValues?: WorkAuthorizationFormInitialValues;
  mineOptions: WorkAuthorizationSelectOption[];
  shiftReportOptions: WorkAuthorizationSelectOption[];
  submitLabel: string;
};

function fieldError(state: WorkAuthorizationFormState, field: WorkAuthorizationFormField) {
  const error = state.fieldErrors[field]?.[0];

  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

type CheckboxFieldProps = {
  defaultChecked?: boolean;
  error?: React.ReactNode;
  label: string;
  name: WorkAuthorizationFormField;
};

function CheckboxField({ defaultChecked, error, label, name }: CheckboxFieldProps) {
  return (
    <label className="checkbox-row">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span>{label}</span>
      {error}
    </label>
  );
}

export function WorkAuthorizationForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  mineOptions,
  shiftReportOptions,
  submitLabel,
}: WorkAuthorizationFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    emptyWorkAuthorizationFormState,
  );

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="authorization-heading">
        <h2 id="authorization-heading">Work Authorization</h2>
        <div className="form-grid">
          <label>
            <span>Shift Report</span>
            <select name="shiftReportId" defaultValue={initialValues?.shiftReportId ?? ""}>
              <option value="">Select Shift Report</option>
              {shiftReportOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "shiftReportId")}
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={initialValues?.status ?? "DRAFT"}>
              {workAuthorizationStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "status")}
          </label>

          <label>
            <span>Work type</span>
            <select name="workType" defaultValue={initialValues?.workType ?? "MAINTENANCE"}>
              {workAuthorizationWorkTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "workType")}
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
            <span>Job location</span>
            <input
              name="jobLocation"
              type="text"
              defaultValue={initialValues?.jobLocation ?? ""}
            />
            {fieldError(state, "jobLocation")}
          </label>

          <label>
            <span>Start time</span>
            <input name="startTime" type="time" defaultValue={initialValues?.startTime ?? ""} />
            {fieldError(state, "startTime")}
          </label>

          <label>
            <span>End time</span>
            <input name="endTime" type="time" defaultValue={initialValues?.endTime ?? ""} />
            {fieldError(state, "endTime")}
          </label>

          <label>
            <span>Crew count</span>
            <input
              name="crewWorkerCount"
              type="number"
              min="0"
              step="1"
              defaultValue={initialValues?.crewWorkerCount ?? ""}
            />
            {fieldError(state, "crewWorkerCount")}
          </label>

          <label>
            <span>Contact name</span>
            <input
              name="contactName"
              type="text"
              defaultValue={initialValues?.contactName ?? ""}
            />
            {fieldError(state, "contactName")}
          </label>

          <label>
            <span>Person in charge</span>
            <input
              name="personInChargeName"
              type="text"
              defaultValue={initialValues?.personInChargeName ?? ""}
            />
            {fieldError(state, "personInChargeName")}
          </label>
        </div>

        <label className="full-width-field">
          <span>Work description</span>
          <textarea
            name="workDescription"
            defaultValue={initialValues?.workDescription ?? ""}
            rows={4}
          />
          {fieldError(state, "workDescription")}
        </label>

        <label className="full-width-field">
          <span>Equipment required</span>
          <textarea
            name="equipmentRequired"
            defaultValue={initialValues?.equipmentRequired ?? ""}
            rows={3}
          />
          {fieldError(state, "equipmentRequired")}
        </label>
      </section>

      <section className="form-section" aria-labelledby="permits-heading">
        <h2 id="permits-heading">Permits And Paperwork</h2>
        <div className="form-grid">
          <CheckboxField
            defaultChecked={initialValues?.lockoutRequired ?? true}
            error={fieldError(state, "lockoutRequired")}
            label="Lockout permit required"
            name="lockoutRequired"
          />
          <CheckboxField
            defaultChecked={initialValues?.lockoutTagoutRequired ?? true}
            error={fieldError(state, "lockoutTagoutRequired")}
            label="Lockout / tagout"
            name="lockoutTagoutRequired"
          />
          <CheckboxField
            defaultChecked={initialValues?.workplaceExamRequired ?? false}
            error={fieldError(state, "workplaceExamRequired")}
            label="Workplace exam"
            name="workplaceExamRequired"
          />
          <CheckboxField
            defaultChecked={initialValues?.confinedSpaceRequired ?? false}
            error={fieldError(state, "confinedSpaceRequired")}
            label="Confined space"
            name="confinedSpaceRequired"
          />
          <CheckboxField
            defaultChecked={initialValues?.hotWorkRequired ?? false}
            error={fieldError(state, "hotWorkRequired")}
            label="Hot work"
            name="hotWorkRequired"
          />
          <CheckboxField
            defaultChecked={initialValues?.workingAtHeightsRequired ?? false}
            error={fieldError(state, "workingAtHeightsRequired")}
            label="Working at heights"
            name="workingAtHeightsRequired"
          />
          <CheckboxField
            defaultChecked={initialValues?.stopCardJhaRequired ?? false}
            error={fieldError(state, "stopCardJhaRequired")}
            label="STOP Card / JHA"
            name="stopCardJhaRequired"
          />
        </div>

        <label className="full-width-field">
          <span>Reason lockout is not required</span>
          <textarea
            name="lockoutNotRequiredReason"
            defaultValue={initialValues?.lockoutNotRequiredReason ?? ""}
            rows={3}
          />
          {fieldError(state, "lockoutNotRequiredReason")}
        </label>
      </section>

      <section className="form-section" aria-labelledby="completion-heading">
        <h2 id="completion-heading">Completion Checklist</h2>
        <div className="form-grid">
          <CheckboxField
            defaultChecked={initialValues?.jobCompleted ?? false}
            error={fieldError(state, "jobCompleted")}
            label="Job completed"
            name="jobCompleted"
          />
          <CheckboxField
            defaultChecked={initialValues?.permitsClosed ?? false}
            error={fieldError(state, "permitsClosed")}
            label="Required permits closed"
            name="permitsClosed"
          />
          <CheckboxField
            defaultChecked={initialValues?.guardsReplaced ?? false}
            error={fieldError(state, "guardsReplaced")}
            label="Guards replaced"
            name="guardsReplaced"
          />
          <CheckboxField
            defaultChecked={initialValues?.lockoutTagoutRemoved ?? false}
            error={fieldError(state, "lockoutTagoutRemoved")}
            label="Lockout / tagout removed"
            name="lockoutTagoutRemoved"
          />
          <CheckboxField
            defaultChecked={initialValues?.toolsRemoved ?? false}
            error={fieldError(state, "toolsRemoved")}
            label="Tools removed"
            name="toolsRemoved"
          />
          <CheckboxField
            defaultChecked={initialValues?.housekeepingCompleted ?? false}
            error={fieldError(state, "housekeepingCompleted")}
            label="Housekeeping completed"
            name="housekeepingCompleted"
          />
          <CheckboxField
            defaultChecked={initialValues?.supervisorNotified ?? false}
            error={fieldError(state, "supervisorNotified")}
            label="Supervisor notified"
            name="supervisorNotified"
          />
        </div>

        <label className="full-width-field">
          <span>Completion notes</span>
          <textarea
            name="completionNotes"
            defaultValue={initialValues?.completionNotes ?? ""}
            rows={3}
          />
          {fieldError(state, "completionNotes")}
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
