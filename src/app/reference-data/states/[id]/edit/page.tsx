import Link from "next/link";
import { notFound } from "next/navigation";

import { updateStateAction } from "@/features/geography/actions";
import { getStateForEdit } from "@/features/geography/data";
import { StateForm } from "@/features/geography/StateForm";

export const dynamic = "force-dynamic";

export default async function EditStatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await getStateForEdit(id);
  if (!state) notFound();
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>Edit State</h1><p className="summary">State edits update live City context without rewriting historical event snapshots.</p></div><Link className="button secondary" href="/reference-data/states">Back</Link></section><StateForm action={updateStateAction.bind(null, id)} initial={{ name: state.name, abbreviation: state.abbreviation }} /></main>;
}
