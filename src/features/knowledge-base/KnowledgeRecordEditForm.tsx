"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";

import { updateUnverifiedKnowledgeRecordAction } from "./actions";
import {
  knowledgeContextKindLabels,
  knowledgeContextKinds,
  knowledgeDisclaimer,
  knowledgeMaximumExternalReferences,
  knowledgeUnverifiedWarning,
} from "./constants";
import type {
  KnowledgeEditActionState,
  KnowledgeEditPageData,
  KnowledgeExternalReferenceInput,
} from "./types";

function FieldError({
  state,
  field,
}: {
  state: KnowledgeEditActionState;
  field: string;
}) {
  const message = state.fieldErrors[field]?.[0];
  return message ? (
    <span className="field-error" id={`knowledge-edit-${field}-error`}>
      {message}
    </span>
  ) : null;
}

function errorAttributes(
  state: KnowledgeEditActionState,
  field: string,
  helpId?: string,
) {
  const errorId = state.fieldErrors[field]?.[0]
    ? `knowledge-edit-${field}-error`
    : null;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return {
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(errorId ? { "aria-invalid": true as const } : {}),
  };
}

export function KnowledgeRecordEditForm({ pageData }: { pageData: KnowledgeEditPageData }) {
  const action = updateUnverifiedKnowledgeRecordAction.bind(null, pageData.id);
  const [state, formAction, pending] = useActionState(action, pageData.initialState);
  const [contextKind, setContextKind] = useState(state.values.contextKind);
  const [mineId, setMineId] = useState(state.values.mineId);
  const [equipmentId, setEquipmentId] = useState(state.values.equipmentId);
  const [references, setReferences] = useState<KnowledgeExternalReferenceInput[]>([
    ...state.externalReferences,
  ]);
  const errorSummaryId = useId();

  useEffect(() => {
    if (state.status === "error") {
      setContextKind(state.values.contextKind);
      setMineId(state.values.mineId);
      setEquipmentId(state.values.equipmentId);
      setReferences([...state.externalReferences]);
      document.getElementById(errorSummaryId)?.focus();
    }
  }, [errorSummaryId, state]);

  function updateReference(
    index: number,
    field: keyof KnowledgeExternalReferenceInput,
    value: string,
  ) {
    setReferences((current) =>
      current.map((reference, candidate) =>
        candidate === index ? { ...reference, [field]: value } : reference,
      ),
    );
  }

  function moveReference(index: number, direction: -1 | 1) {
    setReferences((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  return (
    <form action={formAction} className="panel form-stack knowledge-edit-form" noValidate>
      <input name="expectedStateVersion" type="hidden" value={state.values.expectedStateVersion} />
      <input name="expectedCurrentRevisionId" type="hidden" value={state.values.expectedCurrentRevisionId} />
      <input name="externalReferencesPayload" type="hidden" value={JSON.stringify(references)} />

      {state.status === "error" ? (
        <div
          aria-labelledby={`${errorSummaryId}-title`}
          className="error-summary"
          id={errorSummaryId}
          role="alert"
          tabIndex={-1}
        >
          <h2 id={`${errorSummaryId}-title`}>Knowledge Record was not updated</h2>
          <p>{state.message}</p>
        </div>
      ) : null}

      <section aria-labelledby="knowledge-edit-authority-heading" className="notice-stack">
        <h2 id="knowledge-edit-authority-heading">Personal knowledge boundary</h2>
        <p>{knowledgeDisclaimer}</p>
        <p role="status"><strong>{knowledgeUnverifiedWarning}</strong></p>
      </section>

      <section aria-labelledby="knowledge-edit-kind-heading">
        <h2 id="knowledge-edit-kind-heading">Content kind</h2>
        <p><strong>{pageData.contentKindLabel}</strong></p>
        <p className="field-help">Content kind cannot be changed in this editing phase.</p>
      </section>

      <div className="full-width-field">
        <label htmlFor="knowledge-edit-title">Title</label>
        <input
          defaultValue={state.values.title}
          id="knowledge-edit-title"
          name="title"
          required
          type="text"
          {...errorAttributes(state, "title")}
        />
        <FieldError field="title" state={state} />
      </div>

      <div className="full-width-field">
        <label htmlFor="knowledge-edit-body">Body (restricted Markdown)</label>
        <textarea
          defaultValue={state.values.bodyMarkdown}
          id="knowledge-edit-body"
          name="bodyMarkdown"
          required
          rows={14}
          {...errorAttributes(state, "bodyMarkdown", "knowledge-edit-body-help")}
        />
        <span className="field-help" id="knowledge-edit-body-help">
          The same restricted Markdown policy used for creation and detail rendering applies. No live preview is provided.
        </span>
        <FieldError field="bodyMarkdown" state={state} />
      </div>

      <div className="full-width-field">
        <label htmlFor="knowledge-edit-caution">Safety caution (optional plain text)</label>
        <textarea
          defaultValue={state.values.safetyCaution}
          id="knowledge-edit-caution"
          name="safetyCaution"
          rows={4}
          {...errorAttributes(state, "safetyCaution", "knowledge-edit-caution-help")}
        />
        <span className="field-help" id="knowledge-edit-caution-help">
          This remains personal guidance, not official instruction.
        </span>
        <FieldError field="safetyCaution" state={state} />
      </div>

      <fieldset {...errorAttributes(state, "contextKind", "knowledge-edit-context-help")}>
        <legend>Context</legend>
        <p className="field-help" id="knowledge-edit-context-help">
          Choose General, one active Mine, or one active Equipment. Snapshots are resolved by the server.
        </p>
        <div className="choice-grid">
          {knowledgeContextKinds.map((kind) => (
            <label key={kind}>
              <input
                checked={contextKind === kind}
                name="contextKind"
                onChange={() => setContextKind(kind)}
                type="radio"
                value={kind}
              />{" "}{knowledgeContextKindLabels[kind]}
            </label>
          ))}
        </div>
        <FieldError field="contextKind" state={state} />
      </fieldset>

      <input name="mineId" readOnly type="hidden" value={contextKind === "MINE" ? mineId : ""} />
      <input name="equipmentId" readOnly type="hidden" value={contextKind === "EQUIPMENT" ? equipmentId : ""} />
      {contextKind === "MINE" ? (
        <div className="full-width-field">
          <label htmlFor="knowledge-edit-mine">Active Mine</label>
          <select
            id="knowledge-edit-mine"
            onChange={(event) => setMineId(event.target.value)}
            required
            value={mineId}
            {...errorAttributes(state, "mineId")}
          >
            <option value="">Select a Mine</option>
            {pageData.mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.label}</option>)}
          </select>
          {!mineId ? <span className="field-help">The retained Mine snapshot has no live owner. Leave it unchanged or select an active Mine.</span> : null}
          <FieldError field="mineId" state={state} />
        </div>
      ) : null}
      {contextKind === "EQUIPMENT" ? (
        <div className="full-width-field">
          <label htmlFor="knowledge-edit-equipment">Active Equipment</label>
          <select
            id="knowledge-edit-equipment"
            onChange={(event) => setEquipmentId(event.target.value)}
            required
            value={equipmentId}
            {...errorAttributes(state, "equipmentId")}
          >
            <option value="">Select Equipment</option>
            {pageData.equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {!equipmentId ? <span className="field-help">The retained Equipment snapshot has no live owner. Leave it unchanged or select active Equipment.</span> : null}
          <FieldError field="equipmentId" state={state} />
        </div>
      ) : null}

      <fieldset {...errorAttributes(state, "externalReferences", "knowledge-edit-references-help")}>
        <legend>External references (optional)</legend>
        <p className="field-help" id="knowledge-edit-references-help">
          Saving replaces the complete ordered reference set atomically. NAM does not fetch or verify linked content.
        </p>
        {references.map((reference, index) => (
          <div className="form-grid" key={index}>
            <label>
              Reference {index + 1} label
              <input value={reference.label} onChange={(event) => updateReference(index, "label", event.target.value)} type="text" />
            </label>
            <label>
              Reference {index + 1} HTTPS URL
              <input value={reference.url} onChange={(event) => updateReference(index, "url", event.target.value)} inputMode="url" type="url" />
            </label>
            <div className="inline-actions">
              <button className="button secondary" disabled={index === 0} onClick={() => moveReference(index, -1)} type="button">Move up</button>
              <button className="button secondary" disabled={index === references.length - 1} onClick={() => moveReference(index, 1)} type="button">Move down</button>
              <button className="button secondary" onClick={() => setReferences((current) => current.filter((_, candidate) => candidate !== index))} type="button">Remove</button>
            </div>
          </div>
        ))}
        <button
          className="button secondary"
          disabled={references.length >= knowledgeMaximumExternalReferences}
          onClick={() => setReferences((current) => [...current, { label: "", url: "" }])}
          type="button"
        >
          Add external reference
        </button>
        <FieldError field="externalReferences" state={state} />
      </fieldset>

      <div className="inline-actions">
        <button
          className="button primary"
          disabled={
            pending || Boolean(pageData.loadError) || state.requiresReload
          }
          type="submit"
        >
          {pending ? "Saving changes…" : "Save Changes"}
        </button>
        {state.requiresReload ? (
          <a
            className="button secondary"
            href={`/knowledge-base/${encodeURIComponent(pageData.id)}/edit`}
          >
            Reload current Knowledge Record
          </a>
        ) : null}
        <Link className="button secondary" href={`/knowledge-base/${encodeURIComponent(pageData.id)}`}>Cancel</Link>
        <span aria-live="polite">{pending ? "Saving Knowledge Record changes." : ""}</span>
      </div>
      {pageData.loadError ? <p role="alert">{pageData.loadError}</p> : null}
    </form>
  );
}
