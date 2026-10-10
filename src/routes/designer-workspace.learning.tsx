import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDocumentLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/learning")({
  head: () =>
    meta("Learning & Development", "Designer learning materials and development resources."),
  component: () => <WorkspaceDocumentLibrary type="learning" />,
});
