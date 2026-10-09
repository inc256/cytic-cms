import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/cms/primitives";
import { ConversionChart, NetLineChart } from "@/components/cms/charts";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/trends")({
  head: () => meta("Business Trends", "Compare CYTIC's growth, acquisition and conversion across periods."),
  component: Page,
});

function Page() {
  const [cmp, setCmp] = useState("q3-q2");
  return (
    <>
      <PageHeader title="Business Trends" description="Comparing Jul–Sep 2026 with Apr–Jun 2026. Changes show correlation, not cause."
        actions={<Select value={cmp} onValueChange={setCmp}><SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="q3-q2">Q3 2026 vs Q2 2026</SelectItem><SelectItem value="sep-aug">Sep vs Aug 2026</SelectItem><SelectItem value="ytd">2026 YTD vs 2025 YTD</SelectItem></SelectContent></Select>} />
      <StatGrid>
        <Stat label="Revenue growth" value="+28%" delta={28} hint="vs comparison period" />
        <Stat label="Expense growth" value="+17%" delta={17} hint="vs comparison period" />
        <Stat label="New clients" value="11" delta={22} />
        <Stat label="Repeat clients" value="4" hint="Not enough history to compare" />
        <Stat label="Inquiry volume" value="90" delta={26} />
        <Stat label="Quote → proposal" value="43%" delta={3} />
        <Stat label="Proposal acceptance" value="49%" delta={-2} />
        <Stat label="Projects completed" value="9" delta={12} />
      </StatGrid>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Net result trend"><NetLineChart /></Panel>
        <Panel title="Pipeline trend"><ConversionChart /></Panel>
      </div>
    </>
  );
}
