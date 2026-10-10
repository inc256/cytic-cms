export type PaletteColor = { id: string; hex: string; name: string };
export type PaletteHarmony =
  | "complementary"
  | "analogous"
  | "triadic"
  | "tetradic"
  | "split-complementary"
  | "monochromatic"
  | "shades"
  | "tints";

export const PALETTE_HARMONIES: { id: PaletteHarmony; label: string }[] = [
  { id: "complementary", label: "Complementary" },
  { id: "analogous", label: "Analogous" },
  { id: "triadic", label: "Triadic" },
  { id: "tetradic", label: "Tetradic" },
  { id: "split-complementary", label: "Split complementary" },
  { id: "monochromatic", label: "Monochromatic" },
  { id: "shades", label: "Shades" },
  { id: "tints", label: "Tints" },
];

export function isPaletteHarmony(value: unknown): value is PaletteHarmony {
  return typeof value === "string" && PALETTE_HARMONIES.some((item) => item.id === value);
}

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) {
    return `#${hex
      .split("")
      .map((digit) => `${digit}${digit}`)
      .join("")
      .toUpperCase()}`;
  }
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) =>
      Math.round(Math.max(0, Math.min(255, value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

export function hexToHsl(hex: string) {
  const { r: red, g: green, b: blue } = hexToRgb(hex);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return rgbToHex(...(rgb.map((value) => (value + m) * 255) as [number, number, number]));
}

export function colorName(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  if (s < 10) {
    if (l < 15) return "Black";
    if (l < 35) return "Dark gray";
    if (l < 65) return "Gray";
    if (l < 85) return "Light gray";
    return "White";
  }
  const hue =
    h < 15 || h >= 345
      ? "Red"
      : h < 45
        ? "Orange"
        : h < 70
          ? "Yellow"
          : h < 160
            ? "Green"
            : h < 200
              ? "Cyan"
              : h < 255
                ? "Blue"
                : h < 290
                  ? "Purple"
                  : "Pink";
  if (l < 15) return `Deep ${hue}`;
  if (l < 30) return `Dark ${hue}`;
  if (l > 85) return `Pale ${hue}`;
  if (l > 70) return `Light ${hue}`;
  if (s > 70) return `Vivid ${hue}`;
  if (s < 30) return `Muted ${hue}`;
  return hue;
}

export function generateTones(hex: string, count: number, kind: "shades" | "tints"): string[] {
  const { h, s, l } = hexToHsl(hex);
  return Array.from({ length: count }, (_, index) => {
    const t = index / Math.max(1, count - 1);
    const lightness =
      kind === "shades" ? Math.max(5, l - t * (l - 5)) : Math.min(95, l + t * (95 - l));
    return hslToHex(h, s, lightness);
  });
}

export function generateHarmony(hex: string, harmony: PaletteHarmony, count: number): string[] {
  const { h, s, l } = hexToHsl(hex);
  let colors: string[];
  if (harmony === "complementary") colors = [hslToHex(h, s, l), hslToHex(h + 180, s, l)];
  else if (harmony === "analogous")
    colors = [hslToHex(h - 30, s, l), hslToHex(h, s, l), hslToHex(h + 30, s, l)];
  else if (harmony === "triadic")
    colors = [0, 120, 240].map((offset) => hslToHex(h + offset, s, l));
  else if (harmony === "tetradic")
    colors = [0, 90, 180, 270].map((offset) => hslToHex(h + offset, s, l));
  else if (harmony === "split-complementary")
    colors = [0, 150, 210].map((offset) => hslToHex(h + offset, s, l));
  else if (harmony === "monochromatic") {
    colors = Array.from({ length: count }, (_, i) => {
      const t = i / Math.max(1, count - 1);
      return hslToHex(h, Math.max(15, s * (0.65 + 0.35 * Math.sin(t * Math.PI))), 18 + t * 68);
    });
  } else return generateTones(hex, count, harmony);

  if (colors.length > count) {
    const step = colors.length / count;
    return Array.from({ length: count }, (_, i) => colors[Math.floor(i * step)]!);
  }
  if (colors.length < count) {
    const base = [...colors];
    for (let i = 0; colors.length < count; i += 1) {
      const current = hexToHsl(base[i % base.length]!);
      const cycle = Math.floor(i / base.length) + 1;
      const direction = cycle % 2 === 0 ? 1 : -1;
      colors.push(
        hslToHex(
          current.h,
          Math.max(10, Math.min(100, current.s + (direction === 1 ? -6 : 6) * cycle)),
          Math.max(8, Math.min(95, current.l + direction * 10 * cycle)),
        ),
      );
    }
  }
  return colors;
}

export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) =>
    Object.values(hexToRgb(hex))
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
