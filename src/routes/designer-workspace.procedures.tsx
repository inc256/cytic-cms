import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDocumentLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/procedures")({
  head: () => meta("Work Procedures", "Follow current standard design procedures."),
  component: () => <WorkspaceDocumentLibrary type="procedure" />,
});
