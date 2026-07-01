export default function DailyLogsLoading() {
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Operations</p>
        <h1>Daily Logs</h1>
        <p className="summary">Loading Daily Logs...</p>
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
