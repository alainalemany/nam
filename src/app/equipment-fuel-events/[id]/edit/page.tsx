import Link from "next/link";
import { notFound } from "next/navigation";

import { correctEquipmentFuelEventAction } from "@/features/equipment-fuel-events/actions";
import { equipmentFuelEventToFormInitial, getEquipmentFuelEquipmentOptions, getEquipmentFuelEventById, getEquipmentFuelFormContext, getFuelServicePersonOptions } from "@/features/equipment-fuel-events/data";
import { EquipmentFuelEventForm } from "@/features/equipment-fuel-events/EquipmentFuelEventForm";

export const dynamic = "force-dynamic";

export default async function CorrectEquipmentFuelEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEquipmentFuelEventById(id);
  if (!event) notFound();
  const initialValues = equipmentFuelEventToFormInitial(event);
  const [equipmentOptions, servicePeople, formContext] = await Promise.all([
    getEquipmentFuelEquipmentOptions(event.equipmentId),
    getFuelServicePersonOptions(event.fuelServicePersonId),
    event.equipmentId
      ? getEquipmentFuelFormContext({
          operationalWorkDate: initialValues.operationalWorkDate,
          equipmentId: event.equipmentId,
          currentEventId: event.id,
        })
      : Promise.resolve({ dailyLogActivities: [], tankLabelSuggestions: [] }),
  ]);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Completed Fuel Event Correction</p><h1>Correct Equipment Fueling</h1><p className="summary">The complete aggregate is revalidated and remains Completed. This does not create a Draft or replacement event.</p></div><Link className="button secondary" href={`/equipment-fuel-events/${id}`}>Back</Link></section><EquipmentFuelEventForm action={correctEquipmentFuelEventAction.bind(null, id)} cancelHref={`/equipment-fuel-events/${id}`} currentEventId={id} equipmentOptions={equipmentOptions} initialDailyLogActivities={formContext.dailyLogActivities} initialTankLabelSuggestions={formContext.tankLabelSuggestions} initialValues={initialValues} servicePeople={servicePeople} submitLabel="Save Completed Correction" unavailableEquipmentLabel={!event.equipmentId ? `${event.equipmentDisplayName}${event.equipmentNumber ? ` #${event.equipmentNumber}` : ""}` : undefined} /></main>;
}
