import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, StatusBadge } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import { downloadCsv, getProjectFinancials, type BusinessProject } from "@/lib/business-analytics";
import type { WebsiteService } from "@/lib/website-cms";
import { formatMoney } from "@/lib/format";
import { getSupabaseClient } from "@/lib/supabase";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/projects")({
  head: () => meta("Projects", "Manage projects and track their financial performance."),
  component: Page,
});

const PROJECT_STATUSES: BusinessProject["status"][] = [
  "In Progress",
  "Completed",
  "On Hold",
  "Cancelled",
];

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const {
    rows: services,
    loading: servicesLoading,
    error: servicesError,
  } = useWebsiteRows<WebsiteService>("cms_website_services", "sort_order");
  const { state } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<BusinessProject | null>(null);
  const [projectService, setProjectService] = useState("");
  const [saving, setSaving] = useState(false);
  const canManage = state.status === "signed-in" && state.role === "CEO";

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
        <PageHeader title="Projects" description="Manage projects and review their financials." />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const projects = getProjectFinancials(data);

  const openProject = (project?: BusinessProject) => {
    setEditingProject(project ?? null);
    setProjectService(
      serviceOptions.find((service) => service.label === project?.service_category)?.id ?? "",
    );
    setDialogOpen(true);
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
    const contractValue = Number(formData.get("value"));
    if (!Number.isSafeInteger(contractValue) || contractValue < 0) {
      toast.error("Contract value must be a non-negative whole-UGX amount.");
      return;
    }
    const project = {
      name: String(formData.get("name")).trim(),
      client_name: String(formData.get("client")).trim(),
      service_category: serviceCategory,
      contract_value: contractValue,
      status: String(formData.get("status") ?? "In Progress") as BusinessProject["status"],
    };
    if (!project.name || !project.client_name) {
      toast.error("Project name and client are required.");
      return;
    }
    setSaving(true);
    const result = editingProject
      ? await supabase.from("cms_projects").update(project).eq("id", editingProject.id)
      : await supabase.from("cms_projects").insert(project);
    setSaving(false);
    if (result.error) {
      toast.error(
        `Could not ${editingProject ? "update" : "create"} project: ${result.error.message}`,
      );
      return;
    }
    toast.success(editingProject ? "Project updated" : "Project created");
    setDialogOpen(false);
    setEditingProject(null);
    await refresh();
  };

  const updateProjectStatus = async (projectId: string, status: BusinessProject["status"]) => {
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
        title="Projects"
        description="Manage client projects, contract values, statuses, and linked financial performance."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "projects.csv",
                  projects.map((project) => ({
                    Reference: project.project_code,
                    Project: project.name,
                    Client: project.client_name,
                    Service: project.service_category,
                    Status: project.status,
                    Contract: project.contract_value,
                    Received: project.received,
                    Expenses: project.cost,
                    Outstanding: project.outstanding,
                    Margin: `${project.margin}%`,
                  })),
                )
              }
              disabled={!projects.length}
            >
              <Download className="size-4" /> Export
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => openProject()}>
                <Plus className="size-4" /> New project
              </Button>
            )}
          </>
        }
      />
      <div className="overflow-x-auto rounded-lg border bg-card shadow-soft">
        {projects.length ? (
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {[
                  "Reference",
                  "Project",
                  "Client",
                  "Service",
                  "Contract",
                  "Received",
                  "Expenses",
                  "Outstanding",
                  "Status",
                  ...(canManage ? ["Actions"] : []),
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-mono text-xs">{project.project_code}</td>
                  <td className="px-4 py-3 font-medium">{project.name}</td>
                  <td className="px-4 py-3">{project.client_name}</td>
                  <td className="px-4 py-3">{project.service_category}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(project.contract_value)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(project.received)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(project.cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(project.outstanding)}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        aria-label={`Status for ${project.name}`}
                        className="h-8 rounded-md border bg-background px-2"
                        value={project.status}
                        onChange={(event) =>
                          void updateProjectStatus(
                            project.id,
                            event.target.value as BusinessProject["status"],
                          )
                        }
                      >
                        {PROJECT_STATUSES.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={project.status} />
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openProject(project)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteProject(project)}
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
          <p className="p-8 text-center text-sm text-muted-foreground">
            No projects have been added yet.
          </p>
        )}
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          {projects.length} project{projects.length === 1 ? "" : "s"} · linked income and expenses
          update automatically
        </p>
      </div>

      {canManage && (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingProject(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProject ? "Edit project" : "New project"}</DialogTitle>
            </DialogHeader>
            <form
              key={editingProject?.id ?? "new"}
              id="project-form"
              onSubmit={(event) => void saveProject(event)}
              className="grid gap-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="project-name">Project name</Label>
                <Input id="project-name" name="name" defaultValue={editingProject?.name} required />
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
                    {servicesLoading
                      ? "Loading services…"
                      : servicesError
                        ? "Could not load services"
                        : "Select an existing service"}
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
                  step="1"
                  defaultValue={editingProject?.contract_value ?? 0}
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
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
            </form>
            <DialogFooter>
              <Button
                type="submit"
                form="project-form"
                disabled={
                  saving || servicesLoading || !serviceOptions.length || Boolean(servicesError)
                }
              >
                {saving ? "Saving…" : editingProject ? "Save changes" : "Create project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
