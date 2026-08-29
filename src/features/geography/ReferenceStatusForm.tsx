"use client";

import { useActionState } from "react";

import { emptyGeographyActionState, type GeographyActionState } from "./validation";

export function ReferenceStatusForm({ action, active }: {
  action: (state: GeographyActionState, formData: FormData) => Promise<GeographyActionState>;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, emptyGeographyActionState);
  return <form action={formAction} className="form-stack">
    {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
    <button className={active ? "button danger" : "button secondary"} disabled={pending} type="submit">
      {pending ? "Saving..." : active ? "Mark Inactive" : "Activate"}
    </button>
  </form>;
}
