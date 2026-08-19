export const DRAGLINE_DELAY_CODE_CATALOG_VERSION = 1 as const;

export const DRAGLINE_DELAY_CODE_CATEGORIES = [
  "OPERATIONAL",
  "MECHANICAL",
  "ELECTRICAL",
] as const;

export type DraglineDelayCodeCategory =
  (typeof DRAGLINE_DELAY_CODE_CATEGORIES)[number];

export type DraglineDelayCode = Readonly<{
  code: string;
  description: string;
  category: DraglineDelayCodeCategory;
}>;

// Source: docs/reference/dragline-delay-reports/delay-code-catalog-v1.md.
// Wording and ordering intentionally preserve the source legend.
export const DRAGLINE_DELAY_CODES: readonly DraglineDelayCode[] = [
  { code: "0", description: "Normal Digging (WINDROW)", category: "OPERATIONAL" },
  { code: "1", description: "BackFILL", category: "OPERATIONAL" },
  { code: "2", description: "Pad Generation/ Rehandle/ Road Building", category: "OPERATIONAL" },
  { code: "4", description: "Holiday", category: "OPERATIONAL" },
  { code: "5", description: "Idled (Not Schedule to operate)", category: "OPERATIONAL" },
  { code: "6", description: "Weather", category: "OPERATIONAL" },
  { code: "7", description: "Fueling", category: "OPERATIONAL" },
  { code: "8", description: "Safety Inspection (MSHA, SWAT)", category: "OPERATIONAL" },
  { code: "9", description: "Other Meetings", category: "OPERATIONAL" },
  { code: "10", description: "Tour", category: "OPERATIONAL" },
  { code: "11", description: "Personnel-Absenteeism", category: "OPERATIONAL" },
  { code: "13", description: "Shift Change", category: "OPERATIONAL" },
  { code: "14", description: "Manuevering", category: "OPERATIONAL" },
  { code: "15", description: "Dozer Work", category: "OPERATIONAL" },
  { code: "17", description: "Load an Unload Supplies", category: "OPERATIONAL" },
  { code: "18", description: "Move Trailers/Boxes Move", category: "OPERATIONAL" },
  { code: "19", description: "Deadheading", category: "OPERATIONAL" },
  { code: "20", description: "Blasting", category: "OPERATIONAL" },
  { code: "22", description: "Rock Loading/Rock Bound", category: "OPERATIONAL" },
  { code: "24", description: "Training", category: "OPERATIONAL" },
  { code: "25", description: "Safety Meeting", category: "OPERATIONAL" },
  { code: "26", description: "Surveying", category: "OPERATIONAL" },
  { code: "27", description: "Obstruction- People / Equip. in radius", category: "OPERATIONAL" },
  { code: "30", description: "Cycle Bench with Bucket", category: "OPERATIONAL" },
  { code: "33", description: "Accident", category: "OPERATIONAL" },
  { code: "34", description: "Other (Explain)", category: "OPERATIONAL" },
  { code: "35", description: "Startup Check", category: "OPERATIONAL" },
  { code: "36", description: "Daily PM", category: "OPERATIONAL" },
  { code: "37", description: "Drag Ropes", category: "MECHANICAL" },
  { code: "38", description: "Hoist Ropes", category: "MECHANICAL" },
  { code: "39", description: "Dump Ropes", category: "MECHANICAL" },
  { code: "40", description: "Bucket/Rigging", category: "MECHANICAL" },
  { code: "41", description: "Lube Air System", category: "MECHANICAL" },
  { code: "42", description: "Drag Machinery", category: "MECHANICAL" },
  { code: "43", description: "Hoist Machinery", category: "MECHANICAL" },
  { code: "44", description: "Swing Machinery", category: "MECHANICAL" },
  { code: "45", description: "Propel Machinery", category: "MECHANICAL" },
  { code: "46", description: "Boom Mast /A-Frame", category: "MECHANICAL" },
  { code: "47", description: "Fairleads", category: "MECHANICAL" },
  { code: "48", description: "Rotating Frame", category: "MECHANICAL" },
  { code: "50", description: "Crawlers", category: "MECHANICAL" },
  { code: "51", description: "Scheduled PM", category: "MECHANICAL" },
  { code: "52", description: "Other (Explain)", category: "MECHANICAL" },
  { code: "53", description: "Teeth Adapters Shrouds", category: "MECHANICAL" },
  { code: "55", description: "Waiting on Parts (Mech.)", category: "MECHANICAL" },
  { code: "56", description: "Waiting on Mechanics", category: "MECHANICAL" },
  { code: "57", description: "Revolving Frame and Tub", category: "MECHANICAL" },
  { code: "58", description: "House", category: "MECHANICAL" },
  { code: "59", description: "Off Shift Maintenance", category: "MECHANICAL" },
  { code: "60", description: "Planned Outage", category: "MECHANICAL" },
  { code: "61", description: "Engine", category: "MECHANICAL" },
  { code: "74", description: "Pit Power Distribution/ Power Cable", category: "ELECTRICAL" },
  { code: "75", description: "Drag Motor/ Gen / Controls", category: "ELECTRICAL" },
  { code: "76", description: "Hoist Motor/ Gen / Controls", category: "ELECTRICAL" },
  { code: "77", description: "Swing Motor/ Gen / Controls", category: "ELECTRICAL" },
  { code: "78", description: "Propel Motor/ Gen / Controls", category: "ELECTRICAL" },
  { code: "79", description: "Exciter Set", category: "ELECTRICAL" },
  { code: "80", description: "MG sets PCM", category: "ELECTRICAL" },
  { code: "81", description: "High Voltage Equipment/ Transformer", category: "ELECTRICAL" },
  { code: "82", description: "Auxiliary Equipment (lights)", category: "ELECTRICAL" },
  { code: "83", description: "Waiting on Parts (Elec.)", category: "ELECTRICAL" },
  { code: "84", description: "Waiting on Electricians", category: "ELECTRICAL" },
  { code: "85", description: "Collector Rings", category: "ELECTRICAL" },
  { code: "86", description: "Misc. Electrical", category: "ELECTRICAL" },
  { code: "87", description: "Sync Motors", category: "ELECTRICAL" },
  { code: "88", description: "Induction Motors", category: "ELECTRICAL" },
] as const;

const delayCodeByCode = new Map(
  DRAGLINE_DELAY_CODES.map((entry) => [entry.code, entry]),
);

export function getDraglineDelayCode(code: string) {
  return delayCodeByCode.get(code);
}

export function searchDraglineDelayCodes(query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return DRAGLINE_DELAY_CODES;
  }

  return DRAGLINE_DELAY_CODES.filter(
    (entry) =>
      entry.code.includes(normalizedQuery) ||
      entry.description.toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function groupDraglineDelayCodes(
  entries: readonly DraglineDelayCode[] = DRAGLINE_DELAY_CODES,
) {
  return DRAGLINE_DELAY_CODE_CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  }));
}
