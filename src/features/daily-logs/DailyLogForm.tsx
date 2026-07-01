"use client";

import { useActionState, useMemo, useState } from "react";

import { dailyLogActivityTypeOptions, shiftOptions } from "./constants";
import type {
  DailyLogFormActivity,
  DailyLogFormInitialValues,
  DailyLogSelectOption,
} from "./types";
import {
  emptyDailyLogFormState,
  type DailyLogFormField,
  type DailyLogFormState,
} from "./validation";

type DailyLogFormProps = {
  action: (
    previousState: DailyLogFormState,
    formData: FormData,
  ) => Promise<DailyLogFormState>;
  cancelHref: string;
  equipmentOptions: DailyLogSelectOption[];
  initialValues?: DailyLogFormInitialValues;
  mineOptions: DailyLogSelectOption[];
  submitLabel: string;
};

type ActivityRow = DailyLogFormActivity & {
  key: string;
};

function fieldError(state: DailyLogFormState, field: DailyLogFormField) {
  const error = state.fieldErrors[field]?.[0];

  if (!error) {
    return null;
  }

  return <p className="field-error">{error}</p>;
}

function makeActivityRow(activity?: DailyLogFormActivity): ActivityRow {
  return {
    key: crypto.randomUUID(),
    activityType: activity?.activityType ?? "GENERAL_NOTE",
    title: activity?.title ?? "",
    startTime: activity?.startTime ?? "",
    endTime: activity?.endTime ?? "",
    description: activity?.description ?? "",
    equipmentId: activity?.equipmentId ?? "",
    location: activity?.location ?? "",
    contractorCompany: activity?.contractorCompany ?? "",
    personName: activity?.personName ?? "",
    notes: activity?.notes ?? "",
  };
}

export function DailyLogForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  mineOptions,
  submitLabel,
}: DailyLogFormProps) {
  const initialActivities = useMemo(
    () =>
      initialValues?.activities && initialValues.activities.length > 0
        ? initialValues.activities.map((activity) => makeActivityRow(activity))
        : [makeActivityRow()],
    [initialValues?.activities],
  );
  const [activities, setActivities] = useState<ActivityRow[]>(initialActivities);
  const [state, formAction, pending] = useActionState(action, emptyDailyLogFormState);

  function addActivity() {
    setActivities((current) => [...current, makeActivityRow()]);
  }

  function removeActivity(key: string) {
    setActivities((current) =>
      current.length > 1 ? current.filter((activity) => activity.key !== key) : current,
    );
  }

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="daily-log-heading">
        <h2 id="daily-log-heading">Daily Log</h2>
        <div className="form-grid">
          <label>
            <span>Date</span>
            <input
              name="logDate"
              type="date"
              defaultValue={initialValues?.logDate ?? ""}
            />
            {fieldError(state, "logDate")}
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
            <span>Primary equipment</span>
            <select
              name="primaryEquipmentId"
              defaultValue={initialValues?.primaryEquipmentId ?? ""}
            >
              <option value="">Not set</option>
              {equipmentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError(state, "primaryEquipmentId")}
          </label>
        </div>

        <label className="full-width-field">
          <span>Summary</span>
          <textarea
            name="summary"
            defaultValue={initialValues?.summary ?? ""}
            rows={3}
          />
          {fieldError(state, "summary")}
        </label>

        <label className="full-width-field">
          <span>Weather conditions</span>
          <input
            name="weatherConditions"
            defaultValue={initialValues?.weatherConditions ?? ""}
            autoComplete="off"
          />
          {fieldError(state, "weatherConditions")}
        </label>

        <label className="full-width-field">
          <span>General notes</span>
          <textarea
            name="generalNotes"
            defaultValue={initialValues?.generalNotes ?? ""}
            rows={4}
          />
          {fieldError(state, "generalNotes")}
        </label>
      </section>

      <section className="form-section" aria-labelledby="activities-heading">
        <div className="section-heading">
          <h2 id="activities-heading">Activities</h2>
          <button className="button secondary" type="button" onClick={addActivity}>
            Add Activity
          </button>
        </div>
        {fieldError(state, "activities")}

        <div className="activity-list">
          {activities.map((activity, index) => (
            <fieldset className="activity-card" key={activity.key}>
              <legend>Activity {index + 1}</legend>

              <div className="form-grid">
                <label>
                  <span>Type</span>
                  <select
                    name="activityType"
                    defaultValue={activity.activityType ?? "GENERAL_NOTE"}
                  >
                    {dailyLogActivityTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Title</span>
                  <input
                    name="activityTitle"
                    defaultValue={activity.title ?? ""}
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span>Start time</span>
                  <input
                    name="activityStartTime"
                    type="time"
                    defaultValue={activity.startTime ?? ""}
                  />
                </label>

                <label>
                  <span>End time</span>
                  <input
                    name="activityEndTime"
                    type="time"
                    defaultValue={activity.endTime ?? ""}
                  />
                </label>

                <label>
                  <span>Equipment</span>
                  <select name="activityEquipmentId" defaultValue={activity.equipmentId ?? ""}>
                    <option value="">Not set</option>
                    {equipmentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Location</span>
                  <input
                    name="activityLocation"
                    defaultValue={activity.location ?? ""}
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span>Company</span>
                  <input
                    name="activityContractorCompany"
                    defaultValue={activity.contractorCompany ?? ""}
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span>Person</span>
                  <input
                    name="activityPersonName"
                    defaultValue={activity.personName ?? ""}
                    autoComplete="off"
                  />
                </label>
              </div>

              <label className="full-width-field">
                <span>Description</span>
                <textarea
                  name="activityDescription"
                  defaultValue={activity.description ?? ""}
                  rows={3}
                />
              </label>

              <label className="full-width-field">
                <span>Notes</span>
                <textarea name="activityNotes" defaultValue={activity.notes ?? ""} rows={3} />
              </label>

              <div className="activity-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => removeActivity(activity.key)}
                  disabled={activities.length === 1}
                >
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
        </div>
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
