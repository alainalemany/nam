import { describe, expect, it } from "vitest";

import {
  calculateStationAdvance,
  formatStationNotation,
  parseStationNotation,
} from "@/features/dragline-delay-reports/station";

describe("Dragline station helpers", () => {
  it("normalizes strict station notation to absolute feet", () => {
    expect(parseStationNotation("50+30")).toEqual({
      stationNumber: 50,
      offsetFeet: 30,
      absoluteFeet: 5030,
    });
    expect(parseStationNotation("51+20").absoluteFeet).toBe(5120);
  });

  it("formats normalized feet and derives boundary-crossing advance", () => {
    expect(formatStationNotation(5090)).toBe("50+90");
    expect(formatStationNotation(5120)).toBe("51+20");
    expect(calculateStationAdvance(5090, 5120)).toBe(30);
    expect(calculateStationAdvance(5030, 5060)).toBe(30);
  });

  it.each(["50+3", "50 +30", "050+30", "50+100", "-1+20", "station 50+30"])(
    "rejects malformed notation %s",
    (value) => expect(() => parseStationNotation(value)).toThrow(),
  );

  it("keeps unresolved reverse movement unsupported", () => {
    expect(() => calculateStationAdvance(5060, 5030)).toThrow(/Reverse/);
  });
});
