"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  emptyLakeFormState,
  type LakeFormState,
  type LakeFormValues,
} from "./lake-validation";

type Props = {
  action: (state: LakeFormState, formData: FormData) => Promise<LakeFormState>;
  initialValues?: LakeFormValues;
  mines: Array<{ id: string; label: string; status: string }>;
};

export function LakeForm({ action, initialValues, mines }: Props) {
  const [state, formAction, pending] = useActionState(action, emptyLakeFormState);
  const values = state.values ?? initialValues;
  const error = (field: keyof LakeFormValues) =>
    state.fieldErrors[field]?.[0] ? (
      <p className="field-error">{state.fieldErrors[field]?.[0]}</p>
    ) : null;

  return (
    <form action={formAction} className="panel form-stack">
      {state.status === "error" ? (
        <div className="form-alert" role="alert">{state.message}</div>
      ) : null}
      <div className="form-grid">
        <label>
          <span>Mine</span>
          <select defaultValue={values?.mineId ?? ""} name="mineId">
            <option value="">Select Mine</option>
            {mines.map((mine) => (
              <option key={mine.id} value={mine.id}>{mine.label}</option>
            ))}
          </select>
          {error("mineId")}
        </label>
        <label>
          <span>Lake name</span>
          <input defaultValue={values?.name ?? ""} maxLength={120} name="name" />
          {error("name")}
        </label>
        <label>
          <span>Status</span>
          <select defaultValue={values?.status ?? "ACTIVE"} name="status">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          {error("status")}
        </label>
        <label className="full-width-field">
          <span>Notes (optional)</span>
          <textarea defaultValue={values?.notes ?? ""} maxLength={1000} name="notes" rows={3} />
          {error("notes")}
        </label>
      </div>
      <div className="inline-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Saving..." : initialValues ? "Save Lake" : "Create Lake"}
        </button>
        <Link className="button secondary" href="/dragline-delay-reports/lakes">Cancel</Link>
      </div>
    </form>
  );
}
