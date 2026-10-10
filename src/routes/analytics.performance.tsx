import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Download, Plus } from "lucide-react";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { HBar, IncomeExpenseChart } from "@/components/cms/charts";
import { PageHeader, Panel, PeriodSelect, Stat, StatGrid } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { getSupabaseClient } from "@/lib/supabase";
import { meta } from "@/lib/seo";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";

export const Route = createFileRoute("/analytics/performance")({
  head: () =>
    meta("Business Performance", "Live financial and commercial performance for CYTIC Creatives."),
  component: Page,
});

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const { state } = useAuth();
  const [period, setPeriod] = useState("This quarter");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const range = getPeriodRange(period);
  const canManageProjects = state.status === "signed-in" && state.role === "CEO";
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

  const updateProjectStatus = async (projectId: string, status: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase.from("cms_projects").update({ status }).eq("id", projectId);
    if (result.error) {
      toast.error(`Could not update project: ${result.error.message}`);
      return;
    }
    toast.success("Project status updated");
    await refresh();
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase.from("cms_projects").insert({
      name: String(formData.get("name")).trim(),
      client_name: String(formData.get("client")).trim(),
      service_category: String(formData.get("service")).trim(),
      contract_value: Number(formData.get("value")),
    });
    if (result.error) {
      toast.error(`Could not create project: ${result.error.message}`);
      return;
    }
    toast.success("Project created");
    setProjectDialogOpen(false);
    await refresh();
  };

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
            {canManageProjects && (
              <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4" /> New project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New project</DialogTitle>
                  </DialogHeader>
                  <form id="new-project" onSubmit={createProject} className="grid gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-name">Project name</Label>
                      <Input id="project-name" name="name" required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-client">Client</Label>
                      <Input id="project-client" name="client" required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-service">Service category</Label>
                      <Input id="project-service" name="service" required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-value">Contract value (UGX)</Label>
                      <Input id="project-value" name="value" type="number" min="0" required />
                    </div>
                  </form>
                  <DialogFooter>
                    <Button type="submit" form="new-project">
                      Create project
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
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
          flush
        >
          {projectRows.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Project</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Received</th>
                  <th className="px-5 py-2.5 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projectRows.map((project) => (
                  <tr key={project.id}>
                    <td className="px-5 py-3">{project.name}</td>
                    <td className="px-5 py-3">
                      {canManageProjects ? (
                        <Select
                          value={project.status}
                          onValueChange={(status) => void updateProjectStatus(project.id, status)}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["In Progress", "Completed", "On Hold", "Cancelled"].map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        project.status
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(project.received)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums font-medium ${project.margin >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {project.margin}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No projects have been added yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
