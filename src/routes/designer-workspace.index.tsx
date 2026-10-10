import { createFileRoute } from "@tanstack/react-router";
import { DesignerWorkspaceOverview } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/")({
  head: () =>
    meta("Designer Workspace", "Internal CYTIC Creatives designer guidance and resources."),
  component: DesignerWorkspaceOverview,
});
