"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";

import {
  getWorkScheduleAssignmentsForOwnerAction,
  saveWeeklyTimesheetAction,
} from "./actions";
import {
  buildPayrollWeekDates,
  buildTimesheetPreview,
  formatMinutes,
  normalizeIdentityKey,
  parseDateOnly,
} from "./calculations";
import { dayLabels } from "./constants";
import type {
  DailyTimeEntryInput,
  TimesheetAllocationInput,
  TimesheetFormOptions,
  WeeklyTimesheetInput,
} from "./types";
import { emptyTimesheetFormState } from "./types";

type DayState = DailyTimeEntryInput & { enabled: boolean };
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
      <select value={value} onChange={(event) => onChange(event.target.value)}>
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
  const [employeeName, setEmployeeName] = useState(initial.primaryEmployeeDisplayName);
  const [days, setDays] = useState<DayState[]>(() => buildDays(initial));
  const [scheduleAssignments, setScheduleAssignments] = useState(options.scheduleAssignments);
  const [loadingScheduleAssignments, startScheduleAssignmentLoad] = useTransition();
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set(initial.entries.map((entry) => entry.workDate)),
  );

  const activeEntries = days.filter((day) => day.enabled).map(({ enabled: _enabled, ...entry }) => entry);
  const preview = buildTimesheetPreview(activeEntries);
  const previewByDate = new Map(preview.entries.map((entry) => [entry.workDate, entry]));
  const payload = useMemo(
    () => JSON.stringify({ payrollWeekStartDate: weekStart, primaryEmployeeDisplayName: employeeName, entries: activeEntries }),
    [weekStart, employeeName, activeEntries],
  );

  function updateDay(index: number, patch: Partial<DayState>) {
    setDays((current) => current.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)));
  }

  function updateAllocation(dayIndex: number, allocationIndex: number, patch: Partial<TimesheetAllocationInput>) {
    const allocations = days[dayIndex].allocations.map((item, index) =>
      index === allocationIndex ? { ...item, ...patch } : item,
    );
    updateDay(dayIndex, { allocations });
  }

  function changeWeek(value: string) {
    setWeekStart(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const dates = buildPayrollWeekDates(parseDateOnly(value));
      setDays((current) => current.map((day, index) => ({ ...day, workDate: dates[index] })));
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


  function loadScheduleAssignments() {
    startScheduleAssignmentLoad(async () => {
      setScheduleAssignments(
        await getWorkScheduleAssignmentsForOwnerAction(employeeName),
      );
    });
  }

  function fieldError(entryIndex: number, field: string) {
    return state.fieldErrors[`entries.${entryIndex}.${field}`]?.[0];
  }

  function allocationError(entryIndex: number, allocationIndex: number, field: string) {
    return state.fieldErrors[`entries.${entryIndex}.allocations.${allocationIndex}.${field}`]?.[0];
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
              <input
                value={employeeName}
                onChange={(event) => {
                  setEmployeeName(event.target.value);
                  setScheduleAssignments([]);
                }}
                maxLength={200}
                required
              />
            </label>
            <button
              className="button secondary"
              disabled={!employeeName.trim() || loadingScheduleAssignments}
              type="button"
              onClick={loadScheduleAssignments}
            >
              {loadingScheduleAssignments ? "Loading..." : "Load matching schedule context"}
            </button>
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
        </dl>
        <p className="subtle">Preview only. Server validation recalculates authoritative payroll and reconciliation totals when saved.</p>
      </section>

      <section className="timesheet-week" aria-label="Daily Time Entries">
        {days.map((day, dayIndex) => {
          const entryIndex = activeEntries.findIndex((entry) => entry.workDate === day.workDate);
          const dayPreview = previewByDate.get(day.workDate);
          const dayErrors = entryIndex >= 0
            ? Object.entries(state.fieldErrors).filter(([key]) => key.startsWith(`entries.${entryIndex}.`))
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
                    ? `${formatMinutes(dayPreview.workedMinutes)} worked · ${allocationStatus(dayPreview.allocationDifferenceMinutes)}`
                    : "No entry"}
                </span>
              </summary>
              <div className="form-stack">
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
                            .filter((item) => item.workDate === day.workDate && item.primaryEmployeeKey === normalizeIdentityKey(employeeName))
                            .map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                        <FieldError message={fieldError(entryIndex, "workScheduleDailyAssignmentId")} />
                      </label>
                      <label><span>Daily notes</span><input value={day.notes ?? ""} onChange={(event) => updateDay(dayIndex, { notes: event.target.value })} maxLength={1000} /><FieldError message={fieldError(entryIndex, "notes")} /></label>
                    </div>

                    <div className="section-heading">
                      <div><h3>Work Allocations</h3><span className="subtle">Ordered accounting for the day</span></div>
                      <button className="button secondary" type="button" onClick={() => updateDay(dayIndex, { allocations: [...day.allocations, emptyAllocation(day.allocations.length + 1)] })}>Add allocation</button>
                    </div>
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
                      </div>
                    ))}
                  </>
                ) : null}
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
