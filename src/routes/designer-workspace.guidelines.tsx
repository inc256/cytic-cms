import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDocumentLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/guidelines")({
  head: () => meta("Guidelines & Handbook", "Published CYTIC Creatives design guidelines."),
  component: () => <WorkspaceDocumentLibrary type="guideline" />,
});
