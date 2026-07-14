"use client";

export default function TimesheetsError({ reset }: { reset: () => void }) {
  return <main className="page-stack"><section className="empty-state"><h1>Timesheets could not be loaded</h1><p>Try the request again.</p><button className="button primary" onClick={reset} type="button">Try again</button></section></main>;
}

