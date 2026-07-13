import Link from "next/link";

import {
  dailyInspectionConditionOptions,
  dailyInspectionStatusOptions,
  optionLabel,
  shiftOptions,
} from "@/features/daily-inspections/constants";
import {
  displayDateOnly,
  getDailyInspectionFilterOptions,
  getDailyInspections,
} from "@/features/daily-inspections/data";
import {
  hasDailyInspectionFilters,
  parseDailyInspectionFilters,
  type DailyInspectionSearchParams,
} from "@/features/daily-inspections/filters";

export const dynamic = "force-dynamic";

type DailyInspectionsPageProps = {
  searchParams?: Promise<DailyInspectionSearchParams>;
};

export default async function DailyInspectionsPage({
  searchParams,
}: DailyInspectionsPageProps) {
  const filters = parseDailyInspectionFilters((await searchParams) ?? {});
  const filtersActive = hasDailyInspectionFilters(filters);
  const [dailyInspections, options] = await Promise.all([
    getDailyInspections(filters),
    getDailyInspectionFilterOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Daily Inspections</h1>
          <p className="summary">
            Manual equipment inspection records with findings, condition, and
            defect context.
          </p>
        </div>
        <Link className="button primary" href="/daily-inspections/new">
          New Daily Inspection
        </Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="daily-inspection-filters-heading">
        <form action="/daily-inspections" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="daily-inspection-filters-heading">Find Daily Inspections</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/daily-inspections">
                Clear Filters
              </Link>
            ) : null}
          </div>

          <div className="form-grid">
            <label>
              <span>Text</span>
              <input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Findings, notes, equipment"
                autoComplete="off"
              />
            </label>

            <label>
              <span>From date</span>
              <input name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} />
            </label>

            <label>
              <span>To date</span>
              <input name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} />
            </label>

            <label>
              <span>Equipment</span>
              <select name="equipmentId" defaultValue={filters.equipmentId ?? ""}>
                <option value="">Any equipment</option>
                {options.equipmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select name="status" defaultValue={filters.status ?? ""}>
                <option value="">Any status</option>
                {dailyInspectionStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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

      <section className="panel table-panel" aria-labelledby="daily-inspection-list-heading">
        <div className="section-heading">
          <h2 id="daily-inspection-list-heading">Daily Inspection records</h2>
          <span className="count-pill">{dailyInspections.length}</span>
        </div>

        {dailyInspections.length === 0 ? (
          <div className="empty-state">
            {filtersActive ? (
              <>
                <h3>No Daily Inspections match these filters</h3>
                <p>
                  Adjust the search filters or clear them to review all Daily
                  Inspections.
                </p>
                <Link className="button secondary" href="/daily-inspections">
                  Clear Filters
                </Link>
              </>
            ) : (
              <>
                <h3>No Daily Inspections yet</h3>
                <p>
                  Create the first Daily Inspection to begin tracking equipment
                  condition and findings.
                </p>
                <Link className="button primary" href="/daily-inspections/new">
                  Add Daily Inspection
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Status</th>
                  <th scope="col">Defects</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyInspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td>
                      <strong>{displayDateOnly(inspection.inspectionDate)}</strong>
                      <span className="subtle">
                        {optionLabel(shiftOptions, inspection.shift)}
                      </span>
                    </td>
                    <td>
                      {inspection.equipment?.displayName ?? "Not set"}
                      <span className="subtle">
                        {inspection.mine
                          ? `${inspection.mine.name}, ${inspection.mine.city.name}`
                          : "Mine not set"}
                      </span>
                    </td>
                    <td>
                      {optionLabel(dailyInspectionConditionOptions, inspection.condition)}
                    </td>
                    <td>{optionLabel(dailyInspectionStatusOptions, inspection.status)}</td>
                    <td>{inspection.defectsIdentified ? "Yes" : "No"}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/daily-inspections/${inspection.id}`}>
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/daily-inspections/${inspection.id}/edit`}
                      >
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
