"use client";

import { useActionState, useMemo, useState } from "react";

import {
  DRAGLINE_DELAY_CODE_CATALOG_VERSION,
  getDraglineDelayCode,
  groupDraglineDelayCodes,
  searchDraglineDelayCodes,
} from "./catalog";
import { calculateDraglineShiftTotals } from "./calculations";
import { normalizeEventStartTime } from "./time";
import type {
  DraglineDelayReportFormInitialValues,
  DraglineDelayReportOperatorFormRow,
  DraglineDelayReportTimelineFormRow,
  DraglineEmployeeOption,
  DraglineEquipmentOption,
} from "./types";
import {
  emptyDraglineDelayReportActionState,
  type DraglineDelayReportActionState,
} from "./validation";

type Props = {
  action: (
    previousState: DraglineDelayReportActionState,
    formData: FormData,
  ) => Promise<DraglineDelayReportActionState>;
  cancelHref: string;
  equipmentOptions: DraglineEquipmentOption[];
  employeeOptions: DraglineEmployeeOption[];
  supervisorOptions: DraglineEmployeeOption[];
  initialValues: DraglineDelayReportFormInitialValues;
  submitLabel: string;
};

let clientRowSequence = 0;

function clientRowId(prefix: string) {
  clientRowSequence += 1;
  return `${prefix}-${clientRowSequence}`;
}

function emptyOperator(): DraglineDelayReportOperatorFormRow {
  return { clientId: clientRowId("operator"), employeeId: "" };
}

function emptyTimelineEntry(): DraglineDelayReportTimelineFormRow {
  return {
    clientId: clientRowId("timeline"),
    startTime: "",
    dayOffset: 0,
    delayCode: "",
    description: "",
    durationMinutes: "",
    causesDowntime: false,
  };
}

function firstError(state: DraglineDelayReportActionState, path: string) {
  const message = state.fieldErrors[path]?.[0];
  return message ? <p className="field-error">{message}</p> : null;
}

