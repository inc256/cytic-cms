import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { ConversionChart, NetLineChart } from "@/components/cms/charts";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/cms/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import {
  buildMonthlySeries,
  getPreviousPeriodRange,
  getPeriodRange,
  percentageChange,
  sumTransactions,
} from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/trends")({
  head: () => meta("Business Trends", "Compare business performance using live Supabase records."),
  component: Page,
});

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const [comparison, setComparison] = useState("quarter");
  const chartData = useMemo(() => (data ? buildMonthlySeries(data, 12) : []), [data]);

  if (loading || error || !data) {
    return (
      <>
        <PageHeader title="Business Trends" description="Changes show correlation, not cause." />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const current = getPeriodRange(comparison === "month" ? "This month" : "This quarter");
  const previous = getPreviousPeriodRange(comparison === "month" ? "This month" : "This quarter");
  const currentIncome =
    sumTransactions(data.transactions, "income", current) -
    sumTransactions(data.transactions, "refund", current);
  const previousIncome =
    sumTransactions(data.transactions, "income", previous) -
    sumTransactions(data.transactions, "refund", previous);
  const currentExpenses = sumTransactions(data.transactions, "expense", current);
  const previousExpenses = sumTransactions(data.transactions, "expense", previous);
  const currentQuotes = data.quotes.filter(
    (quote) =>
      new Date(quote.created_at) >= current.start && new Date(quote.created_at) <= current.end,
  );
  const previousQuotes = data.quotes.filter(
    (quote) =>
      new Date(quote.created_at) >= previous.start && new Date(quote.created_at) <= previous.end,
  );
  const acceptedStatuses = ["Approved", "In Progress", "Completed"];
  const currentAccepted = currentQuotes.filter((quote) =>
    acceptedStatuses.includes(quote.status),
  ).length;
  const completedProjects = data.projects.filter(
    (project) =>
      project.status === "Completed" &&
      new Date(project.created_at) >= current.start &&
      new Date(project.created_at) <= current.end,
  ).length;
  const growth = percentageChange(currentIncome, previousIncome);
  const expenseGrowth = percentageChange(currentExpenses, previousExpenses);
  const inquiryGrowth = percentageChange(currentQuotes.length, previousQuotes.length);
  const conversion = currentQuotes.length
    ? Math.round((currentAccepted / currentQuotes.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="Business Trends"
        description="Compare saved transaction, quote-request, and project data."
        actions={
          <Select value={comparison} onValueChange={setComparison}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quarter">This quarter vs previous quarter</SelectItem>
              <SelectItem value="month">This month vs previous month</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <StatGrid>
        <Stat
          label="Revenue growth"
          value={growth === undefined ? "—" : `${growth > 0 ? "+" : ""}${growth}%`}
          delta={growth}
          hint={growth === undefined ? "No prior-period income" : "vs previous period"}
        />
        <Stat
          label="Expense growth"
          value={
            expenseGrowth === undefined ? "—" : `${expenseGrowth > 0 ? "+" : ""}${expenseGrowth}%`
          }
          delta={expenseGrowth}
          hint={expenseGrowth === undefined ? "No prior-period expenses" : "vs previous period"}
        />
        <Stat label="Revenue received" value={formatMoney(currentIncome)} hint="Selected period" />
        <Stat
          label="Recorded expenses"
          value={formatMoney(currentExpenses)}
          hint="Selected period"
        />
        <Stat
          label="New quote requests"
          value={String(currentQuotes.length)}
          delta={inquiryGrowth}
          hint={inquiryGrowth === undefined ? "No prior-period requests" : "vs previous period"}
        />
        <Stat
          label="Proposal-stage requests"
          value={String(
            currentQuotes.filter((quote) =>
              ["Proposal Sent", "Approved", "In Progress", "Completed"].includes(quote.status),
            ).length,
          )}
        />
        <Stat
          label="Request approval rate"
          value={`${conversion}%`}
          hint={`${currentAccepted} accepted of ${currentQuotes.length}`}
        />
        <Stat label="Projects completed" value={String(completedProjects)} hint="Selected period" />
      </StatGrid>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Net result trend" description="Recorded income less refunds and expenses">
          <NetLineChart data={chartData} />
        </Panel>
        <Panel
          title="Quote request pipeline"
          description="Submitted requests progressing to approved work"
        >
          <ConversionChart data={chartData} />
        </Panel>
      </div>
    </>
  );
}
