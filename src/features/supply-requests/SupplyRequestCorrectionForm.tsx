"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";

import { correctSupplyRequestAction } from "./correction-actions";
import {
  searchSupplyRequestEquipmentAction,
  searchSupplyRequestItemsAction,
  searchSupplyRequestSupervisorsAction,
} from "./surface-actions";
import {
  supplyRequestDerivedTitle,
  supplyRequestStatusLabel,
} from "./surface-display";
import type {
  SupplyRequestCorrectionActionState,
  SupplyRequestCorrectionContext,
  SupplyRequestEquipmentOption,
  SupplyRequestItemOption,
  SupplyRequestSupervisorOption,
} from "./surface-types";

function FieldError({
  state,
  field,
  id,
}: {
  state: SupplyRequestCorrectionActionState;
  field: string;
  id: string;
}) {
  const message = state.fieldErrors[field]?.[0];
  return message ? (
    <span className="field-error" id={id}>
      {message}
    </span>
  ) : null;
}

function errorAttributes(
  state: SupplyRequestCorrectionActionState,
  field: string,
  errorId: string,
  helpId?: string,
) {
  const hasError = Boolean(state.fieldErrors[field]?.[0]);
  const describedBy = [helpId, hasError ? errorId : null]
    .filter(Boolean)
    .join(" ");
  return {
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(hasError ? { "aria-invalid": true as const } : {}),
  };
}

function SearchBox({
  label,
  onSearch,
  pending,
}: {
  label: string;
  onSearch: (query: string) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const id = `correction-${label.toLowerCase().replace(/\s+/gu, "-")}-search`;
  return (
    <div className="inline-actions">
      <label className="sr-only" htmlFor={id}>
        Search {label}
      </label>
      <input
        id={id}
        maxLength={200}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSearch(query);
        }}
        placeholder={`Search ${label}`}
        type="search"
        value={query}
      />
      <button
        aria-label={`Run correction ${label} search`}
        className="button secondary"
        disabled={pending}
        onClick={() => onSearch(query)}
        type="button"
      >
        {pending ? "Searching..." : "Search"}
      </button>
    </div>
  );
}

