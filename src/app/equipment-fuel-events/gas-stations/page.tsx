import Link from "next/link";

import { changeGasStationStatusAction } from "@/features/equipment-fuel-events/gas-station-actions";
import { getGasStationManagementList, parseGasStationFilters } from "@/features/equipment-fuel-events/gas-station-data";
import { GasStationStatusForm } from "@/features/equipment-fuel-events/GasStationStatusForm";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function GasStationsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const filters = parseGasStationFilters((await searchParams) ?? {});
  const stations = await getGasStationManagementList(filters);
  const filtered = Boolean(filters.q || filters.status !== "all");
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Fuel Events Reference Data</p><h1>Gas Stations</h1><p className="summary">Reusable fueling locations. Historical prices remain on Fuel Events.</p></div>
        <div className="inline-actions"><Link className="button secondary" href="/equipment-fuel-events">Back</Link><Link className="button primary" href="/equipment-fuel-events/gas-stations/new">Add Gas Station</Link></div>
      </section>
      <section className="panel filter-panel" aria-labelledby="gas-station-filter-heading">
        <form action="/equipment-fuel-events/gas-stations" className="form-stack">
          <div className="section-heading"><h2 id="gas-station-filter-heading">Find Gas Stations</h2>{filtered ? <Link className="button secondary" href="/equipment-fuel-events/gas-stations">Clear</Link> : null}</div>
          <div className="form-grid">
            <label><span>Search</span><input defaultValue={filters.q ?? ""} maxLength={200} name="q" placeholder="Name, address, City, or ZIP" type="search" /></label>
            <label><span>Status</span><select defaultValue={filters.status} name="status"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
          <div className="filter-actions"><button className="button primary" type="submit">Apply Filters</button></div>
        </form>
      </section>
      <section className="panel table-panel" aria-labelledby="gas-stations-heading">
        <div className="section-heading"><h2 id="gas-stations-heading">Gas Stations</h2><span className="count-pill">{stations.length}</span></div>
        {stations.length === 0 ? <div className="empty-state"><h3>No matching Gas Stations</h3><p>Add a station or adjust the current filters.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Station</th><th>Location</th><th>Status</th><th>Historical events</th><th>Actions</th></tr></thead><tbody>{stations.map((station) => (
            <tr key={station.id}><td>{station.name}</td><td>{station.address ? <>{station.address}<span className="subtle">{station.city.name}{station.city.state ? `, ${station.city.state}` : ""}{station.postalCode ? ` ${station.postalCode}` : ""}</span></> : <>{station.city.name}{station.city.state ? `, ${station.city.state}` : ""}{station.postalCode ? ` ${station.postalCode}` : ""}</>}</td><td>{station.isActive ? "Active" : "Inactive"}</td><td>{station._count.fuelEvents}</td><td className="action-cell"><Link className="table-action" href={`/equipment-fuel-events/gas-stations/${station.id}/edit`}>Edit</Link><GasStationStatusForm action={changeGasStationStatusAction.bind(null, station.id, !station.isActive)} isActive={station.isActive} /></td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </main>
  );
}
