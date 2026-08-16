"use client";

import { useActionState, useMemo, useRef, useState } from "react";

import {
  dailyAssignmentStatusOptions,
  dayNames,
  shiftOptions,
  weeklyScheduleStatusOptions,
} from "./constants";
import type {
  WorkScheduleFormInitialValues,
  WorkScheduleEmployeeOption,
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
  employeeOptions: WorkScheduleEmployeeOption[];
  equipmentOptions: WorkScheduleSelectOption[];
  initialValues: WorkScheduleFormInitialValues;
  submitLabel: string;
  supervisorOptions: WorkScheduleEmployeeOption[];
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
    plannedStatus: "SCHEDULED" as const,
    plannedShift: "UNKNOWN" as const,
    plannedEquipmentId: "",
    actualStatus: "SCHEDULED" as const,
    actualShift: "UNKNOWN" as const,
    actualEquipmentId: "",
    plannedPrimaryEmployeeId: initialValues.primaryEmployeeId ?? "",
    plannedPrimaryDisplayName: "",
    plannedPartnerEmployeeId: "",
    plannedPartnerDisplayName: "",
    plannedPartnerUnknown: false,
    actualPrimaryEmployeeId: initialValues.primaryEmployeeId ?? "",
    actualPrimaryDisplayName: "",
    actualPartnerEmployeeId: "",
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
  employeeOptions,
  equipmentOptions,
  initialValues,
  submitLabel,
  supervisorOptions,
}: WorkScheduleFormProps) {
  const [state, formAction, pending] = useActionState(action, emptyWeeklyScheduleFormState);
  const [weekStartDate, setWeekStartDate] = useState(initialValues.weekStartDate);
  const [primaryEmployeeId, setPrimaryEmployeeId] = useState(
    initialValues.primaryEmployeeId ?? "",
  );
  const [personnel, setPersonnel] = useState(() =>
    assignmentRows(initialValues, initialValues.weekStartDate).map((assignment) => ({
      plannedPrimaryEmployeeId: assignment.plannedPrimaryEmployeeId ?? "",
      actualPrimaryEmployeeId: assignment.actualPrimaryEmployeeId ?? "",
      plannedPartnerEmployeeId: assignment.plannedPartnerEmployeeId ?? "",
      actualPartnerEmployeeId: assignment.actualPartnerEmployeeId ?? "",
    })),
  );
  const plannedPrimaryOverridden = useRef(
    initialValues.assignments.map(() => !initialValues.isNew),
  );
  const actualPrimaryOverridden = useRef(
    initialValues.assignments.map(() => !initialValues.isNew),
  );
  const actualPartnerOverridden = useRef(
    initialValues.assignments.map(() => !initialValues.isNew),
  );
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
        <div className="form-grid work-schedule-header-grid">
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
            <select
              name="primaryEmployeeId"
              value={primaryEmployeeId}
              onChange={(event) => {
                const employeeId = event.target.value;
                setPrimaryEmployeeId(employeeId);
                setPersonnel((current) =>
                  current.map((row, index) => {
                    if (plannedPrimaryOverridden.current[index]) return row;
                    return {
                      ...row,
                      plannedPrimaryEmployeeId: employeeId,
                      actualPrimaryEmployeeId: actualPrimaryOverridden.current[index]
                        ? row.actualPrimaryEmployeeId
                        : employeeId,
                    };
                  }),
                );
              }}
            >
              <option value="" disabled={initialValues.isNew}>
                {initialValues.primaryEmployeeDisplayName && !initialValues.primaryEmployeeId
                  ? `Historical: ${initialValues.primaryEmployeeDisplayName} (not linked)`
                  : "Select employee"}
              </option>
              {employeeOptions.map((option) => (
                <option disabled={!option.isActive && option.id !== primaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {fieldError(state, "primaryEmployeeId")}
          </label>

          <label>
            <span>Assigned By</span>
            <select name="assignedByEmployeeId" defaultValue={initialValues.assignedByEmployeeId ?? ""}>
              <option value="" disabled={initialValues.isNew}>
                {initialValues.assignedByDisplayName && !initialValues.assignedByEmployeeId
                  ? `Historical: ${initialValues.assignedByDisplayName} (not linked)`
                  : "Select supervisor"}
              </option>
              {supervisorOptions.map((option) => (
                <option disabled={!option.isActive && option.id !== initialValues.assignedByEmployeeId} key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {fieldError(state, "assignedByEmployeeId")}
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
                  <select
                    name="plannedPrimaryEmployeeId"
                    value={personnel[index]?.plannedPrimaryEmployeeId ?? ""}
                    onChange={(event) => {
                      const employeeId = event.target.value;
                      plannedPrimaryOverridden.current[index] = true;
                      setPersonnel((current) => current.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              plannedPrimaryEmployeeId: employeeId,
                              actualPrimaryEmployeeId: actualPrimaryOverridden.current[index]
                                ? row.actualPrimaryEmployeeId
                                : employeeId,
                            }
                          : row,
                      ));
                    }}
                  >
                    <option value="" disabled={initialValues.isNew}>
                      {assignment.plannedPrimaryDisplayName && !assignment.plannedPrimaryEmployeeId
                        ? `Historical: ${assignment.plannedPrimaryDisplayName} (not linked)`
                        : "Select employee"}
                    </option>
                    {employeeOptions.map((option) => (
                      <option disabled={!option.isActive && option.id !== personnel[index]?.plannedPrimaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "plannedPrimaryEmployeeId")}
                </label>

                <label>
                  <span>Actual primary</span>
                  <select
                    name="actualPrimaryEmployeeId"
                    value={personnel[index]?.actualPrimaryEmployeeId ?? ""}
                    onChange={(event) => {
                      actualPrimaryOverridden.current[index] = true;
                      setPersonnel((current) => current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, actualPrimaryEmployeeId: event.target.value }
                          : row,
                      ));
                    }}
                  >
                    <option value="" disabled={initialValues.isNew}>
                      {assignment.actualPrimaryDisplayName && !assignment.actualPrimaryEmployeeId
                        ? `Historical: ${assignment.actualPrimaryDisplayName} (not linked)`
                        : "Select employee"}
                    </option>
                    {employeeOptions.map((option) => (
                      <option disabled={!option.isActive && option.id !== personnel[index]?.actualPrimaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "actualPrimaryEmployeeId")}
                </label>

                <label>
                  <span>Planned partner</span>
                  <select
                    name="plannedPartnerEmployeeId"
                    value={personnel[index]?.plannedPartnerEmployeeId ?? ""}
                    onChange={(event) => {
                      const employeeId = event.target.value;
                      setPersonnel((current) => current.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              plannedPartnerEmployeeId: employeeId,
                              actualPartnerEmployeeId: actualPartnerOverridden.current[index]
                                ? row.actualPartnerEmployeeId
                                : employeeId,
                            }
                          : row,
                      ));
                    }}
                  >
                    <option value="">
                      {assignment.plannedPartnerDisplayName && !assignment.plannedPartnerEmployeeId
                        ? `Historical: ${assignment.plannedPartnerDisplayName} (not linked)`
                        : "Select partner (optional)"}
                    </option>
                    {employeeOptions.map((option) => (
                      <option disabled={!option.isActive && option.id !== personnel[index]?.plannedPartnerEmployeeId} key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "plannedPartnerEmployeeId")}
                </label>

                <label>
                  <span>Actual partner</span>
                  <select
                    name="actualPartnerEmployeeId"
                    value={personnel[index]?.actualPartnerEmployeeId ?? ""}
                    onChange={(event) => {
                      actualPartnerOverridden.current[index] = true;
                      setPersonnel((current) => current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, actualPartnerEmployeeId: event.target.value }
                          : row,
                      ));
                    }}
                  >
                    <option value="">
                      {assignment.actualPartnerDisplayName && !assignment.actualPartnerEmployeeId
                        ? `Historical: ${assignment.actualPartnerDisplayName} (not linked)`
                        : "Select partner (optional)"}
                    </option>
                    {employeeOptions.map((option) => (
                      <option disabled={!option.isActive && option.id !== personnel[index]?.actualPartnerEmployeeId} key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {assignmentFieldError(state, index, "actualPartnerEmployeeId")}
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
