import { describe, expect, it } from "vitest";

import {
  colorName,
  contrastRatio,
  generateHarmony,
  generateTones,
  hexToHsl,
  hexToRgb,
  hslToHex,
  isPaletteHarmony,
  normalizeHex,
  PALETTE_HARMONIES,
} from "@/lib/palette-creator";

describe("Palette Creator color tools", () => {
  it("normalizes valid three- and six-digit hex values and rejects malformed values", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("123456")).toBe("#123456");
    expect(normalizeHex("#ggg")).toBeNull();
    expect(normalizeHex("12345")).toBeNull();
  });

  it("converts between hex, RGB, and HSL", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToHsl("#FF0000")).toEqual({ h: 0, s: 100, l: 50 });
    expect(hslToHex(0, 100, 50)).toBe("#FF0000");
  });

  it("generates requested palette sizes for each harmony and tone scale", () => {
    for (const { id } of PALETTE_HARMONIES) {
      const output = generateHarmony("#7C5CFF", id, 7);
      expect(output).toHaveLength(7);
      expect(output.every((hex) => normalizeHex(hex) === hex)).toBe(true);
    }
    expect(generateTones("#336699", 5, "shades")).toHaveLength(5);
    expect(generateTones("#336699", 5, "tints")).toHaveLength(5);
  });

  it("identifies color names and computes WCAG contrast", () => {
    expect(colorName("#000000")).toBe("Black");
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 2);
  });

  it("validates persisted harmony selections", () => {
    expect(isPaletteHarmony("triadic")).toBe(true);
    expect(isPaletteHarmony("not-a-harmony")).toBe(false);
  });
});
