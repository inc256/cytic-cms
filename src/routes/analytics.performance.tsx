import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Panel, PeriodSelect, Stat, StatGrid } from "@/components/cms/primitives";
import { HBar, IncomeExpenseChart } from "@/components/cms/charts";
import { formatMoney, goals, revenueByService } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/performance")({
  head: () => meta("Business Performance", "Consolidated financial and commercial performance for CYTIC Creatives."),
  component: Page,
});

const projects = [
  { name: "Booking website — Akwaaba", value: 19600000, cost: 7200000 },
  { name: "Wallet app UI — Nile Fintech", value: 18600000, cost: 5900000 },
  { name: "Roastery rebrand", value: 9000000, cost: 3400000 },
  { name: "Zuri merch drop", value: 3400000, cost: 1900000 },
];

function Page() {
  const [p, setP] = useState("This quarter");
  return (
    <>
      <PageHeader title="Business Performance" description="Cash received, recorded expenditure and receivables. Quotations and unpaid invoices are never counted as income."
        actions={<><PeriodSelect value={p} onChange={setP} /><Button variant="outline" size="sm"><Download className="size-4" /> Export</Button></>} />
      <StatGrid>
        <Stat label="Cash received" value={formatMoney(63600000)} delta={14} />
        <Stat label="Recorded expenditure" value={formatMoney(31500000)} delta={9} />
        <Stat label="Net result" value={formatMoney(32100000)} delta={19} />
        <Stat label="Outstanding receivables" value={formatMoney(24200000)} hint="Invoiced, not yet received" />
      </StatGrid>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Revenue by period" className="lg:col-span-2"><IncomeExpenseChart /></Panel>
        <Panel title="Against goals">
          <ul className="space-y-5">
            {goals.slice(0, 3).map((g) => {
              const pct = Math.min(100, Math.round((g.actual / g.target) * 100));
              return (
                <li key={g.name}>
                  <div className="flex justify-between text-sm"><span>{g.name}</span><span className="tabular-nums text-muted-foreground">{pct}%</span></div>
                  <Progress value={pct} className="mt-2 h-1.5" />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue by service category"><HBar data={revenueByService} dataKey="value" nameKey="service" money /></Panel>
        <Panel title="Project profitability" description="Only projects with recorded costs" flush>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-5 py-2.5 text-left font-medium">Project</th><th className="px-5 py-2.5 text-right font-medium">Value</th><th className="px-5 py-2.5 text-right font-medium">Margin</th></tr></thead>
            <tbody className="divide-y">
              {projects.map((r) => (
                <tr key={r.name}><td className="px-5 py-3">{r.name}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(r.value)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-success">{Math.round(((r.value - r.cost) / r.value) * 100)}%</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
