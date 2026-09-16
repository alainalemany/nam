import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/dragline-delay-reports/data", () => ({
  getDraglineDelayReportFormOptions: vi.fn(async () => ({
    equipment: [],
    employees: [],
    supervisors: [],
    lakes: [],
  })),
}));

import NewDraglineDelayReportPage from "@/app/dragline-delay-reports/new/page";

afterEach(cleanup);

describe("New Dragline Delay Report", () => {
  it("defaults new-report Day Ground Checks, Cut Type, and Benchfill Buckets", async () => {
    render(await NewDraglineDelayReportPage());

    const benchfill = screen.getByLabelText("Benchfill Buckets");
    expect(benchfill).toHaveValue(0);
    expect(screen.getByLabelText("Normal Digging Buckets")).toHaveValue(null);
    expect(screen.getByLabelText("Cut Type")).toHaveValue("PRODUCTION");
    expect(screen.getByLabelText("Day Shift Field Lead")).toHaveValue("");
    expect(screen.getByLabelText("Night Shift Field Lead")).toHaveValue("");
    expect(
      [1, 2, 3, 4].map((sequence) =>
        screen.getByLabelText(`Ground Check time ${sequence}`),
      ),
    ).toEqual([
      expect.objectContaining({ value: "06:20" }),
      expect.objectContaining({ value: "09:30" }),
      expect.objectContaining({ value: "12:30" }),
      expect.objectContaining({ value: "16:00" }),
    ]);
    expect(screen.getAllByText("40 min").length).toBeGreaterThan(0);
    expect(screen.getAllByText("11 h 20 min").length).toBeGreaterThan(0);

    fireEvent.change(benchfill, { target: { value: "" } });
    expect(benchfill).toHaveValue(null);
  });
});
