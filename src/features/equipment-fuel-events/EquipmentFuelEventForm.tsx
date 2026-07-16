"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";

import { getEquipmentFuelFormContextAction } from "./actions";
import { compatibleFuelTypes, equipmentFuelTypeOptions, maxTankFills } from "./constants";
import { localEquipmentFuelDateValue, localEquipmentFuelTimeValue } from "./date";
import type {
  EquipmentFuelEquipmentOption,
  EquipmentFuelEventFormInitialValues,
  EquipmentFuelTankFillValue,
  FuelDailyLogActivityOption,
  FuelServicePersonOption,
} from "./types";
import { emptyEquipmentFuelActionState, type EquipmentFuelActionState } from "./validation";

type Props = {
  action: (previousState: EquipmentFuelActionState, formData: FormData) => Promise<EquipmentFuelActionState>;
  cancelHref: string;
  equipmentOptions: EquipmentFuelEquipmentOption[];
  servicePeople: FuelServicePersonOption[];
  initialDailyLogActivities?: FuelDailyLogActivityOption[];
  initialTankLabelSuggestions?: string[];
  currentEventId?: string;
  submitLabel: string;
  initialValues?: EquipmentFuelEventFormInitialValues;
  unavailableEquipmentLabel?: string;
};

function firstError(state: EquipmentFuelActionState, path: string) {
  const message = state.fieldErrors[path]?.[0];
  return message ? <p className="field-error">{message}</p> : null;
}

function emptyFill(sequence = 1): EquipmentFuelTankFillValue {
  return { sequence, tankLabel: "", gallons: "" };
}