export function SupplyRequestCorrectionForm({
  context,
  initialState,
}: {
  context: SupplyRequestCorrectionContext;
  initialState: SupplyRequestCorrectionActionState;
}) {
  const action = correctSupplyRequestAction.bind(
    null,
    context.detail.supplyRequestId,
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const [equipment, setEquipment] = useState(context.equipment);
  const [supervisors, setSupervisors] = useState(context.supervisors);
  const [items, setItems] = useState(context.items);
  const [selectedEquipment, setSelectedEquipment] =
    useState<SupplyRequestEquipmentOption | null>(
      () =>
        context.equipment.find(
          (option) => option.id === state.values.equipmentId,
        ) ?? null,
    );
  const [selectedSupervisor, setSelectedSupervisor] =
    useState<SupplyRequestSupervisorOption | null>(
      () =>
        context.supervisors.find(
          (option) => option.id === state.values.supervisorId,
        ) ?? null,
    );
  const selectedEquipmentRef = useRef(selectedEquipment);
  const selectedSupervisorRef = useRef(selectedSupervisor);
  const optionById = new Map(context.items.map((item) => [item.id, item]));
  const [selectedItems, setSelectedItems] = useState<
    Array<{ option: SupplyRequestItemOption; quantity: number }>
  >(() =>
    state.items.flatMap((item) => {
      const option = optionById.get(item.supplyItemId);
      return option ? [{ option, quantity: item.quantity }] : [];
    }),
  );
  const [itemChoice, setItemChoice] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [resultingStatus, setResultingStatus] = useState(
    state.values.resultingStatus,
  );
  const [message, setMessage] = useState("");
  const [searchPending, startSearch] = useTransition();
  const equipmentSequence = useRef(0);
  const supervisorSequence = useRef(0);
  const itemSequence = useRef(0);

  function searchEquipment(query: string) {
    const sequence = ++equipmentSequence.current;
    startSearch(async () => {
      const result = await searchSupplyRequestEquipmentAction(query);
      if (sequence !== equipmentSequence.current) return;
      const selected = selectedEquipmentRef.current;
      setEquipment(
        selected && !result.options.some((option) => option.id === selected.id)
          ? [selected, ...result.options]
          : result.options,
      );
      setMessage(result.error ?? "");
    });
  }

  function searchSupervisors(query: string) {
    const sequence = ++supervisorSequence.current;
    startSearch(async () => {
      const result = await searchSupplyRequestSupervisorsAction(query);
      if (sequence !== supervisorSequence.current) return;
      const selected = selectedSupervisorRef.current;
      setSupervisors(
        selected && !result.options.some((option) => option.id === selected.id)
          ? [selected, ...result.options]
          : result.options,
      );
      setMessage(result.error ?? "");
    });
  }

  function searchItems(query: string) {
    const sequence = ++itemSequence.current;
    startSearch(async () => {
      const result = await searchSupplyRequestItemsAction(query);
      if (sequence !== itemSequence.current) return;
      setItems(result.options);
      setMessage(result.error ?? "");
    });
  }

  function addItem() {
    const option = items.find((candidate) => candidate.id === itemChoice);
    if (!option) return setMessage("Choose a Supply Item before adding it.");
    if (selectedItems.some((item) => item.option.id === option.id)) {
      return setMessage("Each Supply Item may appear only once.");
    }
    if (
      !Number.isSafeInteger(newQuantity) ||
      newQuantity < 1 ||
      newQuantity > 999_999
    ) {
      return setMessage(
        "Quantity must be a whole number from 1 through 999999.",
      );
    }
    setSelectedItems((current) => [...current, { option, quantity: newQuantity }]);
    setItemChoice("");
    setNewQuantity(1);
    setMessage("");
  }

  function moveItem(index: number, direction: -1 | 1) {
    setSelectedItems((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  const detail = context.detail;
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Supply Request historical repair</p>
        <h1>Correct Request</h1>
        <p className="summary">
          {supplyRequestDerivedTitle(
            detail.equipmentLabel,
            detail.operationalWorkDate,
          )}
        </p>
      </section>

      <section className="panel detail-grid" aria-labelledby="correction-context">
        <h2 className="full-width-field" id="correction-context">
          Read-only request context
        </h2>
        <div><p className="eyebrow">NAM Reference</p><p>{detail.namReference}</p></div>
        <div><p className="eyebrow">Current version</p><p>{detail.versionNumber}</p></div>
        <div><p className="eyebrow">Current status</p><p>{supplyRequestStatusLabel(detail.status)}</p></div>
        <div><p className="eyebrow">Requested by</p><p>{detail.requesterDisplayName}</p></div>
        <div><p className="eyebrow">Employee number</p><p>{detail.requesterEmployeeNumber}</p></div>
        <div><p className="eyebrow">Warehouse</p><p>South Warehouse</p></div>
      </section>

      <section className="panel">
        <h2>Immutable correction</h2>
        <p>
          Correct Request repairs NAM’s historical record. It does not contact
          or modify the corporate system. Existing immutable versions remain
          unchanged and the Correction Reason becomes permanent history.
        </p>
      </section>

      <form action={formAction} className="page-stack">
        {state.message ? <div className="form-alert" role="alert">{state.message}</div> : null}
        {message ? <div className="form-alert" role="status">{message}</div> : null}
        <input name="expectedCurrentVersionNumber" type="hidden" value={state.values.expectedCurrentVersionNumber} />

        <section className="panel form-stack" aria-labelledby="corrected-facts">
          <h2 id="corrected-facts">Corrected request facts</h2>
          <div className="form-grid">
            {[
              ["operationalWorkDate", "Operational work date", "date"],
              ["submittedLocalDate", "Submitted local date", "date"],
              ["submittedLocalTime", "Submitted local time", "time"],
            ].map(([name, label, type]) => (
              <div className="form-stack" key={name}>
                <label htmlFor={`correction-${name}`}>{label}</label>
                <input
                  {...errorAttributes(state, name, `correction-${name}-error`)}
                  defaultValue={state.values[name as keyof typeof state.values]}
                  id={`correction-${name}`}
                  name={name}
                  required
                  type={type}
                />
                <FieldError state={state} field={name} id={`correction-${name}-error`} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel form-stack" aria-labelledby="correction-equipment">
          <h2 id="correction-equipment">Equipment</h2>
          {context.requiresEquipmentReplacement ? (
            <div className="form-alert" role="status">
              The prior live Equipment record is unavailable. Select an active
              replacement; the older snapshots remain in prior versions.
            </div>
          ) : null}
          <SearchBox label="Equipment" onSearch={searchEquipment} pending={searchPending} />
          <select
            {...errorAttributes(state, "equipmentId", "correction-equipment-error")}
            aria-label="Correction Equipment"
            onChange={(event) => {
              const option = equipment.find((item) => item.id === event.target.value) ?? null;
              selectedEquipmentRef.current = option;
              setSelectedEquipment(option);
            }}
            value={selectedEquipment?.id ?? ""}
          >
            <option value="">Choose Equipment</option>
            {equipment.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.mineName} · {option.cityName}
              </option>
            ))}
          </select>
          <input name="equipmentId" type="hidden" value={selectedEquipment?.id ?? ""} />
          <FieldError state={state} field="equipmentId" id="correction-equipment-error" />
        </section>

        <section className="panel form-stack" aria-labelledby="correction-supervisor">
          <h2 id="correction-supervisor">Supervisor</h2>
          <SearchBox label="Supervisors" onSearch={searchSupervisors} pending={searchPending} />
          <select
            {...errorAttributes(state, "supervisorId", "correction-supervisor-error")}
            aria-label="Correction Supervisor"
            onChange={(event) => {
              const option = supervisors.find((item) => item.id === event.target.value) ?? null;
              selectedSupervisorRef.current = option;
              setSelectedSupervisor(option);
            }}
            value={selectedSupervisor?.id ?? ""}
          >
            <option value="">Choose Supervisor</option>
            {supervisors.map((option) => (
              <option key={option.id} value={option.id}>{option.fullName} · {option.email}</option>
            ))}
          </select>
          {selectedSupervisor ? <p className="subtle">Email: {selectedSupervisor.email}</p> : null}
          <input name="supervisorId" type="hidden" value={selectedSupervisor?.id ?? ""} />
          <FieldError state={state} field="supervisorId" id="correction-supervisor-error" />
        </section>

        <section className="panel form-stack" aria-labelledby="correction-items">
          <h2 id="correction-items">Corrected ordered items</h2>
          <SearchBox label="Supply Items" onSearch={searchItems} pending={searchPending} />
          <div className="form-grid">
            <div className="form-stack">
              <label htmlFor="correction-item-choice">Supply Item</label>
              <select id="correction-item-choice" onChange={(event) => setItemChoice(event.target.value)} value={itemChoice}>
                <option value="">Choose Supply Item</option>
                {items.map((option) => (
                  <option key={option.id} value={option.id}>{option.itemNumber} · {option.description} · {option.unit}</option>
                ))}
              </select>
            </div>
            <div className="form-stack">
              <label htmlFor="correction-new-quantity">Quantity</label>
              <input id="correction-new-quantity" max={999999} min={1} onChange={(event) => setNewQuantity(event.target.valueAsNumber)} step={1} type="number" value={Number.isNaN(newQuantity) ? "" : newQuantity} />
            </div>
          </div>
          <button
            {...errorAttributes(state, "items", "correction-items-error")}
            className="button secondary"
            disabled={selectedItems.length >= 50}
            onClick={addItem}
            type="button"
          >
            Add selected item
          </button>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Order</th><th scope="col">Item Number</th><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Unit</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {selectedItems.map((item, index) => (
                  <tr key={item.option.id}>
                    <td>{index + 1}</td><td>{item.option.itemNumber}</td><td>{item.option.description}</td>
                    <td>
                      <label className="sr-only" htmlFor={`correction-quantity-${item.option.id}`}>Quantity for {item.option.itemNumber}</label>
                      <input id={`correction-quantity-${item.option.id}`} max={999999} min={1} onChange={(event) => {
                        const quantity = event.target.valueAsNumber;
                        setSelectedItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, quantity } : candidate));
                      }} step={1} type="number" value={Number.isNaN(item.quantity) ? "" : item.quantity} />
                    </td>
                    <td>{item.option.unit}</td>
                    <td className="action-cell">
                      <button aria-label={`Move ${item.option.itemNumber} up`} className="table-action" disabled={index === 0} onClick={() => moveItem(index, -1)} type="button">Move Up</button>
                      <button aria-label={`Move ${item.option.itemNumber} down`} className="table-action" disabled={index === selectedItems.length - 1} onClick={() => moveItem(index, 1)} type="button">Move Down</button>
                      <button aria-label={`Remove ${item.option.itemNumber}`} className="table-action" onClick={() => setSelectedItems((current) => current.filter((candidate) => candidate.option.id !== item.option.id))} type="button">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <input
            name="itemsPayload"
            type="hidden"
            value={JSON.stringify(
              selectedItems.map((item) => ({
                supplyItemId: item.option.id,
                quantity: item.quantity,
              })),
            )}
          />
          <FieldError state={state} field="items" id="correction-items-error" />
        </section>

        <section className="panel form-stack" aria-labelledby="correction-narrative">
          <h2 id="correction-narrative">Request narrative</h2>
          <label htmlFor="correction-notes">Notes (optional)</label>
          <textarea {...errorAttributes(state, "notes", "correction-notes-error")} defaultValue={state.values.notes} id="correction-notes" maxLength={2000} name="notes" rows={5} />
          <FieldError state={state} field="notes" id="correction-notes-error" />
        </section>

        <section className="panel form-stack" aria-labelledby="correction-status">
          <h2 id="correction-status">Resulting status and lifecycle facts</h2>
          <label htmlFor="correction-resulting-status">Resulting status</label>
          <select {...errorAttributes(state, "resultingStatus", "correction-resulting-status-error")} id="correction-resulting-status" name="resultingStatus" onChange={(event) => setResultingStatus(event.target.value as typeof resultingStatus)} value={resultingStatus}>
            <option value="REQUESTED">Requested</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <FieldError state={state} field="resultingStatus" id="correction-resulting-status-error" />
          {resultingStatus === "FULFILLED" ? (
            <div className="form-grid">
              {[
                ["fulfillmentOperationalWorkDate", "Fulfillment operational work date", "date"],
                ["fulfilledLocalDate", "Fulfilled local date", "date"],
                ["fulfilledLocalTime", "Fulfilled local time", "time"],
              ].map(([name, label, type]) => (
                <div className="form-stack" key={name}>
                  <label htmlFor={`correction-${name}`}>{label}</label>
                  <input
                    {...errorAttributes(state, name, `correction-${name}-error`)}
                    defaultValue={state.values[name as keyof typeof state.values]}
                    id={`correction-${name}`}
                    name={name}
                    required
                    type={type}
                  />
                  <FieldError
                    state={state}
                    field={name}
                    id={`correction-${name}-error`}
                  />
                </div>
              ))}
              <div className="form-stack">
                <label htmlFor="correction-fulfillment-note">Fulfillment Note (optional)</label>
                <textarea
                  {...errorAttributes(state, "fulfillmentNote", "correction-fulfillment-note-error")}
                  defaultValue={state.values.fulfillmentNote}
                  id="correction-fulfillment-note"
                  maxLength={1000}
                  name="fulfillmentNote"
                />
                <FieldError state={state} field="fulfillmentNote" id="correction-fulfillment-note-error" />
              </div>
            </div>
          ) : null}
          {resultingStatus === "CANCELLED" ? (
            <div className="form-grid">
              <div className="form-stack">
                <label htmlFor="correction-cancelled-date">Cancelled local date</label>
                <input
                  {...errorAttributes(state, "cancelledLocalDate", "correction-cancelled-date-error")}
                  defaultValue={state.values.cancelledLocalDate}
                  id="correction-cancelled-date"
                  name="cancelledLocalDate"
                  required
                  type="date"
                />
                <FieldError state={state} field="cancelledLocalDate" id="correction-cancelled-date-error" />
              </div>
              <div className="form-stack">
                <label htmlFor="correction-cancelled-time">Cancelled local time</label>
                <input
                  {...errorAttributes(state, "cancelledLocalTime", "correction-cancelled-time-error")}
                  defaultValue={state.values.cancelledLocalTime}
                  id="correction-cancelled-time"
                  name="cancelledLocalTime"
                  required
                  type="time"
                />
                <FieldError state={state} field="cancelledLocalTime" id="correction-cancelled-time-error" />
              </div>
              <div className="form-stack">
                <label htmlFor="correction-cancellation-reason">Cancellation Reason (optional)</label>
                <textarea
                  {...errorAttributes(state, "cancellationReason", "correction-cancellation-reason-error")}
                  defaultValue={state.values.cancellationReason}
                  id="correction-cancellation-reason"
                  maxLength={1000}
                  name="cancellationReason"
                />
                <FieldError state={state} field="cancellationReason" id="correction-cancellation-reason-error" />
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel form-stack" aria-labelledby="correction-reason-heading">
          <h2 id="correction-reason-heading">Permanent Correction Reason</h2>
          <label htmlFor="correction-reason">Correction Reason</label>
          <textarea {...errorAttributes(state, "correctionReason", "correction-reason-error", "correction-reason-help")} defaultValue={state.values.correctionReason} id="correction-reason" maxLength={1000} name="correctionReason" required rows={5} />
          <span className="field-help" id="correction-reason-help">
            Explain why NAM’s historical record is being corrected. This
            reason becomes permanent correction history. Use 1000 characters
            or fewer.
          </span>
          <FieldError state={state} field="correctionReason" id="correction-reason-error" />
        </section>

        <div className="inline-actions">
          <button className="button primary" disabled={pending || selectedItems.length === 0 || !selectedEquipment || !selectedSupervisor} type="submit">{pending ? "Saving corrected version..." : "Save Corrected Version"}</button>
          <Link className="button secondary" href={`/supply-requests/${encodeURIComponent(detail.supplyRequestId)}`}>Back to current detail</Link>
        </div>
      </form>
    </main>
  );
}
