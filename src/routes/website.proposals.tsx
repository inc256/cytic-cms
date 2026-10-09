import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { formatMoney, proposals } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/proposals")({
  head: () => meta("Proposals", "Draft, preview and track client proposals."),
  component: Page,
});

function Page() {
  const [client, setClient] = useState("Ssali Motors");
  const [title, setTitle] = useState("Dealer website + CMS");
  const [items, setItems] = useState([{ d: "Discovery & UX", a: 2800000 }, { d: "Website design & build", a: 9500000 }, { d: "CMS setup & training", a: 3500000 }]);
  const total = items.reduce((s, i) => s + (Number(i.a) || 0), 0);
  return (
    <>
      <PageHeader title="Proposals" description="Proposals are commercial offers — they are never counted as income." />
      <ResourceTable entity="Proposal" rows={proposals} statusKey="status" searchKeys={["id", "client", "title"]}
        columns={[{ key: "id", label: "ID", className: "font-mono text-xs" }, { key: "client", label: "Client", className: "font-medium" }, { key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "validUntil", label: "Valid until" }, { key: "value", label: "Value", align: "right", render: (r) => formatMoney(r.value) }]} />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Proposal editor" description="Draft PRP-057">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="c">Client</Label><Input id="c" value={client} onChange={(e) => setClient(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="t">Title</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          </div>
          <p className="mt-6 text-xs font-medium text-muted-foreground">Line items</p>
          <div className="mt-2 space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label="Description" value={it.d} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, d: e.target.value } : x))} />
                <Input aria-label="Amount" type="number" className="w-36" value={it.a} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, a: Number(e.target.value) } : x))} />
                <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { d: "", a: 0 }])}><Plus className="size-4" /> Add line</Button>
            <Button size="sm" onClick={() => toast.success("Proposal saved as draft (demo)")}>Save draft</Button>
          </div>
        </Panel>
        <Panel title="Preview" flush>
          <div className="p-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold-foreground">Proposal</p>
            <h3 className="mt-2 text-xl font-semibold text-primary">{title || "Untitled proposal"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Prepared for {client || "—"} by CYTIC Creatives</p>
            <table className="mt-6 w-full text-sm"><tbody className="divide-y border-y">
              {items.map((it, i) => <tr key={i}><td className="py-2.5">{it.d || <span className="text-muted-foreground">Untitled item</span>}</td><td className="py-2.5 text-right tabular-nums">{formatMoney(Number(it.a) || 0)}</td></tr>)}
            </tbody></table>
            <div className="mt-4 flex justify-between text-sm font-semibold"><span>Total</span><span className="tabular-nums text-primary">{formatMoney(total)}</span></div>
            <p className="mt-6 text-[11px] text-muted-foreground">Valid for 21 days. 50% deposit on acceptance; balance on delivery.</p>
          </div>
        </Panel>
      </div>
    </>
  );
}
