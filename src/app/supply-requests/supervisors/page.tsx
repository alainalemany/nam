import Link from "next/link";

import { getSupervisorManagementList } from "@/features/supply-requests/reference-data";
import {
  hasSupplyRequestReferenceFilters,
  parseSupplyRequestReferenceFilters,
  supplyRequestReferencePageHref,
  type SupplyRequestReferenceSearchParams,
} from "@/features/supply-requests/reference-filters";
import { ReferenceManagementFilters } from "@/features/supply-requests/ReferenceManagementFilters";
import { ReferenceStatusForm } from "@/features/supply-requests/ReferenceStatusForm";

export const dynamic = "force-dynamic";

export default async function SupervisorsPage({
  searchParams,
}: {
  searchParams?: Promise<SupplyRequestReferenceSearchParams>;
}) {
  const parsed = parseSupplyRequestReferenceFilters(
    (await searchParams) ?? {},
  );
  const { filters, ignoredInvalidParameters } = parsed;
  const result = await getSupervisorManagementList(filters);
  const filtersActive = hasSupplyRequestReferenceFilters(filters);

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Supply Requests Reference Data</p>
          <h1>Supervisors</h1>
          <p className="summary">
            Maintain the narrow supervisor reference list used by Supply
            Requests. This is not a workforce or login directory.
          </p>
        </div>
        <Link className="button primary" href="/supply-requests/supervisors/new">
          Add Supervisor
        </Link>
      </section>

      <ReferenceManagementFilters
        filters={filters}
        noun="Supervisors"
        route="/supply-requests/supervisors"
      />

      {ignoredInvalidParameters ? (
        <div className="form-alert" role="status">
          Some invalid supervisor filter parameters were ignored.
        </div>
      ) : null}

      <section className="panel">
        <h2>Reference retirement</h2>
        <p>
          Inactivating a supervisor preserves every historical Supply Request
          but removes the supervisor from new-request selection. Existing
          historical Supply Requests are not changed, and no corporate request
          is cancelled or edited.
        </p>
      </section>

      <section className="panel table-panel" aria-labelledby="supervisor-list">
        <div className="section-heading">
          <h2 id="supervisor-list">Supervisor references</h2>
          <span className="count-pill">{result.matchingCount}</span>
        </div>
        {result.totalCount === 0 ? (
          <div className="empty-state">
            <h3>No supervisors yet</h3>
            <p>Create the first supervisor reference for Supply Requests.</p>
            <Link
              className="button primary"
              href="/supply-requests/supervisors/new"
            >
              Add Supervisor
            </Link>
          </div>
        ) : result.items.length === 0 &&
          result.page > 1 &&
          result.matchingCount > 0 ? (
          <div className="empty-state">
            <h3>No supervisors on this page</h3>
            <Link
              className="button secondary"
              href={supplyRequestReferencePageHref(
                "/supply-requests/supervisors",
                filters,
                result.page - 1,
              )}
            >
              Previous
            </Link>
          </div>
        ) : result.items.length === 0 && filtersActive ? (
          <div className="empty-state">
            <h3>No supervisors match these filters</h3>
            <p>Adjust the search or status filter to review all supervisors.</p>
            <Link
              className="button secondary"
              href="/supply-requests/supervisors"
            >
              Clear Filters
            </Link>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Full name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((supervisor) => (
                    <tr key={supervisor.id}>
                      <td>
                        <strong>{supervisor.fullName}</strong>
                        <span className="subtle">
                          {supervisor.historicalUseCount} historical request
                          versions
                        </span>
                      </td>
                      <td>{supervisor.email}</td>
                      <td>
                        <span className="count-pill">
                          {supervisor.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="action-cell">
                        <Link
                          className="table-action"
                          href={`/supply-requests/supervisors/${supervisor.id}/edit`}
                        >
                          Edit
                        </Link>
                        <ReferenceStatusForm
                          active={supervisor.active}
                          id={supervisor.id}
                          kind="supervisor"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.hasPreviousPage || result.hasNextPage ? (
              <nav className="inline-actions" aria-label="Supervisor pages">
                {result.hasPreviousPage ? (
                  <Link
                    className="button secondary"
                    href={supplyRequestReferencePageHref(
                      "/supply-requests/supervisors",
                      filters,
                      result.page - 1,
                    )}
                  >
                    Previous
                  </Link>
                ) : null}
                <span className="subtle">Page {result.page}</span>
                {result.hasNextPage ? (
                  <Link
                    className="button secondary"
                    href={supplyRequestReferencePageHref(
                      "/supply-requests/supervisors",
                      filters,
                      result.page + 1,
                    )}
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
