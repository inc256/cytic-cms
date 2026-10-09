import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { articles } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/blog")({
  head: () => meta("Blog & Articles", "Write, schedule and publish CYTIC articles."),
  component: () => (
    <>
      <PageHeader title="Blog & Articles" description="Drafts, scheduled posts and published articles." />
      <ResourceTable entity="Article" rows={articles} statusKey="status" searchKeys={["title", "author", "category"]}
        columns={[{ key: "title", label: "Title", className: "font-medium" }, { key: "category", label: "Category" }, { key: "author", label: "Author" }, { key: "status", label: "Status" }, { key: "date", label: "Publish date" }]}
        fields={[{ key: "title", label: "Title", required: true }, { key: "category", label: "Category", type: "select", options: ["Branding", "UI/UX", "Digital", "Merchandise"] }, { key: "date", label: "Publish date", type: "date" }, { key: "author", label: "Author" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Scheduled", "Published"] }]} />
    </>
  ),
});
