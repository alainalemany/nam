import Link from "next/link";

import {
  optionLabel,
  stopCardCategoryOptions,
  stopCardSeverityOptions,
  stopCardStatusOptions,
} from "@/features/stop-cards/constants";
import { displayDateOnly, getStopCardFormOptions, getStopCards } from "@/features/stop-cards/data";
import {
  hasStopCardFilters,
  parseStopCardFilters,
  type StopCardSearchParams,
} from "@/features/stop-cards/filters";

export const dynamic = "force-dynamic";

type StopCardsPageProps = {
  searchParams?: Promise<StopCardSearchParams>;
};

export default async function StopCardsPage({ searchParams }: StopCardsPageProps) {
  const filters = parseStopCardFilters((await searchParams) ?? {});
  const filtersActive = hasStopCardFilters(filters);
  const [stopCards, options] = await Promise.all([
    getStopCards(filters),
    getStopCardFormOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Safety</p>
          <h1 id="page-title">STOP Cards</h1>
          <p className="summary">
            Manual safety observations with corrective actions, status, and
            operations context.
          </p>
        </div>
        <Link className="button primary" href="/stop-cards/new">
          New STOP Card
        </Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="stop-card-filters-heading">
        <form action="/stop-cards" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="stop-card-filters-heading">Find STOP Cards</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/stop-cards">
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
                placeholder="Description, action, location, equipment"
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
              <span>Status</span>
              <select name="status" defaultValue={filters.status ?? ""}>
                <option value="">Any status</option>
                {stopCardStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Category</span>
              <select name="category" defaultValue={filters.category ?? ""}>
                <option value="">Any category</option>
                {stopCardCategoryOptions.map((option) => (
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
                {stopCardSeverityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Mine</span>
              <select name="mineId" defaultValue={filters.mineId ?? ""}>
                <option value="">Any mine</option>
                {options.mineOptions.map((option) => (
                  <option key={option.id} value={option.id}>
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
          </div>

          <div className="filter-actions">
            <button className="button primary" type="submit">
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="panel table-panel" aria-labelledby="stop-card-list-heading">
        <div className="section-heading">
          <h2 id="stop-card-list-heading">STOP Card records</h2>
          <span className="count-pill">{stopCards.length}</span>
        </div>

        {stopCards.length === 0 ? (
          <div className="empty-state">
            {filtersActive ? (
              <>
                <h3>No STOP Cards match these filters</h3>
                <p>Adjust the search filters or clear them to review all STOP Cards.</p>
                <Link className="button secondary" href="/stop-cards">
                  Clear Filters
                </Link>
              </>
            ) : (
              <>
                <h3>No STOP Cards yet</h3>
                <p>
                  Create the first STOP Card to start tracking safety observations
                  and corrective actions.
                </p>
                <Link className="button primary" href="/stop-cards/new">
                  Add STOP Card
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
                  <th scope="col">Category</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Location</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stopCards.map((stopCard) => (
                  <tr key={stopCard.id}>
                    <td>
                      <strong>{displayDateOnly(stopCard.observationDate)}</strong>
                      <span className="subtle">
                        {stopCard.mine
                          ? `${stopCard.mine.name}, ${stopCard.mine.city.name}`
                          : "Mine not set"}
                      </span>
                    </td>
                    <td>{optionLabel(stopCardCategoryOptions, stopCard.category)}</td>
                    <td>{optionLabel(stopCardSeverityOptions, stopCard.severity)}</td>
                    <td>{optionLabel(stopCardStatusOptions, stopCard.status)}</td>
                    <td>{stopCard.location ?? stopCard.equipment?.displayName ?? "Not set"}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/stop-cards/${stopCard.id}`}>
                        View
                      </Link>
                      <Link className="table-action" href={`/stop-cards/${stopCard.id}/edit`}>
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
