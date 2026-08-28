"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getEquipmentFuelTankLabelSuggestionsAction } from "./actions";
import { compatibleFuelTypes, equipmentFuelTypeOptions, maxTankFills } from "./constants";
import { localEquipmentFuelDateValue, localEquipmentFuelTimeValue } from "./date";
import type {
  EquipmentFuelEquipmentOption,
  EquipmentFuelEventFormInitialValues,
  EquipmentFuelTankFillValue,
} from "./types";
import { emptyEquipmentFuelActionState, type EquipmentFuelActionState } from "./validation";

type Props = {
  action: (previousState: EquipmentFuelActionState, formData: FormData) => Promise<EquipmentFuelActionState>;
  cancelHref: string;
  equipmentOptions: EquipmentFuelEquipmentOption[];
  initialTankLabelSuggestions?: string[];
  submitLabel: string;
  initialValues?: EquipmentFuelEventFormInitialValues;
  unavailableEquipmentLabel?: string;
};

function errorId(path: string) {
  return `fuel-event-error-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function hasError(state: EquipmentFuelActionState, path: string) {
  return Boolean(state.fieldErrors[path]?.length);
}

function firstError(state: EquipmentFuelActionState, path: string) {
  const message = state.fieldErrors[path]?.[0];
  return message ? <p className="field-error" id={errorId(path)}>{message}</p> : null;
}

export function EquipmentFuelEventForm({
  action,
  cancelHref,
  equipmentOptions,
  initialTankLabelSuggestions = [],
  submitLabel,
  initialValues,
  unavailableEquipmentLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, emptyEquipmentFuelActionState);
  const nextRowNumber = useRef(0);

  function emptyFill(sequence = 1): EquipmentFuelTankFillValue {
    nextRowNumber.current += 1;
    return {
      clientRowId: `fuel-tank-fill-${nextRowNumber.current}`,
      sequence,
      tankLabel: "",
      gallons: "",
    };
  }

  function initialFills(): EquipmentFuelTankFillValue[] {
    if (!initialValues?.tankFills.length) return [emptyFill()];
    return initialValues.tankFills.map((fill) => ({
      ...fill,
      clientRowId: emptyFill().clientRowId,
    }));
  }

  const [operationalWorkDate, setOperationalWorkDate] = useState(
    initialValues?.operationalWorkDate ?? localEquipmentFuelDateValue(),
  );
  const [eventTime, setEventTime] = useState(
    initialValues?.eventTime ?? localEquipmentFuelTimeValue(),
  );
  const [equipmentId, setEquipmentId] = useState(initialValues?.equipmentId ?? "");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [fuelType, setFuelType] = useState<string>(initialValues?.fuelType ?? "DIESEL");
  const [tankLabelSuggestions, setTankLabelSuggestions] = useState(initialTankLabelSuggestions);
  const [loadingSuggestions, startSuggestionLoad] = useTransition();
  const suggestionRequest = useRef(0);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [fills, setFills] = useState<EquipmentFuelTankFillValue[]>(initialFills);

  useEffect(() => {
    if (!state.values) return;
    setOperationalWorkDate(state.values.operationalWorkDate);
    setEventTime(state.values.eventTime);
    setEquipmentId(state.values.equipmentId);
    setFuelType(state.values.fuelType);
    setNotes(state.values.notes);
    setFills(state.values.tankFills.length ? state.values.tankFills : [emptyFill()]);
  }, [state.values]);

  const selectedEquipment = equipmentOptions.find((option) => option.id === equipmentId);
  const allowedFuelTypes = compatibleFuelTypes(selectedEquipment?.powerType ?? null);
  const visibleEquipment = equipmentOptions.filter((option) =>
    option.id === equipmentId || option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const totalGallons = useMemo(
    () => fills.reduce(
      (total, fill) => /^\d+$/.test(fill.gallons) ? total + Number(fill.gallons) : total,
      0,
    ),
    [fills],
  );
  const payload = JSON.stringify({
    operationalWorkDate,
    eventTime,
    equipmentId,
    fuelType,
    notes,
    tankFills: fills.map((fill, index) => ({
      ...fill,
      sequence: index + 1,
    })),
  });

  function loadTankLabelSuggestions(nextEquipmentId: string) {
    const request = ++suggestionRequest.current;
    setTankLabelSuggestions([]);
    if (!nextEquipmentId) return;
    startSuggestionLoad(async () => {
      const suggestions = await getEquipmentFuelTankLabelSuggestionsAction(nextEquipmentId);
      if (suggestionRequest.current !== request) return;
      setTankLabelSuggestions(suggestions);
    });
  }

  function selectEquipment(nextId: string) {
    if (nextId !== equipmentId) setFills([emptyFill()]);
    setEquipmentId(nextId);
    loadTankLabelSuggestions(nextId);
    const next = equipmentOptions.find((option) => option.id === nextId);
    const nextFuelTypes = compatibleFuelTypes(next?.powerType ?? null);
    if (!nextFuelTypes.includes(fuelType as never)) {
      setFuelType(nextFuelTypes[0] ?? "DIESEL");
    }
  }

  function updateFill(index: number, values: Partial<EquipmentFuelTankFillValue>) {
    setFills((current) => current.map((fill, fillIndex) =>
      fillIndex === index ? { ...fill, ...values } : fill,
    ));
  }

  function moveFill(index: number, offset: -1 | 1) {
    setFills((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((fill, fillIndex) => ({ ...fill, sequence: fillIndex + 1 }));
    });
  }

  function removeFill(index: number) {
    setFills((current) => current
      .filter((_, fillIndex) => fillIndex !== index)
      .map((fill, fillIndex) => ({ ...fill, sequence: fillIndex + 1 })));
  }

  const dateError = hasError(state, "operationalWorkDate");
  const timeError = hasError(state, "eventTime");
  const equipmentError = hasError(state, "equipmentId");
  const fuelTypeError = hasError(state, "fuelType");
  const notesError = hasError(state, "notes");

  return (
    <form action={formAction} className="form-stack">
      <input name="payload" type="hidden" value={payload} />
      {state.status === "error" ? (
        <div className="form-alert" role="alert"><p>{state.message}</p></div>
      ) : null}
      {unavailableEquipmentLabel ? (
        <div className="form-alert" role="status">
          <p>Original Equipment unavailable: {unavailableEquipmentLabel}</p>
          <span>Select current active eligible Equipment and enter fresh Tank Fills before saving this correction.</span>
        </div>
      ) : null}

      <section className="panel form-section" aria-labelledby="fuel-event-context-heading">
        <div className="full-width-field">
          <p className="eyebrow">Completed on submission</p>
          <h2 id="fuel-event-context-heading">Fueling context</h2>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Operational work date</span>
            <input
              aria-label="Operational work date"
              aria-describedby={dateError ? errorId("operationalWorkDate") : undefined}
              aria-invalid={dateError || undefined}
              onChange={(event) => setOperationalWorkDate(event.target.value)}
              type="date"
              value={operationalWorkDate}
            />
            {firstError(state, "operationalWorkDate")}
          </label>
          <label>
            <span>Local event time</span>
            <input
              aria-label="Local event time"
              aria-describedby={timeError ? errorId("eventTime") : undefined}
              aria-invalid={timeError || undefined}
              onChange={(event) => setEventTime(event.target.value)}
              type="time"
              value={eventTime}
            />
            {firstError(state, "eventTime")}
          </label>
          <label>
            <span>Find Equipment</span>
            <input
              aria-label="Find Equipment"
              autoComplete="off"
              onChange={(event) => setEquipmentQuery(event.target.value)}
              placeholder="Name, number, or mine"
              type="search"
              value={equipmentQuery}
            />
          </label>
          <label>
            <span>Equipment</span>
            <select
              aria-label="Equipment"
              aria-describedby={equipmentError ? errorId("equipmentId") : undefined}
              aria-invalid={equipmentError || undefined}
              onChange={(event) => selectEquipment(event.target.value)}
              value={equipmentId}
            >
              <option value="">Select Equipment</option>
              {visibleEquipment.map((equipment) => (
                <option
                  disabled={equipment.status !== "ACTIVE" && equipment.id !== initialValues?.equipmentId}
                  key={equipment.id}
                  value={equipment.id}
                >
                  {equipment.label}{equipment.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {firstError(state, "equipmentId")}
          </label>
          <label>
            <span>Fuel type</span>
            <select
              aria-label="Fuel type"
              aria-describedby={fuelTypeError ? errorId("fuelType") : undefined}
              aria-invalid={fuelTypeError || undefined}
              onChange={(event) => setFuelType(event.target.value)}
              value={fuelType}
            >
              {equipmentFuelTypeOptions.map((option) => (
                <option
                  disabled={!allowedFuelTypes.includes(option.value as never)}
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
            {firstError(state, "fuelType")}
          </label>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div><span>Mine</span><strong>{selectedEquipment?.mineName ?? "Derived from Equipment"}</strong></div>
          <div><span>City</span><strong>{selectedEquipment ? `${selectedEquipment.cityName}${selectedEquipment.cityState ? `, ${selectedEquipment.cityState}` : ""}` : "Derived from Equipment"}</strong></div>
          <div><span>Power context</span><strong>{selectedEquipment?.powerType ?? "Select Equipment"}</strong></div>
          <div><span>Event total</span><strong>{totalGallons.toLocaleString()} gal</strong></div>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="tank-fills-heading">
        <div className="section-heading full-width-field">
          <div><p className="eyebrow">Whole US gallons</p><h2 id="tank-fills-heading">Tank Fills</h2></div>
          <button
            className="button secondary"
            disabled={fills.length >= maxTankFills}
            onClick={() => setFills((current) => [...current, emptyFill(current.length + 1)])}
            type="button"
          >
            Add Tank Fill
          </button>
        </div>
        {firstError(state, "tankFills")}
        <datalist id="fuel-tank-label-suggestions">
          {tankLabelSuggestions.map((label) => <option key={label} value={label} />)}
        </datalist>
        <div aria-busy={loadingSuggestions} className="fuel-fill-list full-width-field">
          {fills.map((fill, index) => {
            const labelPath = `tankFills.${index}.tankLabel`;
            const gallonsPath = `tankFills.${index}.gallons`;
            const labelError = hasError(state, labelPath);
            const gallonsError = hasError(state, gallonsPath);
            return (
              <fieldset
                className="fuel-fill-row"
                data-client-row-id={fill.clientRowId}
                key={fill.clientRowId}
              >
                <legend>Tank Fill {index + 1}</legend>
                {firstError(state, `tankFills.${index}.sequence`)}
                <label>
                  <span>Tank label</span>
                  <input
                    aria-label="Tank label"
                    aria-describedby={labelError ? errorId(labelPath) : undefined}
                    aria-invalid={labelError || undefined}
                    list="fuel-tank-label-suggestions"
                    maxLength={100}
                    onChange={(event) => updateFill(index, { tankLabel: event.target.value })}
                    value={fill.tankLabel}
                  />
                  {firstError(state, labelPath)}
                </label>
                <label>
                  <span>Delivered gallons</span>
                  <input
                    aria-label="Delivered gallons"
                    aria-describedby={gallonsError ? errorId(gallonsPath) : undefined}
                    aria-invalid={gallonsError || undefined}
                    inputMode="numeric"
                    max="999999"
                    min="1"
                    onChange={(event) => updateFill(index, { gallons: event.target.value })}
                    step="1"
                    type="number"
                    value={fill.gallons}
                  />
                  {firstError(state, gallonsPath)}
                </label>
                <div className="inline-actions fuel-fill-actions">
                  <button className="button secondary" disabled={index === 0} onClick={() => moveFill(index, -1)} type="button">Move up</button>
                  <button className="button secondary" disabled={index === fills.length - 1} onClick={() => moveFill(index, 1)} type="button">Move down</button>
                  <button className="button danger" disabled={fills.length === 1} onClick={() => removeFill(index)} type="button">Remove</button>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="fuel-event-notes-heading">
        <div className="full-width-field"><h2 id="fuel-event-notes-heading">Notes</h2></div>
        <label className="full-width-field">
          <span>Notes (optional)</span>
          <textarea
            aria-label="Notes (optional)"
            aria-describedby={notesError ? errorId("notes") : undefined}
            aria-invalid={notesError || undefined}
            maxLength={2000}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            value={notes}
          />
          {firstError(state, "notes")}
        </label>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>Cancel</a>
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
