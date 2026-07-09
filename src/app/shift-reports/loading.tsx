export default function ShiftReportsLoading() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Shift Reports</h1>
        <p className="summary">Loading Shift Report records.</p>
      </section>

      <section className="panel">
        <div className="skeleton-list" aria-label="Loading Shift Reports">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
