import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { SERVICES, formatMoney, pricing } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/quote")({
  head: () => meta("Self-Quote & Pricing", "Configure the public Self-Quote flow, starting prices and scope questions."),
  component: Page,
});

const steps = ["What do you need?", "Select specific services", "Define project scope", "Business & project info", "Expected timeline", "Contact details", "Review initial estimate", "Request a detailed proposal"];
const questions = [
  { q: "How many pages does the website need?", applies: "Websites", type: "Range · 1–30", rule: "+UGX 250,000 per page over 5" },
  { q: "Do you need e-commerce?", applies: "Websites", type: "Yes / No", rule: "+35% complexity" },
  { q: "Which platforms?", applies: "Applications", type: "Multi-select", rule: "+60% per extra platform" },
  { q: "Number of logo concepts", applies: "Logo design", type: "Select · 2/3/5", rule: "+UGX 300,000 per concept over 2" },
  { q: "Quantity of pieces", applies: "Promotional wear", type: "Number", rule: "Tiered: −10% over 100, −18% over 500" },
];

function Page() {
  const [avail, setAvail] = useState<Record<string, boolean>>(Object.fromEntries(SERVICES.map((s) => [s.id, true])));
  const [disc, setDisc] = useState("This Self-Quote is an initial estimate only. It is not a final quotation, invoice, contract or binding commercial offer. A detailed proposal will follow a review of your requirements.");
  return (
    <>
      <PageHeader title="Self-Quote & Pricing" description="Manage what clients see when they estimate a project. Final totals are always recalculated on the server." />
      <Tabs defaultValue="flow">
        <TabsList><TabsTrigger value="flow">Flow</TabsTrigger><TabsTrigger value="pricing">Pricing rules</TabsTrigger><TabsTrigger value="questions">Scope questions</TabsTrigger><TabsTrigger value="disclaimer">Disclaimer</TabsTrigger></TabsList>
        <TabsContent value="flow" className="mt-4 grid gap-6 lg:grid-cols-3">
          <Panel title="Public quote steps" className="lg:col-span-2" flush>
            <ol className="divide-y">{steps.map((s, i) => (
              <li key={s} className="flex items-center gap-4 px-5 py-3 text-sm"><span className="grid size-7 place-items-center rounded-full bg-primary-subtle text-xs font-semibold tabular-nums text-primary">{i + 1}</span>{s}</li>
            ))}</ol>
          </Panel>
          <Panel title="Service availability" description="Step 1 shows all available pillars">
            <ul className="space-y-4">{SERVICES.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3">
                <div><Label htmlFor={s.id} className="text-sm">{s.name}</Label><p className="text-xs text-muted-foreground">{s.short}</p></div>
                <Switch id={s.id} checked={avail[s.id] ?? false} onCheckedChange={(v) => setAvail({ ...avail, [s.id]: v })} />
              </li>
            ))}</ul>
          </Panel>
        </TabsContent>
        <TabsContent value="pricing" className="mt-4">
          <ResourceTable entity="Price rule" rows={pricing.map((p) => ({ ...p, status: p.active ? "Active" : "Inactive" }))} statusKey="status" searchKeys={["service", "item"]}
            columns={[{ key: "service", label: "Service" }, { key: "item", label: "Item", className: "font-medium" }, { key: "unit", label: "Per" }, { key: "status", label: "Status" }, { key: "base", label: "Starting price", align: "right", render: (r) => formatMoney(r.base) }]}
            fields={[{ key: "item", label: "Item", required: true }, { key: "service", label: "Service", type: "select", options: ["Digital Products", "Brand Identity", "UI/UX Design", "Merchandise"] }, { key: "base", label: "Starting price (UGX)", type: "number", required: true }, { key: "unit", label: "Per", type: "select", options: ["project", "screen", "piece", "page"] }]} />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <ResourceTable entity="Question" rows={questions} searchKeys={["q", "applies"]}
            columns={[{ key: "q", label: "Question", className: "font-medium" }, { key: "applies", label: "Applies to" }, { key: "type", label: "Input" }, { key: "rule", label: "Pricing rule", className: "text-muted-foreground" }]}
            fields={[{ key: "q", label: "Question", required: true }, { key: "applies", label: "Applies to", type: "select", options: ["Websites", "Applications", "Logo design", "Campaigns", "Graphic design", "Promotional wear", "Packaging"] }, { key: "type", label: "Input type" }, { key: "rule", label: "Pricing rule" }]} />
        </TabsContent>
        <TabsContent value="disclaimer" className="mt-4">
          <Panel title="Estimate disclaimer" description="Shown on the review step and in the estimate email">
            <Textarea value={disc} onChange={(e) => setDisc(e.target.value)} rows={4} />
            <div className="mt-4 flex items-start gap-2 rounded-md border border-gold/40 bg-warning-subtle p-3 text-xs text-gold-foreground"><AlertTriangle className="size-4 shrink-0" />{disc}</div>
            <Button className="mt-4" size="sm" onClick={() => toast.success("Disclaimer saved (demo)")}>Save disclaimer</Button>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
