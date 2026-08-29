import Link from "next/link";
import { notFound } from "next/navigation";

import { updateGasStationAction } from "@/features/equipment-fuel-events/gas-station-actions";
import { getGasStationCityOptions, getGasStationForEdit } from "@/features/equipment-fuel-events/gas-station-data";
import { GasStationForm } from "@/features/equipment-fuel-events/GasStationForm";

export const dynamic = "force-dynamic";

export default async function EditGasStationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const station = await getGasStationForEdit(id);
  if (!station) notFound();
  const cities = await getGasStationCityOptions(station.cityId);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Fuel Events Reference Data</p><h1>Edit Gas Station</h1><p className="summary">Reference edits do not rewrite historical Fuel Event snapshots.</p></div><Link className="button secondary" href="/equipment-fuel-events/gas-stations">Back</Link></section><GasStationForm action={updateGasStationAction.bind(null, id)} cities={cities} initial={{ name: station.name, address: station.address ?? "", cityId: station.cityId, postalCode: station.postalCode ?? "" }} /></main>;
}
