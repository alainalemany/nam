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
  it("defaults new-report Cut Type to Production and Benchfill Buckets to zero", async () => {
    render(await NewDraglineDelayReportPage());

    const benchfill = screen.getByLabelText("Benchfill Buckets");
    expect(benchfill).toHaveValue(0);
    expect(screen.getByLabelText("Normal Digging Buckets")).toHaveValue(null);
    expect(screen.getByLabelText("Cut Type")).toHaveValue("PRODUCTION");
    expect(screen.getByLabelText("Day Shift Field Lead")).toHaveValue("");
    expect(screen.getByLabelText("Night Shift Field Lead")).toHaveValue("");

    fireEvent.change(benchfill, { target: { value: "" } });
    expect(benchfill).toHaveValue(null);
  });
});
