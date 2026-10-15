export const PHASE_A_TEST_DATABASE_NAME = "nam_phase_a_integration_test";
export const PHASE_A_TEST_DATABASE_HOST = "nam-phase-a-test-postgres";
export const PHASE_A_TEST_DATABASE_USER = "nam_phase_a_test";
export const PHASE_A_CI_TEST_DATABASE_HOST = "127.0.0.1";
export const PHASE_A_CI_TEST_DATABASE_PROFILE = "github-actions";

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

function approvedHost(environment: GuardEnvironment) {
  const profile = environment.PHASE_A_TEST_DATABASE_PROFILE;
  if (!profile || profile === "local-container") {
    return PHASE_A_TEST_DATABASE_HOST;
  }
  if (
    profile === PHASE_A_CI_TEST_DATABASE_PROFILE &&
    environment.GITHUB_ACTIONS === "true" &&
    environment.CI === "true"
  ) {
    return PHASE_A_CI_TEST_DATABASE_HOST;
  }
  throw new Error("PHASE_A_TEST_DATABASE_PROFILE is not an approved test target.");
}

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

  const expectedHost = approvedHost(environment);

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== expectedHost ||
    parsed.port !== "5432" ||
    parsed.pathname !== `/${PHASE_A_TEST_DATABASE_NAME}` ||
    parsed.username !== PHASE_A_TEST_DATABASE_USER ||
    !parsed.password
  ) {
    throw new Error(
      `Phase A PostgreSQL tests require ${PHASE_A_TEST_DATABASE_USER}@${expectedHost}:5432/${PHASE_A_TEST_DATABASE_NAME}.`,
    );
  }

  return value;
}
