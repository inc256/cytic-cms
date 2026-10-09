import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { pages } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/pages")({
  head: () => meta("Pages & Sections", "Manage the pages and sections of the CYTIC public website."),
  component: () => (
    <>
      <PageHeader title="Pages & Sections" description="Edit page structure, section order and publishing status." />
      <ResourceTable entity="Page" rows={pages} statusKey="status" searchKeys={["title", "slug"]}
        columns={[{ key: "title", label: "Page", className: "font-medium" }, { key: "slug", label: "URL", className: "font-mono text-xs text-muted-foreground" }, { key: "sections", label: "Sections", align: "right" }, { key: "status", label: "Status" }, { key: "updated", label: "Last updated" }]}
        fields={[{ key: "title", label: "Page title", required: true }, { key: "slug", label: "URL slug", required: true }, { key: "sections", label: "Sections", type: "number" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Published"] }]} />
    </>
  ),
});
