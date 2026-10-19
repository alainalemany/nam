"use client";

import { useActionState, useRef } from "react";

import {
  completeWeeklyTimesheetAction,
  deleteWeeklyTimesheetAction,
  reopenWeeklyTimesheetAction,
} from "./actions";

export function CompleteTimesheetButton({
  id,
  weekLabel,
  workedTime,
  ftoSummary,
  noWorkSummary,
  issues,
}: {
  id: string;
  weekLabel: string;
  workedTime: string;
  ftoSummary: string;
  noWorkSummary: string;
  issues: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(
    completeWeeklyTimesheetAction.bind(null, id),
    { ok: true, message: "" },
  );
  return <>
    <button className="button primary" disabled={pending} type="button" onClick={() => dialogRef.current?.showModal()}>Complete Timesheet</button>
    <dialog className="confirmation-dialog" ref={dialogRef} aria-labelledby="complete-timesheet-title">
      <form action={action} className="form-stack">
        <div><p className="eyebrow">Completion review</p><h2 id="complete-timesheet-title">Complete {weekLabel}?</h2></div>
        {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
        <dl className="meta-list"><dt>Actual worked time</dt><dd>{workedTime}</dd><dt>FTO requests</dt><dd>{ftoSummary}</dd><dt>Explained no-work dates</dt><dd>{noWorkSummary}</dd></dl>
        {issues.length ? <div className="form-message error" role="alert"><strong>Resolve these issues first:</strong>{issues.map((issue) => <span key={issue}>{issue}</span>)}</div> : <div className="form-message" role="status">All recorded days pass completion review.</div>}
        <p>Completion makes this week read-only. Reopen it to Draft before making later corrections.</p>
        <div className="inline-actions"><button className="button primary" disabled={pending || issues.length > 0} type="submit">{pending ? "Completing..." : "Confirm completion"}</button><button className="button secondary" type="button" onClick={() => dialogRef.current?.close()}>Keep editing</button></div>
      </form>
    </dialog>
  </>;
}

export function ReopenTimesheetButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    reopenWeeklyTimesheetAction.bind(null, id),
    { ok: true, message: "" },
  );
  return <form action={action}>{state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}<button className="button primary" disabled={pending} type="submit">{pending ? "Reopening..." : "Reopen to Draft"}</button></form>;
}

export function DeleteTimesheetButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    deleteWeeklyTimesheetAction.bind(null, id),
    { ok: true, message: "" },
  );
  return <form action={action}>{state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}<button className="button secondary" disabled={pending} type="submit">{pending ? "Deleting..." : "Delete Draft"}</button></form>;
}

