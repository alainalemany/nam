"use client";

import {
  memo,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DRAGLINE_SHIFT_CHANGE_DELAY_CODE,
  getDraglineDelayCode,
  groupDraglineDelayCodes,
  searchDraglineDelayCodes,
} from "./catalog";
import { calculateDraglineShiftTotals } from "./calculations";
import { DRAGLINE_DELAY_REPORT_CUT_TYPES } from "./cut-types";
import { recordDraglineDelayReportDiagnostic } from "./diagnostics";
import {
  draglineDraftSubmission,
  draglineDraftSubmittedClientIds,
  type DraglineDelayReportDraftSnapshot,
  type DraglineTimelineOrderItem,
} from "./draft-recovery";
import { formatDraglineDurationMinutes } from "./duration";
import {
  getDefaultGroundChecksForShift,
  isDefaultGroundCheckSetForShift,
} from "./ground-check-defaults";
import { filterDraglineLakesForMine } from "./lakes";
import { calculateStationAdvance, parseStationNotation } from "./station";
import { orderDraglineDelayReportTimelineItems } from "./timeline-order";
import { normalizeEventStartTime } from "./time";
import type {
  DraglineDelayReportFormInitialValues,
  DraglineDelayReportDowntimeBlockActivityFormRow,
  DraglineDelayReportDowntimeBlockFormRow,
  DraglineDelayReportGroundCheckFormRow,
  DraglineDelayReportOperatorFormRow,
  DraglineDelayReportTimelineFormRow,
  DraglineEmployeeOption,
  DraglineEquipmentOption,
  DraglineLakeOption,
} from "./types";
import {
  useDraglineDelayDraftPersistence,
} from "./useDraglineDelayDraftPersistence";
import {
  emptyDraglineDelayReportActionState,
  type DraglineDelayReportActionState,
} from "./validation";
import {
  draglineDelayReportErrorSummary,
  draglineDelayReportErrorTargetPaths,
} from "./validation-feedback";
import type { DraglineDelayReportAutosaveResult } from "./actions";

type Props = {
  action: (
    previousState: DraglineDelayReportActionState,
    formData: FormData,
  ) => Promise<DraglineDelayReportActionState>;
  autosaveAction?: (
    reportId: string | undefined,
    payload: string,
  ) => Promise<DraglineDelayReportAutosaveResult>;
  cancelHref: string;
  equipmentOptions: DraglineEquipmentOption[];
  employeeOptions: DraglineEmployeeOption[];
  lakeOptions: DraglineLakeOption[];
  supervisorOptions: DraglineEmployeeOption[];
  initialValues: DraglineDelayReportFormInitialValues;
  enableNewReportGroundCheckDefaults?: boolean;
  mode?: "draft" | "correction";
  reportId?: string;
  allowComplete?: boolean;
  submitLabel: string;
};

let clientRowSequence = 0;

function clientRowId(prefix: string) {
  clientRowSequence += 1;
  return `${prefix}-${clientRowSequence}`;
}

function emptyOperator(): DraglineDelayReportOperatorFormRow {
  return { clientId: clientRowId("operator"), employeeId: "" };
}

function emptyTimelineEntry(): DraglineDelayReportTimelineFormRow {
  return {
    clientId: clientRowId("timeline"),
    startTime: "",
    dayOffset: 0,
    delayCode: "",
    description: "",
    durationMinutes: "",
    causesDowntime: false,
  };
}

function emptyGroundCheck(): DraglineDelayReportGroundCheckFormRow {
  return {
    clientId: clientRowId("ground-check"),
    startTime: "",
    dayOffset: 0,
  };
}

function defaultGroundChecksForShift(
  shift: "DAY" | "NIGHT",
): DraglineDelayReportGroundCheckFormRow[] {
  return getDefaultGroundChecksForShift(shift).map((groundCheck) => ({
    ...groundCheck,
    clientId: clientRowId("ground-check"),
  }));
}

function emptyDowntimeBlockActivity(): DraglineDelayReportDowntimeBlockActivityFormRow {
  return {
    clientId: clientRowId("downtime-block-activity"),
    delayCode: "",
    description: "",
  };
}

function emptyDowntimeBlock(): DraglineDelayReportDowntimeBlockFormRow {
  return {
    clientId: clientRowId("downtime-block"),
    startTime: "",
    dayOffset: 0,
    durationMinutes: "",
    description: "",
    activities: [emptyDowntimeBlockActivity()],
  };
}

function firstError(state: DraglineDelayReportActionState, path: string) {
  const message = state.fieldErrors[path]?.[0];
  return message ? (
    <p className="field-error" id={errorId(path)}>
      {message}
    </p>
  ) : null;
}

function errorId(path: string) {
  return `ddr-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}-error`;
}

function errorAttributes(state: DraglineDelayReportActionState, path: string) {
  return state.fieldErrors[path]?.length
    ? {
        "aria-describedby": errorId(path),
        "aria-invalid": true as const,
        "data-ddr-error-path": path,
      }
    : { "data-ddr-error-path": path };
}

function hasError(state: DraglineDelayReportActionState, path: string) {
  return Boolean(state.fieldErrors[path]?.length);
}

function hasNestedError(state: DraglineDelayReportActionState, path: string) {
  return Object.keys(state.fieldErrors).some(
    (errorPath) => errorPath === path || errorPath.startsWith(`${path}.`),
  );
}

