import Link from "next/link";

import { getSupplyRequestHistoryPage } from "@/features/supply-requests/history-data";
import {
  hasSupplyRequestHistoryFilters,
  parseSupplyRequestHistoryFilters,
  supplyRequestHistoryPageHref,
  type SupplyRequestHistoryFilters,
  type SupplyRequestHistorySearchParams,
} from "@/features/supply-requests/history-filters";
import type {
  SupplyRequestHistoryFilterOption,
  SupplyRequestHistoryPageData,
} from "@/features/supply-requests/history-types";
import { formatSupplyRequestDate } from "@/features/supply-requests/surface-display";

export const dynamic = "force-dynamic";

function referenceOptions(
  options: readonly SupplyRequestHistoryFilterOption[],
  selectedId: string | undefined,
) {
  const selectedExists = options.some((option) => option.id === selectedId);
  return (
    <>
      {selectedId && !selectedExists ? (
        <option value={selectedId}>Unavailable historical reference</option>
      ) : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
          {option.active ? "" : " (Inactive)"}
        </option>
      ))}
    </>
  );
}

function Filters({
  filters,
  data,
}: {
  filters: SupplyRequestHistoryFilters;
  data: SupplyRequestHistoryPageData;
}) {
  return (
    <section className="panel filter-panel" aria-labelledby="request-filters">
      <form action="/supply-requests" className="form-stack" method="get">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Search</p>
            <h2 id="request-filters">Find Supply Requests</h2>
          </div>
          {hasSupplyRequestHistoryFilters(filters) ? (
            <Link className="button secondary" href="/supply-requests">
              Clear Filters
            </Link>
          ) : null}
        </div>
        <div className="form-grid">
          <label>
            <span>Operational Date From</span>
            <input
              defaultValue={filters.dateFrom ?? ""}
              name="dateFrom"
              type="date"
            />
          </label>
          <label>
            <span>Operational Date To</span>
            <input
              defaultValue={filters.dateTo ?? ""}
              name="dateTo"
              type="date"
            />
          </label>
          <label>
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Any status</option>
              <option value="REQUESTED">Requested</option>
              <option value="FULFILLED">Fulfilled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label>
            <span>Equipment</span>
            <select defaultValue={filters.equipmentId ?? ""} name="equipmentId">
              <option value="">Any Equipment</option>
              {referenceOptions(data.equipmentOptions, filters.equipmentId)}
            </select>
          </label>
          <label>
            <span>Supervisor</span>
            <select
              defaultValue={filters.supervisorId ?? ""}
              name="supervisorId"
            >
              <option value="">Any supervisor</option>
              {referenceOptions(data.supervisorOptions, filters.supervisorId)}
            </select>
          </label>
          <label>
            <span>NAM Reference</span>
            <input
              defaultValue={filters.reference ?? ""}
              maxLength={50}
              name="reference"
              type="text"
            />
          </label>
          <label>
            <span>Item Number or Description</span>
            <input
              defaultValue={filters.item ?? ""}
              maxLength={200}
              name="item"
              type="search"
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              defaultValue={filters.notes ?? ""}
              maxLength={200}
              name="notes"
              type="search"
            />
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

function Results({
  data,
  filters,
}: {
  data: SupplyRequestHistoryPageData;
  filters: SupplyRequestHistoryFilters;
}) {
  const filtered = hasSupplyRequestHistoryFilters(filters);
  return (
    <section className="panel table-panel" aria-labelledby="request-history">
      <div className="section-heading">
        <h2 id="request-history">Current Supply Request history</h2>
        <span className="count-pill">{data.matchingCount}</span>
      </div>
      {data.totalCount === 0 && !filtered ? (
        <div className="empty-state">
          <h3>No Supply Requests have been recorded yet</h3>
          <p>
            NAM records Supply Requests only after they were submitted through
            the corporate system.
          </p>
          <Link className="button primary" href="/supply-requests/new">
            Record Submitted Request
          </Link>
        </div>
      ) : data.rows.length === 0 && data.matchingCount === 0 && filtered ? (
        <div className="empty-state">
          <h3>No current Supply Requests match these filters</h3>
          <p>Adjust the filters or clear them to review current NAM records.</p>
          <Link className="button secondary" href="/supply-requests">
            Clear Filters
          </Link>
        </div>
      ) : data.rows.length === 0 && data.page > 1 ? (
        <div className="empty-state">
          <h3>No Supply Requests on this page</h3>
          <p>The requested page is beyond the matching current records.</p>
          <div className="inline-actions">
            <Link
              className="button secondary"
              href={supplyRequestHistoryPageHref(filters, data.page - 1)}
            >
              Previous
            </Link>
            <Link
              className="button secondary"
              href={supplyRequestHistoryPageHref(filters, 1)}
            >
              First page
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">NAM Reference</th>
                  <th scope="col">Operational date</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">Supervisor</th>
                  <th scope="col">Items</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.supplyRequestId}>
                    <td>
                      <strong>{row.namReference}</strong>
                      <span className="subtle">Version {row.versionNumber}</span>
                    </td>
                    <td>{formatSupplyRequestDate(row.operationalWorkDate)}</td>
                    <td>
                      {row.equipmentLabel}
                      <span className="subtle">
                        {row.mineName} · {row.cityLabel}
                      </span>
                    </td>
                    <td>{row.supervisorName}</td>
                    <td>{row.itemCount}</td>
                    <td>
                      <span className="count-pill">{row.statusLabel}</span>
                    </td>
                    <td>
                      {formatSupplyRequestDate(row.submittedLocalDate)} ·{" "}
                      {row.submittedLocalTime}
                    </td>
                    <td className="action-cell">
                      <Link className="table-action" href={row.detailHref}>
                        View current request
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.hasPreviousPage || data.hasNextPage ? (
            <nav className="pagination" aria-label="Supply Request history pages">
              {data.hasPreviousPage ? (
                <Link
                  className="button secondary"
                  href={supplyRequestHistoryPageHref(filters, data.page - 1)}
                >
                  Previous
                </Link>
              ) : null}
              <span>Page {data.page}</span>
              {data.hasNextPage ? (
                <Link
                  className="button secondary"
                  href={supplyRequestHistoryPageHref(filters, data.page + 1)}
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

export default async function SupplyRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<SupplyRequestHistorySearchParams>;
}) {
  const parsed = parseSupplyRequestHistoryFilters((await searchParams) ?? {});
  const result = await getSupplyRequestHistoryPage(parsed.filters);
  const retryHref = supplyRequestHistoryPageHref(
    parsed.filters,
    parsed.filters.page,
  );
  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">NAM Supply Records</p>
          <h1 id="page-title">Supply Requests</h1>
          <p className="summary">
            Review requests already submitted through the corporate system.
            NAM records this history but does not submit or modify corporate
            requests.
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/supply-requests/items">
            Manage Supply Items
          </Link>
          <Link className="button secondary" href="/supply-requests/supervisors">
            Manage Supervisors
          </Link>
          <Link className="button primary" href="/supply-requests/new">
            Record Submitted Request
          </Link>
        </div>
      </section>
      {result.status === "error" ? (
        <section className="panel" aria-labelledby="history-unavailable">
          <div className="form-alert" role="alert">
            <h2 id="history-unavailable">Supply Request history unavailable</h2>
            <p>{result.message}</p>
            <Link className="button secondary" href={retryHref}>
              Try again
            </Link>
          </div>
        </section>
      ) : (
        <>
          <Filters data={result} filters={parsed.filters} />
          {parsed.invalidParameters.length > 0 ? (
            <div className="form-alert" role="status">
              Unsupported or invalid values were ignored for: {" "}
              {parsed.invalidParameters.join(", ")}.
            </div>
          ) : null}
          <Results data={result} filters={parsed.filters} />
        </>
      )}
    </main>
  );
}
