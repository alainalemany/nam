"use client";

import { useEffect } from "react";

export default function DraglineDelayReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Do not include report form values or operational notes in diagnostics.
    console.error("Dragline Delay Reports route error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <main className="page-stack">
      <section className="panel form-alert" role="alert">
        <p className="eyebrow">Dragline Delay Reports</p>
        <h1>This page could not continue</h1>
        <p>
          Reload the DDR workspace. Draft recovery on this device may offer any
          changes that had not reached the server.
        </p>
        <div className="inline-actions">
          <button className="button primary" type="button" onClick={reset}>
            Try again
          </button>
          <a className="button secondary" href="/dragline-delay-reports">
            Report history
          </a>
        </div>
      </section>
    </main>
  );
}
