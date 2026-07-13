export default function WorkScheduleLoading() {
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Planning</p>
        <h1>Work Schedule</h1>
      </section>
      <section className="panel">
        <div className="skeleton-list" aria-label="Loading Work Schedule">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}

