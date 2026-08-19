import { describe, expect, it } from "vitest";

import {
  DRAGLINE_DELAY_CODES,
  DRAGLINE_DELAY_CODE_CATALOG_VERSION,
  getDraglineDelayCode,
  groupDraglineDelayCodes,
  searchDraglineDelayCodes,
} from "@/features/dragline-delay-reports/catalog";

describe("Dragline Delay Code Catalog V1", () => {
  it("preserves the verified 66-code category counts and unique identities", () => {
    expect(DRAGLINE_DELAY_CODE_CATALOG_VERSION).toBe(1);
    expect(DRAGLINE_DELAY_CODES).toHaveLength(66);
    expect(new Set(DRAGLINE_DELAY_CODES.map((entry) => entry.code)).size).toBe(66);
    expect(groupDraglineDelayCodes().map((group) => [group.category, group.entries.length])).toEqual([
      ["OPERATIONAL", 28],
      ["MECHANICAL", 23],
      ["ELECTRICAL", 15],
    ]);
  });

  it("preserves source wording rather than normalizing it", () => {
    expect(getDraglineDelayCode("1")?.description).toBe("BackFILL");
    expect(getDraglineDelayCode("14")?.description).toBe("Manuevering");
    expect(getDraglineDelayCode("17")?.description).toBe("Load an Unload Supplies");
    expect(getDraglineDelayCode("80")?.description).toBe("MG sets PCM");
    expect(getDraglineDelayCode("3")).toBeUndefined();
  });

  it("matches every entry in the canonical source-derived reference", () => {
    const reference = readFileSync(
      join(
        process.cwd(),
        "docs/reference/dragline-delay-reports/delay-code-catalog-v1.md",
      ),
      "utf8",
    );
    const transcribedEntries = [...reference.matchAll(/^\|\s*\d+\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|$/gm)].map(
      (match) => ({ code: match[1], description: match[2] }),
    );

    expect(transcribedEntries).toHaveLength(66);
    expect(
      DRAGLINE_DELAY_CODES.map(({ code, description }) => ({ code, description })),
    ).toEqual(transcribedEntries);
  });

  it("searches official codes and descriptions", () => {
    expect(searchDraglineDelayCodes("26").map((entry) => entry.code)).toContain("26");
    expect(searchDraglineDelayCodes("surveying")).toEqual([
      expect.objectContaining({ code: "26", category: "OPERATIONAL" }),
    ]);
    expect(searchDraglineDelayCodes("electricians")).toEqual([
      expect.objectContaining({ code: "84", category: "ELECTRICAL" }),
    ]);
  });
});
import { readFileSync } from "node:fs";
import { join } from "node:path";
