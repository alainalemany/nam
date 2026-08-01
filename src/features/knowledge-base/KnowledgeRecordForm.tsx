"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { createKnowledgeRecordAction } from "./actions";
import {
  knowledgeContentKindLabels,
  knowledgeContentKinds,
  knowledgeContextKindLabels,
  knowledgeContextKinds,
  knowledgeDisclaimer,
  knowledgeMaximumExternalReferences,
  knowledgeUnverifiedWarning,
} from "./constants";
import type {
  KnowledgeCreateActionState,
  KnowledgeCreatePageData,
  KnowledgeExternalReferenceInput,
} from "./types";

function FieldError({
  state,
  field,
}: {
  state: KnowledgeCreateActionState;
  field: string;
}) {
  const message = state.fieldErrors[field]?.[0];
  return message ? (
    <span className="field-error" id={`knowledge-${field}-error`}>
      {message}
    </span>
  ) : null;
}

function errorAttributes(
  state: KnowledgeCreateActionState,
  field: string,
  helpId?: string,
) {
  const errorId = state.fieldErrors[field]?.[0]
    ? `knowledge-${field}-error`
    : null;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return {
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(errorId ? { "aria-invalid": true as const } : {}),
  };
}

export function KnowledgeRecordForm({
  initialState,
  pageData,
}: {
  initialState: KnowledgeCreateActionState;
  pageData: KnowledgeCreatePageData;
}) {
  const [state, formAction, pending] = useActionState(
    createKnowledgeRecordAction,
    initialState,
  );
  const [contextKind, setContextKind] = useState(state.values.contextKind);
  const [mineId, setMineId] = useState(state.values.mineId);
  const [equipmentId, setEquipmentId] = useState(state.values.equipmentId);
  const [references, setReferences] = useState<KnowledgeExternalReferenceInput[]>(
    [...state.externalReferences],
  );
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

  function addReference() {
    if (references.length >= knowledgeMaximumExternalReferences) return;
    setReferences((current) => [...current, { label: "", url: "" }]);
  }

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
    <form action={formAction} className="panel form-stack knowledge-create-form" noValidate>
      <input name="submissionKey" type="hidden" value={state.values.submissionKey} />
      <input
        name="externalReferencesPayload"
        type="hidden"
        value={JSON.stringify(references)}
      />

      {state.status === "error" ? (
        <div
          aria-labelledby={`${errorSummaryId}-title`}
          className="error-summary"
          id={errorSummaryId}
          role="alert"
          tabIndex={-1}
        >
          <h2 id={`${errorSummaryId}-title`}>Knowledge Record was not saved</h2>
          <p>{state.message}</p>
        </div>
      ) : null}

      <section aria-labelledby="knowledge-authority-heading" className="notice-stack">
        <h2 id="knowledge-authority-heading">Personal knowledge boundary</h2>
        <p>{knowledgeDisclaimer}</p>
        <p role="status"><strong>{knowledgeUnverifiedWarning}</strong></p>
        <p>Every new Knowledge Record is saved as Active and Unverified.</p>
      </section>

      <div className="form-grid">
        <div className="full-width-field">
          <label htmlFor="knowledge-content-kind">Content kind</label>
          <select
            defaultValue={state.values.contentKind}
            id="knowledge-content-kind"
            name="contentKind"
            required
            {...errorAttributes(state, "contentKind")}
          >
            {knowledgeContentKinds.map((kind) => (
              <option key={kind} value={kind}>{knowledgeContentKindLabels[kind]}</option>
            ))}
          </select>
          <FieldError field="contentKind" state={state} />
        </div>
        <div className="full-width-field">
          <label htmlFor="knowledge-title">Title</label>
          <input
            defaultValue={state.values.title}
            id="knowledge-title"
            name="title"
            required
            type="text"
            {...errorAttributes(state, "title")}
          />
          <FieldError field="title" state={state} />
        </div>
      </div>

      <div className="full-width-field">
        <label htmlFor="knowledge-body">Body (restricted Markdown)</label>
        <textarea
          defaultValue={state.values.bodyMarkdown}
          id="knowledge-body"
          name="bodyMarkdown"
          required
          rows={14}
          {...errorAttributes(state, "bodyMarkdown", "knowledge-body-help")}
        />
        <span className="field-help" id="knowledge-body-help">
          Paragraphs, headings level 2–4, lists, emphasis, blockquotes, code, and
          labeled HTTPS links are supported. HTML, images, tables, task controls,
          and unsafe links are rejected. No live preview is provided.
        </span>
        <FieldError field="bodyMarkdown" state={state} />
      </div>

      <div className="full-width-field">
        <label htmlFor="knowledge-safety-caution">
          Safety caution (optional plain text)
        </label>
        <textarea
          defaultValue={state.values.safetyCaution}
          id="knowledge-safety-caution"
          name="safetyCaution"
          rows={4}
          {...errorAttributes(
            state,
            "safetyCaution",
            "knowledge-caution-help",
          )}
        />
        <span className="field-help" id="knowledge-caution-help">
          This remains personal guidance, not official instruction.
        </span>
        <FieldError field="safetyCaution" state={state} />
      </div>

      <fieldset
        {...errorAttributes(state, "contextKind", "knowledge-context-help")}
      >
        <legend>Context</legend>
        <p className="field-help" id="knowledge-context-help">
          Choose General, one active Mine, or one active Equipment record. Equipment
          context derives its Mine and location on the server.
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

      <input name="mineId" type="hidden" value={contextKind === "MINE" ? mineId : ""} readOnly />
      <input name="equipmentId" type="hidden" value={contextKind === "EQUIPMENT" ? equipmentId : ""} readOnly />
      {contextKind === "MINE" ? (
        <div className="full-width-field">
          <label htmlFor="knowledge-mine">Active Mine</label>
          <select
            id="knowledge-mine"
            onChange={(event) => setMineId(event.target.value)}
            required
            value={mineId}
            {...errorAttributes(state, "mineId")}
          >
            <option value="">Select a Mine</option>
            {pageData.mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.label}</option>)}
          </select>
          <FieldError field="mineId" state={state} />
        </div>
      ) : null}
      {contextKind === "EQUIPMENT" ? (
        <div className="full-width-field">
          <label htmlFor="knowledge-equipment">Active Equipment</label>
          <select
            id="knowledge-equipment"
            onChange={(event) => setEquipmentId(event.target.value)}
            required
            value={equipmentId}
            {...errorAttributes(state, "equipmentId")}
          >
            <option value="">Select Equipment</option>
            {pageData.equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <FieldError field="equipmentId" state={state} />
        </div>
      ) : null}

      <fieldset
        {...errorAttributes(
          state,
          "externalReferences",
          "knowledge-references-help",
        )}
      >
        <legend>External references (optional)</legend>
        <p className="field-help" id="knowledge-references-help">
          Add up to ten labeled HTTPS references. NAM does not fetch, preview, or
          verify linked content.
        </p>
        {references.map((reference, index) => (
          <div className="form-grid" key={index}>
            <label>
              Reference {index + 1} label
              <input
                onChange={(event) => updateReference(index, "label", event.target.value)}
                type="text"
                value={reference.label}
              />
            </label>
            <label>
              Reference {index + 1} HTTPS URL
              <input
                inputMode="url"
                onChange={(event) => updateReference(index, "url", event.target.value)}
                type="url"
                value={reference.url}
              />
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
          onClick={addReference}
          type="button"
        >
          Add external reference
        </button>
        <FieldError field="externalReferences" state={state} />
      </fieldset>

      <section aria-labelledby="prohibited-content-heading" className="notice-stack">
        <h2 id="prohibited-content-heading">Do not store sensitive or unauthorized content</h2>
        <p>
          Do not store passwords, credentials, tokens, access codes, API keys,
          private keys, payroll or medical information, unnecessary employee
          personal data, full confidential corporate documents, restricted security
          procedures, or content you lack permission to reproduce. NAM cannot
          perfectly detect prohibited content.
        </p>
      </section>

      <div className="inline-actions">
        <button className="button primary" disabled={pending || Boolean(pageData.loadError)} type="submit">
          {pending ? "Saving…" : "Save Knowledge Record"}
        </button>
        <span aria-live="polite">{pending ? "Saving Knowledge Record." : ""}</span>
      </div>
      {pageData.loadError ? <p role="alert">{pageData.loadError}</p> : null}
    </form>
  );
}
