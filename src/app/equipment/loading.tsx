export default function EquipmentLoading() {
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Reference data</p>
        <h1>Equipment</h1>
        <p className="summary">Loading equipment records...</p>
      </section>
      <section className="panel">
        <div className="skeleton-list" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
