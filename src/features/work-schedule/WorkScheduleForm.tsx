"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  dailyAssignmentStatusOptions,
  dayNames,
  shiftOptions,
  weeklyScheduleStatusOptions,
  type DailyAssignmentStatusValue,
  type ShiftValue,
  type WeeklyScheduleStatusValue,
} from "./constants";
import type {
  WorkScheduleEmployeeOption,
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
  type WeeklyScheduleSubmittedValues,
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

type AssignmentRow = ReturnType<typeof assignmentRows>[number];

function errorMessage(
  state: WeeklyScheduleFormState,
  field: WeeklyScheduleFormField,
) {
  return state.fieldErrors[field]?.[0];
}

function assignmentErrorMessage(
  state: WeeklyScheduleFormState,
  index: number,
  field: AssignmentFormField,
) {
  return state.assignmentErrors[index]?.[field]?.[0];
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={id}>{message}</p> : null;
}

function assignmentRows(initialValues: WorkScheduleFormInitialValues, weekStartDate: string) {
  const byDate = new Map(
    initialValues.assignments.map((assignment) => [assignment.assignmentDate, assignment]),
  );

  return buildWeekDates(parseDateOnly(weekStartDate)).map((day) => ({
    plannedStatus: "SCHEDULED" as DailyAssignmentStatusValue,
    plannedShift: "UNKNOWN" as ShiftValue,
    plannedEquipmentId: "",
    actualStatus: "SCHEDULED" as DailyAssignmentStatusValue,
    actualShift: "UNKNOWN" as ShiftValue,
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

function submittedRows(
  submitted: WeeklyScheduleSubmittedValues,
  initialValues: WorkScheduleFormInitialValues,
) {
  const initialRows = assignmentRows(initialValues, submitted.weekStartDate);
  return initialRows.map((row, index) => ({
    ...row,
    ...submitted.assignments[index],
    dayOfWeek: Number(submitted.assignments[index]?.dayOfWeek ?? row.dayOfWeek),
    plannedStatus: (submitted.assignments[index]?.plannedStatus ?? row.plannedStatus) as DailyAssignmentStatusValue,
    plannedShift: (submitted.assignments[index]?.plannedShift ?? row.plannedShift) as ShiftValue,
    actualStatus: (submitted.assignments[index]?.actualStatus ?? row.actualStatus) as DailyAssignmentStatusValue,
    actualShift: (submitted.assignments[index]?.actualShift ?? row.actualShift) as ShiftValue,
  }));
}

function disabledValue(name: string, value: string | number, disabled: boolean) {
  return disabled ? <input type="hidden" name={name} value={value} /> : null;
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
  const [status, setStatus] = useState<WeeklyScheduleStatusValue>(initialValues.status);
  const [primaryEmployeeId, setPrimaryEmployeeId] = useState(initialValues.primaryEmployeeId ?? "");
  const [assignedByEmployeeId, setAssignedByEmployeeId] = useState(initialValues.assignedByEmployeeId ?? "");
  const [receivedAt, setReceivedAt] = useState(initialValues.receivedAt ?? "");
  const [sourceNote, setSourceNote] = useState(initialValues.sourceNote ?? "");
  const [scheduleNotes, setScheduleNotes] = useState(initialValues.scheduleNotes ?? "");
  const [assignments, setAssignments] = useState(() =>
    assignmentRows(initialValues, initialValues.weekStartDate),
  );
  const plannedPrimaryOverridden = useRef(assignments.map(() => !initialValues.isNew));
  const actualPrimaryOverridden = useRef(assignments.map(() => !initialValues.isNew));
  const actualStatusOverridden = useRef(assignments.map(() => !initialValues.isNew));
  const actualShiftOverridden = useRef(assignments.map(() => !initialValues.isNew));
  const actualEquipmentOverridden = useRef(assignments.map(() => !initialValues.isNew));
  const actualPartnerOverridden = useRef(assignments.map(() => !initialValues.isNew));

  useEffect(() => {
    if (!state.submittedValues) return;
    const submitted = state.submittedValues;
    setWeekStartDate(submitted.weekStartDate);
    setStatus(submitted.status as WeeklyScheduleStatusValue);
    setPrimaryEmployeeId(submitted.primaryEmployeeId);
    setAssignedByEmployeeId(submitted.assignedByEmployeeId);
    setReceivedAt(submitted.receivedAt);
    setSourceNote(submitted.sourceNote);
    setScheduleNotes(submitted.scheduleNotes);
    setAssignments(submittedRows(submitted, initialValues));
  }, [state.submittedValues, initialValues]);

  const updateAssignment = (index: number, update: Partial<AssignmentRow>) => {
    setAssignments((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...update } : row,
    ));
  };

  const changePlannedStatus = (index: number, plannedStatus: DailyAssignmentStatusValue) => {
    const inactive = plannedStatus === "NON_WORKING" || plannedStatus === "CANCELLED";
    if (inactive) {
      actualStatusOverridden.current[index] = false;
      actualShiftOverridden.current[index] = false;
      actualEquipmentOverridden.current[index] = false;
      actualPrimaryOverridden.current[index] = false;
      actualPartnerOverridden.current[index] = false;
      updateAssignment(index, plannedStatus === "NON_WORKING" ? {
        plannedStatus,
        actualStatus: "NON_WORKING",
        plannedShift: "UNKNOWN",
        actualShift: "UNKNOWN",
        plannedEquipmentId: "",
        actualEquipmentId: "",
        plannedPrimaryEmployeeId: "",
        actualPrimaryEmployeeId: "",
        plannedPartnerEmployeeId: "",
        actualPartnerEmployeeId: "",
        plannedPartnerUnknown: false,
        actualPartnerUnknown: false,
        changeReason: "",
        plannedNotes: "",
        actualNotes: "",
      } : {
        plannedStatus,
        actualStatus: "CANCELLED",
        actualShift: "UNKNOWN",
        actualEquipmentId: "",
        actualPrimaryEmployeeId: "",
        actualPartnerEmployeeId: "",
        actualPartnerUnknown: false,
        actualNotes: "",
      });
      return;
    }

    setAssignments((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      return {
        ...row,
        plannedStatus,
        actualStatus: actualStatusOverridden.current[index] ? row.actualStatus : plannedStatus,
        actualShift: row.plannedShift,
        actualEquipmentId: row.plannedEquipmentId,
        actualPrimaryEmployeeId: row.plannedPrimaryEmployeeId,
        actualPartnerEmployeeId: row.plannedPartnerEmployeeId,
        actualPartnerUnknown: row.plannedPartnerUnknown,
      };
    }));
  };

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}

      <section className="form-section" aria-labelledby="schedule-header-heading">
        <h2 id="schedule-header-heading">Weekly Schedule</h2>
        <div className="form-grid work-schedule-header-grid">
          <label>
            <span>Week starting Monday</span>
            <input
              aria-describedby={errorMessage(state, "weekStartDate") ? "weekStartDate-error" : undefined}
              aria-invalid={Boolean(errorMessage(state, "weekStartDate"))}
              name="weekStartDate"
              type="date"
              value={weekStartDate}
              onChange={(event) => {
                const value = event.target.value;
                setWeekStartDate(value);
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                  const dates = buildWeekDates(parseDateOnly(value));
                  setAssignments((current) => current.map((row, index) => ({ ...row, ...dates[index] })));
                }
              }}
            />
            <FieldError id="weekStartDate-error" message={errorMessage(state, "weekStartDate")} />
          </label>

          <label>
            <span>Status</span>
            <select aria-describedby={errorMessage(state, "status") ? "status-error" : undefined} aria-invalid={Boolean(errorMessage(state, "status"))} name="status" value={status} onChange={(event) => setStatus(event.target.value as WeeklyScheduleStatusValue)}>
              {weeklyScheduleStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <FieldError id="status-error" message={errorMessage(state, "status")} />
          </label>

          <label>
            <span>Primary employee</span>
            <select
              aria-invalid={Boolean(errorMessage(state, "primaryEmployeeId"))}
              name="primaryEmployeeId"
              value={primaryEmployeeId}
              onChange={(event) => {
                const employeeId = event.target.value;
                setPrimaryEmployeeId(employeeId);
                setAssignments((current) => current.map((row, index) => plannedPrimaryOverridden.current[index] ? row : {
                  ...row,
                  plannedPrimaryEmployeeId: employeeId,
                  actualPrimaryEmployeeId: actualPrimaryOverridden.current[index] ? row.actualPrimaryEmployeeId : employeeId,
                }));
              }}
            >
              <option value="" disabled={initialValues.isNew}>
                {initialValues.primaryEmployeeDisplayName && !initialValues.primaryEmployeeId
                  ? `Historical: ${initialValues.primaryEmployeeDisplayName} (not linked)`
                  : "Select employee"}
              </option>
              {employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== primaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <FieldError id="primaryEmployeeId-error" message={errorMessage(state, "primaryEmployeeId")} />
          </label>

          <label>
            <span>Assigned By</span>
            <select
              aria-invalid={Boolean(errorMessage(state, "assignedByEmployeeId"))}
              name="assignedByEmployeeId"
              value={assignedByEmployeeId}
              onChange={(event) => setAssignedByEmployeeId(event.target.value)}
            >
              <option value="" disabled={initialValues.isNew}>
                {initialValues.assignedByDisplayName && !initialValues.assignedByEmployeeId
                  ? `Historical: ${initialValues.assignedByDisplayName} (not linked)`
                  : "Select supervisor"}
              </option>
              {supervisorOptions.map((option) => <option disabled={!option.isActive && option.id !== assignedByEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <FieldError id="assignedByEmployeeId-error" message={errorMessage(state, "assignedByEmployeeId")} />
          </label>

          <label>
            <span>Received at</span>
            <input aria-describedby={errorMessage(state, "receivedAt") ? "receivedAt-error" : undefined} aria-invalid={Boolean(errorMessage(state, "receivedAt"))} name="receivedAt" type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
            <FieldError id="receivedAt-error" message={errorMessage(state, "receivedAt")} />
          </label>
        </div>

        <label className="full-width-field">
          <span>Source note</span>
          <textarea aria-describedby={errorMessage(state, "sourceNote") ? "sourceNote-error" : undefined} aria-invalid={Boolean(errorMessage(state, "sourceNote"))} name="sourceNote" rows={3} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} />
          <FieldError id="sourceNote-error" message={errorMessage(state, "sourceNote")} />
        </label>

        <label className="full-width-field">
          <span>Schedule notes</span>
          <textarea aria-label="Schedule notes" aria-describedby={errorMessage(state, "scheduleNotes") ? "scheduleNotes-error" : undefined} aria-invalid={Boolean(errorMessage(state, "scheduleNotes"))} name="scheduleNotes" rows={3} value={scheduleNotes} onChange={(event) => setScheduleNotes(event.target.value)} />
          <FieldError id="scheduleNotes-error" message={errorMessage(state, "scheduleNotes")} />
        </label>
      </section>

      <section className="form-section" aria-labelledby="weekly-grid-heading">
        <h2 id="weekly-grid-heading">Monday-Sunday Grid</h2>
        <FieldError id="assignments-error" message={errorMessage(state, "assignments")} />
        <div className="activity-list">
          {assignments.map((assignment, index) => {
            const nonWorking = assignment.plannedStatus === "NON_WORKING";
            const cancelled = assignment.plannedStatus === "CANCELLED";
            const inactive = nonWorking || cancelled;
            const statusLabel = nonWorking ? "Non-working" : cancelled ? "Cancelled" : null;
            const error = (field: AssignmentFormField) => assignmentErrorMessage(state, index, field);
            const errorId = (field: AssignmentFormField) => `assignment-${index}-${field}-error`;
            const describedBy = (field: AssignmentFormField) => error(field) ? errorId(field) : undefined;
            return (
              <fieldset
                className={`activity-card work-schedule-day${inactive ? " work-schedule-day--inactive" : ""}${nonWorking ? " work-schedule-day--non-working" : ""}${cancelled ? " work-schedule-day--cancelled" : ""}`}
                data-day-state={inactive ? assignment.plannedStatus : "ACTIVE"}
                key={assignment.assignmentDate}
              >
                <legend>{dayNames[index]} - {assignment.assignmentDate}</legend>
                <input type="hidden" name="assignmentDate" value={assignment.assignmentDate} />
                <input type="hidden" name="dayOfWeek" value={assignment.dayOfWeek} />

                <div className="work-schedule-day-status">
                  <label>
                    <span>Planned status</span>
                    <select
                      aria-describedby={describedBy("plannedStatus")}
                      aria-invalid={Boolean(error("plannedStatus"))}
                      name="plannedStatus"
                      value={assignment.plannedStatus}
                      onChange={(event) => changePlannedStatus(index, event.target.value as DailyAssignmentStatusValue)}
                    >
                      {dailyAssignmentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <FieldError id={errorId("plannedStatus")} message={error("plannedStatus")} />
                  </label>
                  {statusLabel ? <span className="work-schedule-day-status-badge">{statusLabel}</span> : null}
                </div>

                <div className="work-schedule-assignment-area">
                  <div className="form-grid">
                    <label>
                      <span>Actual status</span>
                      <select disabled={inactive} aria-describedby={describedBy("actualStatus")} aria-invalid={Boolean(error("actualStatus"))} name="actualStatus" value={assignment.actualStatus} onChange={(event) => {
                        actualStatusOverridden.current[index] = true;
                        updateAssignment(index, { actualStatus: event.target.value as DailyAssignmentStatusValue });
                      }}>
                        {dailyAssignmentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      {disabledValue("actualStatus", assignment.actualStatus, inactive)}
                      <FieldError id={errorId("actualStatus")} message={error("actualStatus")} />
                    </label>

                    <label>
                      <span>Planned shift</span>
                      <select disabled={inactive} aria-describedby={describedBy("plannedShift")} aria-invalid={Boolean(error("plannedShift"))} name="plannedShift" value={assignment.plannedShift} onChange={(event) => {
                        const value = event.target.value as ShiftValue;
                        updateAssignment(index, { plannedShift: value, ...(!actualShiftOverridden.current[index] ? { actualShift: value } : {}) });
                      }}>
                        {shiftOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      {disabledValue("plannedShift", assignment.plannedShift, inactive)}
                      <FieldError id={errorId("plannedShift")} message={error("plannedShift")} />
                    </label>

                    <label>
                      <span>Actual shift</span>
                      <select aria-label="Actual shift" disabled={inactive} aria-describedby={describedBy("actualShift")} aria-invalid={Boolean(error("actualShift"))} name="actualShift" value={assignment.actualShift} onChange={(event) => {
                        actualShiftOverridden.current[index] = true;
                        updateAssignment(index, { actualShift: event.target.value as ShiftValue });
                      }}>
                        {shiftOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      {disabledValue("actualShift", assignment.actualShift, inactive)}
                      <FieldError id={errorId("actualShift")} message={error("actualShift")} />
                    </label>

                    <label>
                      <span>Planned equipment</span>
                      <select disabled={inactive} aria-describedby={describedBy("plannedEquipmentId")} aria-invalid={Boolean(error("plannedEquipmentId"))} name="plannedEquipmentId" value={assignment.plannedEquipmentId ?? ""} onChange={(event) => {
                        const value = event.target.value;
                        updateAssignment(index, { plannedEquipmentId: value, ...(!actualEquipmentOverridden.current[index] ? { actualEquipmentId: value } : {}) });
                      }}>
                        <option value="">No equipment selected</option>
                        {equipmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {disabledValue("plannedEquipmentId", assignment.plannedEquipmentId ?? "", inactive)}
                      <FieldError id={errorId("plannedEquipmentId")} message={error("plannedEquipmentId")} />
                    </label>

                    <label>
                      <span>Actual equipment</span>
                      <select disabled={inactive} aria-describedby={describedBy("actualEquipmentId")} aria-invalid={Boolean(error("actualEquipmentId"))} name="actualEquipmentId" value={assignment.actualEquipmentId ?? ""} onChange={(event) => {
                        actualEquipmentOverridden.current[index] = true;
                        updateAssignment(index, { actualEquipmentId: event.target.value });
                      }}>
                        <option value="">No equipment selected</option>
                        {equipmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {disabledValue("actualEquipmentId", assignment.actualEquipmentId ?? "", inactive)}
                      <FieldError id={errorId("actualEquipmentId")} message={error("actualEquipmentId")} />
                    </label>

                    <label>
                      <span>Planned primary</span>
                      <select disabled={inactive} aria-describedby={describedBy("plannedPrimaryEmployeeId")} aria-invalid={Boolean(error("plannedPrimaryEmployeeId"))} name="plannedPrimaryEmployeeId" value={assignment.plannedPrimaryEmployeeId ?? ""} onChange={(event) => {
                        const value = event.target.value;
                        plannedPrimaryOverridden.current[index] = true;
                        updateAssignment(index, { plannedPrimaryEmployeeId: value, ...(!actualPrimaryOverridden.current[index] ? { actualPrimaryEmployeeId: value } : {}) });
                      }}>
                        <option value="" disabled={initialValues.isNew}>{assignment.plannedPrimaryDisplayName && !assignment.plannedPrimaryEmployeeId ? `Historical: ${assignment.plannedPrimaryDisplayName} (not linked)` : "Select employee"}</option>
                        {employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.plannedPrimaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {disabledValue("plannedPrimaryEmployeeId", assignment.plannedPrimaryEmployeeId ?? "", inactive)}
                      <FieldError id={errorId("plannedPrimaryEmployeeId")} message={error("plannedPrimaryEmployeeId")} />
                    </label>

                    <label>
                      <span>Actual primary</span>
                      <select disabled={inactive} aria-describedby={describedBy("actualPrimaryEmployeeId")} aria-invalid={Boolean(error("actualPrimaryEmployeeId"))} name="actualPrimaryEmployeeId" value={assignment.actualPrimaryEmployeeId ?? ""} onChange={(event) => {
                        actualPrimaryOverridden.current[index] = true;
                        updateAssignment(index, { actualPrimaryEmployeeId: event.target.value });
                      }}>
                        <option value="" disabled={initialValues.isNew}>{assignment.actualPrimaryDisplayName && !assignment.actualPrimaryEmployeeId ? `Historical: ${assignment.actualPrimaryDisplayName} (not linked)` : "Select employee"}</option>
                        {employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.actualPrimaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {disabledValue("actualPrimaryEmployeeId", assignment.actualPrimaryEmployeeId ?? "", inactive)}
                      <FieldError id={errorId("actualPrimaryEmployeeId")} message={error("actualPrimaryEmployeeId")} />
                    </label>

                    <label>
                      <span>Planned partner</span>
                      <select disabled={inactive} aria-describedby={describedBy("plannedPartnerEmployeeId")} aria-invalid={Boolean(error("plannedPartnerEmployeeId"))} name="plannedPartnerEmployeeId" value={assignment.plannedPartnerEmployeeId ?? ""} onChange={(event) => {
                        const value = event.target.value;
                        updateAssignment(index, { plannedPartnerEmployeeId: value, ...(!actualPartnerOverridden.current[index] ? { actualPartnerEmployeeId: value } : {}) });
                      }}>
                        <option value="">{assignment.plannedPartnerDisplayName && !assignment.plannedPartnerEmployeeId ? `Historical: ${assignment.plannedPartnerDisplayName} (not linked)` : "Select partner (optional)"}</option>
                        {employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.plannedPartnerEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {disabledValue("plannedPartnerEmployeeId", assignment.plannedPartnerEmployeeId ?? "", inactive)}
                      <FieldError id={errorId("plannedPartnerEmployeeId")} message={error("plannedPartnerEmployeeId")} />
                    </label>

                    <label>
                      <span>Actual partner</span>
                      <select disabled={inactive} aria-describedby={describedBy("actualPartnerEmployeeId")} aria-invalid={Boolean(error("actualPartnerEmployeeId"))} name="actualPartnerEmployeeId" value={assignment.actualPartnerEmployeeId ?? ""} onChange={(event) => {
                        actualPartnerOverridden.current[index] = true;
                        updateAssignment(index, { actualPartnerEmployeeId: event.target.value });
                      }}>
                        <option value="">{assignment.actualPartnerDisplayName && !assignment.actualPartnerEmployeeId ? `Historical: ${assignment.actualPartnerDisplayName} (not linked)` : "Select partner (optional)"}</option>
                        {employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.actualPartnerEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      {disabledValue("actualPartnerEmployeeId", assignment.actualPartnerEmployeeId ?? "", inactive)}
                      <FieldError id={errorId("actualPartnerEmployeeId")} message={error("actualPartnerEmployeeId")} />
                    </label>

                    <label className="checkbox-row">
                      <input disabled={inactive} aria-describedby={describedBy("plannedPartnerUnknown")} aria-invalid={Boolean(error("plannedPartnerUnknown"))} name={`plannedPartnerUnknown-${index}`} type="checkbox" checked={Boolean(assignment.plannedPartnerUnknown)} onChange={(event) => {
                        const checked = event.target.checked;
                        updateAssignment(index, { plannedPartnerUnknown: checked, ...(!actualPartnerOverridden.current[index] ? { actualPartnerUnknown: checked } : {}) });
                      }} />
                      {inactive && assignment.plannedPartnerUnknown ? <input type="hidden" name={`plannedPartnerUnknown-${index}`} value="on" /> : null}
                      <span>Planned partner unknown</span>
                      <FieldError id={errorId("plannedPartnerUnknown")} message={error("plannedPartnerUnknown")} />
                    </label>

                    <label className="checkbox-row">
                      <input disabled={inactive} aria-describedby={describedBy("actualPartnerUnknown")} aria-invalid={Boolean(error("actualPartnerUnknown"))} name={`actualPartnerUnknown-${index}`} type="checkbox" checked={Boolean(assignment.actualPartnerUnknown)} onChange={(event) => {
                        actualPartnerOverridden.current[index] = true;
                        updateAssignment(index, { actualPartnerUnknown: event.target.checked });
                      }} />
                      {inactive && assignment.actualPartnerUnknown ? <input type="hidden" name={`actualPartnerUnknown-${index}`} value="on" /> : null}
                      <span>Actual partner unknown</span>
                      <FieldError id={errorId("actualPartnerUnknown")} message={error("actualPartnerUnknown")} />
                    </label>
                  </div>

                  <label className={cancelled ? "full-width-field work-schedule-inactive-exception" : "full-width-field"}>
                    <span>Change reason</span>
                    <textarea disabled={nonWorking} aria-describedby={describedBy("changeReason")} aria-invalid={Boolean(error("changeReason"))} name="changeReason" rows={2} value={assignment.changeReason ?? ""} onChange={(event) => updateAssignment(index, { changeReason: event.target.value })} />
                    {disabledValue("changeReason", assignment.changeReason ?? "", nonWorking)}
                    <FieldError id={errorId("changeReason")} message={error("changeReason")} />
                  </label>

                  <div className="form-grid">
                    <label>
                      <span>Planned notes</span>
                      <textarea disabled={inactive} aria-describedby={describedBy("plannedNotes")} aria-invalid={Boolean(error("plannedNotes"))} name="plannedNotes" rows={2} value={assignment.plannedNotes ?? ""} onChange={(event) => updateAssignment(index, { plannedNotes: event.target.value })} />
                      {disabledValue("plannedNotes", assignment.plannedNotes ?? "", inactive)}
                      <FieldError id={errorId("plannedNotes")} message={error("plannedNotes")} />
                    </label>
                    <label>
                      <span>Actual notes</span>
                      <textarea disabled={inactive} aria-describedby={describedBy("actualNotes")} aria-invalid={Boolean(error("actualNotes"))} name="actualNotes" rows={2} value={assignment.actualNotes ?? ""} onChange={(event) => updateAssignment(index, { actualNotes: event.target.value })} />
                      {disabledValue("actualNotes", assignment.actualNotes ?? "", inactive)}
                      <FieldError id={errorId("actualNotes")} message={error("actualNotes")} />
                    </label>
                  </div>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>Cancel</a>
        <button className="button primary" type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
