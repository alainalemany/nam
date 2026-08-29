import Link from "next/link";

import {
  equipmentCategoryOptions,
  optionLabel,
  recordStatusOptions,
} from "@/features/equipment/constants";
import { getEquipment, getEquipmentMineOptions } from "@/features/equipment/data";
import {
  hasEquipmentFilters,
  parseEquipmentFilters,
  type EquipmentSearchParams,
} from "@/features/equipment/filters";
import { cityDisplayLabel } from "@/features/geography/normalization";

export const dynamic = "force-dynamic";

type EquipmentPageProps = {
  searchParams?: Promise<EquipmentSearchParams>;
};

export default async function EquipmentPage({ searchParams }: EquipmentPageProps) {
  const filters = parseEquipmentFilters((await searchParams) ?? {});
  const filtersActive = hasEquipmentFilters(filters);
  const [equipment, mineOptions] = await Promise.all([
    getEquipment(filters),
    getEquipmentMineOptions(true),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Reference data</p>
          <h1 id="page-title">Equipment</h1>
          <p className="summary">
            Shared equipment records for operations, logs, schedules, fuel,
            inspections, and historical search.
          </p>
        </div>
        <Link className="button primary" href="/equipment/new">
          New Equipment
        </Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="equipment-filters-heading">
        <form action="/equipment" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="equipment-filters-heading">Find Equipment</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/equipment">
                Clear Filters
              </Link>
            ) : null}
          </div>

          <div className="form-grid">
            <label>
              <span>Search</span>
              <input
                autoComplete="off"
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="Display name or equipment number"
                type="search"
              />
            </label>

            <label>
              <span>Category</span>
              <select defaultValue={filters.category ?? ""} name="category">
                <option value="">All equipment</option>
                {equipmentCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Mine</span>
              <select defaultValue={filters.mineId ?? ""} name="mineId">
                <option value="">All mines</option>
                {mineOptions.map((mine) => (
                  <option key={mine.id} value={mine.id}>
                    {mine.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select defaultValue={filters.status ?? ""} name="status">
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
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

      <section className="panel table-panel" aria-labelledby="equipment-list-heading">
        <div className="section-heading">
          <h2 id="equipment-list-heading">Equipment records</h2>
          <span className="count-pill">{equipment.length}</span>
        </div>

        {equipment.length === 0 ? (
          <div className="empty-state">
            <h3>
              {filtersActive ? "No equipment matches these filters" : "No equipment yet"}
            </h3>
            <p>
              {filtersActive
                ? "Adjust the filters or clear them to review all Equipment records."
                : "Add the first dragline, work truck, or support equipment record to establish the shared operations reference data."}
            </p>
            <Link
              className={filtersActive ? "button secondary" : "button primary"}
              href={filtersActive ? "/equipment" : "/equipment/new"}
            >
              {filtersActive ? "Clear Filters" : "Add Equipment"}
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Equipment</th>
                  <th scope="col">Category</th>
                  <th scope="col">Mine</th>
                  <th scope="col">City</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.displayName}</strong>
                      {item.equipmentNumber ? (
                        <span className="subtle">#{item.equipmentNumber}</span>
                      ) : null}
                    </td>
                    <td>{optionLabel(equipmentCategoryOptions, item.category)}</td>
                    <td>{item.mine.name}</td>
                    <td>
                      {cityDisplayLabel(item.mine.city)}
                    </td>
                    <td>{optionLabel(recordStatusOptions, item.status)}</td>
                    <td>
                      <Link className="table-action" href={`/equipment/${item.id}/edit`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
