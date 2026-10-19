"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  getWorkScheduleAssignmentsForEmployeeAction,
  saveWeeklyTimesheetAction,
} from "./actions";
import {
  buildPayrollWeekDates,
  buildTimesheetPreview,
  formatMinutes,
  parseDateOnly,
} from "./calculations";
import {
  allocationClipboardPayload,
  dayClipboardPayload,
  parseTimesheetClipboard,
  timesheetClipboardKey,
} from "./clipboard";
import { dayLabels } from "./constants";
import type {
  DailyTimeEntryInput,
  TimesheetAllocationInput,
  TimesheetClipboardPayload,
  TimesheetFormOptions,
  TimesheetLeaveEntryInput,
  WeeklyTimesheetInput,
} from "./types";
import { emptyTimesheetFormState } from "./types";

type DayState = DailyTimeEntryInput & {
  enabled: boolean;
  leaveEnabled: boolean;
  leaveRequestedMinutes: number;
  leaveWorkScheduleDailyAssignmentId: string;
  leaveNotes: string;
};
type ReferenceOption = { id: string; label: string; active: boolean };

function SearchableReferenceSelect({
  label,
  options,
  value,
  onChange,
  optional = false,
  error,
}: {
  label: string;
  options: ReferenceOption[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter(
    (item) => item.id === value || item.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <label>
      <span>{label}</span>
      <input aria-label={`Search ${label}`} placeholder={`Search ${label}`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{optional ? `No ${label}` : `Select ${label}`}</option>
        {filtered.map((item) => <option disabled={!item.active && item.id !== value} key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <FieldError message={error} />
    </label>
  );
}

function SearchableSupportPersonnel({
  options,
  selected,
  onChange,
  error,
}: {
  options: ReferenceOption[];
  selected: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter(
    (item) => selected.includes(item.id) || item.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <fieldset className="reference-picker">
      <legend>Support Personnel</legend>
      <input aria-label="Search Support Personnel" placeholder="Search Support Personnel" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="reference-picker-options">
        {filtered.map((item) => (
          <label className="checkbox-field" key={item.id}>
            <input
              checked={selected.includes(item.id)}
              disabled={!item.active && !selected.includes(item.id)}
              type="checkbox"
              onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
            />
            <span>{item.label}{!item.active ? " (Inactive)" : ""}</span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error" role="alert">{message}</span> : null;
}

function allocationStatus(differenceMinutes: number) {
  if (differenceMinutes === 0) return "Balanced";
  return differenceMinutes > 0
    ? `${formatMinutes(differenceMinutes)} remaining`
    : `${formatMinutes(Math.abs(differenceMinutes))} overallocated`;
}

function weeklyAllocationStatus(preview: ReturnType<typeof buildTimesheetPreview>) {
  if (preview.balanced) return "Balanced";
  if (preview.allocationDifferenceMinutes === 0) return "Daily entries unbalanced";
  return allocationStatus(preview.allocationDifferenceMinutes);
}

function emptyAllocation(sequence: number): TimesheetAllocationInput {
  return { sequence, workCodeId: "", workOrderId: "", allocatedMinutes: 0, supportPersonIds: [], notes: "" };
}

function buildDays(initial: WeeklyTimesheetInput) {
  const existing = new Map(initial.entries.map((entry) => [entry.workDate, entry]));
  const existingLeave = new Map(initial.leaveEntries.map((entry) => [entry.workDate, entry]));
  return buildPayrollWeekDates(parseDateOnly(initial.payrollWeekStartDate)).map((workDate) => ({
    workDate,
    clockIn: existing.get(workDate)?.clockIn ?? "07:00",
    clockOut: existing.get(workDate)?.clockOut ?? "19:00",
    unpaidBreakMinutes: existing.get(workDate)?.unpaidBreakMinutes ?? 30,
    primaryEquipmentId: existing.get(workDate)?.primaryEquipmentId ?? "",
    workScheduleDailyAssignmentId: existing.get(workDate)?.workScheduleDailyAssignmentId ?? "",
    notes: existing.get(workDate)?.notes ?? "",
    allocations: existing.get(workDate)?.allocations ?? [],
    enabled: existing.has(workDate),
    leaveEnabled: existingLeave.has(workDate),
    leaveRequestedMinutes: existingLeave.get(workDate)?.requestedMinutes ?? 720,
    leaveWorkScheduleDailyAssignmentId:
      existingLeave.get(workDate)?.workScheduleDailyAssignmentId ?? "",
    leaveNotes: existingLeave.get(workDate)?.notes ?? "",
  }));
}

export function TimesheetForm({
  timesheetId,
  initial,
  options,
}: {
  timesheetId: string | null;
  initial: WeeklyTimesheetInput;
  options: TimesheetFormOptions;
}) {
  const [state, action, pending] = useActionState(
    saveWeeklyTimesheetAction.bind(null, timesheetId),
    emptyTimesheetFormState,
  );
  const [weekStart, setWeekStart] = useState(initial.payrollWeekStartDate);
  const [employeeId, setEmployeeId] = useState(initial.primaryEmployeeId ?? "");
  const [days, setDays] = useState<DayState[]>(() => buildDays(initial));
  const [scheduleAssignments, setScheduleAssignments] = useState(options.scheduleAssignments);
  const [loadingScheduleAssignments, startScheduleAssignmentLoad] = useTransition();
  const scheduleLoadGeneration = useRef(0);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set([...initial.entries, ...initial.leaveEntries].map((entry) => entry.workDate)),
  );
  const [clipboard, setClipboard] = useState<TimesheetClipboardPayload | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  const activeEntries = days.filter((day) => day.enabled).map((day) => ({
    workDate: day.workDate,
    clockIn: day.clockIn,
    clockOut: day.clockOut,
    unpaidBreakMinutes: day.unpaidBreakMinutes,
    primaryEquipmentId: day.primaryEquipmentId,
    workScheduleDailyAssignmentId: day.workScheduleDailyAssignmentId,
    notes: day.notes,
    allocations: day.allocations,
  }));
  const activeLeaveEntries: TimesheetLeaveEntryInput[] = days
    .filter((day) => day.leaveEnabled)
    .map((day) => ({
      workDate: day.workDate,
      leaveType: "FTO",
      requestedMinutes: day.leaveRequestedMinutes,
      workScheduleDailyAssignmentId: day.leaveWorkScheduleDailyAssignmentId,
      notes: day.leaveNotes,
    }));
  const preview = buildTimesheetPreview(activeEntries);
  const previewByDate = new Map(preview.entries.map((entry) => [entry.workDate, entry]));
  const payload = useMemo(
    () => JSON.stringify({ payrollWeekStartDate: weekStart, primaryEmployeeId: employeeId, primaryEmployeeDisplayName: initial.primaryEmployeeDisplayName, entries: activeEntries, leaveEntries: activeLeaveEntries }),
    [weekStart, employeeId, initial.primaryEmployeeDisplayName, activeEntries, activeLeaveEntries],
  );

  useEffect(() => {
    setClipboard(
      employeeId
        ? parseTimesheetClipboard(
            window.sessionStorage.getItem(timesheetClipboardKey(employeeId)),
          )
        : null,
    );
  }, [employeeId]);

  useEffect(() => {
    const generation = ++scheduleLoadGeneration.current;
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      if (!timesheetId || employeeId) setScheduleAssignments([]);
      return;
    }
    startScheduleAssignmentLoad(async () => {
      const assignments = await getWorkScheduleAssignmentsForEmployeeAction(
        employeeId,
        weekStart,
        timesheetId,
      );
      if (generation !== scheduleLoadGeneration.current) return;
      setScheduleAssignments(assignments);
      setDays((current) => current.map((day) => {
        if (day.workScheduleDailyAssignmentId) return day;
        const eligible = assignments.filter(
          (assignment) => assignment.workDate === day.workDate && assignment.selectable,
        );
        return eligible.length === 1
          ? { ...day, workScheduleDailyAssignmentId: eligible[0].id }
          : day;
      }));
    });
    return () => {
      if (generation === scheduleLoadGeneration.current) scheduleLoadGeneration.current += 1;
    };
  }, [employeeId, timesheetId, weekStart]);

  function updateDay(index: number, patch: Partial<DayState>) {
    setDays((current) => current.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)));
  }

  function updateAllocation(dayIndex: number, allocationIndex: number, patch: Partial<TimesheetAllocationInput>) {
    const allocations = days[dayIndex].allocations.map((item, index) =>
      index === allocationIndex ? { ...item, ...patch } : item,
    );
    updateDay(dayIndex, { allocations });
  }

  function storeClipboard(payload: TimesheetClipboardPayload, message: string) {
    if (!employeeId) {
      setCopyMessage("Select the employee before copying Timesheet entries.");
      return;
    }
    window.sessionStorage.setItem(
      timesheetClipboardKey(employeeId),
      JSON.stringify(payload),
    );
    setClipboard(payload);
    setCopyMessage(message);
  }

  function copyDay(day: DayState) {
    const workedEntry = day.enabled
      ? {
          workDate: day.workDate,
          clockIn: day.clockIn,
          clockOut: day.clockOut,
          unpaidBreakMinutes: day.unpaidBreakMinutes,
          primaryEquipmentId: day.primaryEquipmentId,
          workScheduleDailyAssignmentId: day.workScheduleDailyAssignmentId,
          notes: day.notes,
          allocations: day.allocations,
        }
      : undefined;
    const leaveEntry = day.leaveEnabled
      ? {
          workDate: day.workDate,
          leaveType: "FTO" as const,
          requestedMinutes: day.leaveRequestedMinutes,
          workScheduleDailyAssignmentId: day.leaveWorkScheduleDailyAssignmentId,
          notes: day.leaveNotes,
        }
      : undefined;
    if (!workedEntry && !leaveEntry) {
      setCopyMessage("There is nothing to copy from this day.");
      return;
    }
    storeClipboard(
      dayClipboardPayload(day.workDate, workedEntry, leaveEntry),
      `Copied ${day.workDate}. Choose an empty destination day and review before saving.`,
    );
  }

  function pasteDay(dayIndex: number) {
    const destination = days[dayIndex];
    if (!clipboard || clipboard.kind !== "DAY") return;
    if (destination.enabled || destination.leaveEnabled) {
      setCopyMessage("Paste stopped: the destination day already contains worked time or FTO.");
      return;
    }
    updateDay(dayIndex, {
      ...(clipboard.workedEntry
        ? {
            enabled: true,
            ...clipboard.workedEntry,
            workScheduleDailyAssignmentId: "",
            allocations: clipboard.workedEntry.allocations.map((item, index) => ({
              ...item,
              sequence: index + 1,
              supportPersonIds: [...item.supportPersonIds],
            })),
          }
        : {}),
      ...(clipboard.leaveEntry
        ? {
            leaveEnabled: true,
            leaveRequestedMinutes: clipboard.leaveEntry.requestedMinutes,
            leaveWorkScheduleDailyAssignmentId: "",
            leaveNotes: clipboard.leaveEntry.notes ?? "",
          }
        : {}),
    });
    setDayExpanded(destination.workDate, true);
    setCopyMessage(
      `Pasted into ${destination.workDate}. The destination date is retained; schedule links, approval, and payment state were not copied. Review before Save Draft.`,
    );
  }

  function pasteAllocation(dayIndex: number) {
    if (!clipboard || clipboard.kind !== "ALLOCATION" || !clipboard.allocation) return;
    const day = days[dayIndex];
    if (!day.enabled) {
      setCopyMessage("Enable worked time on the destination day before pasting an allocation.");
      return;
    }
    updateDay(dayIndex, {
      allocations: [
        ...day.allocations,
        {
          ...clipboard.allocation,
          sequence: day.allocations.length + 1,
          supportPersonIds: [...clipboard.allocation.supportPersonIds],
        },
      ],
    });
    setCopyMessage(`Pasted one allocation into ${day.workDate}. Review it before Save Draft.`);
  }

  function applyFullShiftAllocation(dayIndex: number) {
    const day = days[dayIndex];
    const workedMinutes = previewByDate.get(day.workDate)?.workedMinutes ?? 0;
    if (day.allocations.length > 1) {
      setCopyMessage("Multiple allocations were preserved. Full-shift allocation does not collapse PM or mixed-work rows.");
      return;
    }
    if (day.allocations.length === 1) {
      updateAllocation(dayIndex, 0, { allocatedMinutes: workedMinutes });
      setCopyMessage(`Updated the single allocation to ${formatMinutes(workedMinutes)}. Review before saving.`);
      return;
    }
    const mappedCodes = options.workCodes.filter(
      (item) => item.active && item.equipmentId === day.primaryEquipmentId,
    );
    const workCodeId = mappedCodes.length === 1 ? mappedCodes[0].id : "";
    updateDay(dayIndex, {
      allocations: [{
        ...emptyAllocation(1),
        workCodeId,
        allocatedMinutes: workedMinutes,
      }],
    });
    setCopyMessage(
      mappedCodes.length === 1
        ? `Created one full-shift allocation using the Equipment-linked Work Code. Review before saving.`
        : `Created one full-shift allocation. Select the correct Work Code; no unique Equipment mapping was guessed.`,
    );
  }

  function changeWeek(value: string) {
    const changed = value !== weekStart;
    if (changed) {
      scheduleLoadGeneration.current += 1;
      setScheduleAssignments([]);
    }
    setWeekStart(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const dates = buildPayrollWeekDates(parseDateOnly(value));
      setDays((current) => current.map((day, index) => ({
        ...day,
        workDate: dates[index],
        workScheduleDailyAssignmentId: changed ? "" : day.workScheduleDailyAssignmentId,
        leaveWorkScheduleDailyAssignmentId: changed
          ? ""
          : day.leaveWorkScheduleDailyAssignmentId,
      })));
      setExpandedDates(new Set());
    }
  }

  function setDayExpanded(workDate: string, expanded: boolean) {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (expanded) next.add(workDate);
      else next.delete(workDate);
      return next;
    });
  }

  function fieldError(entryIndex: number, field: string) {
    return state.fieldErrors[`entries.${entryIndex}.${field}`]?.[0];
  }

  function allocationError(entryIndex: number, allocationIndex: number, field: string) {
    return state.fieldErrors[`entries.${entryIndex}.allocations.${allocationIndex}.${field}`]?.[0];
  }


  function leaveError(leaveIndex: number, field: string) {
    return state.fieldErrors[`leaveEntries.${leaveIndex}.${field}`]?.[0];
  }

  return (
    <form action={action} className="form-stack">
      <input name="payload" type="hidden" value={payload} />
      {state.status === "error" ? (
        <div className="form-message error" role="alert">
          <strong>{state.message}</strong>
          {Object.values(state.fieldErrors).flat().map((message, index) => <span key={`${message}-${index}`}>{message}</span>)}
        </div>
      ) : null}
      {copyMessage ? (
        <div className="form-message" role="status">{copyMessage}</div>
      ) : null}

      <section className="panel form-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Payroll Week</p>
            <h2>Weekly Timesheet</h2>
          </div>
          <div className="inline-actions">
            <Link className="button secondary" href="/timesheets/work-codes">Work Codes</Link>
            <Link className="button secondary" href="/timesheets/work-orders">Work Orders</Link>
            <Link className="button secondary" href="/timesheets/support-personnel">Support Personnel</Link>
          </div>
        </div>
        <div className="form-grid two-column">
          <label>
            <span>Week starting Monday</span>
            <input type="date" value={weekStart} onChange={(event) => changeWeek(event.target.value)} required />
          </label>
          <div className="form-stack">
            <label>
              <span>Primary employee</span>
              {timesheetId && !initial.primaryEmployeeId ? (
                <span className="form-message error">Historical identity: {initial.primaryEmployeeDisplayName}. Employee association is unresolved and will not be guessed.</span>
              ) : (
                <select
                  aria-invalid={Boolean(state.fieldErrors.primaryEmployeeId?.[0])}
                  disabled={Boolean(timesheetId)}
                  value={employeeId}
                  onChange={(event) => {
                    scheduleLoadGeneration.current += 1;
                    setEmployeeId(event.target.value);
                    setScheduleAssignments([]);
                    setDays((current) => current.map((day) => ({ ...day, workScheduleDailyAssignmentId: "" })));
                  }}
                  required
                >
                  <option value="">Select employee</option>
                  {options.employees.map((employee) => <option disabled={!employee.active && employee.id !== employeeId} key={employee.id} value={employee.id}>{employee.label}</option>)}
                </select>
              )}
              <FieldError message={state.fieldErrors.primaryEmployeeId?.[0]} />
            </label>
            {loadingScheduleAssignments ? <span className="subtle">Loading Work Schedule context...</span> : null}
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="timesheet-preview-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Display Preview</p>
            <h2 id="timesheet-preview-heading">Weekly totals</h2>
          </div>
          <span className={`count-pill ${preview.balanced ? "" : "warning"}`}>
            {weeklyAllocationStatus(preview)}
          </span>
        </div>
        <dl className="meta-list timesheet-total-grid">
          <dt>Worked</dt><dd>{formatMinutes(preview.workedMinutes)}</dd>
          <dt>Regular</dt><dd>{formatMinutes(preview.regularMinutes)}</dd>
          <dt>Overtime</dt><dd>{formatMinutes(preview.overtimeMinutes)}</dd>
          <dt>Allocated</dt><dd>{formatMinutes(preview.allocatedMinutes)}</dd>
          <dt>FTO requested</dt><dd>{formatMinutes(activeLeaveEntries.reduce((sum, entry) => sum + entry.requestedMinutes, 0))}</dd>
        </dl>
        <p className="subtle">FTO is separate from worked, regular, overtime, and allocated minutes. Preview only; server validation recalculates authoritative worked-time totals when saved.</p>
      </section>

      <section className="timesheet-week" aria-label="Daily Time Entries">
        {days.map((day, dayIndex) => {
          const entryIndex = activeEntries.findIndex((entry) => entry.workDate === day.workDate);
          const leaveIndex = activeLeaveEntries.findIndex((entry) => entry.workDate === day.workDate);
          const dayPreview = previewByDate.get(day.workDate);
          const dayErrors = entryIndex >= 0
            ? Object.entries(state.fieldErrors).filter(([key]) => key.startsWith(`entries.${entryIndex}.`))
            : [];
          const leaveErrors = leaveIndex >= 0
            ? Object.entries(state.fieldErrors).filter(([key]) => key.startsWith(`leaveEntries.${leaveIndex}.`))
            : [];
          return (
            <details
              className="panel timesheet-day"
              key={day.workDate}
              open={expandedDates.has(day.workDate)}
              onToggle={(event) => setDayExpanded(day.workDate, event.currentTarget.open)}
            >
              <summary>
                <span><strong>{dayLabels[dayIndex]}</strong><span className="subtle">{day.workDate}</span></span>
                <span className="subtle">
                  {day.enabled && dayPreview
                    ? `${formatMinutes(dayPreview.workedMinutes)} worked · ${allocationStatus(dayPreview.allocationDifferenceMinutes)}${day.leaveEnabled ? ` · ${formatMinutes(day.leaveRequestedMinutes)} FTO requested` : ""}`
                    : day.leaveEnabled
                      ? `${formatMinutes(day.leaveRequestedMinutes)} FTO requested`
                      : "No entry"}
                </span>
              </summary>
              <div className="form-stack">
                <div className="inline-actions">
                  <button className="button secondary" type="button" onClick={() => copyDay(day)}>Copy day</button>
                  {clipboard?.kind === "DAY" ? (
                    <button className="button secondary" type="button" onClick={() => pasteDay(dayIndex)}>Paste day</button>
                  ) : null}
                </div>
                {dayErrors.length > 0 ? (
                  <div className="form-message error" role="alert">
                    <strong>Check {dayLabels[dayIndex]}.</strong>
                    {[...new Set(dayErrors.flatMap(([, messages]) => messages))].map((message) => <span key={message}>{message}</span>)}
                  </div>
                ) : null}
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) => {
                      updateDay(dayIndex, { enabled: event.target.checked });
                      if (event.target.checked) setDayExpanded(day.workDate, true);
                    }}
                  />
                  <span>Record worked time for this day</span>
                </label>
                {day.enabled ? (
                  <>
                    {dayPreview ? (
                      <div className="timesheet-day-preview" aria-label={`${dayLabels[dayIndex]} calculation preview`}>
                        <span>Gross <strong>{formatMinutes(dayPreview.grossMinutes)}</strong></span>
                        <span>Worked <strong>{formatMinutes(dayPreview.workedMinutes)}</strong></span>
                        <span>Regular <strong>{formatMinutes(dayPreview.regularMinutes)}</strong></span>
                        <span>Overtime <strong>{formatMinutes(dayPreview.overtimeMinutes)}</strong></span>
                        <span>Allocated <strong>{formatMinutes(dayPreview.allocatedMinutes)}</strong></span>
                        <span className={dayPreview.balanced ? "balance-good" : "balance-warning"}>
                          {allocationStatus(dayPreview.allocationDifferenceMinutes)}
                        </span>
                      </div>
                    ) : null}
                    <div className="form-grid four-column">
                      <label><span>Clock in</span><input type="time" value={day.clockIn} onChange={(event) => updateDay(dayIndex, { clockIn: event.target.value })} /><FieldError message={fieldError(entryIndex, "clockIn")} /></label>
                      <label><span>Clock out</span><input type="time" value={day.clockOut} onChange={(event) => updateDay(dayIndex, { clockOut: event.target.value })} /><FieldError message={fieldError(entryIndex, "clockOut")} /></label>
                      <label><span>Unpaid break (minutes)</span><input type="number" min="0" max="1439" value={day.unpaidBreakMinutes} onChange={(event) => updateDay(dayIndex, { unpaidBreakMinutes: Number(event.target.value) })} /><FieldError message={fieldError(entryIndex, "unpaidBreakMinutes")} /></label>
                      <label>
                        <span>Primary equipment</span>
                        <select value={day.primaryEquipmentId} onChange={(event) => updateDay(dayIndex, { primaryEquipmentId: event.target.value })} required>
                          <option value="">Select equipment</option>
                          {options.equipment.map((item) => <option disabled={!item.active && item.id !== day.primaryEquipmentId} key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                        <FieldError message={fieldError(entryIndex, "primaryEquipmentId")} />
                      </label>
                    </div>
                    <div className="form-grid two-column">
                      <label>
                        <span>Work Schedule context (optional)</span>
                        <select value={day.workScheduleDailyAssignmentId ?? ""} onChange={(event) => updateDay(dayIndex, { workScheduleDailyAssignmentId: event.target.value })}>
                          <option value="">No linked assignment</option>
                          {scheduleAssignments
                            .filter((item) => item.workDate === day.workDate || item.id === day.workScheduleDailyAssignmentId)
                            .map((item) => <option disabled={!item.selectable && item.id !== day.workScheduleDailyAssignmentId} key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                        <FieldError message={fieldError(entryIndex, "workScheduleDailyAssignmentId")} />
                        {scheduleAssignments.some((item) => item.workDate === day.workDate && item.selectable)
                          ? null
                          : <span className="subtle">No eligible scheduled assignment. Unscheduled work is allowed.</span>}
                        {scheduleAssignments.find((item) => item.id === day.workScheduleDailyAssignmentId)?.warning
                          ? <span className="form-message error">{scheduleAssignments.find((item) => item.id === day.workScheduleDailyAssignmentId)?.warning} The historical link will be preserved unless you clear it.</span>
                          : null}
                      </label>
                      <label><span>Daily notes</span><input value={day.notes ?? ""} onChange={(event) => updateDay(dayIndex, { notes: event.target.value })} maxLength={1000} /><FieldError message={fieldError(entryIndex, "notes")} /></label>
                    </div>

                    <div className="section-heading">
                      <div><h3>Work Allocations</h3><span className="subtle">Ordered accounting for the day</span></div>
                      <div className="inline-actions">
                        <button className="button secondary" type="button" onClick={() => applyFullShiftAllocation(dayIndex)}>Use full shift</button>
                        {clipboard?.kind === "ALLOCATION" ? <button className="button secondary" type="button" onClick={() => pasteAllocation(dayIndex)}>Paste allocation</button> : null}
                        <button className="button secondary" type="button" onClick={() => updateDay(dayIndex, { allocations: [...day.allocations, emptyAllocation(day.allocations.length + 1)] })}>Add allocation</button>
                      </div>
                    </div>
                    <p className="subtle">Use full shift creates or updates one allocation for the complete worked duration. A unique Equipment-linked Work Code is preferred; missing or ambiguous mappings are never guessed. Multiple PM or mixed-work allocations are preserved.</p>
                    {day.allocations.length === 0 ? <div className="empty-state"><p>No allocations yet. Drafts may remain unbalanced.</p></div> : null}
                    {day.allocations.map((allocation, allocationIndex) => (
                      <div className="allocation-row" key={`${day.workDate}-${allocation.sequence}-${allocationIndex}`}>
                        <div className="form-grid four-column">
                          <label><span>Sequence</span><input type="number" min="1" value={allocation.sequence} onChange={(event) => updateAllocation(dayIndex, allocationIndex, { sequence: Number(event.target.value) })} /><FieldError message={allocationError(entryIndex, allocationIndex, "sequence")} /></label>
                          <SearchableReferenceSelect error={allocationError(entryIndex, allocationIndex, "workCodeId")} label="Work Code" options={options.workCodes} value={allocation.workCodeId} onChange={(value) => updateAllocation(dayIndex, allocationIndex, { workCodeId: value })} />
                          <SearchableReferenceSelect error={allocationError(entryIndex, allocationIndex, "workOrderId")} label="Work Order" optional options={options.workOrders} value={allocation.workOrderId ?? ""} onChange={(value) => updateAllocation(dayIndex, allocationIndex, { workOrderId: value })} />
                          <label><span>Allocated minutes</span><input type="number" min="1" value={allocation.allocatedMinutes} onChange={(event) => updateAllocation(dayIndex, allocationIndex, { allocatedMinutes: Number(event.target.value) })} /><FieldError message={allocationError(entryIndex, allocationIndex, "allocatedMinutes")} /></label>
                        </div>
                        <div className="form-grid two-column">
                          <SearchableSupportPersonnel error={allocationError(entryIndex, allocationIndex, "supportPersonIds")} options={options.supportPersonnel} selected={allocation.supportPersonIds} onChange={(value) => updateAllocation(dayIndex, allocationIndex, { supportPersonIds: value })} />
                          <label><span>Allocation notes</span><textarea value={allocation.notes ?? ""} onChange={(event) => updateAllocation(dayIndex, allocationIndex, { notes: event.target.value })} rows={2} /><FieldError message={allocationError(entryIndex, allocationIndex, "notes")} /></label>
                        </div>
                        <button className="button secondary" type="button" onClick={() => updateDay(dayIndex, { allocations: day.allocations.filter((_, index) => index !== allocationIndex).map((item, index) => ({ ...item, sequence: index + 1 })) })}>Remove allocation</button>
                        <button className="button secondary" type="button" onClick={() => storeClipboard(allocationClipboardPayload(day.workDate, allocation), `Copied allocation ${allocation.sequence} from ${day.workDate}.`)}>Copy allocation</button>
                      </div>
                    ))}
                  </>
                ) : null}

                <div className="timesheet-leave-entry">
                  {leaveErrors.length > 0 ? (
                    <div className="form-message error" role="alert">
                      {[...new Set(leaveErrors.flatMap(([, messages]) => messages))].map((message) => <span key={message}>{message}</span>)}
                    </div>
                  ) : null}
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={day.leaveEnabled}
                      onChange={(event) => {
                        updateDay(dayIndex, { leaveEnabled: event.target.checked });
                        if (event.target.checked) setDayExpanded(day.workDate, true);
                      }}
                    />
                    <span>Record an FTO request for this day</span>
                  </label>
                  {day.leaveEnabled ? (
                    <div className="form-stack">
                      <div className="form-message">
                        FTO is recorded as requested leave only. It is not approved or confirmed paid, and it does not count as worked or overtime time.
                      </div>
                      <div className="form-grid two-column">
                        <label>
                          <span>Requested FTO minutes</span>
                          <input type="number" min="1" max="1440" value={day.leaveRequestedMinutes} onChange={(event) => updateDay(dayIndex, { leaveRequestedMinutes: Number(event.target.value) })} />
                          <FieldError message={leaveError(leaveIndex, "requestedMinutes")} />
                        </label>
                        <label>
                          <span>Original Work Schedule context (optional)</span>
                          <select value={day.leaveWorkScheduleDailyAssignmentId} onChange={(event) => updateDay(dayIndex, { leaveWorkScheduleDailyAssignmentId: event.target.value })}>
                            <option value="">No linked assignment</option>
                            {scheduleAssignments
                              .filter((item) => item.workDate === day.workDate || item.id === day.leaveWorkScheduleDailyAssignmentId)
                              .map((item) => <option disabled={!item.leaveSelectable && item.id !== day.leaveWorkScheduleDailyAssignmentId} key={item.id} value={item.id}>{item.label}</option>)}
                          </select>
                          <FieldError message={leaveError(leaveIndex, "workScheduleDailyAssignmentId")} />
                          {scheduleAssignments.find((item) => item.id === day.leaveWorkScheduleDailyAssignmentId)?.leaveWarning
                            ? <span className="form-message error">{scheduleAssignments.find((item) => item.id === day.leaveWorkScheduleDailyAssignmentId)?.leaveWarning} The historical link will be preserved unless you clear it.</span>
                            : null}
                        </label>
                      </div>
                      <label>
                        <span>FTO notes</span>
                        <textarea maxLength={1000} rows={2} value={day.leaveNotes} onChange={(event) => updateDay(dayIndex, { leaveNotes: event.target.value })} />
                        <FieldError message={leaveError(leaveIndex, "notes")} />
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            </details>
          );
        })}
      </section>

      <div className="form-actions">
        <button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save Draft"}</button>
        <Link className="button secondary" href={timesheetId ? `/timesheets/${timesheetId}` : "/timesheets"}>Cancel</Link>
      </div>
    </form>
  );
}
