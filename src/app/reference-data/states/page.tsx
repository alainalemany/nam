import Link from "next/link";

import { changeStateStatusAction } from "@/features/geography/actions";
import { getStateManagementList, parseGeographyFilters } from "@/features/geography/data";
import { ReferenceStatusForm } from "@/features/geography/ReferenceStatusForm";

export const dynamic = "force-dynamic";
type SearchParams = Record<string, string | string[] | undefined>;

export default async function StatesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const filters = parseGeographyFilters((await searchParams) ?? {});
  const states = await getStateManagementList(filters);
  return <main className="page-stack">
    <section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>U.S. States</h1><p className="summary">Canonical State and District of Columbia records used by Cities.</p></div><div className="inline-actions"><Link className="button secondary" href="/reference-data">Back</Link><Link className="button primary" href="/reference-data/states/new">Add State</Link></div></section>
    <section className="panel filter-panel"><form action="/reference-data/states" className="form-stack"><div className="form-grid"><label><span>Search</span><input defaultValue={filters.q ?? ""} name="q" placeholder="Name or abbreviation" type="search" /></label><label><span>Status</span><select defaultValue={filters.status} name="status"><option value="all">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select></label></div><div className="filter-actions"><button className="button primary" type="submit">Apply Filters</button></div></form></section>
    <section className="panel table-panel"><div className="section-heading"><h2>State records</h2><span className="count-pill">{states.length}</span></div>{states.length === 0 ? <div className="empty-state"><h3>No matching States</h3></div> : <div className="table-wrap"><table><thead><tr><th>State</th><th>Abbreviation</th><th>Status</th><th>Cities</th><th>Actions</th></tr></thead><tbody>{states.map((state) => <tr key={state.id}><td>{state.name}</td><td>{state.abbreviation}</td><td>{state.status === "ACTIVE" ? "Active" : state.status === "INACTIVE" ? "Inactive" : "Archived"}</td><td>{state._count.cities}</td><td className="action-cell"><Link className="table-action" href={`/reference-data/states/${state.id}/edit`}>Edit</Link>{state.status !== "ARCHIVED" ? <ReferenceStatusForm action={changeStateStatusAction.bind(null, state.id, state.status !== "ACTIVE")} active={state.status === "ACTIVE"} /> : null}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