function moveItem<T>(items: T[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function DelayCodeField({
  entry,
  index,
  state,
  onChange,
}: {
  entry: DraglineDelayReportTimelineFormRow;
  index: number;
  state: DraglineDelayReportActionState;
  onChange: (values: Partial<DraglineDelayReportTimelineFormRow>) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = searchDraglineDelayCodes(query);
  const selected = getDraglineDelayCode(entry.delayCode);
  const grouped = groupDraglineDelayCodes(
    selected && !visible.some((candidate) => candidate.code === selected.code)
      ? [selected, ...visible]
      : visible,
  );

  return (
    <div className="ddr-code-field">
      <label>
        <span>Find Delay Code</span>
        <input
          aria-label={`Find Delay Code for row ${index + 1}`}
          autoComplete="off"
          placeholder="Code or description"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label>
        <span>Delay Code</span>
        <select
          aria-label={`Delay Code for row ${index + 1}`}
          value={entry.delayCode}
          onChange={(event) => {
            const next = getDraglineDelayCode(event.target.value);
            onChange({ delayCode: event.target.value, category: next?.category });
          }}
        >
          <option value="">Select official code</option>
          {grouped.map((group) =>
            group.entries.length ? (
              <optgroup key={group.category} label={group.category}>
                {group.entries.map((code) => (
                  <option key={code.code} value={code.code}>
                    {code.code} — {code.description}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
        {firstError(state, `timelineEntries.${index}.delayCode`)}
      </label>
      <p className="subtle">
        Category: {selected?.category ?? "Derived from selected code"}
      </p>
    </div>
  );
}

function EmployeeField({
  label,
  rowNumber,
  value,
  options,
  state,
  errorPath,
  onChange,
}: {
  label: string;
  rowNumber?: number;
  value: string;
  options: DraglineEmployeeOption[];
  state: DraglineDelayReportActionState;
  errorPath: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = options.filter(
    (option) =>
      option.id === value || option.label.toLowerCase().includes(normalized),
  );
  const suffix = rowNumber ? ` ${rowNumber}` : "";

  return (
    <div className="ddr-employee-field">
      <label>
        <span>Find {label}</span>
        <input
          aria-label={`Find ${label}${suffix}`}
          autoComplete="off"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label>
        <span>{label}</span>
        <select
          aria-label={`${label}${suffix}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{label === "Supervisor" ? "Not recorded" : `Select ${label}`}</option>
          {visible.map((option) => (
            <option
              disabled={!option.isActive && option.id !== value}
              key={option.id}
              value={option.id}
            >
              {option.label}
            </option>
          ))}
        </select>
        {firstError(state, errorPath)}
      </label>
    </div>
  );
}

export function DraglineDelayReportForm({
  action,
  cancelHref,
  equipmentOptions,
  employeeOptions,
  supervisorOptions,
  initialValues,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    emptyDraglineDelayReportActionState,
  );
  const [operationalWorkDate, setOperationalWorkDate] = useState(
    initialValues.operationalWorkDate,
  );
  const [shift, setShift] = useState(initialValues.shift);
  const [equipmentId, setEquipmentId] = useState(initialValues.equipmentId);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [startingHourMeter, setStartingHourMeter] = useState(
    initialValues.startingHourMeter,
  );
  const [endingHourMeter, setEndingHourMeter] = useState(
    initialValues.endingHourMeter,
  );
  const [supervisorId, setSupervisorId] = useState(initialValues.supervisorId);
  const [operators, setOperators] = useState(
    initialValues.operators.length ? initialValues.operators : [emptyOperator()],
  );
  const [timelineEntries, setTimelineEntries] = useState(
    initialValues.timelineEntries.length
      ? initialValues.timelineEntries
      : [emptyTimelineEntry()],
  );

  const selectedEquipment = equipmentOptions.find(
    (option) => option.id === equipmentId,
  );
  const visibleEquipment = equipmentOptions.filter(
    (option) =>
      option.id === equipmentId ||
      option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const submittedTimeline = timelineEntries.filter(
    (entry) =>
      entry.id ||
      entry.startTime ||
      entry.delayCode ||
      entry.description.trim() ||
      entry.durationMinutes ||
      entry.causesDowntime,
  );
  const totals = useMemo(() => {
    try {
      return calculateDraglineShiftTotals(
        shift,
        submittedTimeline.map((entry) => ({
          startMinuteOffset: normalizeEventStartTime(entry.startTime, entry.dayOffset),
          durationMinutes: entry.durationMinutes
            ? Number(entry.durationMinutes)
            : undefined,
          causesDowntime: entry.causesDowntime,
        })),
      );
    } catch {
      return null;
    }
  }, [shift, submittedTimeline]);

  const payload = JSON.stringify({
    operationalWorkDate,
    shift,
    equipmentId,
    startingHourMeter,
    endingHourMeter,
    supervisorId,
    recordVersion: initialValues.recordVersion,
    operators: operators.map((operator, index) => ({
      id: operator.id,
      sequence: index + 1,
      employeeId: operator.employeeId,
    })),
    timelineEntries: submittedTimeline.map((entry, index) => ({
      id: entry.id,
      sequence: index + 1,
      startTime: entry.startTime,
      dayOffset: entry.dayOffset,
      catalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
      delayCode: entry.delayCode,
      description: entry.description,
      durationMinutes: entry.durationMinutes,
      causesDowntime: entry.causesDowntime,
    })),
  });

  function updateOperator(
    index: number,
    values: Partial<DraglineDelayReportOperatorFormRow>,
  ) {
    setOperators((current) =>
      current.map((operator, operatorIndex) =>
        operatorIndex === index ? { ...operator, ...values } : operator,
      ),
    );
  }

  function updateTimelineEntry(
    index: number,
    values: Partial<DraglineDelayReportTimelineFormRow>,
  ) {
    setTimelineEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...values } : entry,
      ),
    );
  }

  return (
    <form action={formAction} className="form-stack ddr-form">
      <input name="payload" type="hidden" value={payload} />
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          <p>{state.message}</p>
        </div>
      ) : null}

      <section className="panel form-section" aria-labelledby="ddr-header-heading">
        <div className="full-width-field">
          <p className="eyebrow">Draft report identity</p>
          <h2 id="ddr-header-heading">Shift context</h2>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Operational Work Date</span>
            <input
              type="date"
              value={operationalWorkDate}
              onChange={(event) => setOperationalWorkDate(event.target.value)}
            />
            {firstError(state, "operationalWorkDate")}
          </label>
          <label>
            <span>Shift</span>
            <select
              value={shift}
              onChange={(event) => {
                const next = event.target.value as "DAY" | "NIGHT";
                setShift(next);
                if (next === "DAY") {
                  setTimelineEntries((current) =>
                    current.map((entry) => ({ ...entry, dayOffset: 0 })),
                  );
                }
              }}
            >
              <option value="DAY">Day</option>
              <option value="NIGHT">Night</option>
            </select>
            {firstError(state, "shift")}
          </label>
          <label>
            <span>Find Dragline Equipment</span>
            <input
              autoComplete="off"
              placeholder="Name, number, or mine"
              type="search"
              value={equipmentQuery}
              onChange={(event) => setEquipmentQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Dragline Equipment</span>
            <select
              value={equipmentId}
              onChange={(event) => setEquipmentId(event.target.value)}
            >
              <option value="">Select Dragline Equipment</option>
              {visibleEquipment.map((equipment) => (
                <option
                  disabled={
                    equipment.status !== "ACTIVE" &&
                    equipment.id !== initialValues.equipmentId
                  }
                  key={equipment.id}
                  value={equipment.id}
                >
                  {equipment.label}
                  {equipment.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {firstError(state, "equipmentId")}
          </label>
          <label>
            <span>Starting Hour Meter</span>
            <input
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={startingHourMeter}
              onChange={(event) => setStartingHourMeter(event.target.value)}
            />
            {firstError(state, "startingHourMeter")}
          </label>
          <label>
            <span>Ending Hour Meter (optional in Draft)</span>
            <input
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={endingHourMeter}
              onChange={(event) => setEndingHourMeter(event.target.value)}
            />
            {firstError(state, "endingHourMeter")}
          </label>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div>
            <span>Mine</span>
            <strong>{selectedEquipment?.mineName ?? "Derived from Equipment"}</strong>
          </div>
          <div>
            <span>City</span>
            <strong>
              {selectedEquipment
                ? `${selectedEquipment.cityName}${selectedEquipment.cityState ? `, ${selectedEquipment.cityState}` : ""}`
                : "Derived from Equipment"}
            </strong>
          </div>
          <div>
            <span>Down Time</span>
            <strong>{totals ? `${totals.downTimeMinutes} min` : "Check timeline"}</strong>
          </div>
          <div>
            <span>Run Time</span>
            <strong>{totals ? `${totals.runTimeMinutes} min` : "Check timeline"}</strong>
          </div>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-people-heading">
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Canonical Employees</p>
            <h2 id="ddr-people-heading">Operators and Supervisor</h2>
          </div>
          <button
            className="button secondary"
            disabled={operators.length >= 20}
            type="button"
            onClick={() => setOperators((current) => [...current, emptyOperator()])}
          >
            Add Operator
          </button>
        </div>
        {firstError(state, "operators")}
        <div className="ddr-operator-list full-width-field">
          {operators.map((operator, index) => (
            <fieldset className="ddr-operator-row" key={operator.clientId}>
              <legend>Operator {index + 1}</legend>
              <EmployeeField
                errorPath={`operators.${index}.employeeId`}
                label="Operator"
                onChange={(employeeId) => updateOperator(index, { employeeId })}
                options={employeeOptions}
                rowNumber={index + 1}
                state={state}
                value={operator.employeeId}
              />
              <div className="inline-actions">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  type="button"
                  onClick={() => setOperators((current) => moveItem(current, index, -1))}
                >
                  Move up
                </button>
                <button
                  className="button secondary"
                  disabled={index === operators.length - 1}
                  type="button"
                  onClick={() => setOperators((current) => moveItem(current, index, 1))}
                >
                  Move down
                </button>
                <button
                  className="button danger"
                  disabled={operators.length === 1}
                  type="button"
                  onClick={() =>
                    setOperators((current) =>
                      current.filter((_, operatorIndex) => operatorIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
        </div>
        <div className="full-width-field">
          <EmployeeField
            errorPath="supervisorId"
            label="Supervisor"
            onChange={setSupervisorId}
            options={supervisorOptions}
            state={state}
            value={supervisorId}
          />
          <p className="subtle">Supervisor may remain blank while the report is Draft.</p>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-timeline-heading">
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Actual-time operational record</p>
            <h2 id="ddr-timeline-heading">Timeline</h2>
          </div>
          <button
            className="button secondary"
            disabled={timelineEntries.length >= 200}
            type="button"
            onClick={() =>
              setTimelineEntries((current) => [...current, emptyTimelineEntry()])
            }
          >
            Add Timeline Row
          </button>
        </div>
        <p className="subtle full-width-field">
          Same-time rows are valid. Only checked downtime rows contribute to the
          interval-union total.
        </p>
        {firstError(state, "timelineEntries")}
        <div className="ddr-timeline-list full-width-field">
          {timelineEntries.map((entry, index) => (
            <fieldset className="ddr-timeline-row" key={entry.clientId}>
              <legend>Timeline row {index + 1}</legend>
              <div className="ddr-timeline-fields">
                <label>
                  <span>Start time</span>
                  <input
                    aria-label={`Start time for row ${index + 1}`}
                    type="time"
                    value={entry.startTime}
                    onChange={(event) =>
                      updateTimelineEntry(index, { startTime: event.target.value })
                    }
                  />
                  {firstError(state, `timelineEntries.${index}.startTime`)}
                </label>
                {shift === "NIGHT" ? (
                  <label>
                    <span>Calendar day</span>
                    <select
                      aria-label={`Calendar day for row ${index + 1}`}
                      value={entry.dayOffset}
                      onChange={(event) =>
                        updateTimelineEntry(index, {
                          dayOffset: Number(event.target.value) as 0 | 1,
                        })
                      }
                    >
                      <option value={0}>Operational date</option>
                      <option value={1}>Next day</option>
                    </select>
                  </label>
                ) : null}
                <DelayCodeField
                  entry={entry}
                  index={index}
                  onChange={(values) => updateTimelineEntry(index, values)}
                  state={state}
                />
                <label>
                  <span>Duration (minutes, optional)</span>
                  <input
                    aria-label={`Duration for row ${index + 1}`}
                    inputMode="numeric"
                    min="1"
                    step="1"
                    type="number"
                    value={entry.durationMinutes}
                    onChange={(event) =>
                      updateTimelineEntry(index, {
                        durationMinutes: event.target.value,
                      })
                    }
                  />
                  {firstError(state, `timelineEntries.${index}.durationMinutes`)}
                </label>
                <label className="checkbox-label ddr-downtime-control">
                  <input
                    aria-label={`Causes machine downtime for row ${index + 1}`}
                    checked={entry.causesDowntime}
                    type="checkbox"
                    onChange={(event) =>
                      updateTimelineEntry(index, {
                        causesDowntime: event.target.checked,
                      })
                    }
                  />
                  <span>Causes machine downtime</span>
                </label>
                <label className="ddr-description-field">
                  <span>Description / context (optional)</span>
                  <input
                    aria-label={`Description for row ${index + 1}`}
                    maxLength={1000}
                    value={entry.description}
                    onChange={(event) =>
                      updateTimelineEntry(index, { description: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="inline-actions ddr-row-actions">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  type="button"
                  onClick={() =>
                    setTimelineEntries((current) => moveItem(current, index, -1))
                  }
                >
                  Move up
                </button>
                <button
                  className="button secondary"
                  disabled={index === timelineEntries.length - 1}
                  type="button"
                  onClick={() =>
                    setTimelineEntries((current) => moveItem(current, index, 1))
                  }
                >
                  Move down
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={() =>
                    setTimelineEntries((current) => {
                      const next = current.filter((_, entryIndex) => entryIndex !== index);
                      return next.length ? next : [emptyTimelineEntry()];
                    })
                  }
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
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving Draft..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
