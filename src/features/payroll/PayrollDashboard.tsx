import { AlertTriangle, Banknote, Clock3, FileCheck2, FileText, WalletCards } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { adjacentMonth, formatHours, formatMoney } from "./calculations";
import { lockPayrollAction } from "./actions";
import type { getPayrollDashboardData } from "./data";
import { PayrollCalendar } from "./PayrollCalendar";

export type DashboardData = Awaited<ReturnType<typeof getPayrollDashboardData>>;

function monthName(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

function Metric({ icon: Icon, value, label, color }: { icon: typeof Clock3; value: string; label: string; color: string }) {
  return <Card className="payroll-metric" style={{ "--metric-color": color } as React.CSSProperties}><CardContent><span className="payroll-metric-icon"><Icon aria-hidden="true" /></span><strong className="payroll-metric-value">{value}</strong><span className="payroll-metric-label">{label}</span></CardContent></Card>;
}

export function PayrollDashboard({ data, preview = false }: { data: DashboardData; preview?: boolean }) {
  const latest = data.summary.latestPaycheck;
  return (
    <main className="page-stack payroll-page">
      {preview ? <div className="payroll-notice">Preview data only — no financial record is being shown or changed.</div> : null}
      <header className="payroll-hero">
        <div><p className="eyebrow">Personal payroll reconciliation</p><h1>Payroll</h1><p className="summary">Schedule, NAM Timesheets, and Workday evidence in one trustworthy view for {data.employee.displayName}.</p></div>
        <div className="payroll-actions"><Link className="button secondary" href="/timesheets">Open Timesheets</Link><Link className="button primary" href="/payroll/import">Import Paycheck</Link>{!preview ? <form action={lockPayrollAction}><button className="button secondary" type="submit">Lock</button></form> : null}</div>
      </header>
      <section className="payroll-summary-grid" aria-label="Payroll summary">
        <Metric icon={FileCheck2} value={formatHours(data.summary.reconciledMinutes)} label="Reconciled hours · aggregate" color="#17c653" />
        <Metric icon={Clock3} value={formatHours(data.summary.pendingMinutes)} label="Pending paycheck confirmation" color="#f6b100" />
        <Metric icon={Banknote} value={data.summary.pendingGross ?? "—"} label="Estimated pending gross" color="#1b84ff" />
        <Metric icon={AlertTriangle} value={String(data.summary.openIssues)} label="Open reconciliation issues" color="#f8285a" />
      </section>
      <div className="payroll-layout-grid">
        <PayrollCalendar days={data.days} monthLabel={monthName(data.month)} previousHref={`/payroll?month=${adjacentMonth(data.month, -1)}`} nextHref={`/payroll?month=${adjacentMonth(data.month, 1)}`} />
        <div className="payroll-side-stack">
          <Card>
            <CardHeader><CardTitle>Latest Paycheck</CardTitle><WalletCards size={18} aria-hidden="true" /></CardHeader>
            <CardContent>
              {latest ? <dl className="payroll-detail-list"><div><dt>Covered period</dt><dd>{latest.periodLabel}</dd></div><div><dt>Official check date</dt><dd>{dateLabel(latest.checkDate)}</dd></div><div><dt>Regular</dt><dd>{formatHours(latest.regularPaidMinutes)}</dd></div><div><dt>Overtime</dt><dd>{formatHours(latest.overtimePaidMinutes)}</dd></div><div><dt>Gross cash</dt><dd>{formatMoney(latest.grossCashPay)}</dd></div><div><dt>Net pay</dt><dd>{formatMoney(latest.netPay)}</dd></div></dl> : <div className="payroll-empty"><FileText aria-hidden="true" /><strong>No paychecks imported</strong><span>Import a Workday payslip to begin reconciliation.</span></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Next Expected Check</CardTitle></CardHeader>
            <CardContent><strong className="payroll-metric-value">{dateLabel(data.summary.nextExpectedCheckDate)}</strong><p>Projected from the Monday–Sunday cadence. An actual payslip remains authoritative.</p></CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Paycheck History</CardTitle><Link className="button secondary" href="/payroll/import">Import Paycheck</Link></CardHeader>
        <div className="payroll-table-scroll">
          {data.paychecks.length ? <table className="payroll-history-table"><thead><tr><th>Payroll period</th><th>Check date</th><th>Regular</th><th>Overtime</th><th>Gross cash</th><th>Net pay</th><th>Status</th><th /></tr></thead><tbody>{data.paychecks.map((paycheck) => <tr key={paycheck.id}><td>{paycheck.periodLabel}</td><td>{dateLabel(paycheck.checkDate)}</td><td>{formatHours(paycheck.regularPaidMinutes)}</td><td>{formatHours(paycheck.overtimePaidMinutes)}</td><td>{formatMoney(paycheck.grossCashPay)}</td><td>{formatMoney(paycheck.netPay)}</td><td><span className={`payroll-day-status payroll-status--${paycheck.status.toLowerCase().replaceAll("_", "-")}`}>{paycheck.status === "RECONCILED" ? "Aggregate match" : paycheck.status.replaceAll("_", " ")}</span></td><td><Link className="table-action" href={`/payroll/paychecks/${paycheck.id}`}>Details →</Link></td></tr>)}</tbody></table> : <div className="payroll-empty"><FileText aria-hidden="true" /><strong>No paycheck history yet</strong><span>Imported statements will appear here without retaining the source PDF.</span></div>}
        </div>
      </Card>
    </main>
  );
}
