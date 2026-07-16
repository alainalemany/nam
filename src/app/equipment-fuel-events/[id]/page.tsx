import Link from "next/link";
import { notFound } from "next/navigation";

import { fuelTypeLabel } from "@/features/equipment-fuel-events/constants";
import { displayEquipmentFuelDate } from "@/features/equipment-fuel-events/date";
import { getEquipmentFuelEventById } from "@/features/equipment-fuel-events/data";

export default async function EquipmentFuelEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEquipmentFuelEventById(id);
  if (!event) notFound();
  return (
    <main className="page-stack">
      <section className="page-header with-actions"><div><p className="eyebrow">Completed · {fuelTypeLabel(event.fuelType)}</p><h1>{event.equipmentDisplayName}</h1><p className="summary">{displayEquipmentFuelDate(event.operationalWorkDate)} · {event.eventTime} local · {event.totalGallons.toLocaleString()} gal</p></div><div className="inline-actions"><Link className="button secondary" href="/equipment-fuel-events">Back</Link><Link className="button primary" href={`/equipment-fuel-events/${id}/edit`}>Correct Fuel Event</Link></div></section>
      <section className="panel table-panel"><div className="detail-grid full-width-field"><div><p className="eyebrow">Equipment number</p><p>{event.equipmentNumber ?? "Not recorded"}</p></div><div><p className="eyebrow">Equipment category</p><p>{event.equipmentCategory}</p></div><div><p className="eyebrow">Location</p><p>{event.mineName} · {event.cityName}{event.cityState ? `, ${event.cityState}` : ""}</p></div><div><p className="eyebrow">Fuel Service Person</p><p>{event.fuelServicePersonDisplayNameSnapshot ?? "Not recorded"}</p></div><div><p className="eyebrow">Daily Work Log</p><p>{event.dailyLogActivity ? `${event.dailyLogActivity.title} (${event.dailyLogActivity.activityDate.toISOString().slice(0, 10)})` : "Not linked"}</p></div></div></section>
      <section className="panel table-panel" aria-labelledby="fuel-event-fills-heading"><div className="section-heading"><h2 id="fuel-event-fills-heading">Tank Fills</h2><span className="count-pill">{event.tankFills.length}</span></div><div className="table-wrap"><table><thead><tr><th>Sequence</th><th>Tank</th><th>Delivered gallons</th></tr></thead><tbody>{event.tankFills.map((fill) => <tr key={fill.id}><td>{fill.sequence}</td><td>{fill.tankLabel}</td><td>{fill.gallons.toLocaleString()} gal</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><th>{event.totalGallons.toLocaleString()} gal</th></tr></tfoot></table></div></section>
      <section className="panel table-panel"><h2>Notes</h2><p>{event.notes ?? "No exceptional operational notes recorded."}</p></section>
    </main>
  );
}
