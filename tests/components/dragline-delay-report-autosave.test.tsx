import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DraglineDelayReportAutosaveResult } from "@/features/dragline-delay-reports/actions";
import {
  DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY,
  draglineDraftRecoveryKey,
  serializeDraglineDraftRecovery,
  type DraglineDelayReportDraftSnapshot,
} from "@/features/dragline-delay-reports/draft-recovery";
import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";
import type { DraglineDelayReportFormInitialValues } from "@/features/dragline-delay-reports/types";

const equipment = [{
  id: "dragline-1",
  mineId: "mine-1",
  label: "Dragline 1 · Mine 1",
  displayName: "Dragline 1",
  equipmentNumber: "DL-1",
  status: "ACTIVE" as const,
  mineName: "Mine 1",
  cityName: "City 1",
  cityState: "FL",
}];
const employees = [{
  id: "operator-1",
  label: "Operator One",
  displayName: "Operator One",
  employeeCode: "1",
  isActive: true,
  isSupervisor: false,
}];

const initialValues: DraglineDelayReportFormInitialValues = {
  operationalWorkDate: "2026-09-25",
  shift: "DAY",
  equipmentId: "dragline-1",
  startingHourMeter: "12000",
  endingHourMeter: "",
  supervisorId: "",
  dayShiftFieldLeadId: "",
  nightShiftFieldLeadId: "",
  lakeId: "",
  normalDiggingBuckets: "",
  benchfillBuckets: "0",
  cutType: "PRODUCTION",
  cutNote: "",
  stationStart: "",
  stationEnd: "",
  depthFeet: "",
  fuelGallons: "",
  cableDragFeet: "",
  hoistFeet: "",
  comments: "Server Draft",
  safetyItemsFound: "",
  actionTaken: "",
  recordVersion: 2,
  operators: [{ clientId: "operator-row", id: "operator-db", employeeId: "operator-1" }],
  timelineEntries: [],
  downtimeBlocks: [],
  groundChecks: [],
};

function snapshot(
  overrides: Partial<DraglineDelayReportDraftSnapshot> = {},
): DraglineDelayReportDraftSnapshot {
  return { ...initialValues, timelineOrder: [], ...overrides };
}

function savedResult(recordVersion = 3): DraglineDelayReportAutosaveResult {
  return {
    status: "saved",
    reportId: "report-1",
    recordVersion,
    savedAt: "2026-09-25T16:00:00.000Z",
    identities: {
      operators: [{ id: "operator-db", sequence: 1 }],
      timelineEntries: [],
      downtimeBlocks: [],
      groundChecks: [],
    },
  };
}

