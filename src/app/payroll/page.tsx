import { redirect } from "next/navigation";

import { lockPayrollAction } from "@/features/payroll/actions";
import { getPayrollPrincipal, PayrollAccessConfigurationError } from "@/features/payroll/auth";
import { getPayrollDashboardData } from "@/features/payroll/data";
import { PayrollDashboard } from "@/features/payroll/PayrollDashboard";
import { dateKeyInTimeZone } from "@/lib/zoned-date-time";

export const dynamic = "force-dynamic";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  let principal;
  try { principal = await getPayrollPrincipal(); } catch (error) {
    if (error instanceof PayrollAccessConfigurationError) redirect("/payroll/access?configuration=missing");
    throw error;
  }
  if (!principal) redirect("/payroll/access");
  const query = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : dateKeyInTimeZone(new Date()).slice(0, 7);
  const data = await getPayrollDashboardData(principal.employeeId, month);
  return <PayrollDashboard data={data} lockAction={lockPayrollAction} />;
}
