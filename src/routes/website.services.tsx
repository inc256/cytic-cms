import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import { deleteWebsiteRow, saveWebsiteRow, type WebsiteService } from "@/lib/website-cms";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/services")({
  head: () => meta("Services", "Manage services and their sub-services."),
  component: Page,
});

const empty = { name: "", parent_id: "", description: "", status: "Draft", sort_order: "0" };

async function createServiceCatalogPdf(services: WebsiteService[]): Promise<jsPDF> {
  const { jsPDF: PdfDocument } = await import("jspdf");
  const pdf = new PdfDocument({ format: "a4" });
  const navy: [number, number, number] = [0, 7, 93];
  const gold: [number, number, number] = [190, 157, 91];
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 18;
  const right = pageWidth - left;
  const serviceWidth = 54;
  const descriptionWidth = right - left - serviceWidth - 22;
  const serviceX = left + 3;
  const descriptionX = left + serviceWidth + 3;
  const statusX = right - 3;

  const childrenByParent = new Map<string, WebsiteService[]>();
  for (const service of services) {
    if (!service.parent_id) continue;
    const siblings = childrenByParent.get(service.parent_id) ?? [];
    siblings.push(service);
    childrenByParent.set(service.parent_id, siblings);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  const orderedServices: WebsiteService[] = [];
  const includedIds = new Set<string>();
  const addService = (service: WebsiteService) => {
    if (includedIds.has(service.id)) return;
    orderedServices.push(service);
    includedIds.add(service.id);
    for (const child of childrenByParent.get(service.id) ?? []) addService(child);
  };
  for (const root of services
    .filter((service) => !service.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))) {
    addService(root);
  }
  for (const service of services) addService(service);

  const addPageHeader = (continued: boolean) => {
    if (continued) {
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("CYTIC Creatives  |  Service Catalog", left, 16);
      return 34;
    }

    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 48, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("CYTIC Creatives", left, 22);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Identity that hits differently.", left, 30);
    pdf.setTextColor(...gold);
    pdf.setFontSize(10);
    pdf.text("SERVICE CATALOG", right, 22, { align: "right" });
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.text(`${services.length} service${services.length === 1 ? "" : "s"}`, right, 31, {
      align: "right",
    });
    pdf.setTextColor(80, 80, 90);
    pdf.setFontSize(9);
    pdf.text(`Prepared ${new Date().toLocaleDateString()}`, left, 60);
    return 72;
  };

  const addTableHeader = (y: number) => {
    pdf.setFillColor(245, 246, 250);
    pdf.rect(left, y - 6, right - left, 10, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(55, 55, 65);
    pdf.setFontSize(8);
    pdf.text("SERVICE", serviceX, y);
    pdf.text("DESCRIPTION", descriptionX, y);
    pdf.text("STATUS", statusX, y, { align: "right" });
    return y + 10;
  };

  let y = addTableHeader(addPageHeader(false));
  for (const service of orderedServices) {
    const parent = service.parent_id
      ? services.find((candidate) => candidate.id === service.parent_id)
      : undefined;
    const serviceName = parent ? `${parent.name} / ${service.name}` : service.name;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const serviceLines = pdf.splitTextToSize(serviceName, serviceWidth - 6);
    const descriptionLines = pdf.splitTextToSize(service.description || "-", descriptionWidth - 6);
    const lineCount = Math.max(serviceLines.length, descriptionLines.length, 1);
    const rowHeight = Math.max(11, lineCount * 4 + 6);

    if (y + rowHeight > pageHeight - 18) {
      pdf.addPage();
      y = addTableHeader(addPageHeader(true));
    }

    pdf.setDrawColor(225, 227, 233);
    pdf.line(left, y + rowHeight - 2, right, y + rowHeight - 2);
    pdf.setTextColor(30, 30, 35);
    pdf.setFont("helvetica", parent ? "normal" : "bold");
    pdf.text(serviceLines, serviceX, y + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 90);
    pdf.text(descriptionLines, descriptionX, y + 2);
    pdf.setTextColor(
      service.status === "Published" ? 35 : 120,
      service.status === "Published" ? 115 : 120,
      service.status === "Published" ? 75 : 130,
    );
    pdf.text(service.status, statusX, y + 2, { align: "right" });
    y += rowHeight;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(225, 227, 233);
    pdf.line(left, pageHeight - 14, right, pageHeight - 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 120);
    pdf.text("CYTIC Creatives | Service Catalog", left, pageHeight - 8);
    pdf.text(`Page ${page} of ${pageCount}`, right, pageHeight - 8, { align: "right" });
  }

  return pdf;
}

function Page() {
  const {
    rows: services,
    loading,
    error,
    refresh,
  } = useWebsiteRows<WebsiteService>("cms_website_services", "sort_order");
  const [editing, setEditing] = useState<WebsiteService | null>(null);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const roots = useMemo(() => services.filter((service) => !service.parent_id), [services]);
  const childrenByParent = useMemo(() => {
    const grouped = new Map<string, WebsiteService[]>();
    for (const service of services) {
      if (!service.parent_id) continue;
      const siblings = grouped.get(service.parent_id) ?? [];
      siblings.push(service);
      grouped.set(service.parent_id, siblings);
    }
    return grouped;
  }, [services]);
  const rows = useMemo(
    () =>
      roots.flatMap((parent) => [
        parent,
        ...(expanded.includes(parent.id) ? (childrenByParent.get(parent.id) ?? []) : []),
      ]),
    [childrenByParent, expanded, roots],
  );

  const edit = (service?: WebsiteService, parentId = "") => {
    setEditing(service ?? null);
    setForm(
      service
        ? {
            name: service.name,
            parent_id: service.parent_id ?? "",
            description: service.description,
            status: service.status,
            sort_order: String(service.sort_order),
          }
        : { ...empty, parent_id: parentId },
    );
    setOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveWebsiteRow(
        "cms_website_services",
        {
          name: form.name.trim(),
          parent_id: form.parent_id || null,
          description: form.description.trim(),
          status: form.status,
          sort_order: Number(form.sort_order) || 0,
        },
        editing?.id,
      );
      toast.success(editing ? "Service updated" : "Service created");
      setOpen(false);
      await refresh();
    } catch (saveError) {
      toast.error(
        `Could not save service: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (service: WebsiteService) => {
    const childCount = childrenByParent.get(service.id)?.length ?? 0;
    if (
      !window.confirm(
        childCount
          ? `Delete "${service.name}" and its ${childCount} sub-service${childCount === 1 ? "" : "s"}?`
          : `Delete "${service.name}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteWebsiteRow("cms_website_services", service.id);
      toast.success("Service deleted");
      await refresh();
    } catch (removeError) {
      toast.error(
        `Could not delete service: ${removeError instanceof Error ? removeError.message : String(removeError)}`,
      );
    }
  };

  const downloadCatalog = async () => {
    setExporting(true);
    try {
      const pdf = await createServiceCatalogPdf(services);
      pdf.save(`cytic-service-catalog-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (exportError) {
      toast.error(
        `Could not create service catalog PDF: ${exportError instanceof Error ? exportError.message : String(exportError)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Services"
        description="Organize your offerings into parent services and sub-services, such as Digital Products → Web Development."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void downloadCatalog()}
              disabled={!services.length || exporting}
            >
              <Download className="size-4" /> {exporting ? "Preparing PDF…" : "Download PDF"}
            </Button>
            <Button size="sm" onClick={() => edit()}>
              <Plus className="size-4" /> New parent service
            </Button>
          </>
        }
      />
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading &&
        !error &&
        (services.length ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {["Service hierarchy", "Description", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((service) => {
                  const parent = roots.find((root) => root.id === service.parent_id);
                  const subServices = childrenByParent.get(service.id) ?? [];
                  const isExpanded = expanded.includes(service.id);
                  return (
                    <tr key={service.id} className={parent ? "bg-muted/20" : ""}>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-2 ${parent ? "pl-8" : ""}`}>
                          {!parent && subServices.length > 0 ? (
                            <button
                              type="button"
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${service.name}`}
                              aria-expanded={isExpanded}
                              className="rounded p-1 hover:bg-muted"
                              onClick={() =>
                                setExpanded((current) =>
                                  isExpanded
                                    ? current.filter((id) => id !== service.id)
                                    : [...current, service.id],
                                )
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-6" />
                          )}
                          <div>
                            <p className={`font-medium ${parent ? "text-muted-foreground" : ""}`}>
                              {service.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {parent ? `Sub-service of ${parent.name}` : "Parent service"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-sm truncate px-4 py-3 text-muted-foreground">
                        {service.description || "—"}
                      </td>
                      <td className="px-4 py-3">{service.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => edit(service)}>
                            <Pencil className="size-4" /> Edit
                          </Button>
                          {!parent && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setExpanded((current) =>
                                  current.includes(service.id) ? current : [...current, service.id],
                                );
                                edit(undefined, service.id);
                              }}
                            >
                              <Plus className="size-4" /> Add sub-service
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => void remove(service)}>
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No services yet. Create a parent service, then add sub-services beneath it.
          </p>
        ))}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={(event) => void save(event)}
            className="w-full max-w-lg space-y-4 rounded-xl bg-background p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {editing ? "Edit service" : "New service"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="service-name">Service name *</Label>
                <Input
                  id="service-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="service-parent">Parent service</Label>
                <select
                  id="service-parent"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.parent_id}
                  onChange={(event) => setForm({ ...form, parent_id: event.target.value })}
                >
                  <option value="">None — this is a parent service</option>
                  {roots
                    .filter((parent) => parent.id !== editing?.id)
                    .map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Leave empty for a top-level service, or choose one to create a sub-service.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="service-description">Description</Label>
                <Textarea
                  id="service-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="service-status">Status</Label>
                <select
                  id="service-status"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option>Draft</option>
                  <option>Published</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="service-order">Display order</Label>
                <Input
                  id="service-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save service"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
