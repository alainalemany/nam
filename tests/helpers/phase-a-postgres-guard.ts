export const PHASE_A_TEST_DATABASE_NAME = "nam_phase_a_integration_test";
export const PHASE_A_TEST_DATABASE_HOST = "nam-phase-a-test-postgres";
export const PHASE_A_TEST_DATABASE_USER = "nam_phase_a_test";

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

export function guardedPhaseADatabaseUrl(
  environment: GuardEnvironment = process.env,
) {
  const value = environment.PHASE_A_TEST_DATABASE_URL;
  const required = environment.PHASE_A_POSTGRES_REQUIRED === "1";
  if (!value) {
    if (required) {
      throw new Error("PHASE_A_TEST_DATABASE_URL is required.");
    }
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PHASE_A_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== PHASE_A_TEST_DATABASE_HOST ||
    parsed.port !== "5432" ||
    parsed.pathname !== `/${PHASE_A_TEST_DATABASE_NAME}` ||
    parsed.username !== PHASE_A_TEST_DATABASE_USER ||
    !parsed.password
  ) {
    throw new Error(
      `Phase A PostgreSQL tests require ${PHASE_A_TEST_DATABASE_USER}@${PHASE_A_TEST_DATABASE_HOST}:5432/${PHASE_A_TEST_DATABASE_NAME}.`,
    );
  }

  return value;
}
