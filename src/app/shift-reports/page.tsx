import Link from "next/link";

import {
  optionLabel,
  shiftOptions,
  shiftReportStatusOptions,
} from "@/features/shift-reports/constants";
import {
  displayDateOnly,
  getShiftReportFilterOptions,
  getShiftReports,
} from "@/features/shift-reports/data";
import {
  hasShiftReportFilters,
  parseShiftReportFilters,
  type ShiftReportSearchParams,
} from "@/features/shift-reports/filters";

export const dynamic = "force-dynamic";

type ShiftReportsPageProps = {
  searchParams?: Promise<ShiftReportSearchParams>;
};

export default async function ShiftReportsPage({ searchParams }: ShiftReportsPageProps) {
  const filters = parseShiftReportFilters((await searchParams) ?? {});
  const filtersActive = hasShiftReportFilters(filters);
  const [shiftReports, options] = await Promise.all([
    getShiftReports(filters),
    getShiftReportFilterOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Shift Reports</h1>
          <p className="summary">
            Shift-level operational summaries and coordination records.
          </p>
        </div>
        <Link className="button primary" href="/shift-reports/new">
          New Shift Report
        </Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="shift-report-filters-heading">
        <form action="/shift-reports" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="shift-report-filters-heading">Find Shift Reports</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/shift-reports">
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
                placeholder="Summary, notes, location, equipment"
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
              <span>Shift</span>
              <select name="shift" defaultValue={filters.shift ?? ""}>
                <option value="">Any shift</option>
                {shiftOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                {shiftReportStatusOptions.map((option) => (
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

      <section className="panel table-panel" aria-labelledby="shift-report-list-heading">
        <div className="section-heading">
          <h2 id="shift-report-list-heading">Shift Report records</h2>
          <span className="count-pill">{shiftReports.length}</span>
        </div>

        {shiftReports.length === 0 ? (
          <div className="empty-state">
            {filtersActive ? (
              <>
                <h3>No Shift Reports match these filters</h3>
                <p>Adjust the search filters or clear them to review all Shift Reports.</p>
                <Link className="button secondary" href="/shift-reports">
                  Clear Filters
                </Link>
              </>
            ) : (
              <>
                <h3>No Shift Reports yet</h3>
                <p>
                  Create the first Shift Report to begin preserving shift-level
                  operational summaries.
                </p>
                <Link className="button primary" href="/shift-reports/new">
                  Add Shift Report
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
                  <th scope="col">Context</th>
                  <th scope="col">Status</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shiftReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <strong>{displayDateOnly(report.reportDate)}</strong>
                      <span className="subtle">
                        {optionLabel(shiftOptions, report.shift)}
                      </span>
                    </td>
                    <td>
                      {report.equipment?.displayName ?? report.location ?? "Not set"}
                      <span className="subtle">
                        {report.mine
                          ? `${report.mine.name}, ${report.mine.city.name}`
                          : "Mine not set"}
                      </span>
                    </td>
                    <td>{optionLabel(shiftReportStatusOptions, report.status)}</td>
                    <td>{report.summary}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/shift-reports/${report.id}`}>
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/shift-reports/${report.id}/edit`}
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
