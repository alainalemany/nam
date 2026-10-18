"use client";

export default function RateHistoryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-stack payroll-page rate-history-page"><header className="page-header"><div><p className="eyebrow">Protected Payroll workspace</p><h1>Rate history unavailable</h1><p className="summary">The protected evidence view could not be loaded. No financial record was changed.</p></div></header><div className="payroll-notice payroll-notice--error" role="alert">Refresh your authorized session or try this read again.</div><button className="button primary" type="button" onClick={reset}>Try again</button></main>;
}
