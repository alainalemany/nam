"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  emptyDraglineDelayReportActionState,
  type DraglineDelayReportActionState,
} from "./validation";

type Props = {
  action: (
    previousState: DraglineDelayReportActionState,
    formData: FormData,
  ) => Promise<DraglineDelayReportActionState>;
  editHref: string;
};

export function DraglineDelayReportCompletionAction({ action, editHref }: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    emptyDraglineDelayReportActionState,
  );

  return (
    <form action={formAction}>
      {state.status === "error" ? (
        <div className="form-message error" role="alert">
          <p>{state.message}</p>
          <Link href={editHref}>Review in Edit Draft</Link>
        </div>
      ) : null}
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Completing..." : "Complete Report"}
      </button>
    </form>
  );
}
