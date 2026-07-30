"use client";

import Link from "next/link";
import {
  useActionState,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  createSupplyRequestAction,
  searchSupplyRequestEquipmentAction,
  searchSupplyRequestItemsAction,
  searchSupplyRequestSupervisorsAction,
} from "./surface-actions";
import type {
  SupplyRequestCreateActionState,
  SupplyRequestCreatePageData,
  SupplyRequestEquipmentOption,
  SupplyRequestItemOption,
  SupplyRequestSupervisorOption,
} from "./surface-types";

const confirmationText =
  "I confirm that this request was successfully submitted through the corporate system.";

function FieldError({
  state,
  field,
  id,
}: {
  state: SupplyRequestCreateActionState;
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
  state: SupplyRequestCreateActionState,
  field: string,
  id: string,
) {
  return state.fieldErrors[field]?.[0]
    ? { "aria-describedby": id, "aria-invalid": true as const }
    : {};
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
  const searchId = `${label.toLowerCase().replace(/\s+/gu, "-")}-search`;
  return (
    <div className="inline-actions">
      <label className="sr-only" htmlFor={searchId}>
        Search {label}
      </label>
      <input
        id={searchId}
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
        aria-label={`Run ${label} search`}
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

function BlockedState({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="empty-state" role="status">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function recoverSelectedItems(
  recovered: SupplyRequestCreateActionState["items"],
  options: readonly SupplyRequestItemOption[],
) {
  return recovered.flatMap((item) => {
    const option = options.find(
      (candidate) => candidate.id === item.supplyItemId,
    );
    return option ? [{ option, quantity: item.quantity }] : [];
  });
}

export function SupplyRequestCreateForm({
  pageData,
  initialState,
  requester,
  defaults,
}: {
  pageData: SupplyRequestCreatePageData;
  initialState: SupplyRequestCreateActionState;
  requester: Readonly<{ displayName: string; employeeNumber: string }>;
  defaults: Readonly<{ date: string; time: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createSupplyRequestAction,
    initialState,
  );
  const [equipment, setEquipment] = useState(pageData.equipment);
  const [supervisors, setSupervisors] = useState(pageData.supervisors);
  const [items, setItems] = useState(pageData.items);
  const [selectedEquipment, setSelectedEquipment] =
    useState<SupplyRequestEquipmentOption | null>(
      () =>
        pageData.equipment.find(
          (option) => option.id === state.values.equipmentId,
        ) ?? null,
    );
  const [selectedSupervisor, setSelectedSupervisor] =
    useState<SupplyRequestSupervisorOption | null>(
      () =>
        pageData.supervisors.find(
          (option) => option.id === state.values.supervisorId,
        ) ?? null,
    );
  const selectedEquipmentRef =
    useRef<SupplyRequestEquipmentOption | null>(selectedEquipment);
  const selectedSupervisorRef =
    useRef<SupplyRequestSupervisorOption | null>(selectedSupervisor);
  const [selectedItems, setSelectedItems] = useState<
    Array<{ option: SupplyRequestItemOption; quantity: number }>
  >(() => recoverSelectedItems(state.items, pageData.items));
  const [itemChoice, setItemChoice] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [clientMessage, setClientMessage] = useState("");
  const [searchPending, startSearch] = useTransition();
  const equipmentSearchSequence = useRef(0);
  const supervisorSearchSequence = useRef(0);
  const itemSearchSequence = useRef(0);

  const blocked =
    Boolean(pageData.loadError) ||
    !pageData.hasActiveEquipment ||
    !pageData.hasActiveSupervisors ||
    !pageData.hasActiveItems;

  function searchEquipment(query: string) {
    const requestSequence = ++equipmentSearchSequence.current;
    startSearch(async () => {
      const result = await searchSupplyRequestEquipmentAction(query);
      if (requestSequence !== equipmentSearchSequence.current) return;
      const selected = selectedEquipmentRef.current;
      setEquipment(
        selected &&
          !result.options.some((option) => option.id === selected.id)
          ? [selected, ...result.options]
          : result.options,
      );
      setClientMessage(result.error ?? "");
    });
  }

  function searchSupervisors(query: string) {
    const requestSequence = ++supervisorSearchSequence.current;
    startSearch(async () => {
      const result = await searchSupplyRequestSupervisorsAction(query);
      if (requestSequence !== supervisorSearchSequence.current) return;
      const selected = selectedSupervisorRef.current;
      setSupervisors(
        selected &&
          !result.options.some((option) => option.id === selected.id)
          ? [selected, ...result.options]
          : result.options,
      );
      setClientMessage(result.error ?? "");
    });
  }

  function searchItems(query: string) {
    const requestSequence = ++itemSearchSequence.current;
    startSearch(async () => {
      const result = await searchSupplyRequestItemsAction(query);
      if (requestSequence !== itemSearchSequence.current) return;
      setItems(result.options);
      setClientMessage(result.error ?? "");
    });
  }

  function addItem() {
    const option = items.find((candidate) => candidate.id === itemChoice);
    if (!option) {
      setClientMessage("Choose a Supply Item before adding it.");
      return;
    }
    if (selectedItems.some((item) => item.option.id === option.id)) {
      setClientMessage("Each Supply Item can be selected only once.");
      return;
    }
    if (
      !Number.isSafeInteger(newQuantity) ||
      newQuantity < 1 ||
      newQuantity > 999_999
    ) {
      setClientMessage("Quantity must be a whole number from 1 through 999999.");
      return;
    }
    setSelectedItems((current) => [...current, { option, quantity: newQuantity }]);
    setItemChoice("");
    setNewQuantity(1);
    setClientMessage("");
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

  if (blocked) {
    return (
      <section className="panel form-stack">
        {pageData.loadError ? (
          <BlockedState title="Reference data unavailable">
            <p>{pageData.loadError}</p>
          </BlockedState>
        ) : null}
        {!pageData.loadError && !pageData.hasActiveEquipment ? (
          <BlockedState title="Active Equipment is required">
            <p>
              No active Equipment is available. Use the established Equipment
              management workflow before recording a Supply Request.
            </p>
          </BlockedState>
        ) : null}
        {!pageData.loadError && !pageData.hasActiveSupervisors ? (
          <BlockedState title="An active supervisor is required">
            <p>Create or reactivate a supervisor before continuing.</p>
            <Link
              className="button secondary"
              href="/supply-requests/supervisors/new"
            >
              Add Supervisor
            </Link>
          </BlockedState>
        ) : null}
        {!pageData.loadError && !pageData.hasActiveItems ? (
          <BlockedState title="At least one active Supply Item is required">
            <p>Create or reactivate a catalog item before continuing.</p>
            <Link className="button secondary" href="/supply-requests/items/new">
              Add Supply Item
            </Link>
          </BlockedState>
        ) : null}
      </section>
    );
  }

  return (
    <form action={formAction} className="page-stack">
      {state.message ? (
        <div className="form-alert" role="alert">
          {state.message}
        </div>
      ) : null}
      {clientMessage ? (
        <div className="form-alert" role="status">
          {clientMessage}
        </div>
      ) : null}

      <section className="panel detail-grid" aria-labelledby="request-context">
        <h2 className="full-width-field" id="request-context">
          Request context
        </h2>
        <div>
          <p className="eyebrow">Requested by</p>
          <p>{requester.displayName}</p>
        </div>
        <div>
          <p className="eyebrow">Employee number</p>
          <p>{requester.employeeNumber}</p>
        </div>
        <div>
          <p className="eyebrow">Warehouse</p>
          <p>South Warehouse</p>
        </div>
      </section>

      <section className="panel form-stack" aria-labelledby="request-facts">
        <h2 id="request-facts">Submission facts</h2>
        <div className="form-grid">
          <div className="form-stack">
            <label htmlFor="supply-request-work-date">
              Operational work date
            </label>
            <input
              {...errorAttributes(
                state,
                "operationalWorkDate",
                "supply-request-work-date-error",
              )}
              defaultValue={
                state.values.operationalWorkDate || defaults.date
              }
              id="supply-request-work-date"
              name="operationalWorkDate"
              required
              type="date"
            />
            <FieldError
              field="operationalWorkDate"
              id="supply-request-work-date-error"
              state={state}
            />
          </div>
          <div className="form-stack">
            <label htmlFor="supply-request-submitted-date">
              Submitted local date
            </label>
            <input
              {...errorAttributes(
                state,
                "submittedLocalDate",
                "supply-request-submitted-date-error",
              )}
              defaultValue={state.values.submittedLocalDate || defaults.date}
              id="supply-request-submitted-date"
              name="submittedLocalDate"
              required
              type="date"
            />
            <FieldError
              field="submittedLocalDate"
              id="supply-request-submitted-date-error"
              state={state}
            />
          </div>
          <div className="form-stack">
            <label htmlFor="supply-request-submitted-time">
              Submitted local time
            </label>
            <input
              {...errorAttributes(
                state,
                "submittedLocalTime",
                "supply-request-submitted-time-error",
              )}
              defaultValue={state.values.submittedLocalTime || defaults.time}
              id="supply-request-submitted-time"
              name="submittedLocalTime"
              required
              type="time"
            />
            <FieldError
              field="submittedLocalTime"
              id="supply-request-submitted-time-error"
              state={state}
            />
          </div>
        </div>
      </section>

      <section className="panel form-stack" aria-labelledby="equipment-heading">
        <h2 id="equipment-heading">Equipment</h2>
        <SearchBox
          label="Equipment"
          onSearch={searchEquipment}
          pending={searchPending}
        />
        {equipment.length === 0 ? (
          <p className="subtle">No active Equipment matches this search.</p>
        ) : (
          <select
            {...errorAttributes(
              state,
              "equipmentId",
              "supply-request-equipment-error",
            )}
            aria-label="Active Equipment"
            onChange={(event) => {
              const option =
                equipment.find((item) => item.id === event.target.value) ?? null;
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
        )}
        {selectedEquipment ? (
          <p className="subtle">
            {selectedEquipment.label} — {selectedEquipment.mineName},{" "}
            {selectedEquipment.cityName}
            {selectedEquipment.cityState
              ? `, ${selectedEquipment.cityState}`
              : ""}
          </p>
        ) : null}
        <input
          name="equipmentId"
          type="hidden"
          value={selectedEquipment?.id ?? state.values.equipmentId}
        />
        <FieldError
          field="equipmentId"
          id="supply-request-equipment-error"
          state={state}
        />
      </section>

      <section className="panel form-stack" aria-labelledby="supervisor-heading">
        <h2 id="supervisor-heading">Supervisor</h2>
        <SearchBox
          label="Supervisors"
          onSearch={searchSupervisors}
          pending={searchPending}
        />
        {supervisors.length === 0 ? (
          <div className="form-stack">
            <p className="subtle">No active supervisors match this search.</p>
            <Link
              className="table-action"
              href="/supply-requests/supervisors/new"
            >
              Add Supervisor
            </Link>
          </div>
        ) : (
          <select
            {...errorAttributes(
              state,
              "supervisorId",
              "supply-request-supervisor-error",
            )}
            aria-label="Active Supervisor"
            onChange={(event) => {
              const option =
                supervisors.find((item) => item.id === event.target.value) ??
                null;
              selectedSupervisorRef.current = option;
              setSelectedSupervisor(option);
            }}
            value={selectedSupervisor?.id ?? ""}
          >
            <option value="">Choose Supervisor</option>
            {supervisors.map((option) => (
              <option key={option.id} value={option.id}>
                {option.fullName} · {option.email}
              </option>
            ))}
          </select>
        )}
        {selectedSupervisor ? (
          <p className="subtle">Email: {selectedSupervisor.email}</p>
        ) : null}
        <input
          name="supervisorId"
          type="hidden"
          value={selectedSupervisor?.id ?? state.values.supervisorId}
        />
        <FieldError
          field="supervisorId"
          id="supply-request-supervisor-error"
          state={state}
        />
      </section>

      <section className="panel form-stack" aria-labelledby="items-heading">
        <h2 id="items-heading">Requested items</h2>
        <SearchBox
          label="Supply Items"
          onSearch={searchItems}
          pending={searchPending}
        />
        {items.length === 0 ? (
          <div className="form-stack">
            <p className="subtle">No active Supply Items match this search.</p>
            <Link className="table-action" href="/supply-requests/items/new">
              Add Supply Item
            </Link>
          </div>
        ) : (
          <div className="form-grid">
            <div className="form-stack">
              <label htmlFor="supply-request-item-choice">Supply Item</label>
              <select
                id="supply-request-item-choice"
                onChange={(event) => setItemChoice(event.target.value)}
                value={itemChoice}
              >
                <option value="">Choose Supply Item</option>
                {items.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.itemNumber} · {option.description} · {option.unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-stack">
              <label htmlFor="supply-request-new-quantity">Quantity</label>
              <input
                id="supply-request-new-quantity"
                max={999999}
                min={1}
                onChange={(event) => setNewQuantity(event.target.valueAsNumber)}
                step={1}
                type="number"
                value={Number.isNaN(newQuantity) ? "" : newQuantity}
              />
            </div>
            <div className="form-stack">
              <span className="eyebrow">Unit</span>
              <p>
                {items.find((option) => option.id === itemChoice)?.unit ??
                  "Choose an item"}
              </p>
            </div>
          </div>
        )}
        <button
          {...errorAttributes(
            state,
            "items",
            "supply-request-items-error",
          )}
          className="button secondary"
          disabled={selectedItems.length >= 50}
          onClick={addItem}
          type="button"
        >
          Add selected item
        </button>

        {selectedItems.length === 0 ? (
          <div className="empty-state">
            <h3>No Supply Items selected</h3>
            <p>Add at least one item before recording this request.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Item Number</th>
                  <th scope="col">Description</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item, index) => (
                  <tr key={item.option.id}>
                    <td>{index + 1}</td>
                    <td>{item.option.itemNumber}</td>
                    <td>{item.option.description}</td>
                    <td>
                      <label className="sr-only" htmlFor={`quantity-${item.option.id}`}>
                        Quantity for {item.option.itemNumber}
                      </label>
                      <input
                        id={`quantity-${item.option.id}`}
                        max={999999}
                        min={1}
                        onChange={(event) => {
                          const quantity = event.target.valueAsNumber;
                          setSelectedItems((current) =>
                            current.map((candidate, candidateIndex) =>
                              candidateIndex === index
                                ? { ...candidate, quantity }
                                : candidate,
                            ),
                          );
                        }}
                        step={1}
                        type="number"
                        value={Number.isNaN(item.quantity) ? "" : item.quantity}
                      />
                    </td>
                    <td>{item.option.unit}</td>
                    <td className="action-cell">
                      <button
                        aria-label={`Move ${item.option.itemNumber} up`}
                        className="table-action"
                        disabled={index === 0}
                        onClick={() => moveItem(index, -1)}
                        type="button"
                      >
                        Move Up
                      </button>
                      <button
                        aria-label={`Move ${item.option.itemNumber} down`}
                        className="table-action"
                        disabled={index === selectedItems.length - 1}
                        onClick={() => moveItem(index, 1)}
                        type="button"
                      >
                        Move Down
                      </button>
                      <button
                        aria-label={`Remove ${item.option.itemNumber}`}
                        className="table-action"
                        onClick={() =>
                          setSelectedItems((current) =>
                            current.filter(
                              (candidate) =>
                                candidate.option.id !== item.option.id,
                            ),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <FieldError
          field="items"
          id="supply-request-items-error"
          state={state}
        />
      </section>

      <section className="panel form-stack" aria-labelledby="notes-heading">
        <h2 id="notes-heading">Narrative</h2>
        <label htmlFor="supply-request-notes">Notes (optional)</label>
        <textarea
          {...errorAttributes(state, "notes", "supply-request-notes-error")}
          defaultValue={state.values.notes}
          id="supply-request-notes"
          maxLength={2000}
          name="notes"
          rows={5}
        />
        <FieldError
          field="notes"
          id="supply-request-notes-error"
          state={state}
        />
      </section>

      <section className="panel form-stack" aria-labelledby="confirmation-heading">
        <h2 id="confirmation-heading">Corporate submission confirmation</h2>
        <p>
          NAM records a request that has already been submitted. NAM does not
          submit the corporate request.
        </p>
        <label>
          <input
            {...errorAttributes(
              state,
              "corporateSubmissionConfirmed",
              "supply-request-confirmation-error",
            )}
            defaultChecked={state.values.corporateSubmissionConfirmed}
            name="corporateSubmissionConfirmed"
            type="checkbox"
            value="true"
          />{" "}
          {confirmationText}
        </label>
        <FieldError
          field="corporateSubmissionConfirmed"
          id="supply-request-confirmation-error"
          state={state}
        />
      </section>

      <div className="inline-actions">
        <button
          className="button primary"
          disabled={pending || selectedItems.length === 0}
          type="submit"
        >
          {pending ? "Recording in NAM..." : "Record Supply Request"}
        </button>
        <Link className="button secondary" href="/supply-requests/items">
          Manage Supply Items
        </Link>
      </div>
    </form>
  );
}

export { confirmationText as supplyRequestConfirmationText };
