import Link from "next/link";

import {
  formatSupplyRequestDate,
  supplyRequestChangeKindLabel,
  supplyRequestDerivedTitle,
  supplyRequestEquipmentCategoryLabel,
  supplyRequestStatusLabel,
} from "./surface-display";
import type {
  SupplyRequestDetailView,
  SupplyRequestVersionSummary,
} from "./surface-types";

export function SupplyRequestDetail({
  detail,
  historical = false,
  historicalRole,
  history = [],
}: {
  detail: SupplyRequestDetailView;
  historical?: boolean;
  historicalRole?: "original" | "current" | "superseded";
  history?: readonly SupplyRequestVersionSummary[];
}) {
  const historicalView = historical || historicalRole !== undefined;
  const versionHeading =
    historicalRole === "current"
      ? "Current Immutable Version"
      : historicalRole === "superseded"
        ? "Superseded Version"
        : "Original Requested Version";
  const location = `${detail.mineName} · ${detail.cityName}${
    detail.cityState ? `, ${detail.cityState}` : ""
  }`;

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">
            {historicalView ? versionHeading : "Supply Request"}
          </p>
          <h1>
            {historicalView
              ? `${detail.namReference} — Version ${detail.versionNumber}`
              : detail.namReference}
          </h1>
          <p className="summary">
            {supplyRequestDerivedTitle(
              detail.equipmentLabel,
              detail.operationalWorkDate,
            )}
          </p>
        </div>
        <div className="inline-actions">
          {!historicalView ? (
            <Link className="button secondary" href="/supply-requests">
              Supply Request History
            </Link>
          ) : null}
          <span className="count-pill">
            {supplyRequestStatusLabel(detail.status)}
          </span>
        </div>
      </section>

      {historicalView ? (
        <section className="panel">
          <h2>Read-only historical record</h2>
          <p>
            {historicalRole === "current"
              ? "This immutable version is authoritative through the request’s explicit current-version pointer."
              : historicalRole === "superseded"
                ? "This immutable version is historical and no longer authoritative."
                : "This immutable original version preserves the accepted request facts exactly as they were recorded."}
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

      {!historicalView && detail.status === "REQUESTED" ? (
        <section className="panel" aria-labelledby="lifecycle-actions">
          <h2 id="lifecycle-actions">Update NAM lifecycle</h2>
          <p>
            Record fulfillment only after personally confirming complete
            receipt, or record cancellation in NAM. These actions do not change
            the external corporate request.
          </p>
          <div className="inline-actions">
            <Link
              className="button primary"
              href={`/supply-requests/${encodeURIComponent(
                detail.supplyRequestId,
              )}/fulfill`}
            >
              Fulfill
            </Link>
            <Link
              className="button secondary"
              href={`/supply-requests/${encodeURIComponent(
                detail.supplyRequestId,
              )}/cancel`}
            >
              Cancel
            </Link>
          </div>
        </section>
      ) : null}

      {detail.status === "FULFILLED" ? (
        <section className="panel detail-grid" aria-labelledby="fulfilled-facts">
          <h2 className="full-width-field" id="fulfilled-facts">
            Fulfillment facts
          </h2>
          <div>
            <p className="eyebrow">Fulfillment operational work date</p>
            <p>
              {formatSupplyRequestDate(
                detail.fulfillmentOperationalWorkDate ?? "",
              )}
            </p>
          </div>
          <div>
            <p className="eyebrow">Fulfilled local date</p>
            <p>{formatSupplyRequestDate(detail.fulfilledLocalDate ?? "")}</p>
          </div>
          <div>
            <p className="eyebrow">Fulfilled local time</p>
            <p>{detail.fulfilledLocalTime}</p>
          </div>
          <div className="full-width-field">
            <p className="eyebrow">Fulfillment Note</p>
            <p>{detail.fulfillmentNote ?? "No Fulfillment Note recorded."}</p>
          </div>
        </section>
      ) : null}

      {detail.status === "CANCELLED" ? (
        <section className="panel detail-grid" aria-labelledby="cancelled-facts">
          <h2 className="full-width-field" id="cancelled-facts">
            Cancellation facts
          </h2>
          <div>
            <p className="eyebrow">Cancelled local date</p>
            <p>{formatSupplyRequestDate(detail.cancellationLocalDate ?? "")}</p>
          </div>
          <div>
            <p className="eyebrow">Cancelled local time</p>
            <p>{detail.cancellationLocalTime}</p>
          </div>
          <div className="full-width-field">
            <p className="eyebrow">Cancellation Reason</p>
            <p>
              {detail.cancellationReason ?? "No Cancellation Reason recorded."}
            </p>
          </div>
          <p className="full-width-field">
            Cancellation is recorded in NAM only. It does not prove or perform
            cancellation in the corporate system.
          </p>
        </section>
      ) : null}

      {detail.changeKind === "CORRECTED" ? (
        <section className="panel detail-grid" aria-labelledby="correction-metadata">
          <h2 className="full-width-field" id="correction-metadata">
            Correction metadata
          </h2>
          <div className="full-width-field">
            <p className="eyebrow">Correction Reason</p>
            <p>{detail.correctionReason}</p>
          </div>
          <div>
            <p className="eyebrow">Corrected by</p>
            <p>{detail.correctedByDisplayName}</p>
          </div>
          <div>
            <p className="eyebrow">Correction local date</p>
            <p>{formatSupplyRequestDate(detail.correctionLocalDate ?? "")}</p>
          </div>
          <div>
            <p className="eyebrow">Correction local time</p>
            <p>{detail.correctionLocalTime}</p>
          </div>
        </section>
      ) : null}

      {!historicalView ? (
        <>
          <section className="panel" aria-labelledby="correction-action">
            <h2 id="correction-action">Historical repair</h2>
            <p>
              Correct Request appends a complete immutable version in NAM. It
              does not contact or modify the corporate system.
            </p>
            <Link
              className="button secondary"
              href={`/supply-requests/${encodeURIComponent(
                detail.supplyRequestId,
              )}/correct`}
            >
              Correct Request
            </Link>
          </section>
          <section className="panel table-panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Correction History</h2>
            {history.length === 0 && detail.versionNumber === 1 ? (
              <p>No corrections recorded</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Version</th>
                      <th scope="col">Change kind</th>
                      <th scope="col">Status</th>
                      <th scope="col">Local change time</th>
                      <th scope="col">Correction Reason</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.versionNumber}>
                        <td>{entry.versionNumber}</td>
                        <td>{supplyRequestChangeKindLabel(entry.changeKind)}</td>
                        <td>{supplyRequestStatusLabel(entry.status)}</td>
                        <td>
                          {formatSupplyRequestDate(entry.changeLocalDate)} at{" "}
                          {entry.changeLocalTime}
                        </td>
                        <td>{entry.correctionReason ?? "—"}</td>
                        <td>
                          <Link
                            className="table-action"
                            href={`/supply-requests/${encodeURIComponent(
                              detail.supplyRequestId,
                            )}/history/${entry.versionNumber}`}
                          >
                            View version {entry.versionNumber}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!history.some((entry) => entry.versionNumber === 1) ? (
              <Link
                className="button secondary"
                href={`/supply-requests/${encodeURIComponent(
                  detail.supplyRequestId,
                )}/history/1`}
              >
                View original version 1
              </Link>
            ) : null}
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
