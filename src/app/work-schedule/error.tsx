"use client";

export default function WorkScheduleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-stack">
      <section className="panel error-panel">
        <p className="eyebrow">Error</p>
        <h1>Work Schedule could not load</h1>
        <p className="summary">Try again. If the issue continues, review the latest Work Schedule changes.</p>
        <button className="button primary" type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}

