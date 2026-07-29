import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

afterEach(cleanup);

describe("Timesheet History navigation", () => {
  it("keeps the primary Timesheets entry on the canonical /timesheets route", () => {
    render(
      <RootLayout>
        <main>History content</main>
      </RootLayout>,
    );

    const navigation = screen.getByRole("navigation");
    expect(
      within(navigation).getByRole("link", { name: "Timesheets" }),
    ).toHaveAttribute("href", "/timesheets");
  });
});
