import { createFileRoute } from "@tanstack/react-router";
import { PaletteCreator } from "@/components/cms/palette-creator";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/palette-creator")({
  head: () => meta("Palette Creator", "Create and export color palettes in your browser."),
  component: PaletteCreator,
});
