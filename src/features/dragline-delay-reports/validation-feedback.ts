export type DraglineDelayReportErrorSummaryItem = {
  path: string;
  label: string;
  message: string;
};

const fieldLabels: Record<string, string> = {
  operationalWorkDate: "Operational Work Date",
  shift: "Shift",
  equipmentId: "Dragline Equipment",
  startingHourMeter: "Starting Hour Meter",
  endingHourMeter: "Ending Hour Meter",
  supervisorId: "Supervisor",
  lakeId: "Lake",
  normalDiggingBuckets: "Normal Digging Buckets",
  benchfillBuckets: "Benchfill Buckets",
  stationStart: "Section Start",
  stationEnd: "Section End",
  depthFeet: "Depth",
  fuelGallons: "Fuel",
  cableDragFeet: "Cable Drag",
  hoistFeet: "Hoist",
  comments: "Comments",
  safetyItemsFound: "Safety Items Found",
  actionTaken: "Action Taken",
  correctionReason: "Correction Reason",
  operators: "Operators",
  timelineEntries: "Timeline",
  groundChecks: "Ground Checks",
  recordVersion: "Report Version",
  form: "Report",
};

const timelineFieldLabels: Record<string, string> = {
  startTime: "Start Time",
  dayOffset: "Calendar Day",
  catalogVersion: "Delay Code Catalog",
  delayCode: "Delay Code",
  description: "Description",
  durationMinutes: "Duration",
  causesDowntime: "Causes Downtime",
  sequence: "Order",
  id: "Row Identity",
};

const groundCheckFieldLabels: Record<string, string> = {
  startTime: "Time",
  dayOffset: "Calendar Day",
  sequence: "Order",
  id: "Row Identity",
};

function humanizeField(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

export function formatDraglineDelayReportErrorPath(path: string) {
  const operator = /^operators\.(\d+)(?:\.(\w+))?$/.exec(path);
  if (operator) {
    const rowLabel = `Operator ${Number(operator[1]) + 1}`;
    if (!operator[2] || operator[2] === "employeeId") return rowLabel;
    return `${rowLabel} — ${operator[2] === "sequence" ? "Order" : "Row Identity"}`;
  }

  const timeline = /^timelineEntries\.(\d+)(?:\.(\w+))?$/.exec(path);
  if (timeline) {
    const rowLabel = `Timeline row ${Number(timeline[1]) + 1}`;
    if (!timeline[2]) return rowLabel;
    return `${rowLabel} — ${timelineFieldLabels[timeline[2]] ?? humanizeField(timeline[2])}`;
  }

  const groundCheck = /^groundChecks\.(\d+)(?:\.(\w+))?$/.exec(path);
  if (groundCheck) {
    const rowLabel = `Ground Check ${Number(groundCheck[1]) + 1}`;
    if (!groundCheck[2]) return rowLabel;
    return `${rowLabel} — ${groundCheckFieldLabels[groundCheck[2]] ?? humanizeField(groundCheck[2])}`;
  }

  return fieldLabels[path] ?? humanizeField(path.split(".").at(-1) ?? "Report");
}

export function draglineDelayReportErrorSummary(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
) {
  const seen = new Set<string>();
  const summary: DraglineDelayReportErrorSummaryItem[] = [];

  for (const [path, messages] of Object.entries(fieldErrors)) {
    const label = formatDraglineDelayReportErrorPath(path);
    for (const message of messages) {
      const identity = `${label}\u0000${message}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      summary.push({ path, label, message });
    }
  }

  return summary;
}

export function draglineDelayReportErrorTargetPaths(path: string) {
  const nested = /^(operators|timelineEntries|groundChecks)\.(\d+)\./.exec(path);
  if (nested) return [path, `${nested[1]}.${nested[2]}`, nested[1], "form"];
  if (path === "recordVersion" || path === "form") return [path, "form"];
  return [path, "form"];
}
