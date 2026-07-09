export default function DailyInspectionsLoading() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Daily Inspections</h1>
        <p className="summary">Loading Daily Inspection records.</p>
      </section>

      <section className="panel">
        <div className="skeleton-list" aria-label="Loading Daily Inspections">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
