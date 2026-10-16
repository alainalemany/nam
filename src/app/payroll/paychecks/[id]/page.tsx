import { FileCheck2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHours, formatMoney } from "@/features/payroll/calculations";
import { getPayrollPrincipal, PayrollAccessConfigurationError } from "@/features/payroll/auth";
import { getPaycheckDetail } from "@/features/payroll/data";

export const dynamic = "force-dynamic";

export default async function PaycheckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let principal;
  try { principal = await getPayrollPrincipal(); } catch (error) {
    if (error instanceof PayrollAccessConfigurationError) redirect("/payroll/access?configuration=missing");
    throw error;
  }
  if (!principal) redirect("/payroll/access");
  const paycheck = await getPaycheckDetail(principal.employeeId, (await params).id);
  if (!paycheck) notFound();
  return <main className="page-stack payroll-page"><header className="page-header with-actions"><div><p className="eyebrow">Official Workday evidence</p><h1>Paycheck Detail</h1><p className="summary">{paycheck.periodLabel}</p></div><div className="payroll-actions"><Link className="button secondary" href={`/payroll/paychecks/${paycheck.id}/edit`}>Correct Values</Link><Link className="button secondary" href="/payroll">Back to Payroll</Link></div></header><div className="payroll-layout-grid"><Card><CardHeader><CardTitle>Earnings Breakdown</CardTitle><FileCheck2 size={19} /></CardHeader><CardContent><dl className="paycheck-breakdown"><div><dt>Regular hours</dt><dd>{formatHours(paycheck.regularPaidMinutes)}</dd></div><div><dt>Overtime hours</dt><dd>{formatHours(paycheck.overtimePaidMinutes)}</dd></div><div><dt>Base rate</dt><dd>{paycheck.baseRate ? formatMoney(paycheck.baseRate) : "Not established"}</dd></div><div><dt>Regular earnings</dt><dd>{formatMoney(paycheck.regularEarnings)}</dd></div><div><dt>Overtime 1X earnings</dt><dd>{formatMoney(paycheck.overtimeBaseEarnings)}</dd></div><div><dt>Overtime premium 0.5X</dt><dd>{formatMoney(paycheck.overtimePremiumEarnings)}</dd></div><div><dt>Gross cash pay</dt><dd>{formatMoney(paycheck.grossCashPay)}</dd></div><div><dt>Noncash imputed earnings</dt><dd>{formatMoney(paycheck.noncashImputedEarnings)}</dd></div><div><dt>Pre-tax deductions</dt><dd>{formatMoney(paycheck.preTaxDeductions)}</dd></div><div><dt>Employee taxes</dt><dd>{formatMoney(paycheck.employeeTaxes)}</dd></div><div><dt>Post-tax deductions</dt><dd>{formatMoney(paycheck.postTaxDeductions)}</dd></div><div><dt>Net pay</dt><dd>{formatMoney(paycheck.netPay)}</dd></div></dl></CardContent></Card><Card><CardHeader><CardTitle>Evidence</CardTitle></CardHeader><CardContent><dl className="payroll-detail-list"><div><dt>Period</dt><dd>{paycheck.periodLabel}</dd></div><div><dt>Official check date</dt><dd>{paycheck.checkDate}</dd></div><div><dt>Review state</dt><dd>{paycheck.reviewStatus}</dd></div><div><dt>Imported</dt><dd>{paycheck.importedAt.toLocaleString()}</dd></div></dl><div className="payroll-notice">The source PDF and raw extracted text were discarded. Structured values and a duplicate-detection fingerprint were retained.</div></CardContent></Card></div></main>;
}
