export const DRAGLINE_DELAY_REPORT_TEST_DATABASE_NAME =
  "nam_dragline_delay_report_test";

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

export function guardedDraglineDelayReportDatabaseUrl(
  environment: GuardEnvironment = process.env,
) {
  const value = environment.DRAGLINE_DELAY_REPORT_TEST_DATABASE_URL;
  const required = environment.DRAGLINE_DELAY_REPORT_POSTGRES_REQUIRED === "1";
  if (!value) {
    if (required) {
      throw new Error("DRAGLINE_DELAY_REPORT_TEST_DATABASE_URL is required.");
    }
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "DRAGLINE_DELAY_REPORT_TEST_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.pathname !== `/${DRAGLINE_DELAY_REPORT_TEST_DATABASE_NAME}`
  ) {
    throw new Error(
      `Dragline Delay Report PostgreSQL tests require the disposable ${DRAGLINE_DELAY_REPORT_TEST_DATABASE_NAME} database.`,
    );
  }

  return value;
}
