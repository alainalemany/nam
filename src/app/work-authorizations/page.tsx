import Link from "next/link";

import {
  optionLabel,
  workAuthorizationStatusOptions,
  workAuthorizationWorkTypeOptions,
} from "@/features/work-authorizations/constants";
import {
  displayDateOnly,
  getWorkAuthorizationFilterOptions,
  getWorkAuthorizations,
} from "@/features/work-authorizations/data";
import {
  hasWorkAuthorizationFilters,
  parseWorkAuthorizationFilters,
  type WorkAuthorizationSearchParams,
} from "@/features/work-authorizations/filters";

export const dynamic = "force-dynamic";

type WorkAuthorizationsPageProps = {
  searchParams?: Promise<WorkAuthorizationSearchParams>;
};

export default async function WorkAuthorizationsPage({
  searchParams,
}: WorkAuthorizationsPageProps) {
  const filters = parseWorkAuthorizationFilters((await searchParams) ?? {});
  const filtersActive = hasWorkAuthorizationFilters(filters);
  const [workAuthorizations, options] = await Promise.all([
    getWorkAuthorizations(filters),
    getWorkAuthorizationFilterOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Work Authorizations</h1>
          <p className="summary">
            Shift-scoped maintenance and safety work authorization records.
          </p>
        </div>
        <Link className="button primary" href="/work-authorizations/new">
          New Work Authorization
        </Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="authorization-filters-heading">
        <form action="/work-authorizations" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="authorization-filters-heading">Find Work Authorizations</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/work-authorizations">
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
                placeholder="Description, location, contact, equipment"
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
                {workAuthorizationStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Work type</span>
              <select name="workType" defaultValue={filters.workType ?? ""}>
                <option value="">Any work type</option>
                {workAuthorizationWorkTypeOptions.map((option) => (
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

      <section className="panel table-panel" aria-labelledby="authorization-list-heading">
        <div className="section-heading">
          <h2 id="authorization-list-heading">Work Authorization records</h2>
          <span className="count-pill">{workAuthorizations.length}</span>
        </div>

        {workAuthorizations.length === 0 ? (
          <div className="empty-state">
            {filtersActive ? (
              <>
                <h3>No Work Authorizations match these filters</h3>
                <p>
                  Adjust the search filters or clear them to review all Work
                  Authorizations.
                </p>
                <Link className="button secondary" href="/work-authorizations">
                  Clear Filters
                </Link>
              </>
            ) : (
              <>
                <h3>No Work Authorizations yet</h3>
                <p>
                  Create the first Work Authorization from the correct Shift Report
                  context.
                </p>
                <Link className="button primary" href="/work-authorizations/new">
                  Add Work Authorization
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Shift</th>
                  <th scope="col">Work</th>
                  <th scope="col">Status</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workAuthorizations.map((authorization) => (
                  <tr key={authorization.id}>
                    <td>
                      <strong>{displayDateOnly(authorization.shiftReport.reportDate)}</strong>
                      <span className="subtle">{authorization.shiftReport.shift}</span>
                    </td>
                    <td>
                      {optionLabel(workAuthorizationWorkTypeOptions, authorization.workType)}
                      <span className="subtle">{authorization.workDescription}</span>
                    </td>
                    <td>
                      {optionLabel(workAuthorizationStatusOptions, authorization.status)}
                    </td>
                    <td>
                      {authorization.equipment?.displayName ?? "Not set"}
                      <span className="subtle">
                        {authorization.mine
                          ? `${authorization.mine.name}, ${authorization.mine.city.name}`
                          : authorization.jobLocation ?? "Context not set"}
                      </span>
                    </td>
                    <td className="action-cell">
                      <Link
                        className="table-action"
                        href={`/work-authorizations/${authorization.id}`}
                      >
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/work-authorizations/${authorization.id}/edit`}
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
