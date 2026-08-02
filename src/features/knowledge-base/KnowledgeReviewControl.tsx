"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { reviewKnowledgeRecordAction } from "./actions";
import {
  knowledgePersonalReviewExplanation,
  knowledgeReviewedReadOnlyExplanation,
} from "./constants";
import type {
  KnowledgeMutationTokens,
  KnowledgeReviewActionState,
} from "./types";

export function KnowledgeReviewControl({
  knowledgeRecordId,
  tokens,
}: {
  knowledgeRecordId: string;
  tokens: KnowledgeMutationTokens;
}) {
  const initialState: KnowledgeReviewActionState = {
    status: "idle",
    message: "",
    requiresReload: false,
    fieldErrors: {},
    expectedStateVersion: String(tokens.expectedStateVersion),
    expectedCurrentRevisionId: tokens.expectedCurrentRevisionId,
    confirmed: false,
  };
  const action = reviewKnowledgeRecordAction.bind(null, knowledgeRecordId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(state.confirmed);
  const errorSummaryId = useId();
  useEffect(() => {
    setConfirmed(state.confirmed);
    if (state.status === "error") {
      document.getElementById(errorSummaryId)?.focus();
    }
  }, [errorSummaryId, state]);
  const confirmationError = state.fieldErrors.personalReviewConfirmed?.[0];

  return (
    <form action={formAction} className="panel form-stack knowledge-review-control" noValidate>
      <input name="expectedStateVersion" type="hidden" value={state.expectedStateVersion} />
      <input name="expectedCurrentRevisionId" type="hidden" value={state.expectedCurrentRevisionId} />
      <input name="personalReviewConfirmed" type="hidden" value={confirmed ? "true" : "false"} />
      <section aria-labelledby="knowledge-personal-review-heading">
        <h2 id="knowledge-personal-review-heading">Personally review this material</h2>
        <p>{knowledgePersonalReviewExplanation}</p>
        <p>{knowledgeReviewedReadOnlyExplanation}</p>
      </section>
      {state.status === "error" ? (
        <div
          aria-labelledby={`${errorSummaryId}-title`}
          className="error-summary"
          id={errorSummaryId}
          role="alert"
          tabIndex={-1}
        >
          <h3 id={`${errorSummaryId}-title`}>Personal review was not recorded</h3>
          <p>{state.message}</p>
        </div>
      ) : null}
      <label className="confirmation-choice">
        <input
          aria-describedby={confirmationError ? "knowledge-review-confirmation-error" : undefined}
          aria-invalid={confirmationError ? true : undefined}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        I confirm that I personally reviewed the complete current material.
      </label>
      {confirmationError ? (
        <span className="field-error" id="knowledge-review-confirmation-error">{confirmationError}</span>
      ) : null}
      <div className="inline-actions">
        <button
          className="button primary"
          disabled={pending || state.requiresReload}
          type="submit"
        >
          {pending ? "Recording personal review…" : "Mark as Personally Reviewed"}
        </button>
        {state.requiresReload ? (
          <a
            className="button secondary"
            href={`/knowledge-base/${encodeURIComponent(knowledgeRecordId)}`}
          >
            Reload Knowledge Record
          </a>
        ) : null}
        <span aria-live="polite">{pending ? "Recording personal review." : ""}</span>
      </div>
    </form>
  );
}
