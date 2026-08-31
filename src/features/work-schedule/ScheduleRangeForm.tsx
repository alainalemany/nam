"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  dailyAssignmentStatusOptions,
  shiftOptions,
  weeklyScheduleStatusOptions,
  type DailyAssignmentStatusValue,
  type ShiftValue,
  type WeeklyScheduleStatusValue,
} from "./constants";
import type {
  ScheduleRangeFormState,
} from "./range-state";
import {
  emptyScheduleRangeFormState,
} from "./range-state";
import { MAX_SCHEDULE_RANGE_DAYS } from "./range-validation";
import type {
  ScheduleRangeFormInitialValues,
  WorkScheduleAssignmentInitialValues,
  WorkScheduleEmployeeOption,
  WorkScheduleSelectOption,
} from "./types";
import { addDays, buildDateRange, dateInputValue, isValidDateOnlyString, parseDateOnly } from "./validation";

type Props = {
  action: (state: ScheduleRangeFormState, data: FormData) => Promise<ScheduleRangeFormState>;
  cancelHref: string;
  employeeOptions: WorkScheduleEmployeeOption[];
  equipmentOptions: WorkScheduleSelectOption[];
  initialValues: ScheduleRangeFormInitialValues;
  supervisorOptions: WorkScheduleEmployeeOption[];
};

type Assignment = WorkScheduleAssignmentInitialValues;

const rangeStatusOptions = dailyAssignmentStatusOptions.map((option) => ({
  ...option,
  label: option.value === "NON_WORKING" ? "Off" : option.label,
}));

function blankAssignment(
  assignmentDate: string,
  dayOfWeek: number,
  primaryEmployeeId: string,
): Assignment {
  return {
    assignmentDate,
    dayOfWeek,
    plannedStatus: "SCHEDULED",
    plannedShift: "UNKNOWN",
    plannedEquipmentId: "",
    actualStatus: "UNKNOWN",
    actualShift: "UNKNOWN",
    actualEquipmentId: "",
    plannedPrimaryEmployeeId: primaryEmployeeId,
    plannedPrimaryDisplayName: "",
    plannedPartnerEmployeeId: "",
    plannedPartnerDisplayName: "",
    plannedPartnerUnknown: false,
    actualPrimaryEmployeeId: "",
    actualPrimaryDisplayName: "",
    actualPartnerEmployeeId: "",
    actualPartnerDisplayName: "",
    actualPartnerUnknown: false,
    changeReason: "",
    plannedNotes: "",
    actualNotes: "",
  };
}

function rowsForRange(
  startDate: string,
  endDate: string,
  existing: Assignment[],
  primaryEmployeeId: string,
) {
  if (!isValidDateOnlyString(startDate) || !isValidDateOnlyString(endDate)) return existing;
  const byDate = new Map(existing.map((assignment) => [assignment.assignmentDate, assignment]));
  return buildDateRange(parseDateOnly(startDate), parseDateOnly(endDate)).map((date) => ({
    ...blankAssignment(date.assignmentDate, date.dayOfWeek, primaryEmployeeId),
    ...byDate.get(date.assignmentDate),
    ...date,
  }));
}

function displayRangeDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseDateOnly(value)).replace(",", "");
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={id}>{message}</p> : null;
}

function hiddenWhenDisabled(name: string, value: string | number, disabled: boolean) {
  return disabled ? <input name={name} type="hidden" value={value} /> : null;
}

