import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, FileText, Inbox, PenSquare, Receipt, Wallet, CreditCard, Globe, CircleDollarSign, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, PeriodSelect, Stat, StatGrid } from "@/components/cms/primitives";
import { ConversionChart, IncomeExpenseChart, NetLineChart, ServiceDonut } from "@/components/cms/charts";
import { activity, formatMoney } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => meta("Overview", "A summary of CYTIC Creatives' finances, pipeline and website activity."),
  component: Overview,
});

const ICONS: Record<string, typeof Inbox> = { quote: MessageSquare, payment: CircleDollarSign, proposal: Send, inquiry: Inbox, expense: CreditCard, content: Globe };

const actions = [
  { label: "Record income", icon: Banknote, to: "/analytics/finance" },
  { label: "Record expense", icon: Wallet, to: "/analytics/finance" },
  { label: "Create receipt", icon: Receipt, to: "/analytics/receipts" },
  { label: "Review inquiries", icon: Inbox, to: "/website/inquiries" },
  { label: "Create proposal", icon: FileText, to: "/website/proposals" },
  { label: "Edit website content", icon: PenSquare, to: "/website/pages" },
] as const;

function Overview() {
  const [period, setPeriod] = useState("This month");
  return (
    <>
      <PageHeader eyebrow="Friday, 9 October 2026" title="Good afternoon, Amara"
        description="Here's where CYTIC stands. Figures shown are demo records until the finance ledger is connected."
        actions={<PeriodSelect value={period} onChange={setPeriod} />} />

      <StatGrid>
        <Stat label="Income received" value={formatMoney(12600000)} delta={-12} hint="vs Sep (month to date)" />
        <Stat label="Total expenditure" value={formatMoney(5400000)} delta={-8} />
        <Stat label="Net operating result" value={formatMoney(7200000)} delta={4} />
        <Stat label="Outstanding payments" value={formatMoney(24200000)} hint="Across 3 active projects" />
        <Stat label="New inquiries" value="14" delta={18} />
        <Stat label="Active projects" value="6" hint="2 due this month" />
        <Stat label="Pending proposals" value="2" hint="UGX 25.2M in value" />
        <Stat label="Quote-to-client rate" value="33%" delta={5} />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Income vs expenditure" description="Cash received and recorded expenses, last 6 months" className="lg:col-span-2">
          <IncomeExpenseChart />
        </Panel>
        <Panel title="Revenue by service" description="Year to date, received only"><ServiceDonut /></Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Quick actions" className="lg:order-last">
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <Button key={a.label} variant="outline" asChild className="h-auto flex-col items-start gap-2 whitespace-normal p-3 text-left hover:border-primary/40 hover:bg-primary-subtle">
                <Link to={a.to}><a.icon className="size-4 text-primary" /><span className="text-xs font-medium">{a.label}</span></Link>
              </Button>
            ))}
          </div>
        </Panel>
        <Panel title="Recent activity" flush className="lg:col-span-2">
          <ul className="divide-y">
            {activity.map((a) => {
              const I = ICONS[a.kind] ?? Inbox;
              return (
                <li key={a.text} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 place-items-center rounded-md bg-primary-subtle text-primary"><I className="size-4" /></span>
                  <span className="flex-1 text-sm text-foreground">{a.text}</span>
                  <span className="text-xs text-muted-foreground">{a.time}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Inquiry & proposal conversion" description="From first contact to accepted proposal"><ConversionChart /></Panel>
        <Panel title="Monthly business performance" description="Net result (income − expenditure)"><NetLineChart /></Panel>
      </div>
    </>
  );
}
