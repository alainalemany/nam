import Link from "next/link";

import { createEquipmentFuelEventAction } from "@/features/equipment-fuel-events/actions";
import { getEquipmentFuelEquipmentOptions, getFuelServicePersonOptions } from "@/features/equipment-fuel-events/data";
import { EquipmentFuelEventForm } from "@/features/equipment-fuel-events/EquipmentFuelEventForm";

export const dynamic = "force-dynamic";

export default async function NewEquipmentFuelEventPage() {
  const [equipmentOptions, servicePeople] = await Promise.all([
    getEquipmentFuelEquipmentOptions(),
    getFuelServicePersonOptions(),
  ]);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Completed Fuel Event</p><h1>Record Equipment Fueling</h1><p className="summary">Record one real service occurrence with one or more ordered Tank Fills.</p></div><Link className="button secondary" href="/equipment-fuel-events">Back</Link></section><EquipmentFuelEventForm action={createEquipmentFuelEventAction} cancelHref="/equipment-fuel-events" equipmentOptions={equipmentOptions} servicePeople={servicePeople} submitLabel="Save Completed Fuel Event" /></main>;
}
