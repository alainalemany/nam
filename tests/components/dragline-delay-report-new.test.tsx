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
  it("visually defaults only Benchfill Buckets to zero and allows clearing it", async () => {
    render(await NewDraglineDelayReportPage());

    const benchfill = screen.getByLabelText("Benchfill Buckets");
    expect(benchfill).toHaveValue(0);
    expect(screen.getByLabelText("Normal Digging Buckets")).toHaveValue(null);

    fireEvent.change(benchfill, { target: { value: "" } });
    expect(benchfill).toHaveValue(null);
  });
});
