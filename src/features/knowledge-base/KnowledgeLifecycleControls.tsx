"use client";

import { useActionState, useEffect, useId, useState } from "react";

import {
  archiveKnowledgeRecordAction,
  deleteKnowledgeRecordAction,
  restoreKnowledgeRecordAction,
} from "./actions";
import type {
  KnowledgeLifecycleActionState,
  KnowledgeLifecycleControlsView,
} from "./types";

function initialState(controls: KnowledgeLifecycleControlsView): KnowledgeLifecycleActionState {
  return {
    status: "idle",
    message: "",
    requiresReload: false,
    fieldErrors: {},
    expectedStateVersion: String(controls.tokens.expectedStateVersion),
    expectedCurrentRevisionId: controls.tokens.expectedCurrentRevisionId,
    confirmed: false,
    deleteConfirmation: "",
  };
}

function ErrorSummary({ state, id, title }: { state: KnowledgeLifecycleActionState; id: string; title: string }) {
  useEffect(() => {
    if (state.status === "error") document.getElementById(id)?.focus();
  }, [id, state]);
  return state.status === "error" ? (
    <div aria-labelledby={`${id}-title`} className="error-summary" id={id} role="alert" tabIndex={-1}>
      <h3 id={`${id}-title`}>{title}</h3><p>{state.message}</p>
    </div>
  ) : null;
}

function AuthorityFields({ state }: { state: KnowledgeLifecycleActionState }) {
  return <>
    <input name="expectedStateVersion" type="hidden" value={state.expectedStateVersion} />
    <input name="expectedCurrentRevisionId" type="hidden" value={state.expectedCurrentRevisionId} />
  </>;
}

function Reload({ state, id }: { state: KnowledgeLifecycleActionState; id: string }) {
  return state.requiresReload ? <a className="button secondary" href={`/knowledge-base/${encodeURIComponent(id)}`}>Reload Knowledge Record</a> : null;
}

function ArchiveControl({ id, controls }: { id: string; controls: KnowledgeLifecycleControlsView }) {
  const action = archiveKnowledgeRecordAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialState(controls));
  const [confirmed, setConfirmed] = useState(false);
  const errorId = useId();
  const confirmationError = state.fieldErrors.archiveConfirmed?.[0];
  return <form action={formAction} className="panel form-stack knowledge-lifecycle-control" noValidate>
    <AuthorityFields state={state} />
    <input name="archiveConfirmed" type="hidden" value={confirmed ? "true" : "false"} />
    <h2>Archive Knowledge Record</h2>
    <p>Archive retains this personal Knowledge Record and its history as read-only and removes it from the default Active list. Restore remains possible. No content or revision is deleted.</p>
    <ErrorSummary state={state} id={errorId} title="Knowledge Record was not archived" />
    <label className="confirmation-choice"><input aria-describedby={confirmationError ? `${errorId}-confirmation` : undefined} aria-invalid={confirmationError ? true : undefined} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I understand this record becomes Archived and read-only.</label>
    {confirmationError ? <span className="field-error" id={`${errorId}-confirmation`}>{confirmationError}</span> : null}
    <div className="inline-actions"><button className="button secondary" disabled={pending || state.requiresReload} type="submit">{pending ? "Archiving…" : "Archive Knowledge Record"}</button><Reload state={state} id={id} /><span aria-live="polite">{pending ? "Archiving Knowledge Record." : ""}</span></div>
  </form>;
}

