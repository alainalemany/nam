"use client";

export default function DailyLogsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-stack">
      <section className="panel error-panel" role="alert">
        <p className="eyebrow">Operations</p>
        <h1>Daily Logs could not load</h1>
        <p>The Daily Log list hit an unexpected error. Try loading it again.</p>
        <button className="button primary" type="button" onClick={() => reset()}>
          Retry
        </button>
      </section>
    </main>
  );
}
