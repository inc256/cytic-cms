import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDocumentLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/checklist")({
  head: () =>
    meta("Quality Checklist", "Use the published quality checklist before submitting design work."),
  component: () => <WorkspaceDocumentLibrary type="checklist" />,
});
