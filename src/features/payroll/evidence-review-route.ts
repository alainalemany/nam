import "server-only";

import { redirect } from "next/navigation";

import { PayrollAccessConfigurationError, PayrollAccessDeniedError, requirePayrollEvidenceReviewer } from "./auth";

export async function requireEvidenceReviewRoute() {
  try {
    return await requirePayrollEvidenceReviewer();
  } catch (error) {
    if (error instanceof PayrollAccessConfigurationError) redirect("/payroll/access?configuration=missing");
    if (error instanceof PayrollAccessDeniedError) redirect("/payroll/access");
    throw error;
  }
}
