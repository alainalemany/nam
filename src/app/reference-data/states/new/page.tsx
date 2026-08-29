import Link from "next/link";

import { createStateAction } from "@/features/geography/actions";
import { StateForm } from "@/features/geography/StateForm";

export default function NewStatePage() {
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>Add State</h1><p className="summary">Create one canonical U.S. State reference.</p></div><Link className="button secondary" href="/reference-data/states">Back</Link></section><StateForm action={createStateAction} /></main>;
}
