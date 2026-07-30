"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  cancelSupplyRequestAction,
  fulfillSupplyRequestAction,
} from "./lifecycle-actions";
import {
  emptySupplyRequestLifecycleActionState,
  type SupplyRequestLifecycleActionState,
} from "./lifecycle-action-state";
import {
  formatSupplyRequestDate,
  supplyRequestDerivedTitle,
  supplyRequestStatusLabel,
} from "./surface-display";
import type { SupplyRequestLifecycleActionContext } from "./surface-types";

function fieldError(
  state: SupplyRequestLifecycleActionState,
  field: string,
  id: string,
) {
  const message = state.fieldErrors[field]?.[0];
  return message ? (
    <span className="field-error" id={id}>
      {message}
    </span>
  ) : null;
}

function errorAttributes(
  state: SupplyRequestLifecycleActionState,
  field: string,
  errorId: string,
  helpId?: string,
) {
  const hasError = Boolean(state.fieldErrors[field]?.[0]);
  const describedBy = [helpId, hasError ? errorId : null]
    .filter(Boolean)
    .join(" ");
  return {
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(hasError ? { "aria-invalid": true as const } : {}),
  };
}

export function SupplyRequestLifecycleForm({
  context,
  mode,
}: {
  context: SupplyRequestLifecycleActionContext;
  mode: "fulfill" | "cancel";
}) {
  const action =
    mode === "fulfill"
      ? fulfillSupplyRequestAction.bind(null, context.supplyRequestId)
      : cancelSupplyRequestAction.bind(null, context.supplyRequestId);
  const initialState: SupplyRequestLifecycleActionState = {
    ...emptySupplyRequestLifecycleActionState,
    values: {
      ...emptySupplyRequestLifecycleActionState.values,
      expectedCurrentVersionNumber: String(context.versionNumber),
      fulfillmentOperationalWorkDate: context.operationalWorkDate,
    },
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  const currentHref = `/supply-requests/${encodeURIComponent(
    context.supplyRequestId,
  )}`;
  const isFulfillment = mode === "fulfill";

  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Supply Request lifecycle</p>
        <h1>{isFulfillment ? "Mark Fulfilled" : "Mark Cancelled in NAM"}</h1>
        <p className="summary">
          {supplyRequestDerivedTitle(
            context.equipmentLabel,
            context.operationalWorkDate,
          )}
        </p>
      </section>

      <section className="panel detail-grid" aria-labelledby="request-summary">
        <h2 className="full-width-field" id="request-summary">
          Request summary
        </h2>
        <div>
          <p className="eyebrow">NAM Reference</p>
          <p>{context.namReference}</p>
        </div>
        <div>
          <p className="eyebrow">Current status</p>
          <p>{supplyRequestStatusLabel(context.status)}</p>
        </div>
        <div>
          <p className="eyebrow">Current version</p>
          <p>{context.versionNumber}</p>
        </div>
        <div>
          <p className="eyebrow">Operational work date</p>
          <p>{formatSupplyRequestDate(context.operationalWorkDate)}</p>
        </div>
        <div>
          <p className="eyebrow">Submitted</p>
          <p>
            {formatSupplyRequestDate(context.submittedLocalDate)} at{" "}
            {context.submittedLocalTime}
          </p>
        </div>
        <div>
          <p className="eyebrow">Requested items</p>
          <p>{context.itemCount}</p>
        </div>
      </section>

      <section className="panel">
        {isFulfillment ? (
          <>
            <h2>Confirm complete receipt</h2>
            <p>
              Fulfillment means you personally confirmed that all requested
              supplies were received. Partial receipt must remain Requested.
              Existing request and item facts will be preserved.
            </p>
            <p>
              Fulfilled local date and time are captured automatically using
              America/New_York when this action is confirmed.
            </p>
          </>
        ) : (
          <>
            <h2>Record cancellation in NAM</h2>
            <p>
              This records the Supply Request as Cancelled in NAM. It does not
              cancel, change, contact, or resubmit the external corporate
              request. Existing immutable history remains preserved.
            </p>
            <p>
              Cancelled local date and time are captured automatically using
              America/New_York.
            </p>
          </>
        )}
      </section>

      <form action={formAction} className="panel form-stack">
        {state.message ? (
          <div className="form-alert" role="alert">
            {state.message}
          </div>
        ) : null}
        <input
          name="expectedCurrentVersionNumber"
          type="hidden"
          value={state.values.expectedCurrentVersionNumber}
        />
        {isFulfillment ? (
          <>
            <div className="form-stack">
              <label htmlFor="fulfillment-operational-work-date">
                Fulfillment operational work date
              </label>
              <input
                {...errorAttributes(
                  state,
                  "fulfillmentOperationalWorkDate",
                  "fulfillment-operational-work-date-error",
                )}
                defaultValue={
                  state.values.fulfillmentOperationalWorkDate ||
                  context.operationalWorkDate
                }
                id="fulfillment-operational-work-date"
                name="fulfillmentOperationalWorkDate"
                required
                type="date"
              />
              {fieldError(
                state,
                "fulfillmentOperationalWorkDate",
                "fulfillment-operational-work-date-error",
              )}
            </div>
            <div className="form-stack">
              <label htmlFor="fulfillment-note">
                Fulfillment Note (optional)
              </label>
              <textarea
                {...errorAttributes(
                  state,
                  "fulfillmentNote",
                  "fulfillment-note-error",
                  "fulfillment-note-help",
                )}
                defaultValue={state.values.fulfillmentNote}
                id="fulfillment-note"
                maxLength={1000}
                name="fulfillmentNote"
                rows={5}
              />
              <span className="field-help" id="fulfillment-note-help">
                Up to 1000 characters. This does not replace the original
                request Notes.
              </span>
              {fieldError(
                state,
                "fulfillmentNote",
                "fulfillment-note-error",
              )}
            </div>
          </>
        ) : (
          <div className="form-stack">
            <label htmlFor="cancellation-reason">
              Cancellation Reason (optional)
            </label>
            <textarea
              {...errorAttributes(
                state,
                "cancellationReason",
                "cancellation-reason-error",
                "cancellation-reason-help",
              )}
              defaultValue={state.values.cancellationReason}
              id="cancellation-reason"
              maxLength={1000}
              name="cancellationReason"
              rows={5}
            />
            <span className="field-help" id="cancellation-reason-help">
              Up to 1000 characters.
            </span>
            {fieldError(
              state,
              "cancellationReason",
              "cancellation-reason-error",
            )}
          </div>
        )}
        <div className="inline-actions">
          <button className="button primary" disabled={pending} type="submit">
            {pending
              ? "Updating..."
              : isFulfillment
                ? "Mark Fulfilled"
                : "Mark Cancelled in NAM"}
          </button>
          <Link className="button secondary" href={currentHref}>
            Back to current detail
          </Link>
        </div>
      </form>
    </main>
  );
}

export function SupplyRequestLifecycleUnavailable({
  context,
  actionLabel,
}: {
  context: SupplyRequestLifecycleActionContext;
  actionLabel: string;
}) {
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Supply Request lifecycle</p>
        <h1>{actionLabel} unavailable</h1>
        <p className="summary">{context.namReference}</p>
      </section>
      <section className="panel">
        <h2>Current status: {supplyRequestStatusLabel(context.status)}</h2>
        <p>
          Normal lifecycle actions are available only while a Supply Request is
          Requested. Terminal requests remain read-only.
        </p>
        <Link
          className="button secondary"
          href={`/supply-requests/${encodeURIComponent(
            context.supplyRequestId,
          )}`}
        >
          Back to current detail
        </Link>
      </section>
    </main>
  );
}
