import Link from "next/link";

import {
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  optionLabel,
} from "@/features/defect-tracking/constants";
import {
  displayDateOnly,
  getDefectFilterOptions,
  getDefects,
} from "@/features/defect-tracking/data";
import {
  hasDefectFilters,
  parseDefectFilters,
  type DefectSearchParams,
} from "@/features/defect-tracking/filters";

export const dynamic = "force-dynamic";

type DefectTrackingPageProps = {
  searchParams?: Promise<DefectSearchParams>;
};

export default async function DefectTrackingPage({
  searchParams,
}: DefectTrackingPageProps) {
  const filters = parseDefectFilters((await searchParams) ?? {});
  const filtersActive = hasDefectFilters(filters);
  const [defects, options] = await Promise.all([
    getDefects(filters),
    getDefectFilterOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Defect Tracking</h1>
          <p className="summary">Track equipment issues from reporting through resolution and closure.</p>
        </div>
        <Link className="button primary" href="/defect-tracking/new">New Defect</Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="defect-filters-heading">
        <form action="/defect-tracking" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="defect-filters-heading">Find Defects</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/defect-tracking">
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
                placeholder="Title, description, action, resolution"
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
                {defectStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Severity</span>
              <select name="severity" defaultValue={filters.severity ?? ""}>
                <option value="">Any severity</option>
                {defectSeverityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select name="priority" defaultValue={filters.priority ?? ""}>
                <option value="">Any priority</option>
                {defectPriorityOptions.map((option) => (
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

      <section className="panel table-panel" aria-labelledby="defect-list-heading">
        <div className="section-heading">
          <h2 id="defect-list-heading">Defect records</h2>
          <span className="count-pill">{defects.length}</span>
        </div>

        {defects.length === 0 ? (
          <div className="empty-state">
            {filtersActive ? (
              <>
                <h3>No Defects match these filters</h3>
                <p>Adjust the search filters or clear them to review all Defects.</p>
                <Link className="button secondary" href="/defect-tracking">
                  Clear Filters
                </Link>
              </>
            ) : (
              <>
                <h3>No defects yet</h3>
                <p>Create the first defect to begin tracking equipment issues and corrective work.</p>
                <Link className="button primary" href="/defect-tracking/new">Add Defect</Link>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Defect</th><th>Equipment</th><th>Severity</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {defects.map((defect) => (
                  <tr key={defect.id}>
                    <td>{displayDateOnly(defect.reportedDate)}</td>
                    <td><strong>{defect.title}</strong><span className="subtle">{defect.description}</span></td>
                    <td>{defect.equipment.displayName}<span className="subtle">{defect.equipment.mine.name}</span></td>
                    <td>{optionLabel(defectSeverityOptions, defect.severity)}</td>
                    <td>{optionLabel(defectPriorityOptions, defect.priority)}</td>
                    <td>{optionLabel(defectStatusOptions, defect.status)}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/defect-tracking/${defect.id}`}>View</Link>
                      <Link className="table-action" href={`/defect-tracking/${defect.id}/edit`}>Edit</Link>
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
