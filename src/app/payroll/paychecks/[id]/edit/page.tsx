import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPayrollPrincipal, PayrollAccessConfigurationError } from "@/features/payroll/auth";
import { getPaycheckDetail } from "@/features/payroll/data";
import { PaycheckReviewEditor } from "@/features/payroll/PayrollImportForm";

export const dynamic = "force-dynamic";

export default async function CorrectPaycheckPage({ params }: { params: Promise<{ id: string }> }) {
  let principal;
  try { principal = await getPayrollPrincipal(); } catch (error) {
    if (error instanceof PayrollAccessConfigurationError) redirect("/payroll/access?configuration=missing");
    throw error;
  }
  if (!principal) redirect("/payroll/access");
  const paycheck = await getPaycheckDetail(principal.employeeId, (await params).id);
  if (!paycheck) notFound();
  const values = {
    fingerprint: paycheck.fingerprint,
    parserVersion: paycheck.parserVersion,
    periodStart: paycheck.periodStart,
    periodEnd: paycheck.periodEnd,
    checkDate: paycheck.checkDate,
    regularHours: String(paycheck.regularPaidMinutes / 60),
    overtimeHours: String(paycheck.overtimePaidMinutes / 60),
    baseRate: paycheck.baseRate ?? "",
    regularEarnings: paycheck.regularEarnings,
    overtimeBaseEarnings: paycheck.overtimeBaseEarnings,
    overtimePremiumEarnings: paycheck.overtimePremiumEarnings,
    otherCashEarnings: paycheck.otherCashEarnings,
    grossCashPay: paycheck.grossCashPay,
    noncashImputedEarnings: paycheck.noncashImputedEarnings,
    preTaxDeductions: paycheck.preTaxDeductions,
    employeeTaxes: paycheck.employeeTaxes,
    postTaxDeductions: paycheck.postTaxDeductions,
    adjustments: paycheck.adjustments,
    netPay: paycheck.netPay,
    notes: paycheck.notes,
    warnings: [],
  };
  return <main className="page-stack payroll-page"><header className="page-header with-actions"><div><p className="eyebrow">Controlled correction</p><h1>Correct Paycheck</h1><p className="summary">Review and replace structured values. The original duplicate-detection fingerprint remains unchanged.</p></div><Link className="button secondary" href={`/payroll/paychecks/${paycheck.id}`}>Cancel</Link></header><Card><CardHeader><CardTitle>{paycheck.periodLabel}</CardTitle></CardHeader><CardContent><PaycheckReviewEditor initial={values} paycheckId={paycheck.id} /></CardContent></Card></main>;
}
