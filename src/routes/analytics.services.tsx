import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { HBar } from "@/components/cms/charts";
import { formatMoney } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/services")({
  head: () => meta("Service Analytics", "Interest, conversion and revenue across CYTIC's four service pillars."),
  component: Page,
});

const rows = [
  { service: "Digital Products", inquiries: 48, quotes: 31, accepted: 9, completed: 7, revenue: 54200000 },
  { service: "Brand Identity & Logo", inquiries: 62, quotes: 44, accepted: 14, completed: 12, revenue: 38100000 },
  { service: "UI/UX Design", inquiries: 29, quotes: 18, accepted: 6, completed: 5, revenue: 26800000 },
  { service: "Merchandise Branding", inquiries: 33, quotes: 26, accepted: 11, completed: 10, revenue: 12500000 },
];
const combos = [
  { combo: "Brand Identity + Merchandise", count: 14 },
  { combo: "UI/UX + Digital Products", count: 11 },
  { combo: "Brand Identity + Digital", count: 8 },
  { combo: "All four pillars", count: 2 },
];
type K = keyof (typeof rows)[number];

function Page() {
  const [sort, setSort] = useState<K>("revenue");
  const sorted = [...rows].sort((a, b) => (typeof a[sort] === "number" ? (b[sort] as number) - (a[sort] as number) : 0));
  const heads: [K, string][] = [["inquiries", "Inquiries"], ["quotes", "Quotes requested"], ["accepted", "Accepted"], ["completed", "Completed"], ["revenue", "Revenue received"]];
  return (
    <>
      <PageHeader title="Service Analytics" description="Self-Quote interest is shown separately from completed, paid work." />
      <Panel title="Performance by service" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              <th className="px-5 py-2.5 text-left font-medium">Service</th>
              {heads.map(([k, l]) => (
                <th key={k} className="px-5 py-2.5 text-right font-medium">
                  <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${sort === k ? "text-primary" : ""}`}>{l}<ArrowUpDown className="size-3" /></button>
                </th>
              ))}
              <th className="px-5 py-2.5 text-right font-medium">Avg. value</th><th className="px-5 py-2.5 text-right font-medium">Conversion</th>
            </tr></thead>
            <tbody className="divide-y">
              {sorted.map((r) => (
                <tr key={r.service} className="hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">{r.service}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.inquiries}</td><td className="px-5 py-3 text-right tabular-nums">{r.quotes}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.accepted}</td><td className="px-5 py-3 text-right tabular-nums">{r.completed}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(r.revenue)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(Math.round(r.revenue / r.completed))}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-primary">{Math.round((r.accepted / r.inquiries) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Most requested in Self-Quote" description="Expressed interest, not sales"><HBar data={rows} dataKey="quotes" nameKey="service" /></Panel>
        <Panel title="Common service combinations"><HBar data={combos} dataKey="count" nameKey="combo" /></Panel>
      </div>
    </>
  );
}