function renderForm(options: {
  action?: Parameters<typeof DraglineDelayReportForm>[0]["action"];
  allowComplete?: boolean;
  autosaveAction?: Parameters<typeof DraglineDelayReportForm>[0]["autosaveAction"];
  initialValues?: DraglineDelayReportFormInitialValues;
  reportId?: string;
  strict?: boolean;
} = {}) {
  const form = (
    <DraglineDelayReportForm
      action={options.action ?? vi.fn(async () => ({ status: "idle" as const, message: "", fieldErrors: {} }))}
      allowComplete={options.allowComplete}
      autosaveAction={options.autosaveAction ?? vi.fn(async () => savedResult())}
      cancelHref="/dragline-delay-reports/report-1"
      employeeOptions={employees}
      equipmentOptions={equipment}
      initialValues={options.initialValues ?? initialValues}
      lakeOptions={[]}
      reportId={Object.hasOwn(options, "reportId") ? options.reportId : "report-1"}
      submitLabel="Save Draft"
      supervisorOptions={[]}
    />
  );
  return render(options.strict ? <StrictMode>{form}</StrictMode> : form);
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe("DDR autosave and local recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("debounces a valid server autosave and reports success", async () => {
    const autosaveAction = vi.fn(async () => savedResult());
    renderForm({ autosaveAction });

    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Changed once" },
    });
    await advance(1_999);
    expect(autosaveAction).not.toHaveBeenCalled();
    await advance(1);
    expect(autosaveAction).toHaveBeenCalledOnce();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("does not treat Strict Mode effect replay as a user edit", async () => {
    const autosaveAction = vi.fn(async () => savedResult());
    renderForm({ autosaveAction, strict: true });
    await advance(2_500);
    expect(autosaveAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("retains a local fallback after a failed autosave and retries a later edit", async () => {
    const autosaveAction = vi
      .fn()
      .mockResolvedValueOnce({
        status: "error",
        message: "Save failed",
        fieldErrors: {},
      })
      .mockResolvedValueOnce(savedResult(3));
    renderForm({ autosaveAction });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Keep this locally" },
    });
    await advance(2_000);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    const key = draglineDraftRecoveryKey({
      reportId: "report-1",
      equipmentId: "dragline-1",
      operationalWorkDate: "2026-09-25",
      shift: "DAY",
    });
    expect(window.localStorage.getItem(key)).toContain("Keep this locally");

    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Retry this version" },
    });
    await advance(2_000);
    expect(autosaveAction).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("rejects a stale autosave without replacing newer local input", async () => {
    const autosaveAction = vi.fn(async () => ({
      status: "stale" as const,
      message: "This Draft was updated elsewhere.",
      fieldErrors: { recordVersion: ["Reload first."] },
    }));
    renderForm({ autosaveAction });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Newest device text" },
    });
    await advance(2_000);
    expect(screen.getByText("This Draft was updated elsewhere.")).toBeInTheDocument();
    expect(screen.getByLabelText("Comments")).toHaveValue("Newest device text");
  });

  it("serializes overlapping edits and advances the record version", async () => {
    let resolveFirst!: (result: DraglineDelayReportAutosaveResult) => void;
    const first = new Promise<DraglineDelayReportAutosaveResult>((resolve) => {
      resolveFirst = resolve;
    });
    const autosaveAction = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(savedResult(4));
    renderForm({ autosaveAction });

    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "First edit" },
    });
    await advance(2_000);
    expect(autosaveAction).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Newer edit while saving" },
    });
    await advance(2_000);
    expect(autosaveAction).toHaveBeenCalledOnce();

    await act(async () => resolveFirst(savedResult(3)));
    await advance(250);
    expect(autosaveAction).toHaveBeenCalledTimes(2);
    expect(JSON.parse(autosaveAction.mock.calls[0][1]).recordVersion).toBe(2);
    expect(JSON.parse(autosaveAction.mock.calls[1][1]).recordVersion).toBe(3);
    expect(JSON.parse(autosaveAction.mock.calls[1][1]).comments).toBe(
      "Newer edit while saving",
    );
  });

  it("keeps editing offline and retries when connectivity returns", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const autosaveAction = vi.fn(async () => savedResult());
    renderForm({ autosaveAction });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Entered offline" },
    });
    await advance(2_000);
    expect(autosaveAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Offline — changes are stored/)).toBeInTheDocument();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
    await advance(100);
    expect(autosaveAction).toHaveBeenCalledOnce();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("offers and restores a newer local copy including concurrent timeline rows", () => {
    const recovered = snapshot({
      comments: "Recovered note",
      timelineEntries: [
        {
          clientId: "local-row-1",
          startTime: "08:00",
          dayOffset: 0,
          delayCode: "0",
          description: "Concurrent one",
          durationMinutes: "10",
          causesDowntime: false,
        },
        {
          clientId: "local-row-2",
          startTime: "08:00",
          dayOffset: 0,
          delayCode: "1",
          description: "Concurrent two",
          durationMinutes: "15",
          causesDowntime: true,
        },
      ],
      timelineOrder: [
        { kind: "entry", clientId: "local-row-1" },
        { kind: "entry", clientId: "local-row-2" },
      ],
    });
    const key = draglineDraftRecoveryKey({
      reportId: "report-1",
      equipmentId: recovered.equipmentId,
      operationalWorkDate: recovered.operationalWorkDate,
      shift: recovered.shift,
    });
    window.localStorage.setItem(
      key,
      serializeDraglineDraftRecovery({
        reportId: "report-1",
        serverRecordVersion: 2,
        snapshot: recovered,
      }),
    );

    renderForm();
    expect(screen.getByText("Recovered unsaved DDR changes from this device.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByLabelText("Comments")).toHaveValue("Recovered note");
    expect(screen.getByLabelText("Description for row 1")).toHaveValue("Concurrent one");
    expect(screen.getByLabelText("Description for row 2")).toHaveValue("Concurrent two");
    expect(screen.getByLabelText("Start time for row 1")).toHaveValue("08:00");
    expect(screen.getByLabelText("Start time for row 2")).toHaveValue("08:00");
  });

  it("prefers a newer server version and discards an older local recovery", () => {
    const server = { ...initialValues, recordVersion: 4 };
    const key = draglineDraftRecoveryKey({
      reportId: "report-1",
      equipmentId: server.equipmentId,
      operationalWorkDate: server.operationalWorkDate,
      shift: server.shift,
    });
    window.localStorage.setItem(
      key,
      serializeDraglineDraftRecovery({
        reportId: "report-1",
        serverRecordVersion: 3,
        snapshot: snapshot({ comments: "Older local copy", recordVersion: 3 }),
      }),
    );

    renderForm({ initialValues: server });
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Comments")).toHaveValue("Server Draft");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("clears local recovery when completion is submitted", async () => {
    const action = vi.fn(async () => ({ status: "idle" as const, message: "", fieldErrors: {} }));
    renderForm({ action, allowComplete: true });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Complete this" },
    });
    await advance(500);
    const key = draglineDraftRecoveryKey({
      reportId: "report-1",
      equipmentId: "dragline-1",
      operationalWorkDate: "2026-09-25",
      shift: "DAY",
    });
    expect(window.localStorage.getItem(key)).toContain("Complete this");
    fireEvent.click(screen.getByRole("button", { name: "Complete Report" }));
    await advance(0);
    expect(action).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("uses an identity pointer for a pre-server new-report recovery", async () => {
    renderForm({ reportId: undefined });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "New unsaved report" },
    });
    await advance(500);
    const pointer = window.localStorage.getItem(
      DRAGLINE_DRAFT_RECOVERY_LATEST_NEW_KEY,
    );
    expect(pointer).toContain(":new:dragline-1:2026-09-25:DAY");
    expect(window.localStorage.getItem(pointer!)).toContain("New unsaved report");
  });
});
