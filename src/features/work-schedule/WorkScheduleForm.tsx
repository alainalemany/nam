"use client";

import { useActionState, useMemo, useState } from "react";

import {
  dailyAssignmentStatusOptions,
  dayNames,
  shiftOptions,
  weeklyScheduleStatusOptions,
} from "./constants";
import type {
  WorkScheduleFormInitialValues,
  WorkScheduleSelectOption,
} from "./types";
import {
  buildWeekDates,
  emptyWeeklyScheduleFormState,
  parseDateOnly,
  type AssignmentFormField,
  type WeeklyScheduleFormField,
  type WeeklyScheduleFormState,
} from "./validation";

type WorkScheduleFormProps = {
  action: (
    previousState: WeeklyScheduleFormState,
    formData: FormData,
  ) => Promise<WeeklyScheduleFormState>;
  cancelHref: string;
  equipmentOptions: WorkScheduleSelectOption[];
  initialValues: WorkScheduleFormInitialValues;
  submitLabel: string;
};

function fieldError(state: WeeklyScheduleFormState, field: WeeklyScheduleFormField) {
  const error = state.fieldErrors[field]?.[0];
  return error ? <p className="field-error">{error}</p> : null;
}

function assignmentFieldError(
  state: WeeklyScheduleFormState,
  index: number,
  field: AssignmentFormField,
) {
  const error = state.assignmentErrors[index]?.[field]?.[0];
  return error ? <p className="field-error">{error}</p> : null;
}

function assignmentRows(initialValues: WorkScheduleFormInitialValues, weekStartDate: string) {
  const byDate = new Map(
    initialValues.assignments.map((assignment) => [assignment.assignmentDate, assignment]),
  );

  return buildWeekDates(parseDateOnly(weekStartDate)).map((day) => ({
    plannedStatus: "UNKNOWN" as const,
    plannedShift: "UNKNOWN" as const,
    plannedEquipmentId: "",
    actualStatus: "UNKNOWN" as const,
    actualShift: "UNKNOWN" as const,
    actualEquipmentId: "",
    plannedPrimaryDisplayName: "",
    plannedPartnerDisplayName: "",
    plannedPartnerUnknown: false,
    actualPrimaryDisplayName: "",
    actualPartnerDisplayName: "",
    actualPartnerUnknown: false,
    changeReason: "",
    plannedNotes: "",
    actualNotes: "",
    ...day,
    ...byDate.get(day.assignmentDate),
  }));
}

