import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { SERVICES } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/services")({
  head: () => meta("Services & Categories", "Manage CYTIC's four service pillars and the services within them."),
  component: Page,
});

const svc = [
  { name: "Websites", category: "Digital Products", status: "Published" },
  { name: "Web & mobile apps", category: "Digital Products", status: "Published" },
  { name: "Logo design", category: "Brand Identity & Logo Design", status: "Published" },
  { name: "Brand guidelines", category: "Brand Identity & Logo Design", status: "Published" },
  { name: "UX research", category: "UI/UX Design", status: "Draft" },
  { name: "Interface design", category: "UI/UX Design", status: "Published" },
  { name: "Promotional wear", category: "Merchandise Branding", status: "Published" },
  { name: "Packaging", category: "Merchandise Branding", status: "Draft" },
];

function Page() {
  return (
    <>
      <PageHeader title="Services & Categories" description="The four pillars shown on the website and in the Self-Quote flow." />
      <div className="mb-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((s, i) => (
          <div key={s.id} className="bg-card p-5">
            <p className="text-xs tabular-nums text-gold-foreground">0{i + 1}</p>
            <p className="mt-2 font-display text-sm font-semibold">{s.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.short}</p>
          </div>
        ))}
      </div>
      <ResourceTable entity="Service" rows={svc} statusKey="status" searchKeys={["name", "category"]}
        columns={[{ key: "name", label: "Service", className: "font-medium" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }]}
        fields={[{ key: "name", label: "Service name", required: true }, { key: "category", label: "Category", type: "select", options: SERVICES.map((s) => s.name) }, { key: "status", label: "Status", type: "select", options: ["Draft", "Published"] }]} />
    </>
  );
}
