export default function StopCardsLoading() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Safety</p>
        <h1 id="page-title">STOP Cards</h1>
        <p className="summary">Loading STOP Card records.</p>
      </section>

      <section className="panel">
        <div className="skeleton-list" aria-label="Loading STOP Cards">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
