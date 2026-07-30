"use client";

import { useActionState } from "react";

import {
  changeSupervisorStatusAction,
  changeSupplyItemStatusAction,
} from "./reference-actions";
import { emptyReferenceActionState } from "./reference-action-state";

export function ReferenceStatusForm({
  kind,
  id,
  active,
}: {
  kind: "item" | "supervisor";
  id: string;
  active: boolean;
}) {
  const intent = active ? "inactivate" : "activate";
  const action =
    kind === "item"
      ? changeSupplyItemStatusAction.bind(null, id, intent)
      : changeSupervisorStatusAction.bind(null, id, intent);
  const [state, formAction, pending] = useActionState(
    action,
    emptyReferenceActionState,
  );

  return (
    <form action={formAction}>
      {state.message ? (
        <span className="field-error" role="alert">
          {state.message}
        </span>
      ) : null}
      <button className="table-action" disabled={pending} type="submit">
        {pending ? "Saving..." : active ? "Inactivate" : "Activate"}
      </button>
    </form>
  );
}
