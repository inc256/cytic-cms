import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { portfolio } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/portfolio")({
  head: () => meta("Portfolio & Case Studies", "Curate the case studies shown on the CYTIC website."),
  component: () => (
    <>
      <PageHeader title="Portfolio & Case Studies" description="Featured projects appear on the home page." />
      <ResourceTable entity="Case study" rows={portfolio.map((p) => ({ ...p, featured: p.featured ? "Yes" : "—" }))} statusKey="status" searchKeys={["title", "service"]}
        columns={[{ key: "title", label: "Project", className: "font-medium" }, { key: "service", label: "Service" }, { key: "year", label: "Year" }, { key: "featured", label: "Featured" }, { key: "status", label: "Status" }]}
        fields={[{ key: "title", label: "Project title", required: true }, { key: "service", label: "Service", type: "select", options: ["Digital Products", "Brand Identity", "UI/UX Design", "Merchandise"] }, { key: "year", label: "Year", type: "number" }, { key: "status", label: "Status", type: "select", options: ["Draft", "In review", "Published"] }]} />
    </>
  ),
});
