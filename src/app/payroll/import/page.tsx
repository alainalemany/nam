import { FileUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPayrollPrincipal, PayrollAccessConfigurationError } from "@/features/payroll/auth";
import { PayrollImportForm } from "@/features/payroll/PayrollImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPaycheckPage() {
  try { if (!(await getPayrollPrincipal())) redirect("/payroll/access"); } catch (error) {
    if (error instanceof PayrollAccessConfigurationError) redirect("/payroll/access?configuration=missing");
    throw error;
  }
  return <main className="page-stack payroll-page"><header className="page-header with-actions"><div><p className="eyebrow">Payroll evidence</p><h1>Import Paycheck</h1><p className="summary">Extract a readable Workday PDF, verify every value, then save only the structured payroll evidence.</p></div><Link className="button secondary" href="/payroll">Back to Payroll</Link></header><Card><CardHeader><CardTitle>Workday Payslip</CardTitle><FileUp size={19} /></CardHeader><CardContent><PayrollImportForm /></CardContent></Card></main>;
}
