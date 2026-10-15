import { describe, expect, it } from "vitest";

import {
  guardedPhaseADatabaseUrl,
  PHASE_A_TEST_DATABASE_HOST,
  PHASE_A_TEST_DATABASE_NAME,
  PHASE_A_TEST_DATABASE_USER,
} from "../helpers/phase-a-postgres-guard";

const validUrl =
  `postgresql://${PHASE_A_TEST_DATABASE_USER}:synthetic-secret@` +
  `${PHASE_A_TEST_DATABASE_HOST}:5432/${PHASE_A_TEST_DATABASE_NAME}`;

describe("Phase A PostgreSQL identity guard", () => {
  it("skips without the dedicated URL unless execution is explicitly required", () => {
    expect(guardedPhaseADatabaseUrl({})).toBeUndefined();
    expect(() => guardedPhaseADatabaseUrl({ PHASE_A_POSTGRES_REQUIRED: "1" }))
      .toThrow(/required/);
  });

  it("accepts only the exact Phase A container, user, port, and database", () => {
    expect(guardedPhaseADatabaseUrl({ PHASE_A_TEST_DATABASE_URL: validUrl }))
      .toBe(validUrl);

    for (const value of [
      validUrl.replace(PHASE_A_TEST_DATABASE_HOST, "nam-postgres"),
      validUrl.replace(PHASE_A_TEST_DATABASE_HOST, "localhost"),
      validUrl.replace(PHASE_A_TEST_DATABASE_NAME, "nam_dashboard"),
      validUrl.replace(PHASE_A_TEST_DATABASE_USER, "nam_app"),
      validUrl.replace(":5432", ":55432"),
      validUrl.replace("postgresql:", "mysql:"),
      validUrl.replace(":synthetic-secret", ":"),
    ]) {
      expect(() => guardedPhaseADatabaseUrl({ PHASE_A_TEST_DATABASE_URL: value }))
        .toThrow(/Phase A PostgreSQL tests require/);
    }
  });
});
