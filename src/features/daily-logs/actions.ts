"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  LinkedDailyLogActivityEditError,
  updateDailyLogWithClient,
} from "./update-persistence-internal";

import {
  dailyLogActivitySchema,
  dailyLogFormSchema,
  emptyDailyLogFormState,
  type DailyLogFormInput,
  type DailyLogFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function errorState(message: string): DailyLogFormState {
  return {
    ...emptyDailyLogFormState,
    status: "error",
    message,
  };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value));
}

function parseActivities(formData: FormData):
  | { ok: true; activities: DailyLogFormInput["activities"] }
  | { ok: false; errors: string[] } {
  const activityTypes = getAll(formData, "activityType");
  const activityIds = getAll(formData, "activityId");
  const titles = getAll(formData, "activityTitle");
  const startTimes = getAll(formData, "activityStartTime");
  const endTimes = getAll(formData, "activityEndTime");
  const descriptions = getAll(formData, "activityDescription");
  const equipmentIds = getAll(formData, "activityEquipmentId");
  const locations = getAll(formData, "activityLocation");
  const contractorCompanies = getAll(formData, "activityContractorCompany");
  const personNames = getAll(formData, "activityPersonName");
  const notes = getAll(formData, "activityNotes");

  const activityColumns = [
    activityIds,
    titles,
    startTimes,
    endTimes,
    descriptions,
    equipmentIds,
    locations,
    contractorCompanies,
    personNames,
    notes,
  ];
  if (activityColumns.some((column) => column.length !== activityTypes.length)) {
    return {
      ok: false,
      errors: [
        "The Activity row identities or fields were incomplete. Reload before editing.",
      ],
    };
  }

  const rows = activityTypes
    .map((activityType, index) => ({
      activityId: activityIds[index] ?? "",
      activityType,
      title: titles[index] ?? "",
      startTime: startTimes[index] ?? "",
      endTime: endTimes[index] ?? "",
      description: descriptions[index] ?? "",
      equipmentId: equipmentIds[index] ?? "",
      location: locations[index] ?? "",
      contractorCompany: contractorCompanies[index] ?? "",
      personName: personNames[index] ?? "",
      notes: notes[index] ?? "",
    }))
    .filter((activity) =>
      [
        activity.title,
        activity.startTime,
        activity.endTime,
        activity.description,
        activity.equipmentId,
        activity.location,
        activity.contractorCompany,
        activity.personName,
        activity.notes,
      ].some((value) => value.trim().length > 0),
    );

  const activities: DailyLogFormInput["activities"] = [];
  const errors: string[] = [];

  rows.forEach((activity, index) => {
    const parsed = dailyLogActivitySchema.safeParse(activity);

    if (parsed.success) {
      activities.push(parsed.data);
      return;
    }

    parsed.error.issues.forEach((issue) => {
      errors.push(`Activity ${index + 1}: ${issue.message}`);
    });
  });

  if (errors.length > 0) {
    return {
      ok: false,
      errors: Array.from(new Set(errors)),
    };
  }

  return {
    ok: true,
    activities,
  };
}

function parseFormData(formData: FormData):
  | { ok: true; data: DailyLogFormInput }
  | { ok: false; state: DailyLogFormState } {
  const activityInput = parseActivities(formData);

  if (!activityInput.ok) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the activity rows and try again.",
        fieldErrors: {
          activities: activityInput.errors,
        },
      },
    };
  }

  const parsed = dailyLogFormSchema.safeParse({
    logDate: formData.get("logDate"),
    shift: formData.get("shift"),
    mineId: formData.get("mineId"),
    primaryEquipmentId: formData.get("primaryEquipmentId"),
    summary: formData.get("summary"),
    weatherConditions: formData.get("weatherConditions"),
    generalNotes: formData.get("generalNotes"),
    activities: activityInput.activities,
  });

  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  return { ok: true, data: parsed.data };
}

function activityCreateData(input: DailyLogFormInput) {
  const activityDate = toDateOnly(input.logDate);

  return input.activities.map((activity, index) => ({
    activityDate,
    sequence: index + 1,
    activityType: activity.activityType,
    title: activity.title,
    startTime: asNullable(activity.startTime),
    endTime: asNullable(activity.endTime),
    description: asNullable(activity.description),
    equipmentId: asNullable(activity.equipmentId),
    location: asNullable(activity.location),
    contractorCompany: asNullable(activity.contractorCompany),
    personName: asNullable(activity.personName),
    notes: asNullable(activity.notes),
  }));
}

export async function createDailyLogAction(
  _previousState: DailyLogFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  if (input.data.activities.some((activity) => activity.activityId)) {
    return errorState(
      "New Daily Log Activities cannot reuse existing Activity identities.",
    );
  }

  let dailyLogId: string;

  try {
    const dailyLog = await prisma.dailyLog.create({
      data: {
        logDate: toDateOnly(input.data.logDate),
        shift: input.data.shift,
        mineId: asNullable(input.data.mineId),
        primaryEquipmentId: asNullable(input.data.primaryEquipmentId),
        summary: input.data.summary,
        weatherConditions: asNullable(input.data.weatherConditions),
        generalNotes: asNullable(input.data.generalNotes),
        activities: {
          create: activityCreateData(input.data),
        },
      },
    });

    dailyLogId = dailyLog.id;
  } catch {
    return errorState("Daily Log could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/daily-logs");
  redirect(`/daily-logs/${dailyLogId}`);
}

export async function updateDailyLogAction(
  dailyLogId: string,
  _previousState: DailyLogFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    await updateDailyLogWithClient(prisma, dailyLogId, input.data);
  } catch (error) {
    return errorState(
      error instanceof LinkedDailyLogActivityEditError
        ? error.message
        : "Daily Log could not be updated. Review the fields and try again.",
    );
  }

  revalidatePath("/");
  revalidatePath("/daily-logs");
  revalidatePath(`/daily-logs/${dailyLogId}`);
  redirect(`/daily-logs/${dailyLogId}`);
}
