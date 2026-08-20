import { describe, expect, it } from "vitest";

import {
  calculateStationAdvance,
  formatStationNotation,
  parseStationNotation,
} from "@/features/dragline-delay-reports/station";

describe("Dragline section helpers", () => {
  it("accepts one- or two-digit section offsets and normalizes to absolute feet", () => {
    expect(parseStationNotation("16+0")).toEqual({
      stationNumber: 16,
      offsetFeet: 0,
      absoluteFeet: 1600,
    });
    expect(parseStationNotation("16+5").absoluteFeet).toBe(1605);
    expect(parseStationNotation("16+10").absoluteFeet).toBe(1610);
    expect(parseStationNotation("16+99").absoluteFeet).toBe(1699);
    expect(parseStationNotation("0+0").absoluteFeet).toBe(0);
    expect(parseStationNotation("0+20").absoluteFeet).toBe(20);
  });

  it("formats normalized feet and derives boundary-crossing advance", () => {
    expect(formatStationNotation(5090)).toBe("50+90");
    expect(formatStationNotation(5120)).toBe("51+20");
    expect(calculateStationAdvance(5090, 5120)).toBe(30);
    expect(calculateStationAdvance(5030, 5060)).toBe(30);
    expect(calculateStationAdvance(1600, 1620)).toBe(20);
    expect(calculateStationAdvance(1690, 1720)).toBe(30);
  });

  it.each(["50 +30", "050+30", "16+100", "-1+20", "section 16+20"])(
    "rejects malformed notation %s",
    (value) => expect(() => parseStationNotation(value)).toThrow(),
  );

  it("uses absolute distance when station order decreases", () => {
    expect(calculateStationAdvance(5060, 5030)).toBe(30);
  });
});
