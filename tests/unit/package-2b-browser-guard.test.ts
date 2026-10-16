import { describe, expect, it } from "vitest";

import {
  PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN,
  PACKAGE_2B_BROWSER_DATABASE_HOST,
  PACKAGE_2B_BROWSER_DATABASE_NAME,
  PACKAGE_2B_BROWSER_DATABASE_PORT,
  PACKAGE_2B_BROWSER_DATABASE_USER,
  PACKAGE_2B_BROWSER_FIXTURE_MARKER,
  PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN,
  PACKAGE_2B_BROWSER_TEST_MARKER,
  guardedPackage2BBrowserTestConfiguration,
} from "../helpers/package-2b-browser-guard";

const validUrl = `postgresql://${PACKAGE_2B_BROWSER_DATABASE_USER}:synthetic-browser-only@${PACKAGE_2B_BROWSER_DATABASE_HOST}:${PACKAGE_2B_BROWSER_DATABASE_PORT}/${PACKAGE_2B_BROWSER_DATABASE_NAME}?schema=public`;
const validEnvironment = {
  PACKAGE_2B_BROWSER_TEST_MARKER,
  PACKAGE_2B_BROWSER_FIXTURE_MARKER,
  PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl,
  PACKAGE_2B_BROWSER_AUTHORIZED_APP_DATABASE_URL: validUrl,
  PACKAGE_2B_BROWSER_MISMATCHED_APP_DATABASE_URL: validUrl,
  PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN,
  PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN,
};

describe("Package 2B browser-test environment guard", () => {
  it("accepts only the complete approved isolated configuration", () => {
    expect(guardedPackage2BBrowserTestConfiguration(validEnvironment)).toEqual({
      databaseUrl: validUrl,
      authorizedOrigin: PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN,
      mismatchedReviewerOrigin: PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN,
    });
  });

  it.each([
    ["missing dedicated URL", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: undefined }],
    ["empty dedicated URL", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: "" }],
    ["malformed URL", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: "not-a-url" }],
    ["wrong protocol", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace("postgresql:", "mysql:") }],
    ["wrong host", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace("127.0.0.1", "db.internal") }],
    ["localhost alias", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace("127.0.0.1", "localhost") }],
    ["wrong port", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace(":55441", ":5432") }],
    ["wrong user", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace(PACKAGE_2B_BROWSER_DATABASE_USER, "nam_app") }],
    ["wrong database", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace(PACKAGE_2B_BROWSER_DATABASE_NAME, "nam_dashboard") }],
    ["missing password", { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: validUrl.replace(":synthetic-browser-only", ":") }],
  ])("rejects %s", (_label, replacement) => {
    const environment = { ...validEnvironment, ...replacement };
    environment.PACKAGE_2B_BROWSER_AUTHORIZED_APP_DATABASE_URL = environment.PACKAGE_2B_BROWSER_TEST_DATABASE_URL ?? validUrl;
    environment.PACKAGE_2B_BROWSER_MISMATCHED_APP_DATABASE_URL = environment.PACKAGE_2B_BROWSER_TEST_DATABASE_URL ?? validUrl;
    expect(() => guardedPackage2BBrowserTestConfiguration(environment)).toThrow();
  });

  it("rejects ordinary DATABASE_URL instead of falling back", () => {
    const { PACKAGE_2B_BROWSER_TEST_DATABASE_URL: _omitted, ...withoutDedicatedUrl } = validEnvironment;
    expect(() => guardedPackage2BBrowserTestConfiguration({ ...withoutDedicatedUrl, DATABASE_URL: validUrl })).toThrow(/fallback is forbidden/);
  });

  it.each([
    ["missing test marker", { PACKAGE_2B_BROWSER_TEST_MARKER: undefined }],
    ["wrong test marker", { PACKAGE_2B_BROWSER_TEST_MARKER: "production" }],
    ["missing fixture marker", { PACKAGE_2B_BROWSER_FIXTURE_MARKER: undefined }],
    ["mismatched authorized app database", { PACKAGE_2B_BROWSER_AUTHORIZED_APP_DATABASE_URL: `${validUrl}&application=wrong` }],
    ["mismatched reviewer app database", { PACKAGE_2B_BROWSER_MISMATCHED_APP_DATABASE_URL: `${validUrl}&application=wrong` }],
    ["unexpected authorized origin", { PACKAGE_2B_BROWSER_AUTHORIZED_ORIGIN: "https://dev.alemany.me" }],
    ["unexpected reviewer origin", { PACKAGE_2B_BROWSER_MISMATCHED_ORIGIN: "http://127.0.0.1:3000" }],
  ])("rejects %s", (_label, replacement) => {
    expect(() => guardedPackage2BBrowserTestConfiguration({ ...validEnvironment, ...replacement })).toThrow();
  });
});
