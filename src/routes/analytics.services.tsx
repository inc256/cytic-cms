import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { HBar } from "@/components/cms/charts";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import { buildServiceAnalytics, buildServiceCombinations } from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/services")({
  head: () => meta("Service Analytics", "Live quote interest and recorded revenue by service."),
  component: Page,
});

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const [sort, setSort] = useState<"inquiries" | "quotes" | "accepted" | "completed" | "revenue">(
    "revenue",
  );
  const rows = useMemo(() => (data ? buildServiceAnalytics(data) : []), [data]);
  const sorted = [...rows].sort((a, b) => b[sort] - a[sort]);
  const combinations = data ? buildServiceCombinations(data) : [];

  if (loading || error || !data) {
    return (
      <>
        <PageHeader
          title="Service Analytics"
          description="Quote interest and recognized revenue from saved Supabase records."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const heads = [
    ["inquiries", "Inquiries"],
    ["quotes", "Quotes requested"],
    ["accepted", "Accepted"],
    ["completed", "Completed"],
    ["revenue", "Revenue received"],
  ] as const;

  return (
    <>
      <PageHeader
        title="Service Analytics"
        description="Expressed service interest comes from submitted quote requests; revenue comes only from recorded payments."
      />
      <Panel title="Performance by service" flush>
        <div className="overflow-x-auto">
          {sorted.length ? (
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Service</th>
                  {heads.map(([key, label]) => (
                    <th key={key} className="px-5 py-2.5 text-right font-medium">
                      <button
                        onClick={() => setSort(key)}
                        className={`inline-flex items-center gap-1 hover:text-foreground ${sort === key ? "text-primary" : ""}`}
                      >
                        {label}
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-2.5 text-right font-medium">Avg. completed value</th>
                  <th className="px-5 py-2.5 text-right font-medium">Quote conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((row) => (
                  <tr key={row.service} className="hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">{row.service}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.inquiries}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.quotes}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.accepted}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.completed}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(row.revenue)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(row.averageValue)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-primary">
                      {row.conversion}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No quote requests or categorized payments have been recorded yet.
            </p>
          )}
        </div>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Most requested in Self-Quote" description="Expressed interest, not sales">
          {rows.length ? (
            <HBar data={rows} dataKey="quotes" nameKey="service" />
          ) : (
            <p className="text-sm text-muted-foreground">No service interest recorded yet.</p>
          )}
        </Panel>
        <Panel title="Common service combinations">
          {combinations.length ? (
            <HBar data={combinations} dataKey="count" nameKey="combo" />
          ) : (
            <p className="text-sm text-muted-foreground">No service combinations recorded yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
