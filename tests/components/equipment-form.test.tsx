import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EquipmentForm } from "@/features/equipment/EquipmentForm";
import type { EquipmentFormState } from "@/features/equipment/validation";

async function action(
  _previousState: EquipmentFormState,
  _formData: FormData,
): Promise<EquipmentFormState> {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
  };
}

const mineOptions = [
  {
    id: "mine-1",
    label: "White Rock Quarry (Miami, FL)",
    cityLabel: "Miami, FL",
    mineType: "Quarry",
    status: "ACTIVE",
  },
  {
    id: "mine-2",
    label: "North Mine (Gillette, WY)",
    cityLabel: "Gillette, WY",
    mineType: "Strip Mine",
    status: "ACTIVE",
  },
];

afterEach(cleanup);

describe("EquipmentForm", () => {
  it("uses canonical Mine options and derives City context", () => {
    render(
      <EquipmentForm
        action={action}
        cancelHref="/equipment"
        mineOptions={mineOptions}
        submitLabel="Create Equipment"
      />,
    );

    const mine = screen.getByLabelText("Mine");
    expect(mine).toBeInstanceOf(HTMLSelectElement);
    expect(within(mine).getByRole("option", { name: "Select Mine" })).toBeInTheDocument();
    expect(
      within(mine).getByRole("option", { name: "White Rock Quarry (Miami, FL)" }),
    ).toBeInTheDocument();

    fireEvent.change(mine, { target: { value: "mine-2" } });

    expect(screen.getByText("Gillette, WY")).toBeInTheDocument();
    expect(screen.getByText("Strip Mine")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Equipment" })).toBeInTheDocument();
  });

  it("preselects and submits the existing Mine on edit", async () => {
    const updateAction = vi.fn(action);

    render(
      <EquipmentForm
        action={updateAction}
        cancelHref="/equipment"
        initialValues={{ mineId: "mine-2", displayName: "Dragline 1" }}
        mineOptions={mineOptions}
        submitLabel="Save Equipment"
      />,
    );

    expect(screen.getByLabelText("Mine")).toHaveValue("mine-2");
    expect(screen.getByText("Gillette, WY")).toBeInTheDocument();

    fireEvent.submit(screen.getByRole("button", { name: "Save Equipment" }).closest("form")!);

    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(1));
    expect(updateAction.mock.calls[0][1].get("mineId")).toBe("mine-2");
  });

  it("submits a selected canonical Mine ID without typed Mine reference fields", async () => {
    const createAction = vi.fn(action);

    render(
      <EquipmentForm
        action={createAction}
        cancelHref="/equipment"
        mineOptions={mineOptions}
        submitLabel="Create Equipment"
      />,
    );

    fireEvent.change(screen.getByLabelText("Mine"), { target: { value: "mine-1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create Equipment" }).closest("form")!);

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const submitted = createAction.mock.calls[0][1];
    expect(submitted.get("mineId")).toBe("mine-1");
    expect(submitted.get("mineName")).toBeNull();
    expect(submitted.get("cityName")).toBeNull();
    expect(submitted.get("mineType")).toBeNull();
  });

  it("retains the currently assigned inactive Mine but disables other inactive options", () => {
    const options = [
      ...mineOptions,
      {
        id: "mine-inactive",
        label: "Historic Mine (Bartow, FL)",
        cityLabel: "Bartow, FL",
        mineType: "Quarry",
        status: "INACTIVE",
      },
      {
        id: "mine-other-inactive",
        label: "Closed Mine (Lakeland, FL)",
        cityLabel: "Lakeland, FL",
        mineType: "Quarry",
        status: "INACTIVE",
      },
    ];

    render(
      <EquipmentForm
        action={action}
        cancelHref="/equipment"
        initialValues={{ mineId: "mine-inactive" }}
        mineOptions={options}
        submitLabel="Save Equipment"
      />,
    );

    expect(screen.getByLabelText("Mine")).toHaveValue("mine-inactive");
    expect(
      screen.getByRole("option", { name: "Historic Mine (Bartow, FL) (inactive)" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Closed Mine (Lakeland, FL) (inactive)" }),
    ).toBeDisabled();
  });
});
