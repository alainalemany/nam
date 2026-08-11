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

afterEach(cleanup);

describe("EquipmentForm", () => {
  it("renders core reference-data fields and the submit action", () => {
    render(
      <EquipmentForm
        action={action}
        cancelHref="/equipment"
        submitLabel="Create Equipment"
      />,
    );

    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("Mine")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Equipment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/equipment",
    );
  });

  it("renders genuine State and Mine type create defaults and submits them without interaction", async () => {
    const createAction = vi.fn(action);

    render(
      <EquipmentForm
        action={createAction}
        cancelHref="/equipment"
        submitLabel="Create Equipment"
      />,
    );

    expect(screen.getByLabelText("State")).toHaveValue("FL");
    expect(screen.getByLabelText("Mine type")).toHaveValue("Quarry");

    fireEvent.submit(screen.getByRole("button", { name: "Create Equipment" }).closest("form")!);

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const submitted = createAction.mock.calls[0][1];
    expect(submitted.get("cityState")).toBe("FL");
    expect(submitted.get("mineType")).toBe("Quarry");
  });

  it("submits alternate controlled State and Mine type selections", async () => {
    const createAction = vi.fn(action);

    render(
      <EquipmentForm
        action={createAction}
        cancelHref="/equipment"
        submitLabel="Create Equipment"
      />,
    );

    fireEvent.change(screen.getByLabelText("State"), { target: { value: "WY" } });
    fireEvent.change(screen.getByLabelText("Mine type"), {
      target: { value: "Strip Mine" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create Equipment" }).closest("form")!);

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const submitted = createAction.mock.calls[0][1];
    expect(submitted.get("cityState")).toBe("WY");
    expect(submitted.get("mineType")).toBe("Strip Mine");
  });

  it("preserves and submits stored controlled State and Mine Type values while editing", async () => {
    const updateAction = vi.fn(action);

    render(
      <EquipmentForm
        action={updateAction}
        cancelHref="/equipment"
        initialValues={{ cityState: "PA", mineType: "Underground Mine" }}
        submitLabel="Save Equipment"
      />,
    );

    expect(screen.getByLabelText("State")).toHaveValue("PA");
    expect(screen.getByLabelText("Mine type")).toHaveValue("Underground Mine");

    fireEvent.submit(screen.getByRole("button", { name: "Save Equipment" }).closest("form")!);

    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(1));
    const submitted = updateAction.mock.calls[0][1];
    expect(submitted.get("cityState")).toBe("PA");
    expect(submitted.get("mineType")).toBe("Underground Mine");
  });

  it("preserves and submits null State and Mine Type sentinels during unrelated edits", async () => {
    const updateAction = vi.fn(action);

    render(
      <EquipmentForm
        action={updateAction}
        cancelHref="/equipment"
        initialValues={{ cityState: "", mineType: "" }}
        submitLabel="Save Equipment"
      />,
    );

    expect(screen.getByLabelText("State")).toHaveValue("");
    expect(screen.getByLabelText("Mine type")).toHaveValue("");
    expect(screen.getAllByText(/preserved for unrelated Equipment changes/i)).toHaveLength(2);
    expect(screen.getAllByText(/controlled reference-data process/i)).toHaveLength(2);

    fireEvent.submit(screen.getByRole("button", { name: "Save Equipment" }).closest("form")!);

    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(1));
    const submitted = updateAction.mock.calls[0][1];
    expect(submitted.get("cityState")).toBe("");
    expect(submitted.get("mineType")).toBe("");
  });

  it("preserves and submits exact out-of-catalog State and Mine Type values while editing", async () => {
    const updateAction = vi.fn(action);

    render(
      <EquipmentForm
        action={updateAction}
        cancelHref="/equipment"
        initialValues={{ cityState: "Legacy State", mineType: "Legacy Mine Type" }}
        submitLabel="Save Equipment"
      />,
    );

    expect(screen.getByLabelText("State")).toHaveValue("Legacy State");
    expect(screen.getByLabelText("Mine type")).toHaveValue("Legacy Mine Type");
    expect(screen.getByRole("option", { name: "Legacy State (stored shared value)" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Legacy Mine Type (stored shared value)" }))
      .toBeInTheDocument();

    fireEvent.submit(screen.getByRole("button", { name: "Save Equipment" }).closest("form")!);

    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(1));
    const submitted = updateAction.mock.calls[0][1];
    expect(submitted.get("cityState")).toBe("Legacy State");
    expect(submitted.get("mineType")).toBe("Legacy Mine Type");
  });

  it("renders exactly the controlled create options with no placeholder defaults", () => {
    render(
      <EquipmentForm
        action={action}
        cancelHref="/equipment"
        submitLabel="Create Equipment"
      />,
    );

    const stateOptions = within(screen.getByLabelText("State")).getAllByRole("option");
    const mineTypeOptions = within(screen.getByLabelText("Mine type")).getAllByRole("option");

    expect(stateOptions).toHaveLength(51);
    expect(new Set(stateOptions.map((option) => (option as HTMLOptionElement).value)).size).toBe(51);
    expect(mineTypeOptions).toHaveLength(8);
    expect(stateOptions[0]).not.toHaveTextContent(/select|choose/i);
    expect(mineTypeOptions[0]).not.toHaveTextContent(/select|choose/i);
  });
});
