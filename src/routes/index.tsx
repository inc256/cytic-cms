import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  FileText,
  Globe,
  Inbox,
  MessageSquare,
  PenSquare,
  Receipt,
  Send,
  Wallet,
} from "lucide-react";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { QuotationAnalysis } from "@/components/cms/quotation-analysis";
import {
  ConversionChart,
  IncomeExpenseChart,
  NetLineChart,
  ServiceDonut,
} from "@/components/cms/charts";
import { PageHeader, Panel, PeriodSelect, Stat, StatGrid } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import {
  buildMonthlySeries,
  buildServiceAnalytics,
  getPeriodRange,
  sumTransactions,
} from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { canAccessPath } from "@/lib/cms-access";

export const Route = createFileRoute("/")({
  head: () =>
    meta("Overview", "Live business, financial, and website activity for CYTIC Creatives."),
  component: Overview,
});

const ICONS: Record<string, typeof Inbox> = {
  quote: MessageSquare,
  payment: CircleDollarSign,
  proposal: Send,
  inquiry: Inbox,
  expense: CreditCard,
  content: Globe,
};

const actions = [
  { label: "Record income", icon: Banknote, to: "/analytics/finance" },
  { label: "Record expense", icon: Wallet, to: "/analytics/finance" },
  { label: "View receipts", icon: Receipt, to: "/analytics/receipts" },
  { label: "Review inquiries", icon: Inbox, to: "/website/inquiries" },
  { label: "View proposals", icon: FileText, to: "/website/proposals" },
  { label: "Edit website content", icon: PenSquare, to: "/website/portfolio" },
] as const;

function Overview() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const { state } = useAuth();
  const accessibleActions =
    state.status === "signed-in"
      ? actions.filter((action) => canAccessPath(state.role, action.to))
      : [];
  const [period, setPeriod] = useState("This month");
  const range = getPeriodRange(period);
  const chartData = useMemo(() => (data ? buildMonthlySeries(data) : []), [data]);

  if (loading || error || !data) {
    return (
      <>
        <PageHeader
          title="Business overview"
          description="Live finance and pipeline data from Supabase."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const income =
    sumTransactions(data.transactions, "income", range) -
    sumTransactions(data.transactions, "refund", range);
  const expenses = sumTransactions(data.transactions, "expense", range);
  const inquiries = data.quotes.filter((quote) => {
    const date = new Date(quote.created_at);
    return date >= range.start && date <= range.end;
  }).length;
  const activeProjects = data.projects.filter((project) => project.status === "In Progress").length;
  const pendingProposals = data.quotes.filter((quote) => quote.status === "Proposal Sent").length;
  const conversion = data.quotes.length
    ? Math.round(
        (data.quotes.filter((quote) =>
          ["Approved", "In Progress", "Completed"].includes(quote.status),
        ).length /
          data.quotes.length) *
          100,
      )
    : 0;
  const recentActivity = [
    ...data.transactions.map((transaction) => ({
      kind: transaction.transaction_type === "expense" ? "expense" : "payment",
      text: `${transaction.transaction_type === "expense" ? "Expense" : "Payment"} of ${formatMoney(transaction.amount)} recorded — ${transaction.party}`,
      time: transaction.transaction_date,
      sortDate: transaction.transaction_date,
      id: transaction.id,
    })),
    ...data.quotes.map((quote) => ({
      kind: "quote",
      text: `Quote request ${quote.quote_id} from ${quote.business_name}`,
      time: new Date(quote.created_at).toLocaleDateString(),
      sortDate: quote.created_at,
      id: quote.id,
    })),
  ]
    .sort((left, right) => new Date(right.sortDate).getTime() - new Date(left.sortDate).getTime())
    .slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        title="Business overview"
        description="Current business position from recorded Supabase data."
        actions={<PeriodSelect value={period} onChange={setPeriod} />}
      />
      <StatGrid>
        <Stat label="Income received" value={formatMoney(income)} hint={period} />
        <Stat label="Total expenditure" value={formatMoney(expenses)} hint={period} />
        <Stat
          label="Net operating result"
          value={formatMoney(income - expenses)}
          hint="Income less expenses and refunds"
        />
        <Stat
          label="Outstanding payments"
          value={formatMoney(
            data.projects.reduce((total, project) => {
              const received =
                sumTransactions(
                  data.transactions.filter((item) => item.project_id === project.id),
                  "income",
                ) -
                sumTransactions(
                  data.transactions.filter((item) => item.project_id === project.id),
                  "refund",
                );
              return total + Math.max(0, Number(project.contract_value) - received);
            }, 0),
          )}
          hint="Open contract value less payments"
        />
        <Stat label="New quote requests" value={String(inquiries)} hint={period} />
        <Stat label="Active projects" value={String(activeProjects)} />
        <Stat label="Proposal-stage requests" value={String(pendingProposals)} />
        <Stat label="Request approval rate" value={`${conversion}%`} hint="All quote requests" />
      </StatGrid>
      <div className="mt-6">
        <QuotationAnalysis />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          title="Income vs expenditure"
          description="Last six months of recorded transactions"
          className="lg:col-span-2"
        >
          <IncomeExpenseChart data={chartData} />
        </Panel>
        <Panel title="Revenue by service" description="Recorded payments, less refunds">
          <ServiceDonut
            data={buildServiceAnalytics(data).map(({ service, revenue }) => ({
              service,
              value: revenue,
            }))}
          />
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Quick actions" className="lg:order-last">
          <div className="grid grid-cols-2 gap-2">
            {accessibleActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                asChild
                className="h-auto flex-col items-start gap-2 whitespace-normal p-3 text-left hover:border-primary/40 hover:bg-primary-subtle"
              >
                <Link to={action.to}>
                  <action.icon className="size-4 text-primary" />
                  <span className="text-xs font-medium">{action.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </Panel>
        <Panel title="Recent activity" flush className="lg:col-span-2">
          {recentActivity.length ? (
            <ul className="divide-y">
              {recentActivity.map((item) => {
                const Icon = ICONS[item.kind] ?? Inbox;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-8 place-items-center rounded-md bg-primary-subtle text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1 text-sm text-foreground">{item.text}</span>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No recorded activity yet.
            </p>
          )}
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Inquiry & proposal conversion"
          description="From submitted quote request to approved work"
        >
          <ConversionChart data={chartData} />
        </Panel>
        <Panel
          title="Monthly business performance"
          description="Net result from recorded income and expenses"
        >
          <NetLineChart data={chartData} />
        </Panel>
      </div>
    </>
  );
}
