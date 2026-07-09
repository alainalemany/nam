import Link from "next/link";

import {
  optionLabel,
  stopCardCategoryOptions,
  stopCardSeverityOptions,
  stopCardStatusOptions,
} from "@/features/stop-cards/constants";
import { displayDateOnly, getStopCards } from "@/features/stop-cards/data";

export const dynamic = "force-dynamic";

export default async function StopCardsPage() {
  const stopCards = await getStopCards();

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

      <section className="panel table-panel" aria-labelledby="stop-card-list-heading">
        <div className="section-heading">
          <h2 id="stop-card-list-heading">STOP Card records</h2>
          <span className="count-pill">{stopCards.length}</span>
        </div>

        {stopCards.length === 0 ? (
          <div className="empty-state">
            <h3>No STOP Cards yet</h3>
            <p>
              Create the first STOP Card to start tracking safety observations
              and corrective actions.
            </p>
            <Link className="button primary" href="/stop-cards/new">
              Add STOP Card
            </Link>
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
