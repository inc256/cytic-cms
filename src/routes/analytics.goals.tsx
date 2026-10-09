import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { formatMoney, goals as seed } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/goals")({
  head: () => meta("Goals & Reports", "Set business targets and export financial reports."),
  component: Page,
});
const fmt = (v: number, u: string) => (u === "money" ? formatMoney(v) : u === "percent" ? `${v}%` : String(v));

function Page() {
  const [goals, setGoals] = useState(seed);
  const [name, setName] = useState(""); const [target, setTarget] = useState(""); const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Goals & Reports" description="Targets are measured against saved, recorded data only."
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New goal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5"><Label htmlFor="g">Goal name</Label><Input id="g" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 revenue target" /></div>
              <div className="grid gap-1.5"><Label htmlFor="t">Target (UGX)</Label><Input id="t" type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!name || !Number(target)) return toast.error("Name and a positive target are required");
              setGoals([...goals, { name, target: Number(target), actual: 0, unit: "money" }]); setOpen(false); setName(""); setTarget(""); toast.success("Goal created");
            }}>Create goal</Button></DialogFooter>
          </DialogContent>
        </Dialog>} />
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.actual / g.target) * 100));
          return (
            <Panel key={g.name}>
              <div className="flex items-start justify-between"><p className="text-sm font-medium">{g.name}</p><span className="text-xs tabular-nums text-muted-foreground">{pct}%</span></div>
              <Progress value={pct} className="mt-4 h-2" />
              <dl className="mt-4 grid grid-cols-3 text-xs">
                <div><dt className="text-muted-foreground">Target</dt><dd className="mt-0.5 font-medium tabular-nums">{fmt(g.target, g.unit)}</dd></div>
                <div><dt className="text-muted-foreground">Actual</dt><dd className="mt-0.5 font-medium tabular-nums">{fmt(g.actual, g.unit)}</dd></div>
                <div><dt className="text-muted-foreground">Remaining</dt><dd className="mt-0.5 font-medium tabular-nums">{fmt(Math.max(0, g.target - g.actual), g.unit)}</dd></div>
              </dl>
            </Panel>
          );
        })}
      </div>
      <Panel title="Reports" className="mt-6" flush>
        <ul className="divide-y">
          {["Income statement", "Expense breakdown", "Receivables ageing", "Service revenue report"].map((r) => (
            <li key={r} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{r}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toast("Preparing CSV", { description: r })}><FileDown className="size-4" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>PDF</Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
