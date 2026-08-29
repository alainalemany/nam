"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";

import { searchCityOptionsAction } from "@/features/geography/actions";
import type { GasStationActionState } from "./gas-station-validation";
import { emptyGasStationActionState } from "./gas-station-validation";

type Props = {
  action: (state: GasStationActionState, formData: FormData) => Promise<GasStationActionState>;
  cities: { id: string; label: string; status: string }[];
  initial?: { name: string; address: string; cityId: string; postalCode: string };
};

type GasStationFormField = "name" | "address" | "cityId" | "postalCode";

function errorId(field: string) {
  return `gas-station-${field}-error`;
}

export function GasStationForm({ action, cities, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, emptyGasStationActionState);
  const [cityOptions, setCityOptions] = useState(cities);
  const [citySearch, setCitySearch] = useState("");
  const [searchPending, startSearch] = useTransition();
  const searchRequest = useRef(0);
  const value = (field: GasStationFormField) => state.status === "error"
    ? state.values[field]
    : initial?.[field] ?? "";
  const error = (field: string) => state.fieldErrors[field]?.[0];
  const attributes = (field: string) => error(field)
    ? { "aria-describedby": errorId(field), "aria-invalid": true as const }
    : {};

  return (
    <form action={formAction} className="panel form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
      <div className="form-grid">
        <label>
          <span>Station name</span>
          <input {...attributes("name")} defaultValue={value("name")} maxLength={200} name="name" required />
          {error("name") ? <span className="field-error" id={errorId("name")}>{error("name")}</span> : null}
        </label>
        <label>
          <span>Address/location (optional)</span>
          <input {...attributes("address")} defaultValue={value("address")} maxLength={300} name="address" />
          {error("address") ? <span className="field-error" id={errorId("address")}>{error("address")}</span> : null}
        </label>
        <label>
          <span>Find City</span>
          <input
            autoComplete="off"
            onChange={(event) => {
              const query = event.currentTarget.value;
              const request = ++searchRequest.current;
              setCitySearch(query);
              startSearch(async () => {
                const options = await searchCityOptionsAction(query, value("cityId") || initial?.cityId);
                if (request === searchRequest.current) setCityOptions(options);
              });
            }}
            placeholder="Search city or state"
            type="search"
            value={citySearch}
          />
          <span className="field-hint" aria-live="polite">
            {searchPending ? "Searching cities..." : "Enter at least 2 characters."}
          </span>
        </label>
        <label>
          <span>City</span>
          <select {...attributes("cityId")} defaultValue={value("cityId")} name="cityId" required>
            <option value="">Select City</option>
            {cityOptions.map((city) => (
              <option disabled={city.status !== "ACTIVE" && city.id !== initial?.cityId} key={city.id} value={city.id}>
                {city.label}{city.status !== "ACTIVE" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
          {error("cityId") ? <span className="field-error" id={errorId("cityId")}>{error("cityId")}</span> : null}
        </label>
        <label>
          <span>ZIP/postal code (optional)</span>
          <input {...attributes("postalCode")} defaultValue={value("postalCode")} maxLength={20} name="postalCode" />
          {error("postalCode") ? <span className="field-error" id={errorId("postalCode")}>{error("postalCode")}</span> : null}
        </label>
      </div>
      <div className="inline-actions">
        <button className="button primary" disabled={pending} type="submit">{pending ? "Saving..." : "Save Gas Station"}</button>
        <Link className="button secondary" href="/equipment-fuel-events/gas-stations">Cancel</Link>
      </div>
    </form>
  );
}
