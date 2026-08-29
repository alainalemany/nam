"use client";

import { useActionState } from "react";

import type { GasStationActionState } from "./gas-station-validation";
import { emptyGasStationActionState } from "./gas-station-validation";

export function GasStationStatusForm({
  action,
  isActive,
}: {
  action: (state: GasStationActionState, formData: FormData) => Promise<GasStationActionState>;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, emptyGasStationActionState);
  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
      <button className={isActive ? "button danger" : "button secondary"} disabled={pending} type="submit">
        {pending ? "Saving..." : isActive ? "Mark Inactive" : "Activate Station"}
      </button>
    </form>
  );
}
