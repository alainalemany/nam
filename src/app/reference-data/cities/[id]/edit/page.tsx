import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCityAction } from "@/features/geography/actions";
import { CityForm } from "@/features/geography/CityForm";
import { getCityForEdit, getStateOptions } from "@/features/geography/data";

export const dynamic = "force-dynamic";

export default async function EditCityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const city = await getCityForEdit(id);
  if (!city) notFound();
  const states = await getStateOptions(city.stateId);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>Edit City</h1><p className="summary">Existing Mine and Gas Station relationships retain this City ID.</p></div><Link className="button secondary" href="/reference-data/cities">Back</Link></section><CityForm action={updateCityAction.bind(null, id)} states={states} initial={{ name: city.name, stateId: city.stateId ?? "" }} /></main>;
}
