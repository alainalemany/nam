import { LockKeyhole } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayrollAccessForm } from "@/features/payroll/PayrollAccessForm";

export default async function PayrollAccessPage({ searchParams }: { searchParams: Promise<{ configuration?: string }> }) {
  const query = await searchParams;
  return <main className="payroll-access-shell"><Card className="payroll-access-card"><CardHeader><CardTitle>Private Payroll</CardTitle><LockKeyhole size={19} /></CardHeader><CardContent className="grid gap-5"><div><h1>Financial records protected</h1><p>Enter the server-configured payroll key. Network access through Tailscale does not replace employee authorization.</p></div>{query.configuration === "missing" ? <div className="payroll-notice payroll-notice--error">Payroll is fail-closed until the owner employee ID and server-only secrets are configured.</div> : <PayrollAccessForm />}</CardContent></Card></main>;
}
