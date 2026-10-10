import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDocumentLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/policies")({
  head: () => meta("Rules & Policies", "Read official CYTIC Creatives internal policies."),
  component: () => <WorkspaceDocumentLibrary type="policy" />,
});
