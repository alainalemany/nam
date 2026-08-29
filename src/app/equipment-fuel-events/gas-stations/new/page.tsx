import Link from "next/link";

import { createGasStationAction } from "@/features/equipment-fuel-events/gas-station-actions";
import { getGasStationCityOptions } from "@/features/equipment-fuel-events/gas-station-data";
import { GasStationForm } from "@/features/equipment-fuel-events/GasStationForm";

export const dynamic = "force-dynamic";

export default async function NewGasStationPage() {
  const cities = await getGasStationCityOptions();
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Fuel Events Reference Data</p><h1>Add Gas Station</h1><p className="summary">Create one reusable fueling location. Prices are recorded on each Fuel Event.</p></div><Link className="button secondary" href="/equipment-fuel-events/gas-stations">Back</Link></section><GasStationForm action={createGasStationAction} cities={cities} /></main>;
}
