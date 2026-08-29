import Link from "next/link";

export default function ReferenceDataPage() {
  return <main className="page-stack">
    <section className="page-header"><p className="eyebrow">Reference data</p><h1>Reference Data</h1><p className="summary">Maintain shared operational identities without duplicating them inside individual workflows.</p></section>
    <section className="panel"><div><h2>U.S. States</h2><p>Canonical State names, abbreviations, and active status.</p></div><Link className="button primary" href="/reference-data/states">Manage States</Link></section>
    <section className="panel"><div><h2>U.S. Cities</h2><p>Searchable Cities linked to canonical States and reusable by Mines and Gas Stations.</p></div><Link className="button primary" href="/reference-data/cities">Manage Cities</Link></section>
    <section className="panel"><div><h2>Equipment</h2><p>Equipment and its existing Mine-derived City context.</p></div><Link className="button secondary" href="/equipment">Manage Equipment</Link></section>
    <section className="panel"><div><h2>Gas Stations</h2><p>Fueling locations that consume canonical City reference data.</p></div><Link className="button secondary" href="/equipment-fuel-events/gas-stations">Manage Gas Stations</Link></section>
  </main>;
}
