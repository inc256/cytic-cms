import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Clipboard,
  Copy,
  Palette,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type PaletteColor,
  type PaletteHarmony,
} from "@/lib/palette-creator";

const STORAGE_KEY = "cytic-cms-palette-creator-v1";
const MAX_PALETTE_SIZE = 12;
const DEFAULT_BASE = "#7C5CFF";

type SavedState = {
  colors: PaletteColor[];
  base: string;
  size: number;
  harmony: PaletteHarmony;
};

function makePalette(colors: string[]): PaletteColor[] {
  return colors.map((hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) throw new Error(`Invalid palette color: ${hex}`);
    return { id: crypto.randomUUID(), hex: normalized, name: colorName(normalized) };
  });
}

function contrastLabel(ratio: number): string {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "Fail";
}

function contrastTone(ratio: number): string {
  return ratio >= 4.5 ? "text-success" : ratio >= 3 ? "text-warning" : "text-destructive";
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${value}`);
  } catch (error) {
    toast.error(
      `Could not copy to clipboard: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function PaletteCreator() {
  const [colors, setColors] = useState<PaletteColor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [base, setBase] = useState(DEFAULT_BASE);
  const [baseDraft, setBaseDraft] = useState(DEFAULT_BASE.slice(1));
  const [size, setSize] = useState(5);
  const [harmony, setHarmony] = useState<PaletteHarmony>("complementary");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [adjustments, setAdjustments] = useState({ lightness: 0, saturation: 0, hue: 0 });
  const [loaded, setLoaded] = useState(false);
  const [exportFormat, setExportFormat] = useState<"jpg" | "pdf">("jpg");
  const [exporting, setExporting] = useState(false);

  const selectedIndex = colors.findIndex((color) => color.id === selectedId);
  const selectedColor = selectedIndex < 0 ? null : colors[selectedIndex]!;
  const baseTones = useMemo(() => generateTones(base, Math.min(10, size), "shades"), [base, size]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as Partial<SavedState>;
        const restored = Array.isArray(data.colors)
          ? data.colors.flatMap((color) => {
              if (
                color &&
                typeof color.id === "string" &&
                typeof color.name === "string" &&
                typeof color.hex === "string" &&
                normalizeHex(color.hex)
              ) {
                return [{ ...color, hex: normalizeHex(color.hex)! }];
              }
              return [];
            })
          : [];
        setColors(restored);
        setSelectedId(restored[0]?.id ?? null);
        const savedBase = typeof data.base === "string" ? normalizeHex(data.base) : null;
        if (savedBase) {
          setBase(savedBase);
          setBaseDraft(savedBase.slice(1));
        }
        if (typeof data.size === "number" && Number.isInteger(data.size)) {
          setSize(Math.max(2, Math.min(MAX_PALETTE_SIZE, data.size)));
        }
        if (isPaletteHarmony(data.harmony)) setHarmony(data.harmony);
      }
    } catch (error) {
      toast.error(
        `Could not restore your browser-saved palette: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const saved: SavedState = { colors, base, size, harmony };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      toast.error(
        `Could not save the palette in this browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [base, colors, harmony, loaded, size]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selectedColor) {
        if (window.getSelection()?.toString()) return;
        event.preventDefault();
        void copyText(selectedColor.hex);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !isEditing) {
        setColors((current) => current.filter((color) => color.id !== selectedId));
        setSelectedId(null);
      }
      if (!isEditing && event.key === "ArrowRight" && selectedIndex < colors.length - 1) {
        setSelectedId(colors[selectedIndex + 1]?.id ?? null);
      }
      if (!isEditing && event.key === "ArrowLeft" && selectedIndex > 0) {
        setSelectedId(colors[selectedIndex - 1]?.id ?? null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [colors, selectedColor, selectedId, selectedIndex]);

  const replaceOrAppend = (hexes: string[], announcement: string) => {
    const generated = makePalette(hexes);
    if (mode === "append") {
      setColors((current) => [...current, ...generated]);
      setSelectedId(generated[0]?.id ?? null);
    } else {
      setColors(generated);
      setSelectedId(generated[0]?.id ?? null);
    }
    toast.success(announcement);
  };

  const generate = (type: PaletteHarmony) => {
    setHarmony(type);
    replaceOrAppend(
      generateHarmony(base, type, size),
      `${PALETTE_HARMONIES.find((item) => item.id === type)?.label ?? "Palette"} generated`,
    );
  };

  const addBaseColor = () => {
    const color = makePalette([base])[0]!;
    setColors((current) => [...current, color]);
    setSelectedId(color.id);
    toast.success("Base color added");
  };

  const setBaseColor = (value: string) => {
    const normalized = normalizeHex(value);
    if (!normalized) {
      setBaseDraft(value.replace(/^#/, "").slice(0, 6).toUpperCase());
      return;
    }
    setBase(normalized);
    setBaseDraft(normalized.slice(1));
  };

  const updateColor = (id: string, patch: Partial<PaletteColor>) => {
    setColors((current) =>
      current.map((color) =>
        color.id === id
          ? {
              ...color,
              ...patch,
              ...(patch.hex
                ? { name: color.name === colorName(color.hex) ? colorName(patch.hex) : color.name }
                : {}),
            }
          : color,
      ),
    );
    setSelectedId(id);
  };

  const addTones = (hex: string, type: "shades" | "tints") => {
    const values = generateTones(hex, size, type);
    replaceOrAppend(values, `${values.length} ${type} added`);
  };

  const removeColor = (id: string) => {
    const index = colors.findIndex((color) => color.id === id);
    const remaining = colors.filter((color) => color.id !== id);
    setColors(remaining);
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
  };

  const randomizeAll = () => {
    if (!colors.length) return toast.error("Add colors before randomizing.");
    const hue = Math.random() * 360;
    const saturation = 40 + Math.random() * 50;
    setColors((current) =>
      current.map((color, index) => {
        const hex = hslToHex(
          hue + index * 35,
          Math.max(20, Math.min(100, saturation + (Math.random() - 0.5) * 30)),
          30 + (index / Math.max(1, current.length - 1)) * 50,
        );
        return { ...color, hex, name: colorName(hex) };
      }),
    );
    toast.success("Palette randomized");
  };

  const duplicateLast = () => {
    const last = colors.at(-1);
    if (!last) return toast.error("Add a color before duplicating.");
    const duplicate = { ...last, id: crypto.randomUUID(), name: `${last.name} copy` };
    setColors((current) => [...current, duplicate]);
    setSelectedId(duplicate.id);
  };

  const reverse = () => {
    if (colors.length < 2) return toast.error("At least two colors are needed to reverse.");
    setColors((current) => [...current].reverse());
  };

  const sortByLightness = () => {
    if (colors.length < 2) return toast.error("At least two colors are needed to sort.");
    setColors((current) => [...current].sort((a, b) => hexToHsl(a.hex).l - hexToHsl(b.hex).l));
  };

  const autoName = () => {
    if (!colors.length) return toast.error("Add colors before auto-naming.");
    setColors((current) => current.map((color) => ({ ...color, name: colorName(color.hex) })));
    toast.success("Colors renamed");
  };

  const harmonizeAll = () => {
    if (colors.length < 2) return toast.error("At least two colors are needed to harmonize.");
    const { h, s } = hexToHsl(colors[0]!.hex);
    setColors((current) =>
      current.map((color, index) => {
        const t = index / (current.length - 1);
        const hex = hslToHex(h, Math.max(20, s * (0.5 + t * 0.6)), 20 + t * 65);
        return { ...color, hex, name: colorName(hex) };
      }),
    );
    toast.success("Palette harmonized");
  };

  const applyAdjustments = () => {
    const current = hexToHsl(base);
    setBaseColor(
      hslToHex(
        current.h + adjustments.hue,
        current.s + adjustments.saturation,
        current.l + adjustments.lightness,
      ),
    );
    setAdjustments({ lightness: 0, saturation: 0, hue: 0 });
  };

  const clearPalette = () => {
    if (!colors.length) return;
    if (!window.confirm(`Remove all ${colors.length} colors from your palette?`)) return;
    setColors([]);
    setSelectedId(null);
  };

  const exportPalette = async () => {
    if (!colors.length) return toast.error("Add colors before exporting.");
    setExporting(true);
    try {
      const { jsPDF: PdfDocument } = await import("jspdf");
      if (exportFormat === "pdf") {
        const pdf = new PdfDocument({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 16;
        pdf.setTextColor(17, 24, 39);
        pdf.setFontSize(22);
        pdf.text("Palette Creator", margin, 22);
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          `${colors.length} colors · ${PALETTE_HARMONIES.find((item) => item.id === harmony)?.label}`,
          margin,
          29,
        );
        let y = 40;
        const cardGap = 5;
        const cardWidth = (pageWidth - margin * 2 - cardGap) / 2;
        for (const [index, color] of colors.entries()) {
          if (index > 0 && index % 2 === 0) y += 39;
          const x = margin + (index % 2) * (cardWidth + cardGap);
          const { r, g, b } = hexToRgb(color.hex);
          pdf.setFillColor(r, g, b);
          pdf.roundedRect(x, y, cardWidth, 23, 2, 2, "F");
          pdf.setTextColor(17, 24, 39);
          pdf.setFontSize(12);
          pdf.text(color.name, x, y + 29);
          pdf.setFontSize(10);
          pdf.text(color.hex, x + cardWidth - 28, y + 29);
          const rgbLabel = `RGB ${r}, ${g}, ${b}`;
          pdf.setTextColor(100, 116, 139);
          pdf.text(rgbLabel, x, y + 35);
        }
        pdf.save("cytic-palette.pdf");
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = 1500;
        canvas.height = Math.max(600, 210 + Math.ceil(colors.length / 3) * 230);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not create an image canvas.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#111827";
        context.font = "700 48px sans-serif";
        context.fillText("Palette Creator", 72, 88);
        context.fillStyle = "#64748b";
        context.font = "24px sans-serif";
        context.fillText(
          `${colors.length} colors · ${PALETTE_HARMONIES.find((item) => item.id === harmony)?.label}`,
          72,
          132,
        );
        const gap = 24;
        const cardWidth = (canvas.width - 144 - gap * 2) / 3;
        colors.forEach((color, index) => {
          const col = index % 3;
          const row = Math.floor(index / 3);
          const x = 72 + col * (cardWidth + gap);
          const y = 170 + row * 230;
          context.fillStyle = color.hex;
          context.fillRect(x, y, cardWidth, 135);
          context.fillStyle = "#111827";
          context.font = "700 25px sans-serif";
          context.fillText(color.name.slice(0, 25), x, y + 174);
          context.font = "22px monospace";
          context.fillText(color.hex, x, y + 207);
        });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("Image export failed."))),
            "image/jpeg",
            0.95,
          );
        });
        downloadBlob(blob, "cytic-palette.jpg");
      }
      toast.success(`${exportFormat.toUpperCase()} export downloaded`);
    } catch (error) {
      toast.error(
        `Could not export palette: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Designer Workspace"
        title="Palette Creator"
        description="Build color harmonies, tune shades, check contrast, and export palettes. This tool saves only in this browser and does not write to Supabase."
        actions={
          <>
            <label className="sr-only" htmlFor="palette-export-format">
              Export format
            </label>
            <select
              id="palette-export-format"
              aria-label="Export format"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={exportFormat}
              onChange={(event) => {
                if (event.target.value === "jpg" || event.target.value === "pdf") {
                  setExportFormat(event.target.value);
                }
              }}
            >
              <option value="jpg">JPG image</option>
              <option value="pdf">PDF document</option>
            </select>
            <Button variant="outline" onClick={clearPalette} disabled={!colors.length}>
              <Trash2 className="size-4" /> Clear
            </Button>
            <Button onClick={() => void exportPalette()} disabled={!colors.length || exporting}>
              <ArrowDownToLine className="size-4" /> {exporting ? "Exporting…" : "Export"}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(270px,340px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel
            title="Base color"
            description="Set a color to use as the source for new harmonies."
          >
            <div className="flex items-end gap-3">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Color picker
                <input
                  aria-label="Choose base color"
                  className="h-11 w-16 cursor-pointer rounded-md border bg-background p-1"
                  type="color"
                  value={base}
                  onChange={(event) => setBaseColor(event.target.value)}
                />
              </label>
              <label className="min-w-0 flex-1 space-y-1.5 text-xs text-muted-foreground">
                Hex value
                <Input
                  aria-label="Base color hex"
                  value={baseDraft}
                  maxLength={7}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/^#/, "")
                      .replace(/[^\da-f]/gi, "")
                      .slice(0, 6)
                      .toUpperCase();
                    setBaseDraft(value);
                    const normalized = normalizeHex(value);
                    if (normalized && value.length === 6) setBase(normalized);
                  }}
                  onBlur={() => {
                    const normalized = normalizeHex(baseDraft);
                    if (normalized) {
                      setBase(normalized);
                      setBaseDraft(normalized.slice(1));
                    } else setBaseDraft(base.slice(1));
                  }}
                />
              </label>
              <Button variant="outline" aria-label="Add base color" onClick={addBaseColor}>
                <Plus className="size-4" />
              </Button>
            </div>
          </Panel>

          <Panel title="Palette size" description="Generated scales contain 2–12 colors.">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                aria-label="Decrease palette size"
                disabled={size <= 2}
                onClick={() => setSize((value) => Math.max(2, value - 1))}
              >
                −
              </Button>
              <span className="font-display text-lg font-semibold tabular-nums">{size} colors</span>
              <Button
                variant="outline"
                aria-label="Increase palette size"
                disabled={size >= MAX_PALETTE_SIZE}
                onClick={() => setSize((value) => Math.min(MAX_PALETTE_SIZE, value + 1))}
              >
                +
              </Button>
            </div>
          </Panel>

          <Panel title="Color harmony" description="Choose a color theory rule to build a palette.">
            <div className="grid grid-cols-2 gap-2">
              {PALETTE_HARMONIES.map((item) => (
                <Button
                  key={item.id}
                  variant={harmony === item.id ? "default" : "outline"}
                  className="justify-start text-xs"
                  onClick={() => generate(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 rounded-md border p-1">
              {(["replace", "append"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  className={`rounded px-3 py-2 text-xs font-medium capitalize ${mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setMode(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {mode === "replace"
                ? "Replace creates a fresh palette."
                : "Append adds generated colors to the current palette."}
            </p>
          </Panel>

          <Panel
            title="Shade & tint generator"
            description="Click any preview swatch to copy its hex."
          >
            <div className="flex h-10 overflow-hidden rounded-md border">
              {baseTones.map((hex, index) => (
                <button
                  key={`${hex}-${index}`}
                  type="button"
                  aria-label={`Copy shade ${hex}`}
                  title={`Copy ${hex}`}
                  className="min-w-0 flex-1 transition-[flex] hover:flex-[1.5]"
                  style={{ backgroundColor: hex }}
                  onClick={() => void copyText(hex)}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => addTones(base, "shades")}>
                Add shades
              </Button>
              <Button variant="outline" size="sm" onClick={() => addTones(base, "tints")}>
                Add tints
              </Button>
            </div>
          </Panel>

          <Panel title="Fine adjustments" description="Adjust the base color before generating.">
            {(
              [
                ["lightness", "Lightness", -80, 80],
                ["saturation", "Saturation", -80, 80],
                ["hue", "Hue shift", -180, 180],
              ] as const
            ).map(([key, label, min, max]) => (
              <label
                key={key}
                className="mb-3 grid grid-cols-[78px_minmax(0,1fr)_42px] items-center gap-2 text-xs"
              >
                <span className="text-muted-foreground">{label}</span>
                <input
                  aria-label={label}
                  type="range"
                  min={min}
                  max={max}
                  value={adjustments[key]}
                  onChange={(event) =>
                    setAdjustments((current) => ({ ...current, [key]: Number(event.target.value) }))
                  }
                />
                <span className="text-right tabular-nums">{adjustments[key]}</span>
              </label>
            ))}
            <div className="mt-4 flex gap-2">
              <Button size="sm" className="flex-1" onClick={applyAdjustments}>
                Apply to base
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAdjustments({ lightness: 0, saturation: 0, hue: 0 })}
              >
                <RotateCcw className="size-4" /> Reset
              </Button>
            </div>
          </Panel>

          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={randomizeAll}>
                <Shuffle className="size-4" /> Randomize
              </Button>
              <Button variant="outline" size="sm" onClick={duplicateLast}>
                <Copy className="size-4" /> Duplicate last
              </Button>
              <Button variant="outline" size="sm" onClick={reverse}>
                <RotateCcw className="size-4" /> Reverse
              </Button>
              <Button variant="outline" size="sm" onClick={sortByLightness}>
                Sort lightness
              </Button>
              <Button variant="outline" size="sm" onClick={autoName}>
                Auto-name
              </Button>
              <Button variant="outline" size="sm" onClick={harmonizeAll}>
                <Palette className="size-4" /> Harmonize
              </Button>
            </div>
          </Panel>

          <Panel
            title="Accessibility"
            description={
              selectedColor
                ? `Contrast for ${selectedColor.hex}`
                : "Select a color to check its contrast."
            }
          >
            {selectedColor ? (
              <div className="space-y-2 text-sm">
                {(["#FFFFFF", "#000000"] as const).map((background) => {
                  const ratio = contrastRatio(selectedColor.hex, background);
                  return (
                    <div key={background} className="flex items-center justify-between gap-2">
                      <span>Against {background === "#FFFFFF" ? "white" : "black"}</span>
                      <span className="font-mono">{ratio.toFixed(2)}:1</span>
                      <span className={`font-semibold ${contrastTone(ratio)}`}>
                        {contrastLabel(ratio)}
                      </span>
                    </div>
                  );
                })}
                <p className="pt-1 text-xs text-muted-foreground">
                  WCAG contrast ratios; 4.5:1 is the AA target for normal text.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a color card to see white and black text contrast.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Palette workspace"
            description={`${colors.length} ${colors.length === 1 ? "color" : "colors"} · ${PALETTE_HARMONIES.find((item) => item.id === harmony)?.label ?? "Custom"}`}
            actions={
              <span className="text-xs text-muted-foreground">
                Ctrl/Cmd+C copy · ←/→ select · Delete remove
              </span>
            }
          >
            {colors.length ? (
              <>
                <div className="flex min-h-28 overflow-hidden rounded-lg border">
                  {colors.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={`Select ${color.name} ${color.hex}`}
                      aria-pressed={selectedId === color.id}
                      title={`${color.name} · ${color.hex}`}
                      className={`group relative min-w-5 flex-1 transition-[flex] hover:flex-[1.5] ${selectedId === color.id ? "ring-4 ring-inset ring-primary" : ""}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setSelectedId(color.id)}
                    >
                      <span className="absolute inset-x-1 bottom-2 truncate rounded bg-black/55 px-1 py-0.5 font-mono text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                        {color.hex}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Color details
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Choose a swatch to edit its color and name.
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {colors.map((color) => {
                    const rgb = hexToRgb(color.hex);
                    const hsl = hexToHsl(color.hex);
                    const white = contrastRatio(color.hex, "#FFFFFF");
                    const black = contrastRatio(color.hex, "#000000");
                    const miniShades = generateTones(color.hex, 5, "shades");
                    return (
                      <article
                        key={color.id}
                        className={`overflow-hidden rounded-lg border bg-card ${selectedId === color.id ? "border-primary ring-1 ring-primary" : ""}`}
                      >
                        <div className="relative h-24" style={{ backgroundColor: color.hex }}>
                          <input
                            type="color"
                            aria-label={`Edit ${color.name} color`}
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                            value={color.hex}
                            onFocus={() => setSelectedId(color.id)}
                            onChange={(event) =>
                              updateColor(color.id, { hex: event.target.value.toUpperCase() })
                            }
                          />
                          <div className="absolute right-2 top-2 flex gap-1">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-8"
                              aria-label={`Copy ${color.hex}`}
                              onClick={() => void copyText(color.hex)}
                            >
                              <Clipboard className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-8"
                              aria-label={`Add shades from ${color.hex}`}
                              onClick={() => addTones(color.hex, "shades")}
                            >
                              S
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="size-8"
                              aria-label={`Add tints from ${color.hex}`}
                              onClick={() => addTones(color.hex, "tints")}
                            >
                              T
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="size-8"
                              aria-label={`Remove ${color.name}`}
                              onClick={() => removeColor(color.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex h-6 overflow-hidden border-b">
                          {miniShades.map((hex, index) => (
                            <button
                              key={`${hex}-${index}`}
                              type="button"
                              aria-label={`Copy shade ${hex}`}
                              title={hex}
                              className="flex-1"
                              style={{ backgroundColor: hex }}
                              onClick={() => void copyText(hex)}
                            />
                          ))}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              className="font-mono text-sm font-semibold hover:text-primary"
                              onClick={() => void copyText(color.hex)}
                            >
                              {color.hex}
                            </button>
                            <span className="text-[11px] text-muted-foreground">
                              {colorName(color.hex)}
                            </span>
                          </div>
                          <Input
                            aria-label={`Name for ${color.hex}`}
                            value={color.name}
                            maxLength={48}
                            onFocus={() => setSelectedId(color.id)}
                            onChange={(event) =>
                              updateColor(color.id, { name: event.target.value })
                            }
                          />
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <button
                              className="rounded border px-2 py-1 font-mono hover:bg-muted"
                              onClick={() => void copyText(`${rgb.r}, ${rgb.g}, ${rgb.b}`)}
                            >
                              RGB
                            </button>
                            <button
                              className="rounded border px-2 py-1 font-mono hover:bg-muted"
                              onClick={() =>
                                void copyText(
                                  `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`,
                                )
                              }
                            >
                              HSL
                            </button>
                            <span className={`rounded border px-2 py-1 ${contrastTone(white)}`}>
                              W {white.toFixed(1)}:1
                            </span>
                            <span className={`rounded border px-2 py-1 ${contrastTone(black)}`}>
                              B {black.toFixed(1)}:1
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                <div>
                  <Palette className="mx-auto size-9 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">Your palette is empty</h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Pick a base color, then choose a harmony rule or add the base color to get
                    started.
                  </p>
                </div>
              </div>
            )}
          </Panel>

          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Palette data stays in this browser's local storage. It is not synced to Supabase or
            shared with other users.
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {selectedColor
          ? `${selectedColor.name}, ${selectedColor.hex} selected`
          : "No color selected"}
      </div>
    </div>
  );
}
