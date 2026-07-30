import Link from "next/link";

import { getSupplyItemManagementList } from "@/features/supply-requests/reference-data";
import {
  hasSupplyRequestReferenceFilters,
  parseSupplyRequestReferenceFilters,
  supplyRequestReferencePageHref,
  type SupplyRequestReferenceSearchParams,
} from "@/features/supply-requests/reference-filters";
import { ReferenceManagementFilters } from "@/features/supply-requests/ReferenceManagementFilters";
import { ReferenceStatusForm } from "@/features/supply-requests/ReferenceStatusForm";

export const dynamic = "force-dynamic";

export default async function SupplyItemsPage({
  searchParams,
}: {
  searchParams?: Promise<SupplyRequestReferenceSearchParams>;
}) {
  const parsed = parseSupplyRequestReferenceFilters(
    (await searchParams) ?? {},
  );
  const { filters, ignoredInvalidParameters } = parsed;
  const result = await getSupplyItemManagementList(filters);
  const filtersActive = hasSupplyRequestReferenceFilters(filters);

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Supply Requests Reference Data</p>
          <h1>Supply Items</h1>
          <p className="summary">
            Maintain the small reusable catalog used to record submitted
            requests. This is not inventory or warehouse stock.
          </p>
        </div>
        <Link className="button primary" href="/supply-requests/items/new">
          Add Supply Item
        </Link>
      </section>

      <ReferenceManagementFilters
        filters={filters}
        noun="Supply Items"
        route="/supply-requests/items"
      />

      {ignoredInvalidParameters ? (
        <div className="form-alert" role="status">
          Some invalid Supply Item filter parameters were ignored.
        </div>
      ) : null}

      <section className="panel">
        <h2>Reference retirement</h2>
        <p>
          Inactivating an item preserves every historical Supply Request but
          removes the item from new-request selection. Existing historical
          Supply Requests are not changed, and no corporate request is deleted
          or altered.
        </p>
      </section>

      <section className="panel table-panel" aria-labelledby="supply-item-list">
        <div className="section-heading">
          <h2 id="supply-item-list">Supply Item catalog</h2>
          <span className="count-pill">{result.matchingCount}</span>
        </div>
        {result.totalCount === 0 ? (
          <div className="empty-state">
            <h3>No Supply Items yet</h3>
            <p>Create the first commonly used catalog item.</p>
            <Link className="button primary" href="/supply-requests/items/new">
              Add Supply Item
            </Link>
          </div>
        ) : result.items.length === 0 &&
          result.page > 1 &&
          result.matchingCount > 0 ? (
          <div className="empty-state">
            <h3>No Supply Items on this page</h3>
            <Link
              className="button secondary"
              href={supplyRequestReferencePageHref(
                "/supply-requests/items",
                filters,
                result.page - 1,
              )}
            >
              Previous
            </Link>
          </div>
        ) : result.items.length === 0 && filtersActive ? (
          <div className="empty-state">
            <h3>No Supply Items match these filters</h3>
            <p>Adjust the search or status filter to review the catalog.</p>
            <Link className="button secondary" href="/supply-requests/items">
              Clear Filters
            </Link>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Item Number</th>
                    <th scope="col">Description</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.itemNumber}</strong>
                      </td>
                      <td>
                        {item.description}
                        <span className="subtle">
                          {item.historicalUseCount} historical request versions
                        </span>
                      </td>
                      <td>{item.unit}</td>
                      <td>
                        <span className="count-pill">
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="action-cell">
                        <Link
                          className="table-action"
                          href={`/supply-requests/items/${item.id}/edit`}
                        >
                          Edit
                        </Link>
                        <ReferenceStatusForm
                          active={item.active}
                          id={item.id}
                          kind="item"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.hasPreviousPage || result.hasNextPage ? (
              <nav className="inline-actions" aria-label="Supply Item pages">
                {result.hasPreviousPage ? (
                  <Link
                    className="button secondary"
                    href={supplyRequestReferencePageHref(
                      "/supply-requests/items",
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
                      "/supply-requests/items",
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
