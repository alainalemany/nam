"use client";

export default function EquipmentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-stack">
      <section className="panel error-panel" role="alert">
        <p className="eyebrow">Reference data</p>
        <h1>Equipment could not load</h1>
        <p>
          The equipment list hit an unexpected error. Try loading the page again.
        </p>
        <button className="button primary" type="button" onClick={() => reset()}>
          Retry
        </button>
      </section>
    </main>
  );
}