function moveItem<T>(items: T[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function initialTimelineOrder(
  timelineEntries: DraglineDelayReportTimelineFormRow[],
  downtimeBlocks: DraglineDelayReportDowntimeBlockFormRow[],
): DraglineTimelineOrderItem[] {
  const ordered = orderDraglineDelayReportTimelineItems(
    timelineEntries.map((entry, index) => ({
      id: entry.clientId,
      sequence: entry.sequence ?? index + 1,
      startMinuteOffset: (() => {
        try {
          return normalizeEventStartTime(entry.startTime, entry.dayOffset);
        } catch {
          return Number.MAX_SAFE_INTEGER;
        }
      })(),
    })),
    downtimeBlocks.map((block, index) => ({
      id: block.clientId,
      sequence: block.sequence ?? timelineEntries.length + index + 1,
      startMinuteOffset: (() => {
        try {
          return normalizeEventStartTime(block.startTime, block.dayOffset);
        } catch {
          return Number.MAX_SAFE_INTEGER;
        }
      })(),
    })),
  );

  return ordered.map((item) => ({
    kind: item.kind,
    clientId: item.value.id,
  }));
}

function DelayCodeField({
  entry,
  index,
  state,
  onChange,
}: {
  entry: DraglineDelayReportTimelineFormRow;
  index: number;
  state: DraglineDelayReportActionState;
  onChange: (values: Partial<DraglineDelayReportTimelineFormRow>) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = searchDraglineDelayCodes(query);
  const selected = getDraglineDelayCode(entry.delayCode);
  const grouped = groupDraglineDelayCodes(
    selected && !visible.some((candidate) => candidate.code === selected.code)
      ? [selected, ...visible]
      : visible,
  );

  return (
    <div className="ddr-code-field">
      <label>
        <span>Find Delay Code</span>
        <input
          aria-label={`Find Delay Code for row ${index + 1}`}
          autoComplete="off"
          placeholder="Code or description"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label>
        <span>Delay Code</span>
        <select
          {...errorAttributes(state, `timelineEntries.${index}.delayCode`)}
          aria-label={`Delay Code for row ${index + 1}`}
          value={entry.delayCode}
          onChange={(event) => {
            const next = getDraglineDelayCode(event.target.value);
            onChange({
              delayCode: event.target.value,
              category: next?.category,
            });
          }}
        >
          <option value="">Select official code</option>
          {grouped.map((group) =>
            group.entries.length ? (
              <optgroup key={group.category} label={group.category}>
                {group.entries.map((code) => (
                  <option key={code.code} value={code.code}>
                    {code.code} — {code.description}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
        {firstError(state, `timelineEntries.${index}.delayCode`)}
      </label>
      <p className="subtle">
        Category: {selected?.category ?? "Derived from selected code"}
      </p>
    </div>
  );
}

const TimelineEntryRow = memo(function TimelineEntryRow({
  entry,
  index,
  orderIndex,
  orderLength,
  shift,
  state,
  onChange,
  onMove,
  onRemove,
}: {
  entry: DraglineDelayReportTimelineFormRow;
  index: number;
  orderIndex: number;
  orderLength: number;
  shift: "DAY" | "NIGHT";
  state: DraglineDelayReportActionState;
  onChange: (
    clientId: string,
    values: Partial<DraglineDelayReportTimelineFormRow>,
  ) => void;
  onMove: (index: number, offset: -1 | 1) => void;
  onRemove: (clientId: string) => void;
}) {
  recordDraglineDelayReportDiagnostic("timelineRowRenders");
  return (
    <fieldset
      className={`ddr-timeline-row${hasNestedError(state, `timelineEntries.${index}`) ? " ddr-invalid-row" : ""}`}
      data-ddr-error-path={`timelineEntries.${index}`}
      data-ddr-timeline-client-id={entry.clientId}
      tabIndex={-1}
    >
      <legend>Timeline row {index + 1}</legend>
      {firstError(state, `timelineEntries.${index}.sequence`)}
      {firstError(state, `timelineEntries.${index}.id`)}
      {firstError(state, `timelineEntries.${index}.catalogVersion`)}
      <div className="ddr-timeline-fields">
        <label>
          <span>Start time</span>
          <input
            {...errorAttributes(state, `timelineEntries.${index}.startTime`)}
            aria-label={`Start time for row ${index + 1}`}
            data-ddr-timeline-start="true"
            type="time"
            value={entry.startTime}
            onChange={(event) =>
              onChange(entry.clientId, { startTime: event.target.value })
            }
          />
          {firstError(state, `timelineEntries.${index}.startTime`)}
        </label>
        {shift === "NIGHT" ? (
          <label>
            <span>Calendar day</span>
            <select
              {...errorAttributes(state, `timelineEntries.${index}.dayOffset`)}
              aria-label={`Calendar day for row ${index + 1}`}
              value={entry.dayOffset}
              onChange={(event) =>
                onChange(entry.clientId, {
                  dayOffset: Number(event.target.value) as 0 | 1,
                })
              }
            >
              <option value={0}>Operational date</option>
              <option value={1}>Next day</option>
            </select>
            {firstError(state, `timelineEntries.${index}.dayOffset`)}
          </label>
        ) : null}
        <DelayCodeField
          entry={entry}
          index={index}
          onChange={(values) => onChange(entry.clientId, values)}
          state={state}
        />
        <label>
          <span>Duration (minutes, optional)</span>
          <input
            {...errorAttributes(state, `timelineEntries.${index}.durationMinutes`)}
            aria-label={`Duration for row ${index + 1}`}
            inputMode="numeric"
            min="1"
            step="1"
            type="number"
            value={entry.durationMinutes}
            onChange={(event) =>
              onChange(entry.clientId, {
                durationMinutes: event.target.value,
              })
            }
          />
          {firstError(state, `timelineEntries.${index}.durationMinutes`)}
        </label>
        <label className="checkbox-label ddr-downtime-control">
          <input
            {...errorAttributes(state, `timelineEntries.${index}.causesDowntime`)}
            aria-label={`Causes machine downtime for row ${index + 1}`}
            checked={entry.causesDowntime}
            type="checkbox"
            onChange={(event) =>
              onChange(entry.clientId, {
                causesDowntime: event.target.checked,
              })
            }
          />
          <span>Causes machine downtime</span>
        </label>
        {firstError(state, `timelineEntries.${index}.causesDowntime`)}
        <label className="ddr-description-field">
          <span>Description / context (optional)</span>
          <input
            {...errorAttributes(state, `timelineEntries.${index}.description`)}
            aria-label={`Description for row ${index + 1}`}
            maxLength={1000}
            value={entry.description}
            onChange={(event) =>
              onChange(entry.clientId, { description: event.target.value })
            }
          />
          {firstError(state, `timelineEntries.${index}.description`)}
        </label>
      </div>
      <div className="inline-actions ddr-row-actions">
        <button
          className="button secondary"
          disabled={orderIndex === 0}
          type="button"
          onClick={() => onMove(orderIndex, -1)}
        >
          Move up
        </button>
        <button
          className="button secondary"
          disabled={orderIndex === orderLength - 1}
          type="button"
          onClick={() => onMove(orderIndex, 1)}
        >
          Move down
        </button>
        <button
          className="button danger"
          type="button"
          onClick={() => onRemove(entry.clientId)}
        >
          Remove
        </button>
      </div>
    </fieldset>
  );
});

function DowntimeBlockActivityCodeField({
  activity,
  blockIndex,
  activityIndex,
  state,
  onChange,
}: {
  activity: DraglineDelayReportDowntimeBlockActivityFormRow;
  blockIndex: number;
  activityIndex: number;
  state: DraglineDelayReportActionState;
  onChange: (
    values: Partial<DraglineDelayReportDowntimeBlockActivityFormRow>,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = searchDraglineDelayCodes(query).filter(
    (code) => code.code !== DRAGLINE_SHIFT_CHANGE_DELAY_CODE,
  );
  const selected = getDraglineDelayCode(activity.delayCode);
  const grouped = groupDraglineDelayCodes(
    selected &&
      selected.code !== DRAGLINE_SHIFT_CHANGE_DELAY_CODE &&
      !visible.some((candidate) => candidate.code === selected.code)
      ? [selected, ...visible]
      : visible,
  );
  const path = `downtimeBlocks.${blockIndex}.activities.${activityIndex}.delayCode`;

  return (
    <div className="ddr-code-field">
      <label>
        <span>Find Delay Code</span>
        <input
          aria-label={`Find Delay Code for Shared Downtime Block ${blockIndex + 1} Activity ${activityIndex + 1}`}
          autoComplete="off"
          placeholder="Code or description"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label>
        <span>Delay Code</span>
        <select
          {...errorAttributes(state, path)}
          aria-label={`Delay Code for Shared Downtime Block ${blockIndex + 1} Activity ${activityIndex + 1}`}
          value={activity.delayCode}
          onChange={(event) => {
            const next = getDraglineDelayCode(event.target.value);
            onChange({
              delayCode: event.target.value,
              category: next?.category,
            });
          }}
        >
          <option value="">Select official code</option>
          {grouped.map((group) =>
            group.entries.length ? (
              <optgroup key={group.category} label={group.category}>
                {group.entries.map((code) => (
                  <option key={code.code} value={code.code}>
                    {code.code} — {code.description}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
        {firstError(state, path)}
      </label>
      <p className="subtle">
        Category: {selected?.category ?? "Derived from selected code"}
      </p>
    </div>
  );
}

function EmployeeField({
  label,
  rowNumber,
  value,
  options,
  state,
  errorPath,
  optional = false,
  onChange,
}: {
  label: string;
  rowNumber?: number;
  value: string;
  options: DraglineEmployeeOption[];
  state: DraglineDelayReportActionState;
  errorPath: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = options.filter(
    (option) =>
      option.id === value || option.label.toLowerCase().includes(normalized),
  );
  const suffix = rowNumber ? ` ${rowNumber}` : "";

  return (
    <div className="ddr-employee-field">
      <label>
        <span>Find {label}</span>
        <input
          aria-label={`Find ${label}${suffix}`}
          autoComplete="off"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <label>
        <span>{label}</span>
        <select
          {...errorAttributes(state, errorPath)}
          aria-label={`${label}${suffix}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{optional ? "Not recorded" : `Select ${label}`}</option>
          {visible.map((option) => (
            <option
              disabled={!option.isActive && option.id !== value}
              key={option.id}
              value={option.id}
            >
              {option.label}
            </option>
          ))}
        </select>
        {firstError(state, errorPath)}
      </label>
    </div>
  );
}

export function DraglineDelayReportForm({
  action,
  autosaveAction,
  cancelHref,
  equipmentOptions,
  employeeOptions,
  lakeOptions,
  supervisorOptions,
  initialValues,
  enableNewReportGroundCheckDefaults = false,
  mode = "draft",
  reportId,
  allowComplete = false,
  submitLabel,
}: Props) {
  recordDraglineDelayReportDiagnostic("formRenders");
  const [state, formAction, pending] = useActionState(
    action,
    emptyDraglineDelayReportActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummary = useMemo(
    () => draglineDelayReportErrorSummary(state.fieldErrors),
    [state.fieldErrors],
  );
  const [operationalWorkDate, setOperationalWorkDate] = useState(
    initialValues.operationalWorkDate,
  );
  const [shift, setShift] = useState(initialValues.shift);
  const [equipmentId, setEquipmentId] = useState(initialValues.equipmentId);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [startingHourMeter, setStartingHourMeter] = useState(
    initialValues.startingHourMeter,
  );
  const [endingHourMeter, setEndingHourMeter] = useState(
    initialValues.endingHourMeter,
  );
  const [supervisorId, setSupervisorId] = useState(initialValues.supervisorId);
  const [dayShiftFieldLeadId, setDayShiftFieldLeadId] = useState(
    initialValues.dayShiftFieldLeadId,
  );
  const [nightShiftFieldLeadId, setNightShiftFieldLeadId] = useState(
    initialValues.nightShiftFieldLeadId,
  );
  const [lakeId, setLakeId] = useState(initialValues.lakeId);
  const [normalDiggingBuckets, setNormalDiggingBuckets] = useState(
    initialValues.normalDiggingBuckets,
  );
  const [benchfillBuckets, setBenchfillBuckets] = useState(
    initialValues.benchfillBuckets,
  );
  const [cutType, setCutType] = useState(initialValues.cutType);
  const [cutNote, setCutNote] = useState(initialValues.cutNote);
  const [stationStart, setStationStart] = useState(initialValues.stationStart);
  const [stationEnd, setStationEnd] = useState(initialValues.stationEnd);
  const [depthFeet, setDepthFeet] = useState(initialValues.depthFeet);
  const [fuelGallons, setFuelGallons] = useState(initialValues.fuelGallons);
  const [cableDragFeet, setCableDragFeet] = useState(initialValues.cableDragFeet);
  const [hoistFeet, setHoistFeet] = useState(initialValues.hoistFeet);
  const [comments, setComments] = useState(initialValues.comments);
  const [safetyItemsFound, setSafetyItemsFound] = useState(
    initialValues.safetyItemsFound,
  );
  const [actionTaken, setActionTaken] = useState(initialValues.actionTaken);
  const [correctionReason, setCorrectionReason] = useState("");
  const [pendingIntent, setPendingIntent] = useState<
    "draft" | "complete" | "correct"
  >(mode === "correction" ? "correct" : "draft");
  const [operators, setOperators] = useState(
    initialValues.operators.length ? initialValues.operators : [emptyOperator()],
  );
  const [initialTimelineState] = useState(() => {
    const timelineEntries = initialValues.timelineEntries.length
      ? initialValues.timelineEntries
      : [emptyTimelineEntry()];
    const downtimeBlocks = initialValues.downtimeBlocks ?? [];
    return {
      timelineEntries,
      downtimeBlocks,
      order: initialTimelineOrder(timelineEntries, downtimeBlocks),
    };
  });
  const [timelineEntries, setTimelineEntries] = useState(
    initialTimelineState.timelineEntries,
  );
  const pendingTimelineFocusClientId = useRef<string | null>(null);
  const [downtimeBlocks, setDowntimeBlocks] = useState(
    initialTimelineState.downtimeBlocks,
  );
  const [timelineOrder, setTimelineOrder] = useState(initialTimelineState.order);
  const timelineEntriesRef = useRef(timelineEntries);
  const timelineOrderRef = useRef(timelineOrder);
  timelineEntriesRef.current = timelineEntries;
  timelineOrderRef.current = timelineOrder;
  const pendingDowntimeBlockFocusClientId = useRef<string | null>(null);
  const pendingDowntimeBlockActivityFocusClientId = useRef<string | null>(null);
  const [groundChecks, setGroundChecks] = useState(initialValues.groundChecks);
  const groundCheckDefaultsUntouched = useRef(
    enableNewReportGroundCheckDefaults &&
      isDefaultGroundCheckSetForShift(initialValues.groundChecks, initialValues.shift),
  );

  function updateGroundChecks(
    update: (
      current: DraglineDelayReportGroundCheckFormRow[],
    ) => DraglineDelayReportGroundCheckFormRow[],
  ) {
    groundCheckDefaultsUntouched.current = false;
    setGroundChecks(update);
  }

  function addTimelineEntry() {
    if (timelineEntries.length >= 200) return;
    const entry = emptyTimelineEntry();
    pendingTimelineFocusClientId.current = entry.clientId;
    setTimelineEntries((current) => [...current, entry]);
    setTimelineOrder((current) => [
      ...current,
      { kind: "entry", clientId: entry.clientId },
    ]);
  }

  function addDowntimeBlock() {
    if (downtimeBlocks.length >= 100) return;
    const block = emptyDowntimeBlock();
    pendingDowntimeBlockFocusClientId.current = block.clientId;
    setDowntimeBlocks((current) => [...current, block]);
    setTimelineOrder((current) => [
      ...current,
      { kind: "block", clientId: block.clientId },
    ]);
  }

  function addDowntimeBlockActivity(blockIndex: number) {
    if (downtimeBlocks[blockIndex].activities.length >= 100) return;
    const activity = emptyDowntimeBlockActivity();
    pendingDowntimeBlockActivityFocusClientId.current = activity.clientId;
    updateDowntimeBlock(blockIndex, {
      activities: [...downtimeBlocks[blockIndex].activities, activity],
    });
  }

  const moveTimelineItem = useCallback((index: number, offset: -1 | 1) => {
    const currentOrder = timelineOrderRef.current;
    const nextOrder = moveItem(currentOrder, index, offset);
    if (nextOrder === currentOrder) return;
    const position = new Map(
      nextOrder.map((item, itemIndex) => [item.clientId, itemIndex]),
    );
    timelineOrderRef.current = nextOrder;
    setTimelineOrder(nextOrder);
    setTimelineEntries((current) =>
      [...current].sort(
        (left, right) =>
          position.get(left.clientId)! - position.get(right.clientId)!,
      ),
    );
    setDowntimeBlocks((current) =>
      [...current].sort(
        (left, right) =>
          position.get(left.clientId)! - position.get(right.clientId)!,
      ),
    );
  }, []);

  const removeTimelineEntry = useCallback((clientId: string) => {
    const currentOrder = timelineOrderRef.current;
    const currentEntries = timelineEntriesRef.current;
    const removedPosition = currentOrder.findIndex(
      (item) => item.kind === "entry" && item.clientId === clientId,
    );
    const remainingEntries = currentEntries.filter(
      (entry) => entry.clientId !== clientId,
    );
    const remainingOrder = currentOrder.filter(
      (item) => !(item.kind === "entry" && item.clientId === clientId),
    );
    if (remainingEntries.length) {
      timelineEntriesRef.current = remainingEntries;
      timelineOrderRef.current = remainingOrder;
      setTimelineEntries(remainingEntries);
      setTimelineOrder(remainingOrder);
      return;
    }

    const replacement = emptyTimelineEntry();
    const insertionIndex = Math.min(
      Math.max(removedPosition, 0),
      remainingOrder.length,
    );
    const nextOrder = [...remainingOrder];
    nextOrder.splice(insertionIndex, 0, {
      kind: "entry",
      clientId: replacement.clientId,
    });
    timelineEntriesRef.current = [replacement];
    timelineOrderRef.current = nextOrder;
    setTimelineEntries([replacement]);
    setTimelineOrder(nextOrder);
  }, []);

  function removeDowntimeBlock(clientId: string) {
    setDowntimeBlocks((current) =>
      current.filter((block) => block.clientId !== clientId),
    );
    setTimelineOrder((current) =>
      current.filter(
        (item) => !(item.kind === "block" && item.clientId === clientId),
      ),
    );
  }

  function focusErrorPath(path: string) {
    const form = formRef.current;
    if (!form) return;

    const target = draglineDelayReportErrorTargetPaths(path)
      .map((candidate) =>
        form.querySelector<HTMLElement>(`[data-ddr-error-path="${candidate}"]`),
      )
      .find((candidate): candidate is HTMLElement => Boolean(candidate));
    if (!target) return;

    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (state.status !== "error") return;
    focusErrorPath(errorSummary[0]?.path ?? "form");
  }, [errorSummary, state.status]);

  useEffect(() => {
    const clientId = pendingTimelineFocusClientId.current;
    if (!clientId) return;

    const row = formRef.current?.querySelector<HTMLElement>(
      `[data-ddr-timeline-client-id="${clientId}"]`,
    );
    const startTime = row?.querySelector<HTMLInputElement>(
      'input[data-ddr-timeline-start="true"]',
    );
    if (!row || !startTime) return;

    pendingTimelineFocusClientId.current = null;
    row.scrollIntoView?.({ behavior: "smooth", block: "center" });
    startTime.focus({ preventScroll: true });
  }, [timelineEntries]);

  useEffect(() => {
    const clientId = pendingDowntimeBlockFocusClientId.current;
    if (!clientId) return;

    const block = formRef.current?.querySelector<HTMLElement>(
      `[data-ddr-downtime-block-client-id="${clientId}"]`,
    );
    const startTime = block?.querySelector<HTMLInputElement>(
      'input[data-ddr-downtime-block-start="true"]',
    );
    if (!block || !startTime) return;

    pendingDowntimeBlockFocusClientId.current = null;
    block.scrollIntoView?.({ behavior: "smooth", block: "center" });
    startTime.focus({ preventScroll: true });
  }, [downtimeBlocks]);

  useEffect(() => {
    const clientId = pendingDowntimeBlockActivityFocusClientId.current;
    if (!clientId) return;

    const activity = formRef.current?.querySelector<HTMLElement>(
      `[data-ddr-downtime-block-activity-client-id="${clientId}"]`,
    );
    const delayCode = activity?.querySelector<HTMLSelectElement>(
      "select[aria-label^='Delay Code for Shared Downtime Block']",
    );
    if (!activity || !delayCode) return;

    pendingDowntimeBlockActivityFocusClientId.current = null;
    activity.scrollIntoView?.({ behavior: "smooth", block: "center" });
    delayCode.focus({ preventScroll: true });
  }, [downtimeBlocks]);

  const selectedEquipment = equipmentOptions.find(
    (option) => option.id === equipmentId,
  );
  const visibleEquipment = equipmentOptions.filter(
    (option) =>
      option.id === equipmentId ||
      option.label.toLowerCase().includes(equipmentQuery.trim().toLowerCase()),
  );
  const visibleLakes = filterDraglineLakesForMine(
    lakeOptions,
    selectedEquipment?.mineId,
    lakeId,
  );
  const timelineIndexByClientId = useMemo(
    () => new Map(timelineEntries.map((entry, index) => [entry.clientId, index])),
    [timelineEntries],
  );
  const downtimeBlockIndexByClientId = useMemo(
    () => new Map(downtimeBlocks.map((block, index) => [block.clientId, index])),
    [downtimeBlocks],
  );
  const submittedTimeline = useMemo(
    () =>
      timelineEntries.filter((entry) =>
        Boolean(
          entry.id ||
            entry.startTime ||
            entry.delayCode ||
            entry.description.trim() ||
            entry.durationMinutes ||
            entry.causesDowntime,
        ),
      ),
    [timelineEntries],
  );
  const totals = useMemo(() => {
    try {
      recordDraglineDelayReportDiagnostic("timelineCalculationCalls");
      return calculateDraglineShiftTotals(
        shift,
        submittedTimeline.map((entry) => ({
          startMinuteOffset: normalizeEventStartTime(entry.startTime, entry.dayOffset),
          durationMinutes: entry.durationMinutes
            ? Number(entry.durationMinutes)
            : undefined,
          causesDowntime: entry.causesDowntime,
          delayCode: entry.delayCode,
        })),
        groundChecks.map((groundCheck) => ({
          startMinuteOffset: normalizeEventStartTime(
            groundCheck.startTime,
            groundCheck.dayOffset,
          ),
        })),
        downtimeBlocks.map((block) => ({
          startMinuteOffset: normalizeEventStartTime(
            block.startTime,
            block.dayOffset,
          ),
          durationMinutes: Number(block.durationMinutes),
        })),
      );
    } catch {
      return null;
    }
  }, [downtimeBlocks, groundChecks, shift, submittedTimeline]);
  const advanceFeet = useMemo(() => {
    if (!stationStart.trim() || !stationEnd.trim()) return null;
    try {
      return calculateStationAdvance(
        parseStationNotation(stationStart).absoluteFeet,
        parseStationNotation(stationEnd).absoluteFeet,
      );
    } catch {
      return null;
    }
  }, [stationEnd, stationStart]);

  const draftSnapshot = useMemo<DraglineDelayReportDraftSnapshot>(() => ({
    operationalWorkDate,
    shift,
    equipmentId,
    startingHourMeter,
    endingHourMeter,
    supervisorId,
    dayShiftFieldLeadId,
    nightShiftFieldLeadId,
    lakeId,
    normalDiggingBuckets,
    benchfillBuckets,
    cutType,
    cutNote,
    stationStart,
    stationEnd,
    depthFeet,
    fuelGallons,
    cableDragFeet,
    hoistFeet,
    comments,
    safetyItemsFound,
    actionTaken,
    recordVersion: initialValues.recordVersion,
    operators,
    timelineEntries,
    downtimeBlocks,
    groundChecks,
    timelineOrder,
  }), [
    actionTaken,
    benchfillBuckets,
    cableDragFeet,
    comments,
    cutNote,
    cutType,
    dayShiftFieldLeadId,
    depthFeet,
    downtimeBlocks,
    endingHourMeter,
    equipmentId,
    fuelGallons,
    groundChecks,
    hoistFeet,
    initialValues.recordVersion,
    lakeId,
    nightShiftFieldLeadId,
    normalDiggingBuckets,
    operationalWorkDate,
    operators,
    safetyItemsFound,
    shift,
    startingHourMeter,
    stationEnd,
    stationStart,
    supervisorId,
    timelineEntries,
    timelineOrder,
  ]);

  function updateOperator(
    index: number,
    values: Partial<DraglineDelayReportOperatorFormRow>,
  ) {
    setOperators((current) =>
      current.map((operator, operatorIndex) =>
        operatorIndex === index ? { ...operator, ...values } : operator,
      ),
    );
  }

  const updateTimelineEntry = useCallback((
    clientId: string,
    values: Partial<DraglineDelayReportTimelineFormRow>,
  ) => {
    setTimelineEntries((current) =>
      current.map((entry) =>
        entry.clientId === clientId ? { ...entry, ...values } : entry,
      ),
    );
  }, []);

  function updateDowntimeBlock(
    index: number,
    values: Partial<DraglineDelayReportDowntimeBlockFormRow>,
  ) {
    setDowntimeBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...values } : block,
      ),
    );
  }

  function updateDowntimeBlockActivity(
    blockIndex: number,
    activityIndex: number,
    values: Partial<DraglineDelayReportDowntimeBlockActivityFormRow>,
  ) {
    setDowntimeBlocks((current) =>
      current.map((block, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...block,
              activities: block.activities.map((activity, currentActivityIndex) =>
                currentActivityIndex === activityIndex
                  ? { ...activity, ...values }
                  : activity,
              ),
            }
          : block,
      ),
    );
  }

  const applyRecoveredSnapshot = useCallback(
    (recovered: DraglineDelayReportDraftSnapshot) => {
      setOperationalWorkDate(recovered.operationalWorkDate);
      setShift(recovered.shift);
      setEquipmentId(recovered.equipmentId);
      setStartingHourMeter(recovered.startingHourMeter);
      setEndingHourMeter(recovered.endingHourMeter);
      setSupervisorId(recovered.supervisorId);
      setDayShiftFieldLeadId(recovered.dayShiftFieldLeadId);
      setNightShiftFieldLeadId(recovered.nightShiftFieldLeadId);
      setLakeId(recovered.lakeId);
      setNormalDiggingBuckets(recovered.normalDiggingBuckets);
      setBenchfillBuckets(recovered.benchfillBuckets);
      setCutType(recovered.cutType);
      setCutNote(recovered.cutNote);
      setStationStart(recovered.stationStart);
      setStationEnd(recovered.stationEnd);
      setDepthFeet(recovered.depthFeet);
      setFuelGallons(recovered.fuelGallons);
      setCableDragFeet(recovered.cableDragFeet);
      setHoistFeet(recovered.hoistFeet);
      setComments(recovered.comments);
      setSafetyItemsFound(recovered.safetyItemsFound);
      setActionTaken(recovered.actionTaken);
      setOperators(recovered.operators);
      setTimelineEntries(recovered.timelineEntries);
      setDowntimeBlocks(recovered.downtimeBlocks);
      setGroundChecks(recovered.groundChecks);
      setTimelineOrder(recovered.timelineOrder);
      groundCheckDefaultsUntouched.current = false;
    },
    [],
  );

  const hydratePersistedIdentities = useCallback(
    (
      identities: Extract<
        DraglineDelayReportAutosaveResult,
        { status: "saved" }
      >["identities"],
      submittedSnapshot: DraglineDelayReportDraftSnapshot,
    ) => {
      const submitted = draglineDraftSubmittedClientIds(submittedSnapshot);
      const operatorIdByClientId = new Map(
        submitted.operators.flatMap((row) => {
          const persisted = identities.operators.find(
            (candidate) => candidate.sequence === row.sequence,
          );
          return persisted ? [[row.clientId, persisted.id] as const] : [];
        }),
      );
      const timelineIdByClientId = new Map(
        submitted.timelineEntries.flatMap((row) => {
          const persisted = identities.timelineEntries.find(
            (candidate) => candidate.sequence === row.sequence,
          );
          return persisted ? [[row.clientId, persisted.id] as const] : [];
        }),
      );
      const groundCheckIdByClientId = new Map(
        submitted.groundChecks.flatMap((row) => {
          const persisted = identities.groundChecks.find(
            (candidate) => candidate.sequence === row.sequence,
          );
          return persisted ? [[row.clientId, persisted.id] as const] : [];
        }),
      );
      const blockIdByClientId = new Map<string, string>();
      const activityIdByClientId = new Map<string, string>();
      for (const row of submitted.downtimeBlocks) {
        const persisted = identities.downtimeBlocks.find(
          (candidate) => candidate.sequence === row.sequence,
        );
        if (!persisted) continue;
        blockIdByClientId.set(row.clientId, persisted.id);
        for (const activity of row.activities) {
          const persistedActivity = persisted.activities.find(
            (candidate) => candidate.sequence === activity.sequence,
          );
          if (persistedActivity) {
            activityIdByClientId.set(activity.clientId, persistedActivity.id);
          }
        }
      }

      setOperators((current) => {
        let changed = false;
        const next = current.map((row) => {
          const persistedId = operatorIdByClientId.get(row.clientId);
          if (row.id || !persistedId) return row;
          changed = true;
          return { ...row, id: persistedId };
        });
        return changed ? next : current;
      });
      setTimelineEntries((current) => {
        let changed = false;
        const next = current.map((row) => {
          const persistedId = timelineIdByClientId.get(row.clientId);
          if (row.id || !persistedId) return row;
          changed = true;
          return { ...row, id: persistedId };
        });
        return changed ? next : current;
      });
      setDowntimeBlocks((current) => {
        let anyChanged = false;
        const next = current.map((block) => {
          const persistedBlockId = blockIdByClientId.get(block.clientId);
          let changed = !block.id && Boolean(persistedBlockId);
          const activities = block.activities.map((activity) => {
            const persistedActivityId = activityIdByClientId.get(
              activity.clientId,
            );
            if (activity.id || !persistedActivityId) return activity;
            changed = true;
            return { ...activity, id: persistedActivityId };
          });
          if (!changed) return block;
          anyChanged = true;
          return {
            ...block,
            id: block.id ?? persistedBlockId,
            activities,
          };
        });
        return anyChanged ? next : current;
      });
      setGroundChecks((current) => {
        let changed = false;
        const next = current.map((row) => {
          const persistedId = groundCheckIdByClientId.get(row.clientId);
          if (row.id || !persistedId) return row;
          changed = true;
          return { ...row, id: persistedId };
        });
        return changed ? next : current;
      });
    },
    [],
  );

  const draftPersistence = useDraglineDelayDraftPersistence({
    enabled: mode === "draft" && Boolean(autosaveAction),
    reportId,
    snapshot: draftSnapshot,
    autosaveAction,
    onRestore: applyRecoveredSnapshot,
    onHydrateIdentities: hydratePersistedIdentities,
  });
  const [preparingSubmit, setPreparingSubmit] = useState(false);
  const completionAttemptRef = useRef(false);

  useEffect(() => {
    if (state.status !== "error" || !completionAttemptRef.current) return;
    completionAttemptRef.current = false;
    draftPersistence.preserveRecovery();
  }, [draftPersistence, state.status]);

  return (
    <form
      className="form-stack ddr-form"
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        const intent =
          (submitter?.value as "draft" | "complete" | "correct" | undefined) ??
          (mode === "correction" ? "correct" : "draft");
        setPendingIntent(intent);
        setPreparingSubmit(true);
        completionAttemptRef.current = intent === "complete";
        void (async () => {
          const prepared = await draftPersistence.prepareManualSubmit();
          if (intent === "complete") draftPersistence.clearRecovery();
          const formData = new FormData();
          formData.set("intent", intent);
          if (prepared.reportId) formData.set("reportId", prepared.reportId);
          const payload = JSON.parse(prepared.payload) as Record<string, unknown>;
          if (mode === "correction") payload.correctionReason = correctionReason;
          formData.set("payload", JSON.stringify(payload));
          setPreparingSubmit(false);
          startTransition(() => formAction(formData));
        })();
      }}
    >
      {draftPersistence.recovery ? (
        <div className="form-alert ddr-recovery-alert" role="status">
          <p>Recovered unsaved DDR changes from this device.</p>
          <p className="subtle">
            Device copy saved {new Date(draftPersistence.recovery.savedAt).toLocaleString()}.
            Restore it only if it contains work missing from the server Draft.
          </p>
          <div className="inline-actions">
            <button className="button primary" type="button" onClick={draftPersistence.restoreRecovery}>
              Restore
            </button>
            <button className="button secondary" type="button" onClick={draftPersistence.discardRecovery}>
              Discard
            </button>
          </div>
        </div>
      ) : null}
      {mode === "draft" && autosaveAction ? (
        <div
          className={`ddr-autosave-status ddr-autosave-status--${draftPersistence.status}`}
          data-ddr-autosave-status={draftPersistence.status}
          role="status"
        >
          <span>{draftPersistence.statusMessage || "Draft recovery ready"}</span>
          {draftPersistence.lastSavedAt ? (
            <span className="subtle">
              {new Date(draftPersistence.lastSavedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      ) : null}
      {state.status === "error" ? (
        <div
          className="form-alert ddr-error-summary"
          data-ddr-error-path="form"
          role="alert"
          tabIndex={-1}
        >
          <p>{state.message}</p>
          {errorSummary.length ? (
            <div>
              <p>Fix the following:</p>
              <ul>
                {errorSummary.map((error) => (
                  <li key={`${error.path}-${error.message}`}>
                    <button type="button" onClick={() => focusErrorPath(error.path)}>
                      <strong>{error.label}:</strong> {error.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="panel form-section" aria-labelledby="ddr-header-heading">
        <div className="full-width-field">
          <p className="eyebrow">
            {mode === "correction" ? "Completed report correction" : "Draft report identity"}
          </p>
          <h2 id="ddr-header-heading">Shift context</h2>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Operational Work Date</span>
            <input
              {...errorAttributes(state, "operationalWorkDate")}
              type="date"
              value={operationalWorkDate}
              onChange={(event) => setOperationalWorkDate(event.target.value)}
            />
            {firstError(state, "operationalWorkDate")}
          </label>
          <label>
            <span>Shift</span>
            <select
              {...errorAttributes(state, "shift")}
              value={shift}
              onChange={(event) => {
                const next = event.target.value as "DAY" | "NIGHT";
                setShift(next);
                if (groundCheckDefaultsUntouched.current) {
                  setGroundChecks(defaultGroundChecksForShift(next));
                }
                if (next === "DAY") {
                  setTimelineEntries((current) =>
                    current.map((entry) => ({ ...entry, dayOffset: 0 })),
                  );
                  if (!enableNewReportGroundCheckDefaults) {
                    setGroundChecks((current) =>
                      current.map((groundCheck) => ({
                        ...groundCheck,
                        dayOffset: 0,
                      })),
                    );
                  }
                  setDowntimeBlocks((current) =>
                    current.map((block) => ({ ...block, dayOffset: 0 })),
                  );
                }
              }}
            >
              <option value="DAY">Day</option>
              <option value="NIGHT">Night</option>
            </select>
            {firstError(state, "shift")}
          </label>
          <label>
            <span>Find Dragline Equipment</span>
            <input
              autoComplete="off"
              placeholder="Name, number, or mine"
              type="search"
              value={equipmentQuery}
              onChange={(event) => setEquipmentQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Dragline Equipment</span>
            <select
              {...errorAttributes(state, "equipmentId")}
              value={equipmentId}
              onChange={(event) => {
                const nextEquipmentId = event.target.value;
                const nextMineId = equipmentOptions.find(
                  (equipment) => equipment.id === nextEquipmentId,
                )?.mineId;
                setEquipmentId(nextEquipmentId);
                setLakeId((current) =>
                  lakeOptions.some(
                    (lake) => lake.id === current && lake.mineId === nextMineId,
                  )
                    ? current
                    : "",
                );
              }}
            >
              <option value="">Select Dragline Equipment</option>
              {visibleEquipment.map((equipment) => (
                <option
                  disabled={
                    equipment.status !== "ACTIVE" &&
                    equipment.id !== initialValues.equipmentId
                  }
                  key={equipment.id}
                  value={equipment.id}
                >
                  {equipment.label}
                  {equipment.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {firstError(state, "equipmentId")}
          </label>
          <label>
            <span>Starting Hour Meter</span>
            <input
              {...errorAttributes(state, "startingHourMeter")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={startingHourMeter}
              onChange={(event) => setStartingHourMeter(event.target.value)}
            />
            {firstError(state, "startingHourMeter")}
          </label>
          <label>
            <span>
              {mode === "correction"
                ? "Ending Hour Meter"
                : "Ending Hour Meter (optional in Draft)"}
            </span>
            <input
              {...errorAttributes(state, "endingHourMeter")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={endingHourMeter}
              onChange={(event) => setEndingHourMeter(event.target.value)}
            />
            {firstError(state, "endingHourMeter")}
          </label>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div>
            <span>Mine</span>
            <strong>{selectedEquipment?.mineName ?? "Derived from Equipment"}</strong>
          </div>
          <div>
            <span>City</span>
            <strong>
              {selectedEquipment
                ? `${selectedEquipment.cityName}${selectedEquipment.cityState ? `, ${selectedEquipment.cityState}` : ""}`
                : "Derived from Equipment"}
            </strong>
          </div>
          <div>
            <span>Down Time</span>
            <strong>
              {totals
                ? formatDraglineDurationMinutes(totals.downTimeMinutes)
                : "Check timeline"}
            </strong>
          </div>
          <div>
            <span>Run Time</span>
            <strong>
              {totals
                ? formatDraglineDurationMinutes(totals.runTimeMinutes)
                : "Check timeline"}
            </strong>
          </div>
        </div>
      </section>

      <section
        aria-describedby={hasError(state, "operators") ? errorId("operators") : undefined}
        aria-labelledby="ddr-people-heading"
        className={`panel form-section${hasError(state, "operators") ? " ddr-invalid-section" : ""}`}
        data-ddr-error-path="operators"
        tabIndex={-1}
      >
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Canonical Employees</p>
            <h2 id="ddr-people-heading">Operators and Supervisor</h2>
          </div>
          <button
            className="button secondary"
            disabled={operators.length >= 20}
            type="button"
            onClick={() => setOperators((current) => [...current, emptyOperator()])}
          >
            Add Operator
          </button>
        </div>
        {firstError(state, "operators")}
        <div className="ddr-operator-list full-width-field">
          {operators.map((operator, index) => (
            <fieldset
              className={`ddr-operator-row${hasNestedError(state, `operators.${index}`) ? " ddr-invalid-row" : ""}`}
              data-ddr-error-path={`operators.${index}`}
              key={operator.clientId}
              tabIndex={-1}
            >
              <legend>Operator {index + 1}</legend>
              {firstError(state, `operators.${index}.sequence`)}
              {firstError(state, `operators.${index}.id`)}
              <EmployeeField
                errorPath={`operators.${index}.employeeId`}
                label="Operator"
                onChange={(employeeId) => updateOperator(index, { employeeId })}
                options={employeeOptions}
                rowNumber={index + 1}
                state={state}
                value={operator.employeeId}
              />
              <div className="inline-actions">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  type="button"
                  onClick={() => setOperators((current) => moveItem(current, index, -1))}
                >
                  Move up
                </button>
                <button
                  className="button secondary"
                  disabled={index === operators.length - 1}
                  type="button"
                  onClick={() => setOperators((current) => moveItem(current, index, 1))}
                >
                  Move down
                </button>
                <button
                  className="button danger"
                  disabled={operators.length === 1}
                  type="button"
                  onClick={() =>
                    setOperators((current) =>
                      current.filter((_, operatorIndex) => operatorIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
        </div>
        <div className="full-width-field">
          <EmployeeField
            errorPath="supervisorId"
            label="Supervisor"
            onChange={setSupervisorId}
            options={supervisorOptions}
            optional
            state={state}
            value={supervisorId}
          />
          <p className="subtle">
            {mode === "correction"
              ? "A Supervisor is required for the corrected Completed report."
              : "Supervisor may remain blank while Draft but is required to complete."}
          </p>
        </div>
        <div className="full-width-field">
          <EmployeeField
            errorPath="dayShiftFieldLeadId"
            label="Day Shift Field Lead"
            onChange={setDayShiftFieldLeadId}
            options={employeeOptions}
            optional
            state={state}
            value={dayShiftFieldLeadId}
          />
        </div>
        <div className="full-width-field">
          <EmployeeField
            errorPath="nightShiftFieldLeadId"
            label="Night Shift Field Lead"
            onChange={setNightShiftFieldLeadId}
            options={employeeOptions}
            optional
            state={state}
            value={nightShiftFieldLeadId}
          />
          <p className="subtle">
            Field Leads are optional and use existing Employee records.
          </p>
        </div>
      </section>

      <section
        aria-describedby={
          hasError(state, "timelineEntries")
            ? errorId("timelineEntries")
            : hasError(state, "downtimeBlocks")
              ? errorId("downtimeBlocks")
              : undefined
        }
        aria-labelledby="ddr-timeline-heading"
        className={`panel form-section${hasError(state, "timelineEntries") || hasError(state, "downtimeBlocks") ? " ddr-invalid-section" : ""}`}
        data-ddr-error-path="timelineEntries"
        tabIndex={-1}
      >
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Actual-time operational record</p>
            <h2 id="ddr-timeline-heading">Timeline</h2>
          </div>
          <div className="inline-actions ddr-timeline-add-actions">
            <button
              className="button ddr-add-timeline-button"
              data-ddr-add-timeline-position="top"
              disabled={timelineEntries.length >= 200}
              type="button"
              onClick={addTimelineEntry}
            >
              Add Timeline Row
            </button>
            <button
              className="button ddr-add-downtime-block-button"
              data-ddr-add-downtime-block-position="top"
              disabled={downtimeBlocks.length >= 100}
              type="button"
              onClick={addDowntimeBlock}
            >
              Add Shared Downtime Block
            </button>
          </div>
        </div>
        <p className="subtle full-width-field">
          Timeline Rows and Shared Downtime Blocks share one manual order. A
          block moves as one unit; its Activities keep their own internal order.
          Same-time items are valid, and downtime still uses the interval-union
          total.
        </p>
        {firstError(state, "timelineEntries")}
        {firstError(state, "downtimeBlocks")}
        <div className="ddr-timeline-list full-width-field">
          {timelineOrder.map((orderedItem, orderIndex) => {
            if (orderedItem.kind === "entry") {
              const index =
                timelineIndexByClientId.get(orderedItem.clientId) ?? -1;
              const entry = timelineEntries[index];
              if (!entry) return null;
              return (
                <TimelineEntryRow
                  entry={entry}
                  index={index}
                  key={entry.clientId}
                  onChange={updateTimelineEntry}
                  onMove={moveTimelineItem}
                  onRemove={removeTimelineEntry}
                  orderIndex={orderIndex}
                  orderLength={timelineOrder.length}
                  shift={shift}
                  state={state}
                />
              );
            }

            const blockIndex =
              downtimeBlockIndexByClientId.get(orderedItem.clientId) ?? -1;
            const block = downtimeBlocks[blockIndex];
            if (!block) return null;
            return (
              <fieldset
                className={`ddr-downtime-block${hasNestedError(state, `downtimeBlocks.${blockIndex}`) ? " ddr-invalid-row" : ""}`}
                data-ddr-downtime-block-client-id={block.clientId}
                data-ddr-error-path={`downtimeBlocks.${blockIndex}`}
                key={block.clientId}
                tabIndex={-1}
              >
                <legend>Shared Downtime Block {blockIndex + 1}</legend>
                {firstError(state, `downtimeBlocks.${blockIndex}.sequence`)}
                {firstError(state, `downtimeBlocks.${blockIndex}.id`)}
                <div className="ddr-downtime-block-fields">
                  <label>
                    <span>Start Time</span>
                    <input
                      {...errorAttributes(
                        state,
                        `downtimeBlocks.${blockIndex}.startTime`,
                      )}
                      aria-label={`Start Time for Shared Downtime Block ${blockIndex + 1}`}
                      data-ddr-downtime-block-start="true"
                      type="time"
                      value={block.startTime}
                      onChange={(event) =>
                        updateDowntimeBlock(blockIndex, {
                          startTime: event.target.value,
                        })
                      }
                    />
                    {firstError(
                      state,
                      `downtimeBlocks.${blockIndex}.startTime`,
                    )}
                  </label>
                  {shift === "NIGHT" ? (
                    <label>
                      <span>Calendar Day</span>
                      <select
                        {...errorAttributes(
                          state,
                          `downtimeBlocks.${blockIndex}.dayOffset`,
                        )}
                        aria-label={`Calendar Day for Shared Downtime Block ${blockIndex + 1}`}
                        value={block.dayOffset}
                        onChange={(event) =>
                          updateDowntimeBlock(blockIndex, {
                            dayOffset: Number(event.target.value) as 0 | 1,
                          })
                        }
                      >
                        <option value={0}>Operational date</option>
                        <option value={1}>Next day</option>
                      </select>
                      {firstError(
                        state,
                        `downtimeBlocks.${blockIndex}.dayOffset`,
                      )}
                    </label>
                  ) : null}
                  <label>
                    <span>Total Duration (minutes)</span>
                    <input
                      {...errorAttributes(
                        state,
                        `downtimeBlocks.${blockIndex}.durationMinutes`,
                      )}
                      aria-label={`Total Duration for Shared Downtime Block ${blockIndex + 1}`}
                      inputMode="numeric"
                      min="1"
                      step="1"
                      type="number"
                      value={block.durationMinutes}
                      onChange={(event) =>
                        updateDowntimeBlock(blockIndex, {
                          durationMinutes: event.target.value,
                        })
                      }
                    />
                    {firstError(
                      state,
                      `downtimeBlocks.${blockIndex}.durationMinutes`,
                    )}
                  </label>
                  <label className="ddr-description-field">
                    <span>Block Description / Notes (optional)</span>
                    <textarea
                      {...errorAttributes(
                        state,
                        `downtimeBlocks.${blockIndex}.description`,
                      )}
                      aria-label={`Block Description / Notes for Shared Downtime Block ${blockIndex + 1}`}
                      maxLength={1000}
                      rows={2}
                      value={block.description}
                      onChange={(event) =>
                        updateDowntimeBlock(blockIndex, {
                          description: event.target.value,
                        })
                      }
                    />
                    {firstError(
                      state,
                      `downtimeBlocks.${blockIndex}.description`,
                    )}
                  </label>
                </div>

                <div
                  className="ddr-downtime-block-activities"
                  data-ddr-error-path={`downtimeBlocks.${blockIndex}.activities`}
                  tabIndex={-1}
                >
                  <div className="section-heading">
                    <div>
                      <h4>Activities</h4>
                      <p className="subtle">No individual duration is required.</p>
                    </div>
                    <button
                      className="button secondary"
                      data-ddr-add-activity-position="top"
                      disabled={block.activities.length >= 100}
                      type="button"
                      onClick={() => addDowntimeBlockActivity(blockIndex)}
                    >
                      Add Activity
                    </button>
                  </div>
                  {firstError(
                    state,
                    `downtimeBlocks.${blockIndex}.activities`,
                  )}
                  {block.activities.length === 0 ? (
                    <p className="subtle">Add at least one Activity.</p>
                  ) : null}
                  {block.activities.map((activity, activityIndex) => (
                    <fieldset
                      className={`ddr-downtime-block-activity${hasNestedError(state, `downtimeBlocks.${blockIndex}.activities.${activityIndex}`) ? " ddr-invalid-row" : ""}`}
                      data-ddr-downtime-block-activity-client-id={activity.clientId}
                      data-ddr-error-path={`downtimeBlocks.${blockIndex}.activities.${activityIndex}`}
                      key={activity.clientId}
                      tabIndex={-1}
                    >
                      <legend>Activity {activityIndex + 1}</legend>
                      {firstError(
                        state,
                        `downtimeBlocks.${blockIndex}.activities.${activityIndex}.sequence`,
                      )}
                      {firstError(
                        state,
                        `downtimeBlocks.${blockIndex}.activities.${activityIndex}.id`,
                      )}
                      {firstError(
                        state,
                        `downtimeBlocks.${blockIndex}.activities.${activityIndex}.catalogVersion`,
                      )}
                      <div className="ddr-downtime-block-activity-fields">
                        <DowntimeBlockActivityCodeField
                          activity={activity}
                          activityIndex={activityIndex}
                          blockIndex={blockIndex}
                          onChange={(values) =>
                            updateDowntimeBlockActivity(
                              blockIndex,
                              activityIndex,
                              values,
                            )
                          }
                          state={state}
                        />
                        <label className="ddr-description-field">
                          <span>Description / Notes (optional)</span>
                          <textarea
                            {...errorAttributes(
                              state,
                              `downtimeBlocks.${blockIndex}.activities.${activityIndex}.description`,
                            )}
                            aria-label={`Description / Notes for Shared Downtime Block ${blockIndex + 1} Activity ${activityIndex + 1}`}
                            maxLength={1000}
                            rows={2}
                            value={activity.description}
                            onChange={(event) =>
                              updateDowntimeBlockActivity(
                                blockIndex,
                                activityIndex,
                                { description: event.target.value },
                              )
                            }
                          />
                          {firstError(
                            state,
                            `downtimeBlocks.${blockIndex}.activities.${activityIndex}.description`,
                          )}
                        </label>
                      </div>
                      <div className="inline-actions ddr-row-actions">
                        <button
                          className="button secondary"
                          disabled={activityIndex === 0}
                          type="button"
                          onClick={() =>
                            updateDowntimeBlock(blockIndex, {
                              activities: moveItem(
                                block.activities,
                                activityIndex,
                                -1,
                              ),
                            })
                          }
                        >
                          Move up
                        </button>
                        <button
                          className="button secondary"
                          disabled={activityIndex === block.activities.length - 1}
                          type="button"
                          onClick={() =>
                            updateDowntimeBlock(blockIndex, {
                              activities: moveItem(
                                block.activities,
                                activityIndex,
                                1,
                              ),
                            })
                          }
                        >
                          Move down
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          onClick={() =>
                            updateDowntimeBlock(blockIndex, {
                              activities: block.activities.filter(
                                (_, currentActivityIndex) =>
                                  currentActivityIndex !== activityIndex,
                              ),
                            })
                          }
                        >
                          Remove Activity
                        </button>
                      </div>
                    </fieldset>
                  ))}
                  <div className="inline-actions ddr-downtime-block-activity-bottom-actions">
                    <button
                      className="button secondary"
                      data-ddr-add-activity-position="bottom"
                      disabled={block.activities.length >= 100}
                      type="button"
                      onClick={() => addDowntimeBlockActivity(blockIndex)}
                    >
                      Add Activity
                    </button>
                  </div>
                </div>

                <div className="inline-actions ddr-row-actions">
                  <button
                    className="button secondary"
                    disabled={orderIndex === 0}
                    type="button"
                    onClick={() => moveTimelineItem(orderIndex, -1)}
                  >
                    Move Block Up
                  </button>
                  <button
                    className="button secondary"
                    disabled={orderIndex === timelineOrder.length - 1}
                    type="button"
                    onClick={() => moveTimelineItem(orderIndex, 1)}
                  >
                    Move Block Down
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => removeDowntimeBlock(block.clientId)}
                  >
                    Remove Shared Downtime Block
                  </button>
                </div>
              </fieldset>
            );
          })}
          <div className="inline-actions ddr-timeline-bottom-actions">
            <button
              className="button ddr-add-timeline-button"
              data-ddr-add-timeline-position="bottom"
              disabled={timelineEntries.length >= 200}
              type="button"
              onClick={addTimelineEntry}
            >
              Add Timeline Row
            </button>
            <button
              className="button ddr-add-downtime-block-button"
              data-ddr-add-downtime-block-position="bottom"
              disabled={downtimeBlocks.length >= 100}
              type="button"
              onClick={addDowntimeBlock}
            >
              Add Shared Downtime Block
            </button>
          </div>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-production-heading">
        <div className="full-width-field">
          <p className="eyebrow">
            {mode === "correction" ? "Corrected end-of-shift data" : "End-of-shift Draft data"}
          </p>
          <h2 id="ddr-production-heading">Production</h2>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Normal Digging Buckets</span>
            <input
              {...errorAttributes(state, "normalDiggingBuckets")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={normalDiggingBuckets}
              onChange={(event) => setNormalDiggingBuckets(event.target.value)}
            />
            {firstError(state, "normalDiggingBuckets")}
          </label>
          <label>
            <span>Benchfill Buckets</span>
            <input
              {...errorAttributes(state, "benchfillBuckets")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={benchfillBuckets}
              onChange={(event) => setBenchfillBuckets(event.target.value)}
            />
            {firstError(state, "benchfillBuckets")}
          </label>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-progress-heading">
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Equipment Mine context</p>
            <h2 id="ddr-progress-heading">Work Area and Progress</h2>
          </div>
          <a className="button secondary" href="/dragline-delay-reports/lakes">
            Manage Lakes
          </a>
        </div>
        <div className="form-grid full-width-field ddr-work-area-grid">
          <label className="ddr-work-area-half">
            <span>Lake</span>
            <select
              {...errorAttributes(state, "lakeId")}
              disabled={!selectedEquipment}
              value={lakeId}
              onChange={(event) => setLakeId(event.target.value)}
            >
              <option value="">
                {selectedEquipment
                  ? mode === "correction" ? "Not recorded" : "Not recorded in Draft"
                  : "Select Equipment first"}
              </option>
              {visibleLakes.map((lake) => (
                <option
                  disabled={lake.status !== "ACTIVE" && lake.id !== initialValues.lakeId}
                  key={lake.id}
                  value={lake.id}
                >
                  {lake.name}{lake.status !== "ACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {firstError(state, "lakeId")}
            {selectedEquipment && visibleLakes.length === 0 ? (
              <p className="subtle">No active Lakes exist for this Mine.</p>
            ) : null}
          </label>
          <label className="ddr-work-area-half">
            <span>Cut Type</span>
            <select
              {...errorAttributes(state, "cutType")}
              value={cutType}
              onChange={(event) =>
                setCutType(
                  event.target.value as DraglineDelayReportFormInitialValues["cutType"],
                )
              }
            >
              <option value="">Not recorded</option>
              {DRAGLINE_DELAY_REPORT_CUT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {firstError(state, "cutType")}
          </label>
          <label className="full-width-field">
            <span>Cut Note</span>
            <textarea
              {...errorAttributes(state, "cutNote")}
              maxLength={1000}
              rows={3}
              value={cutNote}
              onChange={(event) => setCutNote(event.target.value)}
            />
            {firstError(state, "cutNote")}
          </label>
          <label className="ddr-work-area-third">
            <span>Station Start</span>
            <input
              {...errorAttributes(state, "stationStart")}
              inputMode="numeric"
              placeholder="16+0"
              value={stationStart}
              onChange={(event) => setStationStart(event.target.value)}
            />
            {firstError(state, "stationStart")}
          </label>
          <label className="ddr-work-area-third">
            <span>Station End</span>
            <input
              {...errorAttributes(state, "stationEnd")}
              inputMode="numeric"
              placeholder="16+20"
              value={stationEnd}
              onChange={(event) => setStationEnd(event.target.value)}
            />
            {firstError(state, "stationEnd")}
          </label>
          <div className="ddr-work-area-third">
            <span>Advance</span>
            <p>
              <strong>
                {advanceFeet == null ? "—" : `${advanceFeet} ft`}
              </strong>
            </p>
            <p className="subtle">Absolute distance; calculated by NAM.</p>
          </div>
          <label className="ddr-work-area-third">
            <span>Depth (feet)</span>
            <input
              {...errorAttributes(state, "depthFeet")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={depthFeet}
              onChange={(event) => setDepthFeet(event.target.value)}
            />
            {firstError(state, "depthFeet")}
          </label>
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-operational-heading">
        <div className="full-width-field">
          <p className="eyebrow">Totals and measurements</p>
          <h2 id="ddr-operational-heading">Operational Context</h2>
        </div>
        <div className="checklist-derived-context full-width-field" aria-live="polite">
          <div>
            <span>Down Time</span>
            <strong>
              {totals
                ? formatDraglineDurationMinutes(totals.downTimeMinutes)
                : "Check timeline"}
            </strong>
          </div>
          <div>
            <span>Run Time</span>
            <strong>
              {totals
                ? formatDraglineDurationMinutes(totals.runTimeMinutes)
                : "Check timeline"}
            </strong>
          </div>
        </div>
        <div className="form-grid full-width-field">
          <label>
            <span>Fuel (gallons)</span>
            <input
              {...errorAttributes(state, "fuelGallons")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={fuelGallons}
              onChange={(event) => setFuelGallons(event.target.value)}
            />
            {firstError(state, "fuelGallons")}
          </label>
          <label>
            <span>Cable Drag (feet cut off)</span>
            <input
              {...errorAttributes(state, "cableDragFeet")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={cableDragFeet}
              onChange={(event) => setCableDragFeet(event.target.value)}
            />
            {firstError(state, "cableDragFeet")}
          </label>
          <label>
            <span>Hoist (feet cut off)</span>
            <input
              {...errorAttributes(state, "hoistFeet")}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={hoistFeet}
              onChange={(event) => setHoistFeet(event.target.value)}
            />
            {firstError(state, "hoistFeet")}
          </label>
        </div>
      </section>

      <section
        aria-describedby={hasError(state, "groundChecks") ? errorId("groundChecks") : undefined}
        aria-labelledby="ddr-ground-check-heading"
        className={`panel form-section${hasError(state, "groundChecks") ? " ddr-invalid-section" : ""}`}
        data-ddr-error-path="groundChecks"
        tabIndex={-1}
      >
        <div className="section-heading full-width-field">
          <div>
            <p className="eyebrow">Manual inspection times</p>
            <h2 id="ddr-ground-check-heading">Ground Checks</h2>
          </div>
          <button
            className="button secondary"
            disabled={groundChecks.length >= 100}
            type="button"
            onClick={() =>
              updateGroundChecks((current) => [...current, emptyGroundCheck()])
            }
          >
            Add Ground Check
          </button>
        </div>
        <p className="subtle full-width-field">
          Record every physical ground-condition inspection. These times are not
          derived from timeline codes.
        </p>
        <p className="ddr-ground-check-info full-width-field" role="note">
          Each Ground Check counts as 10 minutes of downtime and is included
          automatically in Run Time / Down Time totals.
        </p>
        {firstError(state, "groundChecks")}
        <div className="ddr-operator-list full-width-field">
          {groundChecks.length === 0 ? (
            <p className="subtle">
              No Ground Checks recorded{mode === "draft" ? " in this Draft" : ""}.
            </p>
          ) : null}
          {groundChecks.map((groundCheck, index) => (
            <fieldset
              className={`ddr-operator-row${hasNestedError(state, `groundChecks.${index}`) ? " ddr-invalid-row" : ""}`}
              data-ddr-error-path={`groundChecks.${index}`}
              key={groundCheck.clientId}
              tabIndex={-1}
            >
              <legend>Ground Check {index + 1}</legend>
              {firstError(state, `groundChecks.${index}.sequence`)}
              {firstError(state, `groundChecks.${index}.id`)}
              <label>
                <span>Time</span>
                <input
                  {...errorAttributes(state, `groundChecks.${index}.startTime`)}
                  aria-label={`Ground Check time ${index + 1}`}
                  type="time"
                  value={groundCheck.startTime}
                  onChange={(event) =>
                    updateGroundChecks((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, startTime: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                {firstError(state, `groundChecks.${index}.startTime`)}
              </label>
              {shift === "NIGHT" ? (
                <label>
                  <span>Calendar day</span>
                  <select
                    {...errorAttributes(state, `groundChecks.${index}.dayOffset`)}
                    aria-label={`Ground Check calendar day ${index + 1}`}
                    value={groundCheck.dayOffset}
                    onChange={(event) =>
                      updateGroundChecks((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                dayOffset: Number(event.target.value) as 0 | 1,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value={0}>Operational date</option>
                    <option value={1}>Next day</option>
                  </select>
                  {firstError(state, `groundChecks.${index}.dayOffset`)}
                </label>
              ) : null}
              <div className="inline-actions">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  type="button"
                  onClick={() =>
                    updateGroundChecks((current) => moveItem(current, index, -1))
                  }
                >
                  Move up
                </button>
                <button
                  className="button secondary"
                  disabled={index === groundChecks.length - 1}
                  type="button"
                  onClick={() =>
                    updateGroundChecks((current) => moveItem(current, index, 1))
                  }
                >
                  Move down
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={() =>
                    updateGroundChecks((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="panel form-section" aria-labelledby="ddr-closing-heading">
        <div className="full-width-field">
          <p className="eyebrow">
            {mode === "correction" ? "Corrected closing notes" : "Optional Draft notes"}
          </p>
          <h2 id="ddr-closing-heading">Closing Notes</h2>
        </div>
        <div className="form-grid full-width-field">
          <label className="full-width-field">
            <span>Comments</span>
            <textarea
              {...errorAttributes(state, "comments")}
              maxLength={5000}
              rows={4}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
            />
            {firstError(state, "comments")}
          </label>
          <label>
            <span>Safety Items Found</span>
            <textarea
              {...errorAttributes(state, "safetyItemsFound")}
              maxLength={5000}
              rows={4}
              value={safetyItemsFound}
              onChange={(event) => setSafetyItemsFound(event.target.value)}
            />
            {firstError(state, "safetyItemsFound")}
          </label>
          <label>
            <span>Action Taken</span>
            <textarea
              {...errorAttributes(state, "actionTaken")}
              maxLength={5000}
              rows={4}
              value={actionTaken}
              onChange={(event) => setActionTaken(event.target.value)}
            />
            {firstError(state, "actionTaken")}
          </label>
        </div>
      </section>

      {mode === "correction" ? (
        <section className="panel form-section" aria-labelledby="ddr-correction-reason-heading">
          <div className="full-width-field">
            <p className="eyebrow">Permanent correction history</p>
            <h2 id="ddr-correction-reason-heading">Correction Reason</h2>
            <p className="subtle">
              Explain why the Completed report is changing. It remains Completed,
              and this reason is stored with the report version transition.
            </p>
          </div>
          <label className="full-width-field">
            <span>Correction Reason</span>
            <textarea
              {...errorAttributes(state, "correctionReason")}
              aria-label="Correction Reason"
              maxLength={1000}
              rows={4}
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
            />
            {firstError(state, "correctionReason")}
          </label>
        </section>
      ) : null}

      <div className="form-actions">
        <a className="button secondary" href={cancelHref}>
          Cancel
        </a>
        {mode === "correction" ? (
          <button
            className="button primary"
            disabled={pending || preparingSubmit}
            name="intent"
            type="submit"
            value="correct"
          >
              {(pending || preparingSubmit) && pendingIntent === "correct" ? "Correcting..." : submitLabel}
          </button>
        ) : (
          <>
            <button
              className={allowComplete ? "button secondary" : "button primary"}
              disabled={pending || preparingSubmit}
              name="intent"
              type="submit"
              value="draft"
            >
              {(pending || preparingSubmit) && pendingIntent === "draft" ? "Saving Draft..." : submitLabel}
            </button>
            {allowComplete ? (
              <button
                className="button primary"
                disabled={pending || preparingSubmit}
                name="intent"
                type="submit"
                value="complete"
              >
                {(pending || preparingSubmit) && pendingIntent === "complete" ? "Completing..." : "Complete Report"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </form>
  );
}
