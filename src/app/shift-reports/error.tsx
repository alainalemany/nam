"use client";

export default function ShiftReportsError() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Shift Reports</h1>
      </section>

      <section className="panel error-panel">
        <h2>Shift Reports could not load</h2>
        <p className="summary">
          Refresh the page and try again. If the problem continues, check the
          database connection and application logs.
        </p>
      </section>
    </main>
  );
}