export function EquipmentFuelEventForm({
  action,
  cancelHref,
  equipmentOptions,
  servicePeople,
  initialDailyLogActivities = [],
  initialTankLabelSuggestions = [],
  currentEventId,
  submitLabel,
  initialValues,
  unavailableEquipmentLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, emptyEquipmentFuelActionState);
  const [operationalWorkDate, setOperationalWorkDate] = useState(initialValues?.operationalWorkDate ?? localEquipmentFuelDateValue());
  const [eventTime, setEventTime] = useState(initialValues?.eventTime ?? localEquipmentFuelTimeValue());
  const [equipmentId, setEquipmentId] = useState(initialValues?.equipmentId ?? "");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [fuelType, setFuelType] = useState(initialValues?.fuelType ?? "DIESEL");
  const [fuelServicePersonId, setFuelServicePersonId] = useState(initialValues?.fuelServicePersonId ?? "");
  const [personQuery, setPersonQuery] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [dailyLogActivityId, setDailyLogActivityId] = useState(initialValues?.dailyLogActivityId ?? "");
  const [dailyLogActivities, setDailyLogActivities] = useState(initialDailyLogActivities);
  const [tankLabelSuggestions, setTankLabelSuggestions] = useState(initialTankLabelSuggestions);
  const [loadingContext, startContextLoad] = useTransition();
  const contextRequest = useRef(0);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [fills, setFills] = useState(initialValues?.tankFills.length ? initialValues.tankFills : [emptyFill()]);

  const selectedEquipment = equipmentOptions.find((option) => option.id === equipmentId);
  const allowedFuelTypes = compatibleFuelTypes(selectedEquipment?.powerType ?? null);
  const visibleEquipment = equipmentOptions.filter((option) =>
    option.id === equipmentId || option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const visiblePeople = servicePeople.filter((person) =>
    person.id === fuelServicePersonId || person.displayName.toLowerCase().includes(personQuery.trim().toLowerCase()),
  );
  const totalGallons = useMemo(
    () => fills.reduce((total, fill) => /^\d+$/.test(fill.gallons) ? total + Number(fill.gallons) : total, 0),
    [fills],
  );
  const payload = JSON.stringify({
    operationalWorkDate,
    eventTime,
    equipmentId,
    fuelType,
    fuelServicePersonId,
    newFuelServicePersonDisplayName: newPersonName,
    dailyLogActivityId,
    notes,
    tankFills: fills.map((fill, index) => ({ ...fill, sequence: index + 1 })),
  });

  function loadContext(nextDate: string, nextEquipmentId: string) {
    const request = ++contextRequest.current;
    setDailyLogActivities([]);
    setTankLabelSuggestions([]);
    if (!nextDate || !nextEquipmentId) return;
    startContextLoad(async () => {
      const context = await getEquipmentFuelFormContextAction(
        nextDate,
        nextEquipmentId,
        currentEventId,
      );
      if (contextRequest.current !== request) return;
      setDailyLogActivities(context.dailyLogActivities);
      setTankLabelSuggestions(context.tankLabelSuggestions);
    });
  }

  function selectEquipment(nextId: string) {
    if (nextId !== equipmentId) {
      setFills([emptyFill()]);
      setDailyLogActivityId("");
    }
    setEquipmentId(nextId);
    loadContext(operationalWorkDate, nextId);
    const next = equipmentOptions.find((option) => option.id === nextId);
    const nextFuelTypes = compatibleFuelTypes(next?.powerType ?? null);
    if (!nextFuelTypes.includes(fuelType as never)) setFuelType(nextFuelTypes[0] ?? "DIESEL");
  }

  function updateFill(index: number, values: Partial<EquipmentFuelTankFillValue>) {
    setFills((current) => current.map((fill, fillIndex) => fillIndex === index ? { ...fill, ...values } : fill));
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

  return (
    <form action={formAction} className="form-stack">
      <input name="payload" type="hidden" value={payload} />
      {state.status === "error" ? <div className="form-alert" role="alert"><p>{state.message}</p></div> : null}
      {unavailableEquipmentLabel ? (
        <div className="form-alert" role="status">
          <p>Original Equipment unavailable: {unavailableEquipmentLabel}</p>
          <span>Select current active eligible Equipment and enter fresh Tank Fills before saving this correction.</span>
        </div>
      ) : null}

      <section className="panel form-section" aria-labelledby="fuel-event-context-heading">
        <div className="full-width-field"><p className="eyebrow">Completed on submission</p><h2 id="fuel-event-context-heading">Fueling context</h2></div>
        <div className="form-grid full-width-field">
          <label><span>Operational work date</span><input type="date" value={operationalWorkDate} onChange={(event) => { const nextDate = event.target.value; setOperationalWorkDate(nextDate); setDailyLogActivityId(""); loadContext(nextDate, equipmentId); }} />{firstError(state, "operationalWorkDate")}</label>
          <label><span>Local event time</span><input type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />{firstError(state, "eventTime")}</label>
          <label><span>Find Equipment</span><input type="search" autoComplete="off" placeholder="Name, number, or mine" value={equipmentQuery} onChange={(event) => setEquipmentQuery(event.target.value)} /></label>
          <label><span>Equipment</span><select value={equipmentId} onChange={(event) => selectEquipment(event.target.value)}><option value="">Select Equipment</option>{visibleEquipment.map((equipment) => <option disabled={equipment.status !== "ACTIVE" && equipment.id !== initialValues?.equipmentId} key={equipment.id} value={equipment.id}>{equipment.label}{equipment.status !== "ACTIVE" ? " (inactive)" : ""}</option>)}</select>{firstError(state, "equipmentId")}</label>
          <label><span>Fuel type</span><select value={fuelType} onChange={(event) => setFuelType(event.target.value as typeof fuelType)}>{equipmentFuelTypeOptions.map((option) => <option disabled={!allowedFuelTypes.includes(option.value as never)} key={option.value} value={option.value}>{option.label}</option>)}</select>{firstError(state, "fuelType")}</label>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div><span>Mine</span><strong>{selectedEquipment?.mineName ?? "Derived from Equipment"}</strong></div>
          <div><span>City</span><strong>{selectedEquipment ? `${selectedEquipment.cityName}${selectedEquipment.cityState ? `, ${selectedEquipment.cityState}` : ""}` : "Derived from Equipment"}</strong></div>
          <div><span>Power context</span><strong>{selectedEquipment?.powerType ?? "Select Equipment"}</strong></div>
          <div><span>Event total</span><strong>{totalGallons.toLocaleString()} gal</strong></div>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="tank-fills-heading">
        <div className="section-heading full-width-field"><div><p className="eyebrow">Whole US gallons</p><h2 id="tank-fills-heading">Tank Fills</h2></div><button className="button secondary" disabled={fills.length >= maxTankFills} onClick={() => setFills((current) => [...current, emptyFill(current.length + 1)])} type="button">Add Tank Fill</button></div>
        {firstError(state, "tankFills")}
        <datalist id="fuel-tank-label-suggestions">{tankLabelSuggestions.map((label) => <option key={label} value={label} />)}</datalist>
        <div className="fuel-fill-list full-width-field">
          {fills.map((fill, index) => (
            <fieldset className="fuel-fill-row" key={`${index}-${fill.sequence}`}>
              <legend>Tank Fill {index + 1}</legend>
              {firstError(state, `tankFills.${index}.sequence`)}
              <label><span>Tank label</span><input list="fuel-tank-label-suggestions" maxLength={100} value={fill.tankLabel} onChange={(event) => updateFill(index, { tankLabel: event.target.value })} />{firstError(state, `tankFills.${index}.tankLabel`)}</label>
              <label><span>Delivered gallons</span><input inputMode="numeric" max="999999" min="1" step="1" type="number" value={fill.gallons} onChange={(event) => updateFill(index, { gallons: event.target.value })} />{firstError(state, `tankFills.${index}.gallons`)}</label>
              <div className="inline-actions fuel-fill-actions">
                <button className="button secondary" disabled={index === 0} onClick={() => moveFill(index, -1)} type="button">Move up</button>
                <button className="button secondary" disabled={index === fills.length - 1} onClick={() => moveFill(index, 1)} type="button">Move down</button>
                <button className="button danger" disabled={fills.length === 1} onClick={() => setFills((current) => current.filter((_, fillIndex) => fillIndex !== index).map((item, fillIndex) => ({ ...item, sequence: fillIndex + 1 })))} type="button">Remove</button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="fuel-event-links-heading">
        <div className="full-width-field"><h2 id="fuel-event-links-heading">Service and timeline context</h2></div>
        <div className="form-grid full-width-field">
          <label><span>Find Fuel Service Person</span><input type="search" autoComplete="off" value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} /></label>
          <label><span>Fuel Service Person (optional)</span><select value={fuelServicePersonId} onChange={(event) => { setFuelServicePersonId(event.target.value); if (event.target.value) setNewPersonName(""); }}><option value="">Not recorded</option>{visiblePeople.map((person) => <option disabled={!person.active && person.id !== initialValues?.fuelServicePersonId} key={person.id} value={person.id}>{person.displayName}{!person.active ? " (inactive)" : ""}</option>)}</select>{firstError(state, "fuelServicePersonId")}</label>
          <label><span>Create Fuel Service Person inline (optional)</span><input maxLength={200} placeholder="New display name" value={newPersonName} onChange={(event) => { setNewPersonName(event.target.value); if (event.target.value) setFuelServicePersonId(""); }} />{firstError(state, "newFuelServicePersonDisplayName")}</label>
          <label><span>Daily Work Log Fueling activity (optional)</span><select disabled={!operationalWorkDate || !equipmentId || loadingContext} value={dailyLogActivityId} onChange={(event) => setDailyLogActivityId(event.target.value)}><option value="">{loadingContext ? "Loading matching activities..." : "No link"}</option>{dailyLogActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.label}</option>)}</select>{firstError(state, "dailyLogActivityId")}</label>
        </div>
        <label className="full-width-field"><span>Notes (optional)</span><textarea maxLength={2000} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />{firstError(state, "notes")}</label>
      </section>

      <div className="form-actions"><a className="button secondary" href={cancelHref}>Cancel</a><button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : submitLabel}</button></div>
    </form>
  );
}
