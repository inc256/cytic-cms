import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceNoticeLibrary } from "@/components/cms/designer-workspace";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/designer-workspace/notices")({
  head: () => meta("Notices & Updates", "Important internal announcements for the design team."),
  component: WorkspaceNoticeLibrary,
});