export function ScheduleRangeForm({
  action,
  cancelHref,
  employeeOptions,
  equipmentOptions,
  initialValues,
  supervisorOptions,
}: Props) {
  const [state, formAction, pending] = useActionState(action, emptyScheduleRangeFormState);
  const [startDate, setStartDate] = useState(initialValues.startDate);
  const [endDate, setEndDate] = useState(initialValues.endDate);
  const [status, setStatus] = useState<WeeklyScheduleStatusValue>(initialValues.status);
  const [primaryEmployeeId, setPrimaryEmployeeId] = useState(initialValues.primaryEmployeeId ?? "");
  const [assignedByEmployeeId, setAssignedByEmployeeId] = useState(initialValues.assignedByEmployeeId ?? "");
  const [receivedAt, setReceivedAt] = useState(initialValues.receivedAt ?? "");
  const [sourceNote, setSourceNote] = useState(initialValues.sourceNote ?? "");
  const [scheduleNotes, setScheduleNotes] = useState(initialValues.scheduleNotes ?? "");
  const [assignments, setAssignments] = useState(() => rowsForRange(
    initialValues.startDate,
    initialValues.endDate,
    initialValues.assignments,
    initialValues.primaryEmployeeId ?? "",
  ));
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);

  const maximumEndDate = useMemo(() => isValidDateOnlyString(startDate)
    ? dateInputValue(addDays(parseDateOnly(startDate), MAX_SCHEDULE_RANGE_DAYS - 1))
    : undefined, [startDate]);

  useEffect(() => {
    const submitted = state.submittedValues;
    if (!submitted) return;
    setStartDate(submitted.startDate);
    setEndDate(submitted.endDate);
    setStatus(submitted.status as WeeklyScheduleStatusValue);
    setPrimaryEmployeeId(submitted.primaryEmployeeId);
    setAssignedByEmployeeId(submitted.assignedByEmployeeId);
    setReceivedAt(submitted.receivedAt);
    setSourceNote(submitted.sourceNote);
    setScheduleNotes(submitted.scheduleNotes);
    setOverwriteConfirmed(false);
    setAssignments(submitted.assignments.map((assignment) => ({
      ...blankAssignment(
        String(assignment.assignmentDate),
        Number(assignment.dayOfWeek),
        submitted.primaryEmployeeId,
      ),
      ...assignment,
      assignmentDate: String(assignment.assignmentDate),
      dayOfWeek: Number(assignment.dayOfWeek),
      plannedStatus: assignment.plannedStatus as DailyAssignmentStatusValue,
      plannedShift: assignment.plannedShift as ShiftValue,
      actualStatus: assignment.actualStatus as DailyAssignmentStatusValue,
      actualShift: assignment.actualShift as ShiftValue,
    })));
  }, [state.submittedValues]);

  const fieldError = (field: string) => state.fieldErrors[field]?.[0];
  const assignmentError = (index: number, field: string) =>
    state.assignmentErrors[index]?.[field]?.[0];
  const updateAssignment = (index: number, update: Partial<Assignment>) =>
    setAssignments((current) => current.map((assignment, currentIndex) =>
      currentIndex === index ? { ...assignment, ...update } : assignment,
    ));
  const rebuildRows = (nextStart: string, nextEnd: string) => {
    if (!isValidDateOnlyString(nextStart) || !isValidDateOnlyString(nextEnd)) return;
    const next = buildDateRange(parseDateOnly(nextStart), parseDateOnly(nextEnd));
    if (next.length > MAX_SCHEDULE_RANGE_DAYS) return;
    setAssignments((current) => rowsForRange(nextStart, nextEnd, current, primaryEmployeeId));
  };
  const changePlannedStatus = (index: number, plannedStatus: DailyAssignmentStatusValue) => {
    if (plannedStatus === "NON_WORKING") {
      updateAssignment(index, {
        plannedStatus,
        plannedShift: "UNKNOWN",
        plannedEquipmentId: "",
        plannedPrimaryEmployeeId: "",
        plannedPartnerEmployeeId: "",
        plannedPartnerUnknown: false,
        plannedNotes: "",
        actualStatus: "NON_WORKING",
        actualShift: "UNKNOWN",
        actualEquipmentId: "",
        actualPrimaryEmployeeId: "",
        actualPartnerEmployeeId: "",
        actualPartnerUnknown: false,
        changeReason: "",
        actualNotes: "",
      });
    } else if (plannedStatus === "CANCELLED") {
      updateAssignment(index, {
        plannedStatus,
        actualStatus: "CANCELLED",
        actualShift: "UNKNOWN",
        actualEquipmentId: "",
        actualPrimaryEmployeeId: "",
        actualPartnerEmployeeId: "",
        actualPartnerUnknown: false,
        actualNotes: "",
      });
    } else {
      updateAssignment(index, { plannedStatus });
    }
  };

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
      {state.status === "conflict" ? (
        <section className="form-alert schedule-conflict" role="alert" aria-labelledby="schedule-conflict-heading">
          <h2 id="schedule-conflict-heading">Existing schedule data found</h2>
          <p>{state.message}</p>
          <p><strong>Affected dates:</strong> {state.conflictDates.join(", ")}</p>
          <label className="confirmation-choice">
            <input
              checked={overwriteConfirmed}
              onChange={(event) => setOverwriteConfirmed(event.target.checked)}
              type="checkbox"
            />
            I reviewed these dates and confirm that their planned assignments may be replaced.
          </label>
        </section>
      ) : null}
      <input name="overwriteConflicts" type="hidden" value={overwriteConfirmed ? "true" : "false"} />

      <section className="form-section" aria-labelledby="schedule-range-heading">
        <h2 id="schedule-range-heading">Schedule range</h2>
        <p className="subtle">Choose up to {MAX_SCHEDULE_RANGE_DAYS} consecutive calendar days. Calendar-week storage is handled automatically.</p>
        <div className="form-grid work-schedule-header-grid">
          <label>
            <span>Start Date</span>
            <input name="startDate" type="date" value={startDate} aria-invalid={Boolean(fieldError("startDate"))} onChange={(event) => {
              const value = event.target.value;
              setStartDate(value);
              let nextEnd = endDate;
              if (isValidDateOnlyString(value) && (!isValidDateOnlyString(endDate) || endDate < value)) {
                nextEnd = value;
                setEndDate(value);
              }
              rebuildRows(value, nextEnd);
            }} />
            <FieldError id="startDate-error" message={fieldError("startDate")} />
          </label>
          <label>
            <span>End Date</span>
            <input name="endDate" type="date" min={startDate} max={maximumEndDate} value={endDate} aria-invalid={Boolean(fieldError("endDate"))} onChange={(event) => {
              setEndDate(event.target.value);
              rebuildRows(startDate, event.target.value);
            }} />
            <FieldError id="endDate-error" message={fieldError("endDate")} />
          </label>
          <label>
            <span>Status</span>
            <select name="status" value={status} onChange={(event) => setStatus(event.target.value as WeeklyScheduleStatusValue)}>
              {weeklyScheduleStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Primary employee</span>
            <select disabled={!initialValues.isNew} name="primaryEmployeeId" value={primaryEmployeeId} aria-invalid={Boolean(fieldError("primaryEmployeeId"))} onChange={(event) => {
              const value = event.target.value;
              setPrimaryEmployeeId(value);
              setAssignments((current) => current.map((assignment) => ({
                ...assignment,
                plannedPrimaryEmployeeId: assignment.plannedPrimaryEmployeeId === primaryEmployeeId
                  ? value
                  : assignment.plannedPrimaryEmployeeId,
              })));
            }}>
              <option value="">Select employee</option>
              {employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== primaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {hiddenWhenDisabled("primaryEmployeeId", primaryEmployeeId, !initialValues.isNew)}
            <FieldError id="primaryEmployeeId-error" message={fieldError("primaryEmployeeId")} />
          </label>
          <label>
            <span>Assigned By</span>
            <select name="assignedByEmployeeId" value={assignedByEmployeeId} aria-invalid={Boolean(fieldError("assignedByEmployeeId"))} onChange={(event) => setAssignedByEmployeeId(event.target.value)}>
              <option value="">Select supervisor</option>
              {supervisorOptions.map((option) => <option disabled={!option.isActive && option.id !== assignedByEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <FieldError id="assignedByEmployeeId-error" message={fieldError("assignedByEmployeeId")} />
          </label>
          <label>
            <span>Received at</span>
            <input name="receivedAt" type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
          </label>
        </div>
        <label className="full-width-field"><span>Source note</span><textarea name="sourceNote" rows={2} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} /></label>
        <label className="full-width-field"><span>Schedule notes</span><textarea name="scheduleNotes" rows={2} value={scheduleNotes} onChange={(event) => setScheduleNotes(event.target.value)} /></label>
      </section>

      <section className="form-section" aria-labelledby="continuous-days-heading">
        <div className="section-heading">
          <div><h2 id="continuous-days-heading">Calendar days</h2><p className="subtle">{assignments.length} continuous {assignments.length === 1 ? "day" : "days"}</p></div>
        </div>
        <FieldError id="assignments-error" message={fieldError("assignments")} />
        <div className="activity-list schedule-range-days">
          {assignments.map((assignment, index) => {
            const off = assignment.plannedStatus === "NON_WORKING";
            const cancelled = assignment.plannedStatus === "CANCELLED";
            const inactive = off || cancelled;
            const error = (field: string) => assignmentError(index, field);
            return (
              <fieldset className={`activity-card work-schedule-day${inactive ? " work-schedule-day--inactive" : ""}${off ? " work-schedule-day--non-working" : ""}${cancelled ? " work-schedule-day--cancelled" : ""}`} key={assignment.assignmentDate}>
                <legend>{displayRangeDay(assignment.assignmentDate)}</legend>
                <input name="assignmentDate" type="hidden" value={assignment.assignmentDate} />
                <input name="dayOfWeek" type="hidden" value={assignment.dayOfWeek} />
                <div className="work-schedule-day-status">
                  <label><span>Planned status</span><select name="plannedStatus" value={assignment.plannedStatus} onChange={(event) => changePlannedStatus(index, event.target.value as DailyAssignmentStatusValue)}>{rangeStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <span className={`schedule-shift-badge schedule-shift-badge--${off ? "off" : assignment.plannedShift.toLowerCase()}`}>{off ? "Off" : shiftOptions.find((option) => option.value === assignment.plannedShift)?.label}</span>
                </div>
                <div className="form-grid">
                  <label><span>Shift</span><select disabled={inactive} name="plannedShift" value={assignment.plannedShift} aria-invalid={Boolean(error("plannedShift"))} onChange={(event) => updateAssignment(index, { plannedShift: event.target.value as ShiftValue })}>{shiftOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{hiddenWhenDisabled("plannedShift", assignment.plannedShift, inactive)}<FieldError id={`range-${index}-shift-error`} message={error("plannedShift")} /></label>
                  <label><span>Equipment</span><select disabled={inactive} name="plannedEquipmentId" value={assignment.plannedEquipmentId ?? ""} aria-invalid={Boolean(error("plannedEquipmentId"))} onChange={(event) => updateAssignment(index, { plannedEquipmentId: event.target.value })}><option value="">No equipment selected</option>{equipmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>{hiddenWhenDisabled("plannedEquipmentId", assignment.plannedEquipmentId ?? "", inactive)}<FieldError id={`range-${index}-equipment-error`} message={error("plannedEquipmentId")} /></label>
                  <label><span>Primary employee</span><select disabled={inactive} name="plannedPrimaryEmployeeId" value={assignment.plannedPrimaryEmployeeId ?? ""} onChange={(event) => updateAssignment(index, { plannedPrimaryEmployeeId: event.target.value })}><option value="">Use schedule employee</option>{employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.plannedPrimaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}</select>{hiddenWhenDisabled("plannedPrimaryEmployeeId", assignment.plannedPrimaryEmployeeId ?? "", inactive)}</label>
                  <label><span>Planned partner</span><select disabled={inactive || Boolean(assignment.plannedPartnerUnknown)} name="plannedPartnerEmployeeId" value={assignment.plannedPartnerEmployeeId ?? ""} onChange={(event) => updateAssignment(index, { plannedPartnerEmployeeId: event.target.value })}><option value="">No planned partner</option>{employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.plannedPartnerEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}</select>{hiddenWhenDisabled("plannedPartnerEmployeeId", assignment.plannedPartnerEmployeeId ?? "", inactive || Boolean(assignment.plannedPartnerUnknown))}</label>
                  <label className="checkbox-row"><input disabled={inactive} name={`plannedPartnerUnknown-${index}`} type="checkbox" checked={Boolean(assignment.plannedPartnerUnknown)} onChange={(event) => updateAssignment(index, { plannedPartnerUnknown: event.target.checked, plannedPartnerEmployeeId: event.target.checked ? "" : assignment.plannedPartnerEmployeeId })} /><span>Planned partner unknown</span></label>
                </div>
                <label className="full-width-field"><span>Planned notes</span><textarea disabled={inactive} name="plannedNotes" rows={2} value={assignment.plannedNotes ?? ""} onChange={(event) => updateAssignment(index, { plannedNotes: event.target.value })} />{hiddenWhenDisabled("plannedNotes", assignment.plannedNotes ?? "", inactive)}</label>

                <details className="schedule-actual-details">
                  <summary>Actual assignment and change details</summary>
                  <div className="form-grid">
                    <label><span>Actual status</span><select disabled={inactive} name="actualStatus" value={assignment.actualStatus} onChange={(event) => updateAssignment(index, { actualStatus: event.target.value as DailyAssignmentStatusValue })}>{rangeStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{hiddenWhenDisabled("actualStatus", assignment.actualStatus, inactive)}</label>
                    <label><span>Actual shift</span><select disabled={inactive} name="actualShift" value={assignment.actualShift} onChange={(event) => updateAssignment(index, { actualShift: event.target.value as ShiftValue })}>{shiftOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{hiddenWhenDisabled("actualShift", assignment.actualShift, inactive)}</label>
                    <label><span>Actual equipment</span><select disabled={inactive} name="actualEquipmentId" value={assignment.actualEquipmentId ?? ""} onChange={(event) => updateAssignment(index, { actualEquipmentId: event.target.value })}><option value="">No equipment selected</option>{equipmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>{hiddenWhenDisabled("actualEquipmentId", assignment.actualEquipmentId ?? "", inactive)}</label>
                    <label><span>Actual primary</span><select disabled={inactive} name="actualPrimaryEmployeeId" value={assignment.actualPrimaryEmployeeId ?? ""} onChange={(event) => updateAssignment(index, { actualPrimaryEmployeeId: event.target.value })}><option value="">Not recorded</option>{employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.actualPrimaryEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}</select>{hiddenWhenDisabled("actualPrimaryEmployeeId", assignment.actualPrimaryEmployeeId ?? "", inactive)}</label>
                    <label><span>Actual partner</span><select disabled={inactive || Boolean(assignment.actualPartnerUnknown)} name="actualPartnerEmployeeId" value={assignment.actualPartnerEmployeeId ?? ""} onChange={(event) => updateAssignment(index, { actualPartnerEmployeeId: event.target.value })}><option value="">Not recorded</option>{employeeOptions.map((option) => <option disabled={!option.isActive && option.id !== assignment.actualPartnerEmployeeId} key={option.id} value={option.id}>{option.label}</option>)}</select>{hiddenWhenDisabled("actualPartnerEmployeeId", assignment.actualPartnerEmployeeId ?? "", inactive || Boolean(assignment.actualPartnerUnknown))}</label>
                    <label className="checkbox-row"><input disabled={inactive} name={`actualPartnerUnknown-${index}`} type="checkbox" checked={Boolean(assignment.actualPartnerUnknown)} onChange={(event) => updateAssignment(index, { actualPartnerUnknown: event.target.checked, actualPartnerEmployeeId: event.target.checked ? "" : assignment.actualPartnerEmployeeId })} /><span>Actual partner unknown</span></label>
                  </div>
                  <label className="full-width-field"><span>Change reason</span><textarea disabled={off} name="changeReason" rows={2} value={assignment.changeReason ?? ""} onChange={(event) => updateAssignment(index, { changeReason: event.target.value })} />{hiddenWhenDisabled("changeReason", assignment.changeReason ?? "", off)}</label>
                  <label className="full-width-field"><span>Actual notes</span><textarea disabled={inactive} name="actualNotes" rows={2} value={assignment.actualNotes ?? ""} onChange={(event) => updateAssignment(index, { actualNotes: event.target.value })} />{hiddenWhenDisabled("actualNotes", assignment.actualNotes ?? "", inactive)}</label>
                </details>
              </fieldset>
            );
          })}
        </div>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>Cancel</a>
        <button className="button primary" disabled={pending || (state.status === "conflict" && !overwriteConfirmed)} type="submit">{pending ? "Saving..." : state.status === "conflict" ? "Confirm and save range" : "Save schedule"}</button>
      </div>
    </form>
  );
}
