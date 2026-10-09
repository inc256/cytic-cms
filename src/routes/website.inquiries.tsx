import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { formatMoney, inquiries } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/inquiries")({
  head: () => meta("Inquiries & Leads", "Track inquiries and Self-Quote leads from first contact to won."),
  component: Page,
});
type L = (typeof inquiries)[number];
const stages = ["New", "Contacted", "Qualified", "Proposal sent", "Won", "Lost"];

function Page() {
  const [sel, setSel] = useState<L | null>(null);
  return (
    <>
      <PageHeader title="Inquiries & Leads" description="Every inquiry from the contact form, Self-Quote and referrals." />
      <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-6">
        {stages.map((s) => (
          <div key={s} className="bg-card px-4 py-3"><p className="text-[11px] text-muted-foreground">{s}</p><p className="mt-1 font-display text-lg font-semibold tabular-nums">{inquiries.filter((i) => i.status === s).length}</p></div>
        ))}
      </div>
      <ResourceTable entity="Lead" rows={inquiries} statusKey="status" searchKeys={["name", "company", "service"]} onRowClick={setSel}
        columns={[{ key: "id", label: "ID", className: "font-mono text-xs" }, { key: "name", label: "Contact", className: "font-medium" }, { key: "company", label: "Company" }, { key: "service", label: "Service" }, { key: "source", label: "Source" }, { key: "status", label: "Stage" }, { key: "budget", label: "Est. budget", align: "right", render: (r) => formatMoney(r.budget) }]}
        fields={[{ key: "name", label: "Contact name", required: true }, { key: "company", label: "Company" }, { key: "service", label: "Service", type: "select", options: ["Digital Products", "Brand Identity", "UI/UX Design", "Merchandise"] }, { key: "status", label: "Stage", type: "select", options: stages }, { key: "budget", label: "Est. budget (UGX)", type: "number" }, { key: "source", label: "Source", type: "select", options: ["Self-Quote", "Contact form", "Referral"] }]} />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="sm:max-w-md">
          {sel && (<>
            <SheetHeader><SheetTitle>{sel.name}</SheetTitle><SheetDescription>{sel.company} · {sel.id}</SheetDescription></SheetHeader>
            <div className="space-y-6 px-4">
              <StatusBadge status={sel.status} />
              <dl className="divide-y border-y text-sm">
                {([["Service", sel.service], ["Source", sel.source], ["Estimated budget", formatMoney(sel.budget)], ["Received", sel.date]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
              <div><p className="text-xs font-medium text-muted-foreground">History</p>
                <ol className="mt-2 space-y-2 border-l pl-4 text-sm"><li>Inquiry received via {sel.source}</li><li className="text-muted-foreground">Auto-acknowledgement email sent</li></ol></div>
              <Button asChild className="w-full"><Link to="/website/proposals">Create proposal</Link></Button>
            </div>
          </>)}
        </SheetContent>
      </Sheet>
    </>
  );
}
