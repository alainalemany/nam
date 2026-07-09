"use client";

export default function StopCardsError() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Safety</p>
        <h1 id="page-title">STOP Cards</h1>
      </section>

      <section className="panel error-panel">
        <h2>STOP Cards could not load</h2>
        <p className="summary">
          Refresh the page and try again. If the problem continues, check the
          database connection and application logs.
        </p>
      </section>
    </main>
  );
}
