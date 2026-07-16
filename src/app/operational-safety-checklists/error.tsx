"use client";

export default function OperationalSafetyChecklistsError({ reset }: { reset: () => void }) {
  return <main className="page-stack"><section className="panel error-panel"><h1>Operational Safety Checklists unavailable</h1><p>The checklist records could not be loaded.</p><button className="button primary" onClick={reset} type="button">Try Again</button></section></main>;
}
