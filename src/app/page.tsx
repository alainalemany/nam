export default function Home() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Phase 3.1</p>
        <h1 id="page-title">NAM Dashboard</h1>
        <p className="summary">
          Operations reference data is the first application milestone. City,
          Mine, and Equipment records establish the shared context used by later
          logs, schedules, inspections, fuel records, and historical views.
        </p>
      </section>

      <section className="panel" aria-labelledby="reference-data-heading">
        <div>
          <p className="eyebrow">Reference data</p>
          <h2 id="reference-data-heading">Equipment foundation</h2>
          <p>
            Create and maintain equipment records with their mine and city
            associations.
          </p>
        </div>
        <a className="button primary" href="/equipment">
          Open Equipment
        </a>
      </section>
    </main>
  );
}
