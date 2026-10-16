import { describe, expect, it } from "vitest";

import {
  PHASE_A_CI_TEST_DATABASE_HOST,
  PHASE_A_CI_TEST_DATABASE_PROFILE,
  PHASE_A_LOCAL_LOOPBACK_TEST_DATABASE_HOST,
  PHASE_A_LOCAL_LOOPBACK_TEST_DATABASE_PORT,
  PHASE_A_LOCAL_LOOPBACK_TEST_DATABASE_PROFILE,
  guardedPhaseADatabaseUrl,
  PHASE_A_TEST_DATABASE_HOST,
  PHASE_A_TEST_DATABASE_NAME,
  PHASE_A_TEST_DATABASE_USER,
} from "../helpers/phase-a-postgres-guard";

const validUrl =
  `postgresql://${PHASE_A_TEST_DATABASE_USER}:synthetic-secret@` +
  `${PHASE_A_TEST_DATABASE_HOST}:5432/${PHASE_A_TEST_DATABASE_NAME}`;
const validCiUrl =
  `postgresql://${PHASE_A_TEST_DATABASE_USER}:synthetic-secret@` +
  `${PHASE_A_CI_TEST_DATABASE_HOST}:5432/${PHASE_A_TEST_DATABASE_NAME}`;
const validLocalLoopbackUrl =
  `postgresql://${PHASE_A_TEST_DATABASE_USER}:synthetic-secret@` +
  `${PHASE_A_LOCAL_LOOPBACK_TEST_DATABASE_HOST}:${PHASE_A_LOCAL_LOOPBACK_TEST_DATABASE_PORT}/${PHASE_A_TEST_DATABASE_NAME}`;

describe("Phase A PostgreSQL identity guard", () => {
  it("skips without the dedicated URL unless execution is explicitly required", () => {
    expect(guardedPhaseADatabaseUrl({})).toBeUndefined();
    expect(guardedPhaseADatabaseUrl({ DATABASE_URL: validUrl })).toBeUndefined();
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

  it("accepts the loopback CI target only inside an explicit GitHub Actions profile", () => {
    const ciEnvironment = {
      PHASE_A_TEST_DATABASE_URL: validCiUrl,
      PHASE_A_TEST_DATABASE_PROFILE: PHASE_A_CI_TEST_DATABASE_PROFILE,
      GITHUB_ACTIONS: "true",
      CI: "true",
    };
    expect(guardedPhaseADatabaseUrl(ciEnvironment)).toBe(validCiUrl);

    for (const environment of [
      { ...ciEnvironment, GITHUB_ACTIONS: undefined },
      { ...ciEnvironment, CI: undefined },
      { ...ciEnvironment, PHASE_A_TEST_DATABASE_PROFILE: "production" },
      {
        ...ciEnvironment,
        PHASE_A_TEST_DATABASE_URL: validCiUrl.replace("127.0.0.1", "localhost"),
      },
      {
        ...ciEnvironment,
        PHASE_A_TEST_DATABASE_URL: validCiUrl.replace(PHASE_A_TEST_DATABASE_NAME, "nam_dashboard"),
      },
      {
        ...ciEnvironment,
        PHASE_A_TEST_DATABASE_URL: validCiUrl.replace(PHASE_A_TEST_DATABASE_USER, "nam_app"),
      },
      {
        ...ciEnvironment,
        PHASE_A_TEST_DATABASE_URL: validCiUrl.replace(":5432", ":55432"),
      },
    ]) {
      expect(() => guardedPhaseADatabaseUrl(environment)).toThrow();
    }
  });

  it("accepts only the dedicated high-port loopback target for explicit local runs", () => {
    const environment = {
      PHASE_A_TEST_DATABASE_URL: validLocalLoopbackUrl,
      PHASE_A_TEST_DATABASE_PROFILE: PHASE_A_LOCAL_LOOPBACK_TEST_DATABASE_PROFILE,
    };
    expect(guardedPhaseADatabaseUrl(environment)).toBe(validLocalLoopbackUrl);
    for (const value of [
      validLocalLoopbackUrl.replace("127.0.0.1", "localhost"),
      validLocalLoopbackUrl.replace(":55439", ":5432"),
      validLocalLoopbackUrl.replace(PHASE_A_TEST_DATABASE_NAME, "nam_dashboard"),
      validLocalLoopbackUrl.replace(PHASE_A_TEST_DATABASE_USER, "nam_app"),
    ]) {
      expect(() => guardedPhaseADatabaseUrl({ ...environment, PHASE_A_TEST_DATABASE_URL: value })).toThrow();
    }
  });
});
