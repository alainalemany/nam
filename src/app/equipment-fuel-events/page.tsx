import Link from "next/link";

import { equipmentFuelTypeOptions, fuelTypeLabel } from "@/features/equipment-fuel-events/constants";
import { displayEquipmentFuelDate } from "@/features/equipment-fuel-events/date";
import { getEquipmentFuelEvents, getEquipmentFuelFilterOptions } from "@/features/equipment-fuel-events/data";
import { hasEquipmentFuelFilters, parseEquipmentFuelFilters, type EquipmentFuelSearchParams } from "@/features/equipment-fuel-events/filters";

export const dynamic = "force-dynamic";

export default async function EquipmentFuelEventsPage({ searchParams }: { searchParams?: Promise<EquipmentFuelSearchParams> }) {
  const filters = parseEquipmentFuelFilters((await searchParams) ?? {});
  const [events, filterOptions] = await Promise.all([
    getEquipmentFuelEvents(filters),
    getEquipmentFuelFilterOptions(),
  ]);
  const filtersActive = hasEquipmentFuelFilters(filters);

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Equipment Operations</p><h1>Equipment Fuel Events</h1><p className="summary">Completed operational fueling occurrences with structured Tank Fills and delivered gallons.</p></div>
        <div className="inline-actions"><Link className="button secondary" href="/equipment-fuel-events/service-personnel">Service Personnel</Link><Link className="button primary" href="/equipment-fuel-events/new">Record Fuel Event</Link></div>
      </section>

      <section className="panel filter-panel" aria-labelledby="fuel-event-filters-heading">
        <form action="/equipment-fuel-events" className="form-stack">
          <div className="section-heading"><h2 id="fuel-event-filters-heading">Find Fuel Events</h2>{filtersActive ? <Link className="button secondary" href="/equipment-fuel-events">Clear</Link> : null}</div>
          <div className="form-grid">
            <label><span>From</span><input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" /></label>
            <label><span>To</span><input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" /></label>
            <label><span>Equipment</span><select defaultValue={filters.equipmentId ?? ""} name="equipmentId"><option value="">All Equipment</option>{filterOptions.equipment.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.displayName}{equipment.equipmentNumber ? ` #${equipment.equipmentNumber}` : ""}</option>)}</select></label>
            <label><span>Fuel type</span><select defaultValue={filters.fuelType ?? ""} name="fuelType"><option value="">All fuel types</option>{equipmentFuelTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><span>Fuel Service Person</span><select defaultValue={filters.fuelServicePersonId ?? ""} name="fuelServicePersonId"><option value="">All service people</option>{filterOptions.people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
          </div>
          <div className="filter-actions"><button className="button primary" type="submit">Apply Filters</button></div>
        </form>
      </section>

      <section className="panel table-panel" aria-labelledby="fuel-events-heading">
        <div className="section-heading"><h2 id="fuel-events-heading">Completed Fuel Events</h2><span className="count-pill">{events.length}</span></div>
        {events.length === 0 ? (
          <div className="empty-state"><h3>{filtersActive ? "No matching Fuel Events" : "No Fuel Events yet"}</h3><p>{filtersActive ? "Clear or adjust the current filters." : "Record the first operational fueling occurrence."}</p>{filtersActive ? <Link className="button secondary" href="/equipment-fuel-events">Clear Filters</Link> : <Link className="button primary" href="/equipment-fuel-events/new">Record Fuel Event</Link>}</div>
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Date and time</th><th>Equipment</th><th>Fuel</th><th>Tank Fills</th><th>Service person</th><th>Actions</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{displayEquipmentFuelDate(event.operationalWorkDate)}<span className="subtle">{event.eventTime} local</span></td><td>{event.equipmentDisplayName}<span className="subtle">{event.equipmentNumber ?? "No Equipment number"} · {event.mineName}</span></td><td>{fuelTypeLabel(event.fuelType)}<span className="subtle">{event.totalGallons.toLocaleString()} gal total</span></td><td>{event.tankFills.length}<span className="subtle">{event.tankFills.map((fill) => fill.tankLabel).join(", ")}</span></td><td>{event.fuelServicePersonDisplayNameSnapshot ?? "Not recorded"}</td><td className="action-cell"><Link className="table-action" href={`/equipment-fuel-events/${event.id}`}>View</Link><Link className="table-action" href={`/equipment-fuel-events/${event.id}/edit`}>Correct</Link></td></tr>)}</tbody></table></div>
        )}
      </section>
    </main>
  );
}
