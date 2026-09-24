import { prisma } from "@/lib/prisma";
import {
  addDateKeyDays,
  dateKeyInTimeZone,
  NAM_OPERATIONAL_TIME_ZONE,
  zonedDateTime,
} from "@/lib/zoned-date-time";

export const HOME_TIME_ZONE = NAM_OPERATIONAL_TIME_ZONE;

type HomeAssignmentSource = {
  id: string;
  weeklyScheduleId: string;
  assignmentDate: Date;
  plannedStatus: string;
  plannedShift: string;
  plannedEquipmentDisplayName: string | null;
  plannedEquipmentNumber: string | null;
  plannedEquipmentId: string | null;
  plannedMineName: string | null;
  actualStatus: string;
  actualShift: string;
  actualEquipmentDisplayName: string | null;
  actualEquipmentNumber: string | null;
  actualEquipmentId: string | null;
  actualMineName: string | null;
  crewMembers: {
    phase: string;
    role: string;
    displayName: string | null;
    isUnknown: boolean;
  }[];
};

export type HomeShiftSummary = {
  kind: "CURRENT" | "NEXT";
  assignmentId: string;
  scheduleId: string;
  assignmentDate: string;
  shift: "DAY" | "NIGHT";
  shiftLabel: string;
  timeLabel: string;
  start: Date;
  end: Date;
  equipmentLabel?: string;
  equipmentId?: string;
  mineName?: string;
  partnerLabel?: string;
  relativeLabel?: string;
};

function assignmentDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function effectiveAssignment(assignment: HomeAssignmentSource) {
  const useActual = assignment.actualStatus !== "UNKNOWN";
  const phase = useActual ? "ACTUAL" : "PLANNED";
  const status = useActual ? assignment.actualStatus : assignment.plannedStatus;
  const shift = useActual ? assignment.actualShift : assignment.plannedShift;
  const displayName = useActual
    ? assignment.actualEquipmentDisplayName
    : assignment.plannedEquipmentDisplayName;
  const equipmentNumber = useActual
    ? assignment.actualEquipmentNumber
    : assignment.plannedEquipmentNumber;
  const mineName = useActual ? assignment.actualMineName : assignment.plannedMineName;
  const equipmentId = useActual
    ? assignment.actualEquipmentId
    : assignment.plannedEquipmentId;
  const partner = assignment.crewMembers.find(
    (member) => member.phase === phase && member.role === "PARTNER",
  );

  return {
    status,
    shift,
    equipmentId: equipmentId ?? undefined,
    equipmentLabel: displayName
      ? `${displayName}${equipmentNumber ? ` #${equipmentNumber}` : ""}`
      : undefined,
    mineName: mineName ?? undefined,
    partnerLabel: partner
      ? partner.isUnknown
        ? "Unknown partner"
        : partner.displayName ?? undefined
      : undefined,
  };
}

export function homeShiftInterval(
  assignmentDate: string,
  shift: "DAY" | "NIGHT",
  timeZone = HOME_TIME_ZONE,
) {
  if (shift === "DAY") {
    return {
      start: zonedDateTime(assignmentDate, 5, 0, timeZone),
      end: zonedDateTime(assignmentDate, 17, 0, timeZone),
    };
  }

  return {
    start: zonedDateTime(assignmentDate, 17, 0, timeZone),
    end: zonedDateTime(addDateKeyDays(assignmentDate, 1), 5, 0, timeZone),
  };
}

export function relativeShiftStart(
  start: Date,
  now: Date,
  timeZone = HOME_TIME_ZONE,
) {
  const dayDifference = Math.round(
    (new Date(`${dateKeyInTimeZone(start, timeZone)}T00:00:00.000Z`).getTime() -
      new Date(`${dateKeyInTimeZone(now, timeZone)}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );

  if (dayDifference === 1) return "Starts tomorrow";
  if (dayDifference > 1) return `Starts in ${dayDifference} days`;

  const minutes = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "Starts soon" : `Starts in ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return `Starts in ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function selectCurrentOrNextShift(
  assignments: HomeAssignmentSource[],
  now = new Date(),
  timeZone = HOME_TIME_ZONE,
): HomeShiftSummary | undefined {
  const candidates = assignments
    .map((assignment) => {
      const effective = effectiveAssignment(assignment);
      if (
        effective.status !== "SCHEDULED" ||
        (effective.shift !== "DAY" && effective.shift !== "NIGHT")
      ) {
        return undefined;
      }

      const assignmentDate = assignmentDateKey(assignment.assignmentDate);
      const shift = effective.shift as "DAY" | "NIGHT";
      const interval = homeShiftInterval(assignmentDate, shift, timeZone);
      return {
        assignment,
        effective,
        assignmentDate,
        shift,
        ...interval,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  const current = candidates.find(
    (candidate) => candidate.start <= now && now < candidate.end,
  );
  const selected = current ?? candidates.find((candidate) => candidate.start > now);
  if (!selected) return undefined;

  const kind = selected === current ? "CURRENT" : "NEXT";
  return {
    kind,
    assignmentId: selected.assignment.id,
    scheduleId: selected.assignment.weeklyScheduleId,
    assignmentDate: selected.assignmentDate,
    shift: selected.shift,
    shiftLabel: selected.shift === "DAY" ? "Day Shift" : "Night Shift",
    timeLabel: selected.shift === "DAY" ? "5:00 AM – 5:00 PM" : "5:00 PM – 5:00 AM",
    start: selected.start,
    end: selected.end,
    equipmentLabel: selected.effective.equipmentLabel,
    equipmentId: selected.effective.equipmentId,
    mineName: selected.effective.mineName,
    partnerLabel: selected.effective.partnerLabel,
    relativeLabel:
      kind === "CURRENT" ? "In Progress" : relativeShiftStart(selected.start, now, timeZone),
  };
}

export async function getHomeShiftSummary(now = new Date()) {
  const today = dateKeyInTimeZone(now);
  const assignments = await prisma.dailyAssignment.findMany({
    where: {
      assignmentDate: { gte: new Date(`${addDateKeyDays(today, -1)}T00:00:00.000Z`) },
      weeklySchedule: { status: "ACTIVE" },
      OR: [{ plannedStatus: "SCHEDULED" }, { actualStatus: "SCHEDULED" }],
    },
    include: { crewMembers: true },
    orderBy: { assignmentDate: "asc" },
  });

  return selectCurrentOrNextShift(assignments, now);
}

export function displayHomeShiftDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
