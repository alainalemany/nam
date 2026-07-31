import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptySupplyRequestDailyLogLinkActionState } from "@/features/supply-requests/daily-log-link-action-state";
import { SupplyRequestDailyLogLinkError } from "@/features/supply-requests/daily-log-link-errors";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  remove: vi.fn(),
  updateDailyLog: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/supply-requests/daily-log-link-persistence", () => ({
  setSupplyRequestDailyLogLink: mocks.set,
  removeSupplyRequestDailyLogLink: mocks.remove,
}));
vi.mock("@/features/daily-logs/update-persistence-internal", () => ({
  LinkedDailyLogActivityEditError: class extends Error {},
  updateDailyLogWithClient: mocks.updateDailyLog,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  removeSupplyRequestDailyLogLinkAction,
  setSupplyRequestDailyLogLinkAction,
} from "@/features/supply-requests/daily-log-link-actions";
import { updateDailyLogAction } from "@/features/daily-logs/actions";

function setForm() {
  const form = new FormData();
  form.set("dailyLogActivityId", "activity-1");
  form.set("expectedDailyLogActivityId", "");
  return form;
}

describe("Supply Request Daily Log link Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.set.mockResolvedValue({ supplyRequestId: "request/1" });
    mocks.remove.mockResolvedValue({ supplyRequestId: "request/1" });
  });

  it("calls set persistence exactly once and redirects only after commit", async () => {
    await expect(
      setSupplyRequestDailyLogLinkAction(
        "request/1",
        "SUBMISSION",
        emptySupplyRequestDailyLogLinkActionState,
        setForm(),
      ),
    ).rejects.toThrow(
      "redirect:/supply-requests/request%2F1/daily-log/submission",
    );
    expect(mocks.set).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("preserves the submitted Activity and maps stale state without retry", async () => {
    mocks.set.mockRejectedValue(
      new SupplyRequestDailyLogLinkError(
        "STALE_LINK_STATE",
        "Reload before trying again.",
      ),
    );
    await expect(
      setSupplyRequestDailyLogLinkAction(
        "request-1",
        "SUBMISSION",
        emptySupplyRequestDailyLogLinkActionState,
        setForm(),
      ),
    ).resolves.toMatchObject({
      status: "error",
      message: expect.stringMatching(/reload/i),
      selectedActivityId: "activity-1",
    });
    expect(mocks.set).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects unknown, repeated, and caller-owned derived fields", async () => {
    for (const field of [
      "role",
      "title",
      "roleDate",
      "equipmentId",
      "status",
      "linkId",
      "namReference",
    ]) {
      const form = setForm();
      form.set(field, "caller");
      await expect(
        setSupplyRequestDailyLogLinkAction(
          "request-1",
          "SUBMISSION",
          emptySupplyRequestDailyLogLinkActionState,
          form,
        ),
      ).resolves.toMatchObject({ status: "error" });
    }
    const repeated = setForm();
    repeated.append("dailyLogActivityId", "activity-2");
    await expect(
      setSupplyRequestDailyLogLinkAction(
        "request-1",
        "SUBMISSION",
        emptySupplyRequestDailyLogLinkActionState,
        repeated,
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("allows only established Next action metadata", async () => {
    const form = setForm();
    form.set("$ACTION_ID_test", "metadata");
    await expect(
      setSupplyRequestDailyLogLinkAction(
        "request-1",
        "SUBMISSION",
        emptySupplyRequestDailyLogLinkActionState,
        form,
      ),
    ).rejects.toThrow("redirect:");
    expect(mocks.set).toHaveBeenCalledOnce();
  });

  it("removes exactly once and requires the expected Activity token", async () => {
    const form = new FormData();
    form.set("expectedDailyLogActivityId", "activity-1");
    await expect(
      removeSupplyRequestDailyLogLinkAction(
        "request-1",
        "FULFILLMENT",
        emptySupplyRequestDailyLogLinkActionState,
        form,
      ),
    ).rejects.toThrow("redirect:");
    expect(mocks.remove).toHaveBeenCalledOnce();

    const missing = new FormData();
    await expect(
      removeSupplyRequestDailyLogLinkAction(
        "request-1",
        "FULFILLMENT",
        emptySupplyRequestDailyLogLinkActionState,
        missing,
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("isolates raw persistence details and never retries in the action", async () => {
    mocks.set.mockRejectedValue(
      new Error("P2002 SQLSTATE 23505 password=secret"),
    );
    const result = await setSupplyRequestDailyLogLinkAction(
      "request-1",
      "SUBMISSION",
      emptySupplyRequestDailyLogLinkActionState,
      setForm(),
    );
    expect(result.message).toBe(
      "The Daily Log link could not be updated in NAM. Reload and try again.",
    );
    expect(JSON.stringify(result)).not.toMatch(/p2002|23505|password/i);
    expect(mocks.set).toHaveBeenCalledOnce();
  });

  it("rejects misaligned Daily Log Activity identity columns before persistence", async () => {
    const form = new FormData();
    form.set("logDate", "2026-07-30");
    form.set("shift", "DAY");
    form.set("summary", "Daily Log summary");
    for (const title of ["First Activity", "Second Activity"]) {
      form.append("activityType", "GENERAL_NOTE");
      form.append("activityTitle", title);
      form.append("activityStartTime", "");
      form.append("activityEndTime", "");
      form.append("activityDescription", "");
      form.append("activityEquipmentId", "");
      form.append("activityLocation", "");
      form.append("activityContractorCompany", "");
      form.append("activityPersonName", "");
      form.append("activityNotes", "");
    }
    form.append("activityId", "activity-from-first-row-only");

    await expect(
      updateDailyLogAction("daily-log-1", {} as never, form),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: {
        activities: [expect.stringMatching(/identities or fields.*incomplete/i)],
      },
    });
    expect(mocks.updateDailyLog).not.toHaveBeenCalled();
  });
});
