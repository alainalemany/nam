"use client";

import { startTransition, useActionState, useMemo, useState } from "react";

import {
  DRAGLINE_DELAY_CODE_CATALOG_VERSION,
  getDraglineDelayCode,
  groupDraglineDelayCodes,
  searchDraglineDelayCodes,
} from "./catalog";
import { calculateDraglineShiftTotals } from "./calculations";
import { filterDraglineLakesForMine } from "./lakes";
import { calculateStationAdvance, parseStationNotation } from "./station";
import { normalizeEventStartTime } from "./time";
import type {
  DraglineDelayReportFormInitialValues,
  DraglineDelayReportGroundCheckFormRow,
  DraglineDelayReportOperatorFormRow,
  DraglineDelayReportTimelineFormRow,
  DraglineEmployeeOption,
  DraglineEquipmentOption,
  DraglineLakeOption,
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
  lakeOptions: DraglineLakeOption[];
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

function emptyGroundCheck(): DraglineDelayReportGroundCheckFormRow {
  return {
    clientId: clientRowId("ground-check"),
    startTime: "",
    dayOffset: 0,
  };
}

function firstError(state: DraglineDelayReportActionState, path: string) {
  const message = state.fieldErrors[path]?.[0];
  return message ? <p className="field-error">{message}</p> : null;
}

function errorAttributes(state: DraglineDelayReportActionState, path: string) {
  return state.fieldErrors[path]?.length
    ? { "aria-invalid": true as const }
    : {};
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
          {...errorAttributes(state, `timelineEntries.${index}.delayCode`)}
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
          {...errorAttributes(state, errorPath)}
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
  lakeOptions,
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
  const [lakeId, setLakeId] = useState(initialValues.lakeId);
  const [normalDiggingBuckets, setNormalDiggingBuckets] = useState(
    initialValues.normalDiggingBuckets,
  );
  const [benchfillBuckets, setBenchfillBuckets] = useState(
    initialValues.benchfillBuckets,
  );
  const [stationStart, setStationStart] = useState(initialValues.stationStart);
  const [stationEnd, setStationEnd] = useState(initialValues.stationEnd);
  const [depthFeet, setDepthFeet] = useState(initialValues.depthFeet);
  const [fuelGallons, setFuelGallons] = useState(initialValues.fuelGallons);
  const [cableDragFeet, setCableDragFeet] = useState(initialValues.cableDragFeet);
  const [hoistFeet, setHoistFeet] = useState(initialValues.hoistFeet);
  const [comments, setComments] = useState(initialValues.comments);
  const [safetyItemsFound, setSafetyItemsFound] = useState(
    initialValues.safetyItemsFound,
  );
  const [actionTaken, setActionTaken] = useState(initialValues.actionTaken);
  const [operators, setOperators] = useState(
    initialValues.operators.length ? initialValues.operators : [emptyOperator()],
  );
  const [timelineEntries, setTimelineEntries] = useState(
    initialValues.timelineEntries.length
      ? initialValues.timelineEntries
      : [emptyTimelineEntry()],
  );
  const [groundChecks, setGroundChecks] = useState(initialValues.groundChecks);

  const selectedEquipment = equipmentOptions.find(
    (option) => option.id === equipmentId,
  );
  const visibleEquipment = equipmentOptions.filter(
    (option) =>
      option.id === equipmentId ||
      option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const visibleLakes = filterDraglineLakesForMine(
    lakeOptions,
    selectedEquipment?.mineId,
    lakeId,
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
  const advanceFeet = useMemo(() => {
    if (!stationStart.trim() || !stationEnd.trim()) return null;
    try {
      return calculateStationAdvance(
        parseStationNotation(stationStart).absoluteFeet,
        parseStationNotation(stationEnd).absoluteFeet,
      );
    } catch {
      return null;
    }
  }, [stationEnd, stationStart]);

  const payload = JSON.stringify({
    operationalWorkDate,
    shift,
    equipmentId,
    startingHourMeter,
    endingHourMeter,
    supervisorId,
    lakeId,
    normalDiggingBuckets,
    benchfillBuckets,
    stationStart,
    stationEnd,
    depthFeet,
    fuelGallons,
    cableDragFeet,
    hoistFeet,
    comments,
    safetyItemsFound,
    actionTaken,
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
    groundChecks: groundChecks
      .filter((groundCheck) => groundCheck.id || groundCheck.startTime)
      .map((groundCheck, index) => ({
        id: groundCheck.id,
        sequence: index + 1,
        startTime: groundCheck.startTime,
        dayOffset: groundCheck.dayOffset,
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
    <form
      className="form-stack ddr-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
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
              {...errorAttributes(state, "operationalWorkDate")}
              type="date"
              value={operationalWorkDate}
              onChange={(event) => setOperationalWorkDate(event.target.value)}
            />
            {firstError(state, "operationalWorkDate")}
          </label>
          <label>
            <span>Shift</span>
            <select
              {...errorAttributes(state, "shift")}
              value={shift}
              onChange={(event) => {
                const next = event.target.value as "DAY" | "NIGHT";
                setShift(next);
                if (next === "DAY") {
                  setTimelineEntries((current) =>
                    current.map((entry) => ({ ...entry, dayOffset: 0 })),
                  );
                  setGroundChecks((current) =>
                    current.map((groundCheck) => ({
                      ...groundCheck,
                      dayOffset: 0,
                    })),
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
              {...errorAttributes(state, "equipmentId")}
              value={equipmentId}
              onChange={(event) => {
                const nextEquipmentId = event.target.value;
                const nextMineId = equipmentOptions.find(
                  (equipment) => equipment.id === nextEquipmentId,
                )?.mineId;
                setEquipmentId(nextEquipmentId);
                setLakeId((current) =>
                  lakeOptions.some(
                    (lake) => lake.id === current && lake.mineId === nextMineId,
                  )
                    ? current
                    : "",
                );
              }}
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
              {...errorAttributes(state, "startingHourMeter")}
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
              {...errorAttributes(state, "endingHourMeter")}
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
                    {...errorAttributes(state, `timelineEntries.${index}.startTime`)}
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
                    {...errorAttributes(state, `timelineEntries.${index}.durationMinutes`)}
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

      <section className="panel form-section" aria-labelledby="ddr-production-heading">
        <div className="full-width-field">
          <p className="eyebrow">End-of-shift Draft data</p>
          <h2 id="ddr-production-heading">Production</h2>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Normal Digging Buckets</span>
            <input
              {...errorAttributes(state, "normalDiggingBuckets")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={normalDiggingBuckets}
              onChange={(event) => setNormalDiggingBuckets(event.target.value)}
            />
            {firstError(state, "normalDiggingBuckets")}
          </label>
          <label>
            <span>Benchfill Buckets</span>
            <input
              {...errorAttributes(state, "benchfillBuckets")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={benchfillBuckets}
              onChange={(event) => setBenchfillBuckets(event.target.value)}
            />
            {firstError(state, "benchfillBuckets")}
          </label>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-progress-heading">
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Equipment Mine context</p>
            <h2 id="ddr-progress-heading">Work Area and Progress</h2>
          </div>
          <a className="button secondary" href="/dragline-delay-reports/lakes">
            Manage Lakes
          </a>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Lake</span>
            <select
              {...errorAttributes(state, "lakeId")}
              disabled={!selectedEquipment}
              value={lakeId}
              onChange={(event) => setLakeId(event.target.value)}
            >
              <option value="">
                {selectedEquipment ? "Not recorded in Draft" : "Select Equipment first"}
              </option>
              {visibleLakes.map((lake) => (
                <option
                  disabled={lake.status !== "ACTIVE" && lake.id !== initialValues.lakeId}
                  key={lake.id}
                  value={lake.id}
                >
                  {lake.name}{lake.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {firstError(state, "lakeId")}
            {selectedEquipment && visibleLakes.length === 0 ? (
              <p className="subtle">No active Lakes exist for this Mine.</p>
            ) : null}
          </label>
          <label>
            <span>Station Start</span>
            <input
              {...errorAttributes(state, "stationStart")}
              inputMode="numeric"
              placeholder="50+30"
              value={stationStart}
              onChange={(event) => setStationStart(event.target.value)}
            />
            {firstError(state, "stationStart")}
          </label>
          <label>
            <span>Station End</span>
            <input
              {...errorAttributes(state, "stationEnd")}
              inputMode="numeric"
              placeholder="50+60"
              value={stationEnd}
              onChange={(event) => setStationEnd(event.target.value)}
            />
            {firstError(state, "stationEnd")}
          </label>
          <div>
            <span>Advance</span>
            <p>
              <strong>{advanceFeet == null ? "Enter valid Start and End" : `${advanceFeet} ft`}</strong>
            </p>
            <p className="subtle">Absolute distance; calculated by NAM.</p>
          </div>
          <label>
            <span>Depth (feet)</span>
            <input
              {...errorAttributes(state, "depthFeet")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={depthFeet}
              onChange={(event) => setDepthFeet(event.target.value)}
            />
            {firstError(state, "depthFeet")}
          </label>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-operational-heading">
        <div className="full-width-field">
          <p className="eyebrow">Totals and measurements</p>
          <h2 id="ddr-operational-heading">Operational Context</h2>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div>
            <span>Down Time</span>
            <strong>{totals ? `${totals.downTimeMinutes} min` : "Check timeline"}</strong>
          </div>
          <div>
            <span>Run Time</span>
            <strong>{totals ? `${totals.runTimeMinutes} min` : "Check timeline"}</strong>
          </div>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Fuel (gallons)</span>
            <input
              {...errorAttributes(state, "fuelGallons")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={fuelGallons}
              onChange={(event) => setFuelGallons(event.target.value)}
            />
            {firstError(state, "fuelGallons")}
          </label>
          <label>
            <span>Cable Drag (feet cut off)</span>
            <input
              {...errorAttributes(state, "cableDragFeet")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={cableDragFeet}
              onChange={(event) => setCableDragFeet(event.target.value)}
            />
            {firstError(state, "cableDragFeet")}
          </label>
          <label>
            <span>Hoist (feet cut off)</span>
            <input
              {...errorAttributes(state, "hoistFeet")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={hoistFeet}
              onChange={(event) => setHoistFeet(event.target.value)}
            />
            {firstError(state, "hoistFeet")}
          </label>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-ground-check-heading">
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Manual inspection times</p>
            <h2 id="ddr-ground-check-heading">Ground Checks</h2>
          </div>
          <button
            className="button secondary"
            disabled={groundChecks.length >= 100}
            type="button"
            onClick={() => setGroundChecks((current) => [...current, emptyGroundCheck()])}
          >
            Add Ground Check
          </button>
        </div>
        <p className="subtle full-width-field">
          Record every physical ground-condition inspection. These times are not
          derived from timeline codes.
        </p>
        {firstError(state, "groundChecks")}
        <div className="ddr-operator-list full-width-field">
          {groundChecks.length === 0 ? (
            <p className="subtle">No Ground Checks recorded in this Draft.</p>
          ) : null}
          {groundChecks.map((groundCheck, index) => (
            <fieldset className="ddr-operator-row" key={groundCheck.clientId}>
              <legend>Ground Check {index + 1}</legend>
              <label>
                <span>Time</span>
                <input
                  {...errorAttributes(state, `groundChecks.${index}.startTime`)}
                  aria-label={`Ground Check time ${index + 1}`}
                  type="time"
                  value={groundCheck.startTime}
                  onChange={(event) =>
                    setGroundChecks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, startTime: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                {firstError(state, `groundChecks.${index}.startTime`)}
              </label>
              {shift === "NIGHT" ? (
                <label>
                  <span>Calendar day</span>
                  <select
                    aria-label={`Ground Check calendar day ${index + 1}`}
                    value={groundCheck.dayOffset}
                    onChange={(event) =>
                      setGroundChecks((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                dayOffset: Number(event.target.value) as 0 | 1,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value={0}>Operational date</option>
                    <option value={1}>Next day</option>
                  </select>
                </label>
              ) : null}
              <div className="inline-actions">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  type="button"
                  onClick={() => setGroundChecks((current) => moveItem(current, index, -1))}
                >
                  Move up
                </button>
                <button
                  className="button secondary"
                  disabled={index === groundChecks.length - 1}
                  type="button"
                  onClick={() => setGroundChecks((current) => moveItem(current, index, 1))}
                >
                  Move down
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={() =>
                    setGroundChecks((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-closing-heading">
        <div className="full-width-field">
          <p className="eyebrow">Optional Draft notes</p>
          <h2 id="ddr-closing-heading">Closing Notes</h2>
        </div>
        <div className="form-grid full-width-field">
          <label className="full-width-field">
            <span>Comments</span>
            <textarea
              {...errorAttributes(state, "comments")}
              maxLength={5000}
              rows={4}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
            />
            {firstError(state, "comments")}
          </label>
          <label>
            <span>Safety Items Found</span>
            <textarea
              {...errorAttributes(state, "safetyItemsFound")}
              maxLength={5000}
              rows={4}
              value={safetyItemsFound}
              onChange={(event) => setSafetyItemsFound(event.target.value)}
            />
            {firstError(state, "safetyItemsFound")}
          </label>
          <label>
            <span>Action Taken</span>
            <textarea
              {...errorAttributes(state, "actionTaken")}
              maxLength={5000}
              rows={4}
              value={actionTaken}
              onChange={(event) => setActionTaken(event.target.value)}
            />
            {firstError(state, "actionTaken")}
          </label>
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
