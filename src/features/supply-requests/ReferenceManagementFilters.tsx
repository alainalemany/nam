import Link from "next/link";

import type { SupplyRequestReferenceFilters } from "./reference-filters";

export function ReferenceManagementFilters({
  route,
  filters,
  noun,
}: {
  route: string;
  filters: SupplyRequestReferenceFilters;
  noun: string;
}) {
  return (
    <section className="panel filter-panel" aria-labelledby="reference-filters">
      <form action={route} className="form-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Search</p>
            <h2 id="reference-filters">Find {noun}</h2>
          </div>
          {filters.q || filters.status !== "all" ? (
            <Link className="button secondary" href={route}>
              Clear Filters
            </Link>
          ) : null}
        </div>
        <div className="form-grid">
          <label>
            <span>Search</span>
            <input
              defaultValue={filters.q ?? ""}
              maxLength={200}
              name="q"
              placeholder={`Search ${noun.toLowerCase()}`}
            />
          </label>
          <label>
            <span>Status</span>
            <select defaultValue={filters.status} name="status">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="filter-actions">
          <button className="button primary" type="submit">
            Apply Filters
          </button>
        </div>
      </form>
    </section>
  );
}