export function WorkScheduleForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  submitLabel,
}: WorkScheduleFormProps) {
  const [state, formAction, pending] = useActionState(action, emptyWeeklyScheduleFormState);
  const [weekStartDate, setWeekStartDate] = useState(initialValues.weekStartDate);
  const assignments = useMemo(
    () => assignmentRows(initialValues, weekStartDate),
    [initialValues, weekStartDate],
  );

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">{state.message}</div>
      ) : null}

      <section className="form-section" aria-labelledby="schedule-header-heading">
        <h2 id="schedule-header-heading">Weekly Schedule</h2>
        <div className="form-grid">
          <label>
            <span>Week starting Monday</span>
            <input
              name="weekStartDate"
              type="date"
              value={weekStartDate}
              onChange={(event) => setWeekStartDate(event.target.value)}
            />
            {fieldError(state, "weekStartDate")}
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={initialValues.status}>
              {weeklyScheduleStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {fieldError(state, "status")}
          </label>

          <label>
            <span>Primary employee</span>
            <input
              name="primaryEmployeeDisplayName"
              defaultValue={initialValues.primaryEmployeeDisplayName}
              placeholder="Name on the schedule"
            />
            {fieldError(state, "primaryEmployeeDisplayName")}
          </label>

          <label>
            <span>Assigned By</span>
            <input
              name="assignedByDisplayName"
              defaultValue={initialValues.assignedByDisplayName}
              placeholder="Supervisor or schedule source"
            />
            {fieldError(state, "assignedByDisplayName")}
          </label>

          <label>
            <span>Received at</span>
            <input
              name="receivedAt"
              type="datetime-local"
              defaultValue={initialValues.receivedAt ?? ""}
            />
            {fieldError(state, "receivedAt")}
          </label>
        </div>

        <label className="full-width-field">
          <span>Source note</span>
          <textarea name="sourceNote" rows={3} defaultValue={initialValues.sourceNote ?? ""} />
          {fieldError(state, "sourceNote")}
        </label>

        <label className="full-width-field">
          <span>Schedule notes</span>
          <textarea
            name="scheduleNotes"
            rows={3}
            defaultValue={initialValues.scheduleNotes ?? ""}
          />
          {fieldError(state, "scheduleNotes")}
        </label>
      </section>

      <section className="form-section" aria-labelledby="weekly-grid-heading">
        <h2 id="weekly-grid-heading">Monday-Sunday Grid</h2>
        {fieldError(state, "assignments")}
        <div className="activity-list">
          {assignments.map((assignment, index) => (
            <fieldset className="activity-card" key={assignment.assignmentDate}>
              <legend>{dayNames[index]} - {assignment.assignmentDate}</legend>
              <input type="hidden" name="assignmentDate" value={assignment.assignmentDate} />
              <input type="hidden" name="dayOfWeek" value={assignment.dayOfWeek} />

              <div className="form-grid">
                <label>
                  <span>Planned status</span>
                  <select name="plannedStatus" defaultValue={assignment.plannedStatus}>
                    {dailyAssignmentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "plannedStatus")}
                </label>

                <label>
                  <span>Actual status</span>
                  <select name="actualStatus" defaultValue={assignment.actualStatus}>
                    {dailyAssignmentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "actualStatus")}
                </label>

                <label>
                  <span>Planned shift</span>
                  <select name="plannedShift" defaultValue={assignment.plannedShift}>
                    {shiftOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "plannedShift")}
                </label>

                <label>
                  <span>Actual shift</span>
                  <select name="actualShift" defaultValue={assignment.actualShift}>
                    {shiftOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "actualShift")}
                </label>

                <label>
                  <span>Planned equipment</span>
                  <select name="plannedEquipmentId" defaultValue={assignment.plannedEquipmentId ?? ""}>
                    <option value="">No equipment selected</option>
                    {equipmentOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "plannedEquipmentId")}
                </label>

                <label>
                  <span>Actual equipment</span>
                  <select name="actualEquipmentId" defaultValue={assignment.actualEquipmentId ?? ""}>
                    <option value="">No equipment selected</option>
                    {equipmentOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "actualEquipmentId")}
                </label>

                <label>
                  <span>Planned primary</span>
                  <input
                    name="plannedPrimaryDisplayName"
                    defaultValue={assignment.plannedPrimaryDisplayName ?? ""}
                    placeholder="Defaults to primary employee"
                  />
                  {assignmentFieldError(state, index, "plannedPrimaryDisplayName")}
                </label>

                <label>
                  <span>Actual primary</span>
                  <input
                    name="actualPrimaryDisplayName"
                    defaultValue={assignment.actualPrimaryDisplayName ?? ""}
                    placeholder="Defaults to primary employee"
                  />
                  {assignmentFieldError(state, index, "actualPrimaryDisplayName")}
                </label>

                <label>
                  <span>Planned partner</span>
                  <input
                    name="plannedPartnerDisplayName"
                    defaultValue={assignment.plannedPartnerDisplayName ?? ""}
                  />
                  {assignmentFieldError(state, index, "plannedPartnerDisplayName")}
                </label>

                <label>
                  <span>Actual partner</span>
                  <input
                    name="actualPartnerDisplayName"
                    defaultValue={assignment.actualPartnerDisplayName ?? ""}
                  />
                  {assignmentFieldError(state, index, "actualPartnerDisplayName")}
                </label>

                <label className="checkbox-row">
                  <input
                    name={`plannedPartnerUnknown-${index}`}
                    type="checkbox"
                    defaultChecked={assignment.plannedPartnerUnknown}
                  />
                  <span>Planned partner unknown</span>
                  {assignmentFieldError(state, index, "plannedPartnerUnknown")}
                </label>

                <label className="checkbox-row">
                  <input
                    name={`actualPartnerUnknown-${index}`}
                    type="checkbox"
                    defaultChecked={assignment.actualPartnerUnknown}
                  />
                  <span>Actual partner unknown</span>
                  {assignmentFieldError(state, index, "actualPartnerUnknown")}
                </label>
              </div>

              <label className="full-width-field">
                <span>Change reason</span>
                <textarea name="changeReason" rows={2} defaultValue={assignment.changeReason ?? ""} />
                {assignmentFieldError(state, index, "changeReason")}
              </label>

              <div className="form-grid">
                <label>
                  <span>Planned notes</span>
                  <textarea name="plannedNotes" rows={2} defaultValue={assignment.plannedNotes ?? ""} />
                  {assignmentFieldError(state, index, "plannedNotes")}
                </label>

                <label>
                  <span>Actual notes</span>
                  <textarea name="actualNotes" rows={2} defaultValue={assignment.actualNotes ?? ""} />
                  {assignmentFieldError(state, index, "actualNotes")}
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>Cancel</a>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
