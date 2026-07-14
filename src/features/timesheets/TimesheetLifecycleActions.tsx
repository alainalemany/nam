"use client";

import { useActionState } from "react";

import {
  completeWeeklyTimesheetAction,
  deleteWeeklyTimesheetAction,
  reopenWeeklyTimesheetAction,
} from "./actions";

export function CompleteTimesheetButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    completeWeeklyTimesheetAction.bind(null, id),
    { ok: true, message: "" },
  );
  return (
    <form action={action}>
      {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
      <button className="button primary" disabled={pending} type="submit">{pending ? "Completing..." : "Complete Timesheet"}</button>
    </form>
  );
}

export function ReopenTimesheetButton({ id }: { id: string }) {
  return <form action={reopenWeeklyTimesheetAction.bind(null, id)}><button className="button primary" type="submit">Reopen to Draft</button></form>;
}

export function DeleteTimesheetButton({ id }: { id: string }) {
  return <form action={deleteWeeklyTimesheetAction.bind(null, id)}><button className="button secondary" type="submit">Delete Draft</button></form>;
}

