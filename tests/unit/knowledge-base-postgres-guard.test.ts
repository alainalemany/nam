import { describe, expect, it } from "vitest";

import {
  guardedKnowledgeBaseDatabaseUrl,
  KNOWLEDGE_BASE_TEST_DATABASE_NAME,
} from "../helpers/knowledge-base-postgres-guard";

describe("Knowledge Base disposable PostgreSQL guard", () => {
  it.each(["postgres", "postgresql"])(
    "accepts the exact %s disposable identity",
    (protocol) => {
      const value = `${protocol}://localhost/${KNOWLEDGE_BASE_TEST_DATABASE_NAME}?schema=public`;
      expect(
        guardedKnowledgeBaseDatabaseUrl({
          KNOWLEDGE_BASE_TEST_DATABASE_URL: value,
        }),
      ).toBe(value);
    },
  );

  it("returns no optional URL when the dedicated variable is missing", () => {
    expect(
      guardedKnowledgeBaseDatabaseUrl({}),
    ).toBeUndefined();
  });

  it("does not fall back to DATABASE_URL", () => {
    expect(
      guardedKnowledgeBaseDatabaseUrl({
        DATABASE_URL: `postgresql://localhost/${KNOWLEDGE_BASE_TEST_DATABASE_NAME}`,
      }),
    ).toBeUndefined();
  });

  it("fails when final PostgreSQL evidence is required without its URL", () => {
    expect(() =>
      guardedKnowledgeBaseDatabaseUrl({
        KNOWLEDGE_BASE_POSTGRES_REQUIRED: "1",
      }),
    ).toThrow("KNOWLEDGE_BASE_TEST_DATABASE_URL is required.");
  });

  it.each([
    "not-a-url",
    "https://localhost/nam_knowledge_base_test",
    "postgresql://localhost/nam_dashboard",
    "postgresql://localhost/unexpected_database",
    "postgresql://localhost/",
    "postgresql://localhost/nam_knowledge_base_test/extra",
    "postgresql://localhost//nam_knowledge_base_test",
    "postgresql://localhost/%6eam_knowledge_base_test",
    "postgresql://localhost/nam_knowledge_base_test%2Fevil",
    "postgresql://localhost/%",
    "postgresql://localhost/nam_dashboard?database=nam_knowledge_base_test",
  ])("rejects malformed or unsafe identity %s", (value) => {
    expect(() =>
      guardedKnowledgeBaseDatabaseUrl({
        KNOWLEDGE_BASE_TEST_DATABASE_URL: value,
      }),
    ).toThrow();
  });

  it("never includes a supplied URL in its error", () => {
    const value = "postgresql://guard-user:guard-secret@localhost/unexpected_database";
    let thrown: unknown;
    try {
      guardedKnowledgeBaseDatabaseUrl({
        KNOWLEDGE_BASE_TEST_DATABASE_URL: value,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).not.toContain(value);
    expect(message).not.toContain("guard-user");
    expect(message).not.toContain("guard-secret");
  });
});
