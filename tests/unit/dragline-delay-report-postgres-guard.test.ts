import { describe, expect, it } from "vitest";

import {
  DRAGLINE_DELAY_REPORT_TEST_DATABASE_NAME,
  guardedDraglineDelayReportDatabaseUrl,
} from "../helpers/dragline-delay-report-postgres-guard";

describe("Dragline Delay Report PostgreSQL identity guard", () => {
  it("skips when the disposable URL is absent unless explicitly required", () => {
    expect(guardedDraglineDelayReportDatabaseUrl({})).toBeUndefined();
    expect(() =>
      guardedDraglineDelayReportDatabaseUrl({
        DRAGLINE_DELAY_REPORT_POSTGRES_REQUIRED: "1",
      }),
    ).toThrow(/required/);
  });

  it("accepts only the exact disposable database identity", () => {
    const value = `postgresql://user:secret@localhost:5432/${DRAGLINE_DELAY_REPORT_TEST_DATABASE_NAME}`;
    expect(
      guardedDraglineDelayReportDatabaseUrl({
        DRAGLINE_DELAY_REPORT_TEST_DATABASE_URL: value,
      }),
    ).toBe(value);
    expect(() =>
      guardedDraglineDelayReportDatabaseUrl({
        DRAGLINE_DELAY_REPORT_TEST_DATABASE_URL:
          "postgresql://user:secret@localhost:5432/nam_dashboard",
      }),
    ).toThrow(/disposable/);
    expect(() =>
      guardedDraglineDelayReportDatabaseUrl({
        DRAGLINE_DELAY_REPORT_TEST_DATABASE_URL:
          "mysql://user:secret@localhost:3306/nam_dragline_delay_report_test",
      }),
    ).toThrow(/disposable/);
  });
});
