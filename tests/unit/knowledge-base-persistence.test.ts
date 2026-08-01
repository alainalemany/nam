import { describe, expect, it } from "vitest";

import {
  isKnowledgeSubmissionKeyUniqueError,
  isRetryableKnowledgeCreateError,
  runKnowledgeCreateWithRetry,
} from "@/features/knowledge-base/retry";

describe("Knowledge Base create retry classification", () => {
  it("retries only rollback-certain transaction failures at most three times", async () => {
    let attempts = 0;
    await expect(runKnowledgeCreateWithRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw { code: "P2034" };
      return "created";
    })).resolves.toBe("created");
    expect(attempts).toBe(3);
  });

  it.each([
    [{ code: "P2034" }, true],
    [{ code: "40001" }, true],
    [{ code: "40P01" }, true],
    [{ code: "P2010", meta: { code: "40001" } }, true],
    [{ code: "P2002" }, false],
    [new Error("deadlock"), false],
  ])("classifies rollback certainty without transient string matching", (error, expected) => {
    expect(isRetryableKnowledgeCreateError(error)).toBe(expected);
  });

  it("recognizes only the feature submission-key uniqueness constraint", () => {
    expect(isKnowledgeSubmissionKeyUniqueError({ code: "P2002", meta: { target: "KnowledgeRecord_submissionKey_key" } })).toBe(true);
    expect(isKnowledgeSubmissionKeyUniqueError({ code: "P2002", meta: { target: ["createSubmissionKey"] } })).toBe(true);
    expect(isKnowledgeSubmissionKeyUniqueError({ code: "P2002", meta: { target: ["normalizedUrl"] } })).toBe(false);
  });
});