function RestoreControl({ id, controls }: { id: string; controls: KnowledgeLifecycleControlsView }) {
  const action = restoreKnowledgeRecordAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialState(controls));
  const [confirmed, setConfirmed] = useState(false);
  const errorId = useId();
  const reviewed = controls.trust === "PERSONALLY_REVIEWED";
  const confirmationError = state.fieldErrors.restoreConfirmed?.[0];
  return <form action={formAction} className="panel form-stack knowledge-lifecycle-control" noValidate>
    <AuthorityFields state={state} />
    <input name="restoreConfirmed" type="hidden" value={confirmed ? "true" : "false"} />
    <h2>Restore Knowledge Record</h2>
    <p>{reviewed
      ? "Restoring creates one new current Unverified RESTORED revision. The Personally Reviewed revision remains retained and read-only; personal review does not carry forward."
      : "Restoring makes this same current Unverified revision Active again. No history revision is created and its material is not rewritten."}</p>
    <ErrorSummary state={state} id={errorId} title="Knowledge Record was not restored" />
    <label className="confirmation-choice"><input aria-describedby={confirmationError ? `${errorId}-confirmation` : undefined} aria-invalid={confirmationError ? true : undefined} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I understand how this Archived record will be restored.</label>
    {confirmationError ? <span className="field-error" id={`${errorId}-confirmation`}>{confirmationError}</span> : null}
    <div className="inline-actions"><button className="button primary" disabled={pending || state.requiresReload} type="submit">{pending ? "Restoring…" : "Restore Knowledge Record"}</button><Reload state={state} id={id} /><span aria-live="polite">{pending ? "Restoring Knowledge Record." : ""}</span></div>
  </form>;
}

function DeleteControl({ id, controls }: { id: string; controls: KnowledgeLifecycleControlsView }) {
  const action = deleteKnowledgeRecordAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialState(controls));
  const errorId = useId();
  const fieldId = useId();
  const error = state.fieldErrors.deleteConfirmation?.[0];
  return <form action={formAction} className="panel form-stack knowledge-lifecycle-control knowledge-delete-control" noValidate>
    <AuthorityFields state={state} />
    <h2>Permanently Delete Knowledge Record</h2>
    <p><strong>This permanently removes the stable record, every Knowledge Base revision, and every owned external reference. This cannot be undone.</strong></p>
    <p>Mine, Equipment, City, Daily Log, and Defect records are not deleted.</p>
    <ErrorSummary state={state} id={errorId} title="Knowledge Record was not deleted" />
    <label htmlFor={fieldId}>Enter the exact current title to confirm: <strong>{controls.deleteConfirmationTitle}</strong></label>
    <input aria-describedby={error ? `${fieldId}-error` : undefined} aria-invalid={error ? true : undefined} id={fieldId} name="deleteConfirmation" type="text" defaultValue={state.deleteConfirmation} autoComplete="off" />
    {error ? <span className="field-error" id={`${fieldId}-error`}>{error}</span> : null}
    <div className="inline-actions"><button className="button danger" disabled={pending || state.requiresReload} type="submit">{pending ? "Permanently deleting…" : "Permanently Delete Record and History"}</button><Reload state={state} id={id} /><span aria-live="polite">{pending ? "Permanently deleting Knowledge Record." : ""}</span></div>
  </form>;
}

export function KnowledgeLifecycleControls({ knowledgeRecordId, controls }: { knowledgeRecordId: string; controls: KnowledgeLifecycleControlsView }) {
  return <section aria-labelledby="knowledge-lifecycle-controls-heading" className="knowledge-lifecycle-controls">
    <h2 id="knowledge-lifecycle-controls-heading">Lifecycle actions</h2>
    {controls.canArchive ? <ArchiveControl id={knowledgeRecordId} controls={controls} /> : null}
    {controls.canRestore ? <RestoreControl id={knowledgeRecordId} controls={controls} /> : null}
    {controls.canDelete ? <DeleteControl id={knowledgeRecordId} controls={controls} /> : null}
    {!controls.canArchive && controls.lifecycle === "ACTIVE" ? <p>This record remains readable, but its lifecycle version can no longer be incremented safely.</p> : null}
    {!controls.canRestore && controls.lifecycle === "ARCHIVED" ? <p>This Archived record remains readable and permanently deletable, but it cannot be restored safely.</p> : null}
  </section>;
}
