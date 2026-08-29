import Link from "next/link";

import { createCityAction } from "@/features/geography/actions";
import { CityForm } from "@/features/geography/CityForm";
import { getStateOptions } from "@/features/geography/data";

export const dynamic = "force-dynamic";

export default async function NewCityPage() {
  const states = await getStateOptions();
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>Add City</h1><p className="summary">Create a reusable City within one canonical State.</p></div><Link className="button secondary" href="/reference-data/cities">Back</Link></section><CityForm action={createCityAction} states={states} /></main>;
}
