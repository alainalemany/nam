import Link from "next/link";

import { changeCityStatusAction } from "@/features/geography/actions";
import { getCityManagementList, getStateOptions, parseCityFilters } from "@/features/geography/data";
import { cityDisplayLabel } from "@/features/geography/normalization";
import { ReferenceStatusForm } from "@/features/geography/ReferenceStatusForm";

export const dynamic = "force-dynamic";
type SearchParams = Record<string, string | string[] | undefined>;

export default async function CitiesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const filters = parseCityFilters((await searchParams) ?? {});
  const [{ cities, total }, states] = await Promise.all([getCityManagementList(filters), getStateOptions(null, true)]);
  return <main className="page-stack">
    <section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>U.S. Cities</h1><p className="summary">Canonical Cities and Census Places reusable without requiring a Mine.</p></div><div className="inline-actions"><Link className="button secondary" href="/reference-data">Back</Link><Link className="button primary" href="/reference-data/cities/new">Add City</Link></div></section>
    <section className="panel filter-panel"><form action="/reference-data/cities" className="form-stack"><div className="form-grid"><label><span>Search</span><input defaultValue={filters.q ?? ""} name="q" placeholder="City or State" type="search" /></label><label><span>State</span><select defaultValue={filters.stateId ?? ""} name="stateId"><option value="">All States</option>{states.map((state) => <option key={state.id} value={state.id}>{state.name} ({state.abbreviation})</option>)}</select></label><label><span>Status</span><select defaultValue={filters.status} name="status"><option value="all">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></label></div><div className="filter-actions"><button className="button primary" type="submit">Apply Filters</button></div></form></section>
    <section className="panel table-panel"><div className="section-heading"><h2>City records</h2><span className="count-pill">Showing {cities.length} of {total}</span></div>{cities.length === 0 ? <div className="empty-state"><h3>No matching Cities</h3></div> : <div className="table-wrap"><table><thead><tr><th>City</th><th>Status</th><th>References</th><th>Actions</th></tr></thead><tbody>{cities.map((city) => <tr key={city.id}><td>{cityDisplayLabel(city)}{!city.stateId ? <span className="subtle">Legacy State link pending import</span> : null}</td><td>{city.status === "ACTIVE" ? "Active" : city.status === "INACTIVE" ? "Inactive" : "Archived"}</td><td>{city._count.mines} Mines · {city._count.gasStations} Gas Stations</td><td className="action-cell"><Link className="table-action" href={`/reference-data/cities/${city.id}/edit`}>Edit</Link>{city.status !== "ARCHIVED" ? <ReferenceStatusForm action={changeCityStatusAction.bind(null, city.id, city.status !== "ACTIVE")} active={city.status === "ACTIVE"} /> : null}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
