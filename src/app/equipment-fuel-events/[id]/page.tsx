import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  equipmentCategoryLabel,
  formatFuelCurrency,
  formatFuelGallons,
  formatFuelDecimal,
  fuelTypeLabel,
  meterTypeLabel,
} from "@/features/equipment-fuel-events/constants";
import { displayEquipmentFuelDate } from "@/features/equipment-fuel-events/date";
import { getEquipmentFuelEventById } from "@/features/equipment-fuel-events/data";
import { FuelEventSaveConfirmation, type FuelEventSaveOutcome } from "@/features/equipment-fuel-events/FuelEventSaveConfirmation";

function stationLocation(event: {
  gasStationNameSnapshot: string | null;
  gasStationAddressSnapshot: string | null;
  gasStationCitySnapshot: string | null;
  gasStationStateSnapshot: string | null;
  gasStationPostalCodeSnapshot: string | null;
}) {
  if (!event.gasStationNameSnapshot) return "Not recorded (legacy event)";
  const locality = event.gasStationCitySnapshot
    ? `${event.gasStationCitySnapshot}${event.gasStationStateSnapshot ? `, ${event.gasStationStateSnapshot}` : ""}${event.gasStationPostalCodeSnapshot ? ` ${event.gasStationPostalCodeSnapshot}` : ""}`
    : event.gasStationPostalCodeSnapshot;
  return [event.gasStationNameSnapshot, event.gasStationAddressSnapshot, locality].filter(Boolean).join(" · ");
}

function resultOutcome(value: string | string[] | undefined): FuelEventSaveOutcome | null {
  return value === "created" || value === "corrected" ? value : null;
}

export default async function EquipmentFuelEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ result?: string | string[] }>;
}) {
  const { id } = await params;
  const event = await getEquipmentFuelEventById(id);
  if (!event) notFound();
  const outcome = resultOutcome((await searchParams)?.result);
  const title = `${event.equipmentDisplayName}${event.equipmentNumber ? ` · ${event.equipmentNumber}` : ""}`;
  return (
    <main className="page-stack">
      {outcome ? <FuelEventSaveConfirmation outcome={outcome} /> : null}
      <section className="page-header with-actions">
        <div><div className="inline-actions"><span className="ddr-status-badge ddr-status-badge--completed">COMPLETED</span><span>{fuelTypeLabel(event.fuelType)}</span></div><h1>{title}</h1><p className="summary">{displayEquipmentFuelDate(event.operationalWorkDate)} · {event.eventTime} local · {formatFuelGallons(event.totalGallons)}</p></div>
        <div className="inline-actions"><Link className="button secondary" href="/equipment-fuel-events">Back</Link><Link className="button primary" href={`/equipment-fuel-events/${id}/edit`}>Correct Fuel Event</Link></div>
      </section>

      <section className="panel table-panel" aria-labelledby="fuel-event-details-heading">
        <h2 id="fuel-event-details-heading">Fuel Event details</h2>
        <div className="detail-grid full-width-field">
          <div><p className="eyebrow">Equipment category</p><p>{equipmentCategoryLabel(event.equipmentCategory)}</p></div>
          <div><p className="eyebrow">Gas Station</p><p>{stationLocation(event)}</p></div>
          <div><p className="eyebrow">Fuel type</p><p>{fuelTypeLabel(event.fuelType)}</p></div>
          <div><p className="eyebrow">Price per gallon</p><p>{event.pricePerGallon ? `$${formatFuelDecimal(event.pricePerGallon)}` : "Not recorded (legacy event)"}</p></div>
          <div><p className="eyebrow">Total event cost</p><p>{event.totalCost ? formatFuelCurrency(event.totalCost) : "Not recorded (legacy event)"}</p></div>
          <div><p className="eyebrow">Equipment meter</p><p>{event.meterType ? `${meterTypeLabel(event.meterType)}${event.meterReading ? ` · ${formatFuelDecimal(event.meterReading)}` : ""}` : "Not recorded (legacy event)"}</p></div>
          <div><p className="eyebrow">Receipt reference</p><p>{event.receiptReference ?? "Not recorded"}</p></div>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="fuel-event-fills-heading">
        <div className="section-heading"><h2 id="fuel-event-fills-heading">Tank Fills</h2><span className="count-pill">{event.tankFills.length}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Sequence</th><th>Tank</th><th>Delivered gallons</th><th>Calculated cost</th></tr></thead><tbody>{event.tankFills.map((fill) => {
          const fillCost = event.pricePerGallon
            ? fill.gallons.times(event.pricePerGallon).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
            : null;
          return <tr key={fill.id}><td>{fill.sequence}</td><td>{fill.tankLabel}</td><td>{formatFuelGallons(fill.gallons)}</td><td>{fillCost ? formatFuelCurrency(fillCost) : "Not recorded"}</td></tr>;
        })}</tbody><tfoot><tr><th colSpan={2}>Total</th><th>{formatFuelGallons(event.totalGallons)}</th><th>{formatFuelCurrency(event.totalCost)}</th></tr></tfoot></table></div>
      </section>
      <section className="panel table-panel"><h2>Notes</h2><p>{event.notes ?? "No notes recorded."}</p></section>
    </main>
  );
}
