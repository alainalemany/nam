import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

import {
  createPayrollSessionToken,
  isConfiguredPayrollValue,
  isStrongPayrollAccessKey,
  PayrollAccessConfigurationError,
  PayrollAccessDeniedError,
  payrollSessionTtlSeconds,
  safePayrollEqual,
  verifyPayrollSessionToken,
} from "./security";

export {
  assertPayrollEmployeeAccess,
  createPayrollSessionToken,
  PayrollAccessConfigurationError,
  PayrollAccessDeniedError,
  verifyPayrollSessionToken,
} from "./security";
export type { PayrollPrincipal } from "./security";

export const PAYROLL_SESSION_COOKIE = "nam-payroll-session";

const payrollEmployeeIdPattern = /^[A-Za-z0-9_-]{1,191}$/u;

export type PayrollEvidenceReviewer = {
  employeeId: string;
  expiresAt: number;
  displayName: string;
  employeeCode: string | null;
};
function requiredConfiguration() {
  const employeeId = process.env.NAM_PAYROLL_OWNER_EMPLOYEE_ID?.trim();
  const accessKey = process.env.NAM_PAYROLL_ACCESS_KEY;
  const sessionSecret = process.env.NAM_PAYROLL_SESSION_SECRET;
  if (
    !employeeId ||
    !isConfiguredPayrollValue(employeeId) ||
    !accessKey ||
    !isStrongPayrollAccessKey(accessKey) ||
    !sessionSecret ||
    !isConfiguredPayrollValue(sessionSecret) ||
    sessionSecret.length < 32
  ) {
    throw new PayrollAccessConfigurationError(
      "Payroll access is unavailable until its owner and server-only secrets are configured.",
    );
  }
  return { employeeId, accessKey, sessionSecret };
}

export function verifyPayrollAccessKey(candidate: string) {
  const configuration = requiredConfiguration();
  return safePayrollEqual(candidate, configuration.accessKey)
    ? configuration
    : undefined;
}

export async function getPayrollPrincipal() {
  const configuration = requiredConfiguration();
  const token = (await cookies()).get(PAYROLL_SESSION_COOKIE)?.value;
  return token
    ? verifyPayrollSessionToken(
        token,
        configuration.employeeId,
        configuration.sessionSecret,
      )
    : undefined;
}

export async function requirePayrollPrincipal() {
  const principal = await getPayrollPrincipal();
  if (!principal) throw new PayrollAccessDeniedError("Payroll access denied.");
  return principal;
}

export async function requirePayrollEvidenceReviewer(): Promise<PayrollEvidenceReviewer> {
  const principal = await requirePayrollPrincipal();
  const configuredReviewerId = process.env.NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID?.trim();
  if (
    !configuredReviewerId ||
    !isConfiguredPayrollValue(configuredReviewerId) ||
    !payrollEmployeeIdPattern.test(configuredReviewerId)
  ) {
    throw new PayrollAccessConfigurationError(
      "Payroll evidence review is unavailable until its reviewer is configured.",
    );
  }
  if (!safePayrollEqual(principal.employeeId, configuredReviewerId)) {
    throw new PayrollAccessDeniedError("Payroll evidence review access denied.");
  }
  const reviewer = await prisma.employee.findUnique({
    where: { id: principal.employeeId },
    select: { id: true, displayName: true, employeeCode: true },
  });
  if (!reviewer) throw new PayrollAccessDeniedError("Payroll evidence review access denied.");
  return {
    employeeId: reviewer.id,
    expiresAt: principal.expiresAt,
    displayName: reviewer.displayName,
    employeeCode: reviewer.employeeCode,
  };
}

export async function establishPayrollSession(accessKey: string) {
  const configuration = verifyPayrollAccessKey(accessKey);
  if (!configuration) return false;
  const token = createPayrollSessionToken(
    configuration.employeeId,
    configuration.sessionSecret,
  );
  (await cookies()).set(PAYROLL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: payrollSessionTtlSeconds,
  });
  return true;
}

export async function clearPayrollSession() {
  (await cookies()).set(PAYROLL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
