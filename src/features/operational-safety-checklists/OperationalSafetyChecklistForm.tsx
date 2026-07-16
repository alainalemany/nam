"use client";

import { useActionState, useMemo, useState } from "react";

import { safetyChecklistShiftOptions } from "./constants";
import { localSafetyChecklistDateValue } from "./date";
import {
  getSafetyChecklistTemplate,
  responseOptionsBySet,
  type SafetyChecklistResponseCode,
} from "./templates";
import type {
  SafetyChecklistEquipmentOption,
  SafetyChecklistFormInitialValues,
} from "./types";
import {
  emptySafetyChecklistActionState,
  type SafetyChecklistActionState,
} from "./validation";

type OperationalSafetyChecklistFormProps = {
  action: (
    previousState: SafetyChecklistActionState,
    formData: FormData,
  ) => Promise<SafetyChecklistActionState>;
  cancelHref: string;
  equipmentOptions: SafetyChecklistEquipmentOption[];
  initialValues?: SafetyChecklistFormInitialValues;
  submitLabel: string;
  unavailableEquipmentLabel?: string;
};

function firstError(state: SafetyChecklistActionState, field: string) {
  const message = state.fieldErrors[field]?.[0];
  return message ? <p className="field-error">{message}</p> : null;
}

export function OperationalSafetyChecklistForm({
  action,
  cancelHref,
  equipmentOptions,
  initialValues,
  submitLabel,
  unavailableEquipmentLabel,
}: OperationalSafetyChecklistFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    emptySafetyChecklistActionState,
  );
  const [inspectionDate, setInspectionDate] = useState(
    initialValues?.inspectionDate ?? localSafetyChecklistDateValue(),
  );
  const [shift, setShift] = useState(initialValues?.shift ?? "DAY");
  const [equipmentId, setEquipmentId] = useState(initialValues?.equipmentId ?? "");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [templateIdentity, setTemplateIdentity] = useState(() => ({
    key: initialValues?.templateKey ?? equipmentOptions[0]?.templateKey,
    version: initialValues?.templateVersion ?? equipmentOptions[0]?.templateVersion ?? 1,
  }));
  const [startingMeter, setStartingMeter] = useState(initialValues?.startingMeter ?? "");
  const [operatorDisplayName, setOperatorDisplayName] = useState(
    initialValues?.operatorDisplayName ?? "",
  );
  const [supervisorDisplayName, setSupervisorDisplayName] = useState(
    initialValues?.supervisorDisplayName ?? "",
  );
  const [problemDescription, setProblemDescription] = useState(
    initialValues?.problemDescription ?? "",
  );
  const [responses, setResponses] = useState<Record<string, SafetyChecklistResponseCode>>(
    initialValues?.responses ?? {},
  );

  const selectedEquipment = equipmentOptions.find((option) => option.id === equipmentId);
  const visibleEquipmentOptions = equipmentOptions.filter(
    (option) =>
      option.id === equipmentId ||
      option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const template = equipmentId && templateIdentity.key
    ? getSafetyChecklistTemplate(templateIdentity.key, templateIdentity.version)
    : undefined;

  const metadataFields = template?.fields.filter((field) => field.section === "METADATA") ?? [];
  const inspectionFields =
    template?.fields.filter((field) => field.section === "INSPECTION") ?? [];
  const answeredCount = template?.fields.filter((field) => responses[field.key]).length ?? 0;
  const needsRepair = Object.values(responses).includes("NEEDS_REPAIR");
  const meterValid = /^\d+$/.test(startingMeter) && Number(startingMeter) <= 999999;
  const complete = Boolean(
    inspectionDate &&
      shift &&
      equipmentId &&
      template &&
      meterValid &&
      operatorDisplayName.trim() &&
      supervisorDisplayName.trim() &&
      answeredCount === template.fields.length &&
      (!needsRepair || problemDescription.trim()),
  );

  const responseErrorCount = useMemo(
    () => Object.keys(state.fieldErrors).filter((key) => key.startsWith("responses.")).length,
    [state.fieldErrors],
  );

  function selectEquipment(nextEquipmentId: string) {
    const next = equipmentOptions.find((option) => option.id === nextEquipmentId);
    const equipmentChanged = nextEquipmentId !== equipmentId;
    setEquipmentId(nextEquipmentId);
    if (equipmentChanged) {
      setResponses({});
      setProblemDescription("");
      setStartingMeter("");
    }
    if (!next) {
      return;
    }
    setTemplateIdentity({ key: next.templateKey, version: next.templateVersion });
  }

  function setResponse(itemKey: string, responseCode: SafetyChecklistResponseCode) {
    setResponses((current) => ({ ...current, [itemKey]: responseCode }));
  }

  function responseField(field: NonNullable<typeof template>["fields"][number]) {
    return (
      <fieldset className="checklist-response-row" key={field.key}>
        <legend>
          {field.label}
          {field.marker ? <span className="source-marker"> {field.marker}</span> : null}
        </legend>
        <div className="checklist-response-options">
          {responseOptionsBySet[field.responseSet].map((option) => (
            <label key={option.value} className="checklist-response-option">
              <input
                checked={responses[field.key] === option.value}
                name={`response.${field.key}`}
                onChange={() => setResponse(field.key, option.value)}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {firstError(state, `responses.${field.key}`)}
      </fieldset>
    );
  }

  return (
    <form action={formAction} className="form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">
          <p>{state.message}</p>
          {responseErrorCount ? (
            <span>{responseErrorCount} checklist response(s) need attention.</span>
          ) : null}
        </div>
      ) : null}

      {unavailableEquipmentLabel ? (
        <div className="form-alert" role="status">
          <p>Original Equipment unavailable: {unavailableEquipmentLabel}</p>
          <span>
            Select currently valid Equipment, re-enter its meter reading, and complete
            every checklist response for the replacement.
          </span>
        </div>
      ) : null}

      <input name="templateKey" type="hidden" value={template?.key ?? ""} />
      <input name="templateVersion" type="hidden" value={template?.version ?? ""} />

      <section className="form-section panel" aria-labelledby="checklist-metadata-heading">
        <div className="full-width-field">
          <p className="eyebrow">Completed on submission</p>
          <h2 id="checklist-metadata-heading">Inspection context</h2>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Inspection date</span>
            <input
              name="inspectionDate"
              onChange={(event) => setInspectionDate(event.target.value)}
              type="date"
              value={inspectionDate}
            />
            {firstError(state, "inspectionDate")}
          </label>
          <label>
            <span>Shift</span>
            <select name="shift" onChange={(event) => setShift(event.target.value)} value={shift}>
              {safetyChecklistShiftOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {firstError(state, "shift")}
          </label>
          <label>
            <span>Find Equipment</span>
            <input
              autoComplete="off"
              onChange={(event) => setEquipmentQuery(event.target.value)}
              placeholder="Name, number, or mine"
              type="search"
              value={equipmentQuery}
            />
          </label>
          <label>
            <span>Equipment</span>
            <select
              name="equipmentId"
              onChange={(event) => selectEquipment(event.target.value)}
              value={equipmentId}
            >
              <option value="">Select Equipment</option>
              {visibleEquipmentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {firstError(state, "equipmentId")}
          </label>
          <label>
            <span>Hour Meter (Start)</span>
            <input
              inputMode="numeric"
              max="999999"
              min="0"
              name="startingMeter"
              onChange={(event) => setStartingMeter(event.target.value)}
              step="1"
              type="number"
              value={startingMeter}
            />
            {firstError(state, "startingMeter")}
          </label>
          <label>
            <span>Operator</span>
            <input
              autoComplete="off"
              name="operatorDisplayName"
              onChange={(event) => setOperatorDisplayName(event.target.value)}
              value={operatorDisplayName}
            />
            {firstError(state, "operatorDisplayName")}
          </label>
          <label>
            <span>Supervisor</span>
            <input
              autoComplete="off"
              name="supervisorDisplayName"
              onChange={(event) => setSupervisorDisplayName(event.target.value)}
              value={supervisorDisplayName}
            />
            {firstError(state, "supervisorDisplayName")}
          </label>
        </div>

        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div><span>Template</span><strong>{template?.name ?? "Select Equipment"}</strong></div>
          <div><span>Mine</span><strong>{selectedEquipment?.mineName ?? "Derived from Equipment"}</strong></div>
          <div><span>City</span><strong>{selectedEquipment ? `${selectedEquipment.cityName}${selectedEquipment.cityState ? `, ${selectedEquipment.cityState}` : ""}` : "Derived from Equipment"}</strong></div>
          <div><span>Progress</span><strong>{template ? `${answeredCount} of ${template.fields.length}` : "0"}</strong></div>
        </div>

        {metadataFields.length ? (
          <div className="checklist-response-list full-width-field">
            {metadataFields.map(responseField)}
          </div>
        ) : null}
      </section>

      <section className="panel form-section" aria-labelledby="inspection-items-heading">
        <div className="full-width-field">
          <p className="eyebrow">Actual pre-shift inspection</p>
          <h2 id="inspection-items-heading">{template?.name ?? "Checklist items"}</h2>
        </div>
        {template ? (
          <div className="checklist-response-list full-width-field">
            {inspectionFields.map(responseField)}
          </div>
        ) : (
          <div className="empty-state full-width-field">
            <h3>Select Equipment</h3>
            <p>The Equipment category determines the approved checklist template.</p>
          </div>
        )}
      </section>

      <section className="panel form-section" aria-labelledby="problem-description-heading">
        <div className="full-width-field">
          <h2 id="problem-description-heading">Problem Description(s)</h2>
          <p>
            Required when any item is marked Needs Repair. Previously Noted does not
            require repeated problem text.
          </p>
        </div>
        <label className="full-width-field">
          <span>Problem Description(s)</span>
          <textarea
            name="problemDescription"
            onChange={(event) => setProblemDescription(event.target.value)}
            rows={5}
            value={problemDescription}
          />
          {firstError(state, "problemDescription")}
        </label>
      </section>

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>Cancel</a>
        <button className="button primary" disabled={pending || !complete} type="submit">
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
