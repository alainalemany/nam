import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const MIN_PAYROLL_ACCESS_KEY_LENGTH = 32;

export class PayrollAccessConfigurationError extends Error {}
export class PayrollAccessDeniedError extends Error {}

export type PayrollPrincipal = {
  employeeId: string;
  expiresAt: number;
};

export function safePayrollEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isConfiguredPayrollValue(value: string) {
  return value.length > 0 && !value.startsWith("replace-with-");
}

export function isStrongPayrollAccessKey(value: string) {
  return isConfiguredPayrollValue(value) && value.length >= MIN_PAYROLL_ACCESS_KEY_LENGTH;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createPayrollSessionToken(employeeId: string, sessionSecret: string, now = Date.now()) {
  const principal: PayrollPrincipal = {
    employeeId,
    expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(principal)).toString("base64url");
  return `${payload}.${sign(payload, sessionSecret)}`;
}

export function verifyPayrollSessionToken(token: string, expectedEmployeeId: string, sessionSecret: string, now = Date.now()) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return undefined;
  const expectedSignature = sign(payload, sessionSecret);
  if (!safePayrollEqual(suppliedSignature, expectedSignature)) return undefined;
  try {
    const principal = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PayrollPrincipal;
    if (principal.employeeId !== expectedEmployeeId || !Number.isSafeInteger(principal.expiresAt) || principal.expiresAt <= Math.floor(now / 1000)) return undefined;
    return principal;
  } catch {
    return undefined;
  }
}

export function assertPayrollEmployeeAccess(principal: PayrollPrincipal, employeeId: string) {
  if (principal.employeeId !== employeeId) throw new PayrollAccessDeniedError("Payroll access denied.");
}

export const payrollSessionTtlSeconds = SESSION_TTL_SECONDS;
