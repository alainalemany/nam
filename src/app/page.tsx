export default function Home() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Phase 3.2</p>
        <h1 id="page-title">NAM Dashboard</h1>
        <p className="summary">
          Daily Logs are now the central workday record, supported by operations
          reference data for city, mine, and equipment context.
        </p>
      </section>

      <section className="panel" aria-labelledby="daily-logs-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="daily-logs-heading">Daily Work Log</h2>
          <p>
            Record workday summaries and activity timelines linked to existing
            mine and equipment records.
          </p>
        </div>
        <a className="button primary" href="/daily-logs">
          Open Daily Logs
        </a>
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
