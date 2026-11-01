import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FolderKanban } from "lucide-react";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { QuotationAnalysis } from "@/components/cms/quotation-analysis";
import { HBar, IncomeExpenseChart } from "@/components/cms/charts";
import { PageHeader, Panel, PeriodSelect, Stat, StatGrid } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import {
  buildMonthlySeries,
  buildServiceAnalytics,
  downloadCsv,
  getGoalActual,
  getPreviousPeriodRange,
  getPeriodRange,
  getProjectFinancials,
  percentageChange,
  sumTransactions,
} from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/performance")({
  head: () =>
    meta("Business Performance", "Live financial and commercial performance for CYTIC Creatives."),
  component: Page,
});

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const [period, setPeriod] = useState("This quarter");
  const range = getPeriodRange(period);
  const previousRange = getPreviousPeriodRange(period);

  if (loading || error || !data) {
    return (
      <>
        <PageHeader
          title="Business Performance"
          description="Cash received, recorded expenditure and receivables from saved records."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const income =
    sumTransactions(data.transactions, "income", range) -
    sumTransactions(data.transactions, "refund", range);
  const expense = sumTransactions(data.transactions, "expense", range);
  const previousIncome =
    sumTransactions(data.transactions, "income", previousRange) -
    sumTransactions(data.transactions, "refund", previousRange);
  const previousExpense = sumTransactions(data.transactions, "expense", previousRange);
  const receivables = getProjectFinancials(data).reduce(
    (total, project) => total + project.outstanding,
    0,
  );
  const serviceRows = buildServiceAnalytics(data);
  const projectRows = getProjectFinancials(data);
  const chartData = buildMonthlySeries(data);

  return (
    <>
      <PageHeader
        title="Business Performance"
        description="Live cash received, recorded expenditure and project receivables. Quotes are not counted as income."
        actions={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "business-performance.csv",
                  projectRows.map((project) => ({
                    Project: project.name,
                    Client: project.client_name,
                    Contract: project.contract_value,
                    Received: project.received,
                    Costs: project.cost,
                    Margin: `${project.margin}%`,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
          </>
        }
      />
      <StatGrid>
        <Stat
          label="Cash received"
          value={formatMoney(income)}
          delta={percentageChange(income, previousIncome)}
          hint={`${period} · compared with prior period`}
        />
        <Stat
          label="Recorded expenditure"
          value={formatMoney(expense)}
          delta={percentageChange(expense, previousExpense)}
        />
        <Stat label="Net result" value={formatMoney(income - expense)} />
        <Stat
          label="Outstanding receivables"
          value={formatMoney(receivables)}
          hint="Open project value less payments received"
        />
      </StatGrid>
      <div className="mt-6">
        <QuotationAnalysis />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Revenue by period" className="lg:col-span-2">
          <IncomeExpenseChart data={chartData} />
        </Panel>
        <Panel title="Against goals">
          {data.goals.length ? (
            <ul className="space-y-5">
              {data.goals.slice(0, 4).map((goal) => {
                const actual = getGoalActual(goal, data);
                const pct = Math.min(100, Math.round((actual / Number(goal.target)) * 100));
                return (
                  <li key={goal.id}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span>{goal.name}</span>
                      <span className="tabular-nums text-muted-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-2 h-1.5" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No saved goals yet.</p>
          )}
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue by service category">
          <HBar data={serviceRows} dataKey="revenue" nameKey="service" money />
        </Panel>
        <Panel
          title="Projects & profitability"
          description="Project costs come from linked expense entries"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/analytics/projects">
                <FolderKanban className="size-4" /> View projects
              </Link>
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            {projectRows.length
              ? `${projectRows.length} project${projectRows.length === 1 ? "" : "s"} · ${formatMoney(receivables)} outstanding receivables`
              : "No projects have been added yet."}
          </p>
        </Panel>
      </div>
    </>
  );
}
