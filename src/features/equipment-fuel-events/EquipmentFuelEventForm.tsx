"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getEquipmentFuelTankLabelSuggestionsAction } from "./actions";
import {
  compatibleFuelTypes,
  equipmentFuelMeterTypeOptions,
  equipmentFuelTypeOptions,
  maxTankFills,
} from "./constants";
import { localEquipmentFuelDateValue, localEquipmentFuelTimeValue } from "./date";
import type {
  EquipmentFuelEquipmentOption,
  EquipmentFuelEventFormInitialValues,
  EquipmentFuelGasStationOption,
  EquipmentFuelTankFillValue,
} from "./types";
import { emptyEquipmentFuelActionState, type EquipmentFuelActionState } from "./validation";

type Props = {
  action: (previousState: EquipmentFuelActionState, formData: FormData) => Promise<EquipmentFuelActionState>;
  cancelHref: string;
  equipmentOptions: EquipmentFuelEquipmentOption[];
  gasStationOptions?: EquipmentFuelGasStationOption[];
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

function previewNumber(value: string) {
  return /^\d+(?:\.\d{1,3})?$/.test(value.trim()) ? Number(value) : null;
}

function previewCost(gallons: string, price: string) {
  const gallonsValue = previewNumber(gallons);
  const priceValue = previewNumber(price);
  return gallonsValue !== null && priceValue !== null
    ? `$${(gallonsValue * priceValue).toFixed(2)}`
    : "—";
}

export function EquipmentFuelEventForm({
  action,
  cancelHref,
  equipmentOptions,
  gasStationOptions = [],
  initialTankLabelSuggestions = [],
  submitLabel,
  initialValues,
  unavailableEquipmentLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, emptyEquipmentFuelActionState);
  const nextRowNumber = useRef(0);

  function emptyFill(sequence = 1): EquipmentFuelTankFillValue {
    nextRowNumber.current += 1;
    return { clientRowId: `fuel-tank-fill-${nextRowNumber.current}`, sequence, tankLabel: "", gallons: "" };
  }

  function initialFills(): EquipmentFuelTankFillValue[] {
    if (!initialValues?.tankFills.length) return [emptyFill()];
    return initialValues.tankFills.map((fill) => ({ ...fill, clientRowId: emptyFill().clientRowId }));
  }

  const [operationalWorkDate, setOperationalWorkDate] = useState(initialValues?.operationalWorkDate ?? localEquipmentFuelDateValue());
  const [eventTime, setEventTime] = useState(initialValues?.eventTime ?? localEquipmentFuelTimeValue());
  const [equipmentId, setEquipmentId] = useState(initialValues?.equipmentId ?? "");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [fuelType, setFuelType] = useState<string>(initialValues?.fuelType ?? "DIESEL");
  const [gasStationId, setGasStationId] = useState(initialValues?.gasStationId ?? "");
  const [gasStationQuery, setGasStationQuery] = useState("");
  const [pricePerGallon, setPricePerGallon] = useState(initialValues?.pricePerGallon ?? "");
  const [meterType, setMeterType] = useState<string>(initialValues?.meterType ?? "NOT_APPLICABLE");
  const [meterReading, setMeterReading] = useState(initialValues?.meterReading ?? "");
  const [receiptReference, setReceiptReference] = useState(initialValues?.receiptReference ?? "");
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
    setGasStationId(state.values.gasStationId);
    setPricePerGallon(state.values.pricePerGallon);
    setMeterType(state.values.meterType);
    setMeterReading(state.values.meterReading);
    setReceiptReference(state.values.receiptReference);
    setNotes(state.values.notes);
    setFills(state.values.tankFills.length ? state.values.tankFills : [emptyFill()]);
  }, [state.values]);

  const selectedEquipment = equipmentOptions.find((option) => option.id === equipmentId);
  const selectedGasStation = gasStationOptions.find((option) => option.id === gasStationId);
  const allowedFuelTypes = compatibleFuelTypes(selectedEquipment?.powerType ?? null);
  const visibleEquipment = equipmentOptions.filter((option) =>
    option.id === equipmentId || option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const visibleGasStations = gasStationOptions.filter((option) =>
    option.id === gasStationId || option.label.toLowerCase().includes(gasStationQuery.trim().toLowerCase()),
  );
  const totalGallons = useMemo(
    () => fills.reduce((total, fill) => total + (previewNumber(fill.gallons) ?? 0), 0),
    [fills],
  );
  const totalCost = previewNumber(pricePerGallon) === null
    ? null
    : totalGallons * (previewNumber(pricePerGallon) ?? 0);
  const payload = JSON.stringify({
    operationalWorkDate,
    eventTime,
    equipmentId,
    fuelType,
    gasStationId,
    pricePerGallon,
    meterType,
    meterReading,
    receiptReference,
    notes,
    tankFills: fills.map((fill, index) => ({ ...fill, sequence: index + 1 })),
  });

  function loadTankLabelSuggestions(nextEquipmentId: string) {
    const request = ++suggestionRequest.current;
    setTankLabelSuggestions([]);
    if (!nextEquipmentId) return;
    startSuggestionLoad(async () => {
      const suggestions = await getEquipmentFuelTankLabelSuggestionsAction(nextEquipmentId);
      if (suggestionRequest.current === request) setTankLabelSuggestions(suggestions);
    });
  }

  function selectEquipment(nextId: string) {
    if (nextId !== equipmentId) setFills([emptyFill()]);
    setEquipmentId(nextId);
    loadTankLabelSuggestions(nextId);
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

  function removeFill(index: number) {
    setFills((current) => current
      .filter((_, fillIndex) => fillIndex !== index)
      .map((fill, fillIndex) => ({ ...fill, sequence: fillIndex + 1 })));
  }

  const fieldError = (path: string) => hasError(state, path);

  return (
    <form action={formAction} className="form-stack">
      <input name="payload" type="hidden" value={payload} />
      {state.status === "error" ? <div className="form-alert" role="alert"><p>{state.message}</p></div> : null}
      {unavailableEquipmentLabel ? <div className="form-alert" role="status"><p>Original Equipment unavailable: {unavailableEquipmentLabel}</p><span>Select current active eligible Equipment and enter fresh Tank Fills before saving this correction.</span></div> : null}

      <section className="panel form-section" aria-labelledby="fuel-event-context-heading">
        <div className="full-width-field"><p className="eyebrow">Completed on submission</p><h2 id="fuel-event-context-heading">Fueling context</h2></div>
        <div className="form-grid full-width-field">
          <label><span>Operational work date</span><input aria-label="Operational work date" aria-describedby={fieldError("operationalWorkDate") ? errorId("operationalWorkDate") : undefined} aria-invalid={fieldError("operationalWorkDate") || undefined} onChange={(event) => setOperationalWorkDate(event.target.value)} type="date" value={operationalWorkDate} />{firstError(state, "operationalWorkDate")}</label>
          <label><span>Local event time</span><input aria-label="Local event time" aria-describedby={fieldError("eventTime") ? errorId("eventTime") : undefined} aria-invalid={fieldError("eventTime") || undefined} onChange={(event) => setEventTime(event.target.value)} type="time" value={eventTime} />{firstError(state, "eventTime")}</label>
          <label><span>Find Equipment</span><input aria-label="Find Equipment" autoComplete="off" onChange={(event) => setEquipmentQuery(event.target.value)} placeholder="Name, number, or mine" type="search" value={equipmentQuery} /></label>
          <label><span>Equipment</span><select aria-label="Equipment" aria-describedby={fieldError("equipmentId") ? errorId("equipmentId") : undefined} aria-invalid={fieldError("equipmentId") || undefined} onChange={(event) => selectEquipment(event.target.value)} value={equipmentId}><option value="">Select Equipment</option>{visibleEquipment.map((equipment) => <option disabled={equipment.status !== "ACTIVE" && equipment.id !== initialValues?.equipmentId} key={equipment.id} value={equipment.id}>{equipment.label}{equipment.status !== "ACTIVE" ? " (inactive)" : ""}</option>)}</select>{firstError(state, "equipmentId")}</label>
          <label><span>Fuel type</span><select aria-label="Fuel type" aria-describedby={fieldError("fuelType") ? errorId("fuelType") : undefined} aria-invalid={fieldError("fuelType") || undefined} onChange={(event) => setFuelType(event.target.value)} value={fuelType}>{equipmentFuelTypeOptions.map((option) => <option disabled={!allowedFuelTypes.includes(option.value as never)} key={option.value} value={option.value}>{option.label}</option>)}</select>{firstError(state, "fuelType")}</label>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite"><div><span>Equipment</span><strong>{selectedEquipment?.label ?? "Select Equipment"}</strong></div><div><span>Power context</span><strong>{selectedEquipment?.powerType ?? "Select Equipment"}</strong></div></div>
      </section>

      <section className="panel form-section" aria-labelledby="station-pricing-heading">
        <div className="section-heading full-width-field"><div><p className="eyebrow">Fueling location</p><h2 id="station-pricing-heading">Station and pricing</h2></div><Link className="button secondary" href="/equipment-fuel-events/gas-stations">Manage Gas Stations</Link></div>
        <div className="form-grid full-width-field">
          <label><span>Find Gas Station</span><input aria-label="Find Gas Station" autoComplete="off" onChange={(event) => setGasStationQuery(event.target.value)} placeholder="Name, address, City, or ZIP" type="search" value={gasStationQuery} /></label>
          <label><span>Gas Station</span><select aria-label="Gas Station" aria-describedby={fieldError("gasStationId") ? errorId("gasStationId") : undefined} aria-invalid={fieldError("gasStationId") || undefined} onChange={(event) => setGasStationId(event.target.value)} value={gasStationId}><option value="">Select Gas Station</option>{visibleGasStations.map((station) => <option disabled={!station.isActive && station.id !== initialValues?.gasStationId} key={station.id} value={station.id}>{station.label}{!station.isActive ? " (inactive)" : ""}</option>)}</select>{firstError(state, "gasStationId")}</label>
          <label><span>Price per gallon</span><input aria-label="Price per gallon" aria-describedby={fieldError("pricePerGallon") ? errorId("pricePerGallon") : undefined} aria-invalid={fieldError("pricePerGallon") || undefined} inputMode="decimal" min="0.001" onChange={(event) => setPricePerGallon(event.target.value)} placeholder="0.000" step="0.001" type="number" value={pricePerGallon} />{firstError(state, "pricePerGallon")}</label>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite"><div><span>Selected station</span><strong>{selectedGasStation?.label ?? "Select Gas Station"}</strong></div><div><span>Estimated event cost</span><strong>{totalCost === null ? "—" : `$${totalCost.toFixed(2)}`}</strong></div></div>
      </section>

      <section className="panel form-section" aria-labelledby="tank-fills-heading">
        <div className="section-heading full-width-field"><div><p className="eyebrow">US gallons</p><h2 id="tank-fills-heading">Tank Fills</h2></div><button className="button secondary" disabled={fills.length >= maxTankFills} onClick={() => setFills((current) => [...current, emptyFill(current.length + 1)])} type="button">Add Tank Fill</button></div>
        {firstError(state, "tankFills")}
        <datalist id="fuel-tank-label-suggestions">{tankLabelSuggestions.map((label) => <option key={label} value={label} />)}</datalist>
        <div aria-busy={loadingSuggestions} className="fuel-fill-list full-width-field">
          {fills.map((fill, index) => {
            const labelPath = `tankFills.${index}.tankLabel`;
            const gallonsPath = `tankFills.${index}.gallons`;
            return <fieldset className="fuel-fill-row" data-client-row-id={fill.clientRowId} key={fill.clientRowId}><legend>Tank Fill {index + 1}</legend>{firstError(state, `tankFills.${index}.sequence`)}<label><span>Tank label</span><input aria-label="Tank label" aria-describedby={fieldError(labelPath) ? errorId(labelPath) : undefined} aria-invalid={fieldError(labelPath) || undefined} list="fuel-tank-label-suggestions" maxLength={100} onChange={(event) => updateFill(index, { tankLabel: event.target.value })} value={fill.tankLabel} />{firstError(state, labelPath)}</label><label><span>Delivered gallons</span><input aria-label="Delivered gallons" aria-describedby={fieldError(gallonsPath) ? errorId(gallonsPath) : undefined} aria-invalid={fieldError(gallonsPath) || undefined} inputMode="decimal" max="999999" min="0.001" onChange={(event) => updateFill(index, { gallons: event.target.value })} step="0.001" type="number" value={fill.gallons} />{firstError(state, gallonsPath)}</label><div className="fuel-fill-cost"><span>Calculated cost</span><strong>{previewCost(fill.gallons, pricePerGallon)}</strong></div><div className="inline-actions fuel-fill-actions"><button className="button secondary" disabled={index === 0} onClick={() => moveFill(index, -1)} type="button">Move up</button><button className="button secondary" disabled={index === fills.length - 1} onClick={() => moveFill(index, 1)} type="button">Move down</button><button className="button danger" disabled={fills.length === 1} onClick={() => removeFill(index)} type="button">Remove</button></div></fieldset>;
          })}
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite"><div><span>Total gallons</span><strong>{totalGallons.toLocaleString(undefined, { maximumFractionDigits: 3 })} gal</strong></div><div><span>Estimated event cost</span><strong>{totalCost === null ? "—" : `$${totalCost.toFixed(2)}`}</strong></div></div>
      </section>

      <section className="panel form-section" aria-labelledby="equipment-meter-heading">
        <div className="full-width-field"><h2 id="equipment-meter-heading">Equipment meter</h2></div>
        <div className="form-grid full-width-field">
          <label><span>Meter type</span><select aria-label="Meter type" aria-describedby={fieldError("meterType") ? errorId("meterType") : undefined} aria-invalid={fieldError("meterType") || undefined} onChange={(event) => { setMeterType(event.target.value); if (event.target.value === "NOT_APPLICABLE") setMeterReading(""); }} value={meterType}><option value="">Select meter type</option>{equipmentFuelMeterTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{firstError(state, "meterType")}</label>
          {meterType !== "NOT_APPLICABLE" ? <label><span>Meter reading</span><input aria-label="Meter reading" aria-describedby={fieldError("meterReading") ? errorId("meterReading") : undefined} aria-invalid={fieldError("meterReading") || undefined} inputMode="decimal" min="0" onChange={(event) => setMeterReading(event.target.value)} step="0.001" type="number" value={meterReading} />{firstError(state, "meterReading")}</label> : null}
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="fuel-event-receipt-heading">
        <div className="full-width-field"><h2 id="fuel-event-receipt-heading">Receipt</h2></div>
        <label className="full-width-field"><span>Receipt number/reference (optional)</span><input aria-label="Receipt number/reference (optional)" aria-describedby={fieldError("receiptReference") ? errorId("receiptReference") : undefined} aria-invalid={fieldError("receiptReference") || undefined} maxLength={200} onChange={(event) => setReceiptReference(event.target.value)} value={receiptReference} />{firstError(state, "receiptReference")}</label>
      </section>

      <section className="panel form-section" aria-labelledby="fuel-event-notes-heading">
        <div className="full-width-field"><h2 id="fuel-event-notes-heading">Notes</h2></div>
        <label className="full-width-field"><span>Notes (optional)</span><textarea aria-label="Notes (optional)" aria-describedby={fieldError("notes") ? errorId("notes") : undefined} aria-invalid={fieldError("notes") || undefined} maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={4} value={notes} />{firstError(state, "notes")}</label>
      </section>

      <div className="form-actions"><a className="button secondary" href={cancelHref}>Cancel</a><button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : submitLabel}</button></div>
    </form>
  );
}
