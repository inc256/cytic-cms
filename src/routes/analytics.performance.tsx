import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";

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
import { useWebsiteRows } from "@/hooks/use-website-rows";
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
  type BusinessProject,
} from "@/lib/business-analytics";
import type { WebsiteService } from "@/lib/website-cms";
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
  const {
    rows: services,
    loading: servicesLoading,
    error: servicesError,
  } = useWebsiteRows<WebsiteService>("cms_website_services", "sort_order");
  const { state } = useAuth();
  const [period, setPeriod] = useState("This quarter");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<BusinessProject | null>(null);
  const [projectService, setProjectService] = useState("");
  const range = getPeriodRange(period);
  const canManageProjects = state.status === "signed-in" && state.role === "CEO";
  const previousRange = getPreviousPeriodRange(period);
  const serviceOptions = useMemo(() => {
    const names = new Map(services.map((service) => [service.id, service.name]));
    return services.map((service) => ({
      id: service.id,
      label: service.parent_id
        ? `${names.get(service.parent_id) ?? "Service"} / ${service.name}`
        : service.name,
    }));
  }, [services]);

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

  const saveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const serviceCategory = serviceOptions.find((service) => service.id === projectService)?.label;
    if (!serviceCategory) {
      toast.error(servicesError ?? "Choose a service from the existing services list.");
      return;
    }
    const project = {
      name: String(formData.get("name")).trim(),
      client_name: String(formData.get("client")).trim(),
      service_category: serviceCategory,
      contract_value: Number(formData.get("value")),
      status: String(formData.get("status") ?? "In Progress"),
    };
    const result = editingProject
      ? await supabase.from("cms_projects").update(project).eq("id", editingProject.id)
      : await supabase.from("cms_projects").insert(project);
    if (result.error) {
      toast.error(
        `Could not ${editingProject ? "update" : "create"} project: ${result.error.message}`,
      );
      return;
    }
    toast.success(editingProject ? "Project updated" : "Project created");
    setProjectDialogOpen(false);
    setEditingProject(null);
    await refresh();
  };

  const openProject = (project?: BusinessProject) => {
    setEditingProject(project ?? null);
    setProjectService(
      serviceOptions.find((service) => service.label === project?.service_category)?.id ?? "",
    );
    setProjectDialogOpen(true);
  };

  const deleteProject = async (project: BusinessProject) => {
    if (
      !window.confirm(
        `Delete "${project.name}"? Linked transactions and invoices will remain but become unlinked.`,
      )
    ) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase.from("cms_projects").delete().eq("id", project.id);
    if (result.error) {
      toast.error(`Could not delete project: ${result.error.message}`);
      return;
    }
    toast.success("Project deleted");
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
                  <Button size="sm" onClick={() => openProject()}>
                    <Plus className="size-4" /> New project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingProject ? "Edit project" : "New project"}</DialogTitle>
                  </DialogHeader>
                  <form
                    key={editingProject?.id ?? "new"}
                    id="new-project"
                    onSubmit={saveProject}
                    className="grid gap-4"
                  >
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-name">Project name</Label>
                      <Input
                        id="project-name"
                        name="name"
                        defaultValue={editingProject?.name}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-client">Client</Label>
                      <Input
                        id="project-client"
                        name="client"
                        defaultValue={editingProject?.client_name}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-service">Service category</Label>
                      <select
                        id="project-service"
                        value={projectService}
                        onChange={(event) => setProjectService(event.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        <option value="" disabled>
                          {servicesError ? "Could not load services" : "Select an existing service"}
                        </option>
                        {serviceOptions.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.label}
                          </option>
                        ))}
                      </select>
                      {servicesError && <p className="text-xs text-destructive">{servicesError}</p>}
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-value">Contract value (UGX)</Label>
                      <Input
                        id="project-value"
                        name="value"
                        type="number"
                        min="0"
                        defaultValue={editingProject?.contract_value}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="project-status">Status</Label>
                      <select
                        id="project-status"
                        name="status"
                        defaultValue={editingProject?.status ?? "In Progress"}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {["In Progress", "Completed", "On Hold", "Cancelled"].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </form>
                  <DialogFooter>
                    <Button
                      type="submit"
                      form="new-project"
                      disabled={servicesLoading || !serviceOptions.length || Boolean(servicesError)}
                    >
                      {servicesLoading
                        ? "Loading services…"
                        : editingProject
                          ? "Save changes"
                          : "Create project"}
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
                  {canManageProjects && (
                    <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                  )}
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
                    {canManageProjects && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const record = data.projects.find((item) => item.id === project.id);
                              if (record) openProject(record);
                            }}
                          >
                            <Pencil className="size-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const record = data.projects.find((item) => item.id === project.id);
                              if (record) void deleteProject(record);
                            }}
                          >
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    )}
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
