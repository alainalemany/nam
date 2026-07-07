import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EquipmentForm } from "@/features/equipment/EquipmentForm";
import type { EquipmentFormState } from "@/features/equipment/validation";

async function action(): Promise<EquipmentFormState> {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
  };
}

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
});
