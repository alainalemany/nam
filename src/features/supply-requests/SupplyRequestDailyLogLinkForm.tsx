"use client";

import { useActionState } from "react";

import {
  emptySupplyRequestDailyLogLinkActionState,
  type SupplyRequestDailyLogLinkActionState,
} from "./daily-log-link-action-state";
import type { SupplyRequestDailyLogLinkContext } from "./daily-log-link-types";
import { formatSupplyRequestDate, supplyRequestStatusLabel } from "./surface-display";

type LinkAction = (
  previousState: SupplyRequestDailyLogLinkActionState,
  formData: FormData,
) => Promise<SupplyRequestDailyLogLinkActionState>;

function timeLabel(start: string | null, end: string | null) {
  if (!start) return "Time not recorded";
  return end ? `${start}–${end}` : start;
}

export function SupplyRequestDailyLogLinkForm({
  context,
  setAction,
  removeAction,
}: {
  context: SupplyRequestDailyLogLinkContext;
  setAction: LinkAction;
  removeAction: LinkAction;
}) {
  const [setState, submitSet, setPending] = useActionState(
    setAction,
    emptySupplyRequestDailyLogLinkActionState,
  );
  const [removeState, submitRemove, removePending] = useActionState(
    removeAction,
    emptySupplyRequestDailyLogLinkActionState,
  );
  const title =
    context.role === "SUBMISSION"
      ? "Link Submission to Daily Log"
      : "Link Fulfillment to Daily Log";
  const roleName = context.role === "SUBMISSION" ? "Submission" : "Fulfillment";
  const selected =
    setState.selectedActivityId || context.existingLink?.activityId || "";

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Supply Request Daily Log link</p>
        <h1 id="page-title">{title}</h1>
        <p className="summary">
          This links NAM’s Supply Request record to one existing Daily Log
          Activity. It does not create a Daily Log or Activity and does not
          create or alter the corporate request.
        </p>
      </section>

      <section className="panel detail-grid" aria-labelledby="request-context">
        <h2 className="full-width-field" id="request-context">Request context</h2>
        <div><p className="eyebrow">NAM Reference</p><p>{context.namReference}</p></div>
        <div><p className="eyebrow">Current version</p><p>{context.currentVersionNumber}</p></div>
        <div><p className="eyebrow">Current status</p><p>{supplyRequestStatusLabel(context.currentStatus)}</p></div>
        <div><p className="eyebrow">Equipment snapshot</p><p>{context.equipmentLabel}</p></div>
        <div><p className="eyebrow">Role date</p><p>{context.expectedRoleDate ? formatSupplyRequestDate(context.expectedRoleDate) : "Unavailable"}</p></div>
        <div className="full-width-field">
          <p className="eyebrow">Required exact Activity title</p>
          <p>{context.requiredActivityTitle}</p>
        </div>
      </section>

      {!context.eligible ? (
        <section className="panel" aria-labelledby="unavailable-heading">
          <h2 id="unavailable-heading">Fulfillment link unavailable</h2>
          <p>{context.unavailableReason}</p>
          <a className="button secondary" href={`/supply-requests/${encodeURIComponent(context.supplyRequestId)}`}>Back to current detail</a>
        </section>
      ) : (
        <>
          {context.existingLink ? (
            <section className="panel" aria-labelledby="existing-link-heading">
              <h2 id="existing-link-heading">Existing {roleName} link</h2>
              <p>{context.existingLink.activityTitle}</p>
              <p className="subtle">
                Daily Log {formatSupplyRequestDate(context.existingLink.dailyLogDate)} · Activity {context.existingLink.activitySequence} · {timeLabel(context.existingLink.activityStartTime, context.existingLink.activityEndTime)}
              </p>
              <div className="inline-actions">
                <a className="button secondary" href={context.existingLink.dailyLogHref}>Open Daily Log</a>
                <form action={submitRemove}>
                  <input type="hidden" name="expectedDailyLogActivityId" value={context.existingLink.activityId} />
                  <button className="button danger" type="submit" disabled={removePending}>
                    {removePending ? "Removing..." : `Remove ${roleName} Link`}
                  </button>
                </form>
              </div>
              {removeState.status === "error" ? <div className="form-alert" role="alert">{removeState.message}</div> : null}
            </section>
          ) : null}

          <section className="panel" aria-labelledby="candidate-heading">
            <h2 id="candidate-heading">Choose an existing Activity</h2>
            <p>
              The Activity and its Daily Log must use the role date, the Supply
              Request classification, the exact required title, and compatible
              Equipment. Create or edit narrative only through Daily Log-owned
              workflows; linking does not duplicate the requested item list.
            </p>
            {setState.status === "error" ? <div className="form-alert" role="alert">{setState.message}</div> : null}
            <form action={submitSet} className="form-stack">
              <input type="hidden" name="expectedDailyLogActivityId" value={context.existingLink?.activityId ?? ""} />
              {context.dailyLogs.length === 0 ? (
                <p>No Daily Logs exist for the required date. Create one explicitly, then return here.</p>
              ) : (
                context.dailyLogs.map((log) => (
                  <fieldset className="activity-card" key={log.id}>
                    <legend>{formatSupplyRequestDate(log.logDate)} · {log.shiftLabel}</legend>
                    <p>{log.mineLabel ?? "Mine not recorded"} · {log.primaryEquipmentLabel ?? "Primary Equipment not recorded"}</p>
                    {log.summary ? <p className="subtle">{log.summary}</p> : null}
                    {log.activities.length === 0 ? (
                      <p>No eligible Supply Request Activities are available in this Daily Log.</p>
                    ) : (
                      log.activities.map((activity) => (
                        <label key={activity.id} className="full-width-field">
                          <span>
                            <input
                              type="radio"
                              name="dailyLogActivityId"
                              value={activity.id}
                              defaultChecked={activity.id === selected}
                            />{" "}
                            Activity {activity.sequence}: {activity.title}
                          </span>
                          <span className="subtle">{timeLabel(activity.startTime, activity.endTime)} · {activity.equipmentLabel ?? "No Activity Equipment"}{activity.currentlyLinked ? " · Currently linked" : ""}</span>
                        </label>
                      ))
                    )}
                    <div className="inline-actions">
                      <a className="button secondary" href={log.detailHref}>Open Daily Log</a>
                      <a className="button secondary" href={log.editHref}>Create or edit Activity</a>
                    </div>
                  </fieldset>
                ))
              )}
              {setState.fieldErrors.dailyLogActivityId?.map((error) => <p className="field-error" key={error}>{error}</p>)}
              <div className="form-actions">
                <a className="button secondary" href="/daily-logs/new">Create Daily Log</a>
                <button className="button primary" type="submit" disabled={setPending}>
                  {setPending ? "Saving Link..." : context.existingLink ? `Replace ${roleName} Link` : `Link ${roleName} Activity`}
                </button>
              </div>
            </form>
          </section>
          <a className="button secondary" href={`/supply-requests/${encodeURIComponent(context.supplyRequestId)}`}>Back to current Supply Request</a>
        </>
      )}
    </main>
  );
}
