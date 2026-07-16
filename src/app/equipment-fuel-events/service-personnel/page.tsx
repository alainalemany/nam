import Link from "next/link";

import { getFuelServicePeople } from "@/features/equipment-fuel-events/data";
import { FuelServicePersonForm } from "@/features/equipment-fuel-events/FuelServicePersonForm";

export const dynamic = "force-dynamic";

export default async function FuelServicePersonnelPage() {
  const records = await getFuelServicePeople();
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Equipment Fuel Events Reference Data</p><h1>Fuel Service Personnel</h1><p className="summary">A narrow feature-owned directory for optional service-person context, not an Employee or vendor system.</p></div><Link className="button secondary" href="/equipment-fuel-events">Back</Link></section><section className="panel form-stack"><h2>Add Fuel Service Person</h2><FuelServicePersonForm /></section><section className="record-list">{records.map((record) => <details className="record-card" key={record.id}><summary><strong>{record.displayName}</strong><span className="subtle">{record.active ? "Active" : "Inactive"} · {record._count.fuelEvents} historical Fuel Events</span></summary><FuelServicePersonForm id={record.id} initial={{ displayName: record.displayName, active: record.active }} /></details>)}</section></main>;
}
