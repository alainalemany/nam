export const KNOWLEDGE_BASE_TEST_DATABASE_NAME = "nam_knowledge_base_test";

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

export function guardedKnowledgeBaseDatabaseUrl(
  environment: GuardEnvironment = process.env,
) {
  const value = environment.KNOWLEDGE_BASE_TEST_DATABASE_URL;
  const required = environment.KNOWLEDGE_BASE_POSTGRES_REQUIRED === "1";
  if (!value) {
    if (required) {
      throw new Error("KNOWLEDGE_BASE_TEST_DATABASE_URL is required.");
    }
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "KNOWLEDGE_BASE_TEST_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.pathname !== `/${KNOWLEDGE_BASE_TEST_DATABASE_NAME}`
  ) {
    throw new Error(
      `Knowledge Base PostgreSQL tests require the disposable ${KNOWLEDGE_BASE_TEST_DATABASE_NAME} database.`,
    );
  }

  return value;
}
