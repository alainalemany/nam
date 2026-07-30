import Link from "next/link";

import {
  formatSupplyRequestDate,
  supplyRequestChangeKindLabel,
  supplyRequestDerivedTitle,
  supplyRequestEquipmentCategoryLabel,
  supplyRequestStatusLabel,
} from "./surface-display";
import type { SupplyRequestDetailView } from "./surface-types";

export function SupplyRequestDetail({
  detail,
  historical = false,
}: {
  detail: SupplyRequestDetailView;
  historical?: boolean;
}) {
  const location = `${detail.mineName} · ${detail.cityName}${
    detail.cityState ? `, ${detail.cityState}` : ""
  }`;

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">
            {historical ? "Original Requested Version" : "Supply Request"}
          </p>
          <h1>
            {historical
              ? `${detail.namReference} — Version 1`
              : detail.namReference}
          </h1>
          <p className="summary">
            {supplyRequestDerivedTitle(
              detail.equipmentLabel,
              detail.operationalWorkDate,
            )}
          </p>
        </div>
        <span className="count-pill">
          {supplyRequestStatusLabel(detail.status)}
        </span>
      </section>

      {historical ? (
        <section className="panel">
          <h2>Read-only historical record</h2>
          <p>
            This immutable original version preserves the accepted request
            facts exactly as they were recorded.
          </p>
          <Link
            className="button secondary"
            href={`/supply-requests/${encodeURIComponent(detail.supplyRequestId)}`}
          >
            Back to current detail
          </Link>
        </section>
      ) : null}

      {!detail.equipmentAvailable ? (
        <div className="form-alert" role="status">
          The current live Equipment record is unavailable. The stored
          Equipment and location snapshots remain available below.
        </div>
      ) : null}

      <section className="panel detail-grid" aria-labelledby="identity-heading">
        <h2 className="full-width-field" id="identity-heading">
          Request identity
        </h2>
        <div>
          <p className="eyebrow">NAM Reference</p>
          <p>{detail.namReference}</p>
        </div>
        <div>
          <p className="eyebrow">Status</p>
          <p>{supplyRequestStatusLabel(detail.status)}</p>
        </div>
        <div>
          <p className="eyebrow">Version</p>
          <p>{detail.versionNumber}</p>
        </div>
        <div>
          <p className="eyebrow">Change kind</p>
          <p>{supplyRequestChangeKindLabel(detail.changeKind)}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="dates-heading">
        <h2 className="full-width-field" id="dates-heading">
          Operational and submission facts
        </h2>
        <div>
          <p className="eyebrow">Operational work date</p>
          <p>{formatSupplyRequestDate(detail.operationalWorkDate)}</p>
        </div>
        <div>
          <p className="eyebrow">Submitted local date</p>
          <p>{formatSupplyRequestDate(detail.submittedLocalDate)}</p>
        </div>
        <div>
          <p className="eyebrow">Submitted local time</p>
          <p>{detail.submittedLocalTime}</p>
        </div>
        <div>
          <p className="eyebrow">Recorded in NAM</p>
          <p>{detail.createdAtLabel}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="equipment-detail">
        <h2 className="full-width-field" id="equipment-detail">
          Equipment and location snapshots
        </h2>
        <div>
          <p className="eyebrow">Equipment</p>
          <p>{detail.equipmentLabel}</p>
        </div>
        <div>
          <p className="eyebrow">Category</p>
          <p>{supplyRequestEquipmentCategoryLabel(detail.equipmentCategory)}</p>
        </div>
        <div>
          <p className="eyebrow">Location</p>
          <p>{location}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="people-heading">
        <h2 className="full-width-field" id="people-heading">
          Requester and supervisor snapshots
        </h2>
        <div>
          <p className="eyebrow">Requested by</p>
          <p>{detail.requesterDisplayName}</p>
        </div>
        <div>
          <p className="eyebrow">Employee number</p>
          <p>{detail.requesterEmployeeNumber}</p>
        </div>
        <div>
          <p className="eyebrow">Supervisor</p>
          <p>{detail.supervisorName}</p>
        </div>
        <div>
          <p className="eyebrow">Supervisor email</p>
          <p>{detail.supervisorEmail}</p>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="items-detail">
        <h2 id="items-detail">Requested items</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Item Number</th>
                <th scope="col">Description</th>
                <th scope="col">Quantity</th>
                <th scope="col">Unit</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.sequence}</td>
                  <td>{item.itemNumber}</td>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="notes-detail">
        <h2 id="notes-detail">Notes</h2>
        <p>{detail.notes ?? "No Notes recorded."}</p>
      </section>

      {!historical ? (
        <>
          <section className="panel" aria-labelledby="history-heading">
            <h2 id="history-heading">History</h2>
            <p>No corrections recorded</p>
            <Link
              className="button secondary"
              href={`/supply-requests/${encodeURIComponent(
                detail.supplyRequestId,
              )}/history/1`}
            >
              View original version 1
            </Link>
          </section>
          <section className="panel" aria-labelledby="daily-log-guidance">
            <h2 id="daily-log-guidance">Daily Work Log narrative</h2>
            <p>
              If useful, manually record the corporate submission context in
              the Daily Work Log. No Daily Work Log entry or link has been
              created automatically.
            </p>
            <Link className="button secondary" href="/daily-logs/new">
              Open Daily Work Log
            </Link>
          </section>
        </>
      ) : null}
    </main>
  );
}
