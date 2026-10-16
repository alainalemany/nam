export const PACKAGE_2B_BROWSER_DATABASE_HOST = "127.0.0.1";
export const PACKAGE_2B_BROWSER_DATABASE_PORT = "55441";
export const PACKAGE_2B_BROWSER_DATABASE_USER = "nam_package2b_browser";
export const PACKAGE_2B_BROWSER_DATABASE_NAME = "nam_package2b_browser";
export const PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN = "http://127.0.0.1:3102";
export const PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN = "http://127.0.0.1:3103";
export const PACKAGE_2B_BROWSER_TEST_MARKER = "isolated-package-2b-browser-v1";
export const PACKAGE_2B_BROWSER_FIXTURE_MARKER = "synthetic-payroll-evidence-v1";

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

export type Package2BBrowserTestConfiguration = {
  databaseUrl: string;
  authorizedOrigin: string;
  mismatchedReviewerOrigin: string;
};

function requireExact(value: string | undefined, expected: string, name: string) {
  if (value !== expected) {
    throw new Error(`${name} must exactly match the approved isolated Package 2B browser-test value.`);
  }
  return value;
}

export function guardedPackage2BBrowserTestConfiguration(
  environment: GuardEnvironment = process.env,
): Package2BBrowserTestConfiguration {
  requireExact(
    environment.PACKAGE_2B_BROWSER_TEST_MARKER,
    PACKAGE_2B_BROWSER_TEST_MARKER,
    "PACKAGE_2B_BROWSER_TEST_MARKER",
  );
  requireExact(
    environment.PACKAGE_2B_BROWSER_FIXTURE_MARKER,
    PACKAGE_2B_BROWSER_FIXTURE_MARKER,
    "PACKAGE_2B_BROWSER_FIXTURE_MARKER",
  );

  const databaseUrl = environment.PACKAGE_2B_BROWSER_TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("PACKAGE_2B_BROWSER_TEST_DATABASE_URL is required; DATABASE_URL fallback is forbidden.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("PACKAGE_2B_BROWSER_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    parsed.protocol !== "postgresql:" ||
    parsed.hostname !== PACKAGE_2B_BROWSER_DATABASE_HOST ||
    parsed.port !== PACKAGE_2B_BROWSER_DATABASE_PORT ||
    parsed.username !== PACKAGE_2B_BROWSER_DATABASE_USER ||
    parsed.pathname !== `/${PACKAGE_2B_BROWSER_DATABASE_NAME}` ||
    !parsed.password
  ) {
    throw new Error(
      `Package 2B browser tests require postgresql://${PACKAGE_2B_BROWSER_DATABASE_USER}:<password>@${PACKAGE_2B_BROWSER_DATABASE_HOST}:${PACKAGE_2B_BROWSER_DATABASE_PORT}/${PACKAGE_2B_BROWSER_DATABASE_NAME}.`,
    );
  }

  requireExact(
    environment.PACKAGE_2B_BROWSER_AUTHORIZED_APP_DATABASE_URL,
    databaseUrl,
    "PACKAGE_2B_BROWSER_AUTHORIZED_APP_DATABASE_URL",
  );
  requireExact(
    environment.PACKAGE_2B_BROWSER_MISMATCHED_APP_DATABASE_URL,
    databaseUrl,
    "PACKAGE_2B_BROWSER_MISMATCHED_APP_DATABASE_URL",
  );
  const authorizedOrigin = requireExact(
    environment.PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN,
    PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN,
    "PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN",
  );
  const mismatchedReviewerOrigin = requireExact(
    environment.PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN,
    PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN,
    "PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN",
  );

  return { databaseUrl, authorizedOrigin, mismatchedReviewerOrigin };
}
