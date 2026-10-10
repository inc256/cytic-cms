import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceResourceLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/resources")({
  head: () => meta("Resources & Templates", "Approved design resources and templates."),
  component: WorkspaceResourceLibrary,
});
