import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
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
  head: () => meta("Services & Categories", "Manage service categories stored in Supabase."),
  component: Page,
});

const empty = { name: "", category: "", description: "", status: "Draft", sort_order: "0" };

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

  const edit = (service?: WebsiteService) => {
    setEditing(service ?? null);
    setForm(
      service
        ? {
            name: service.name,
            category: service.category,
            description: service.description,
            status: service.status,
            sort_order: String(service.sort_order),
          }
        : empty,
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
          category: form.category.trim(),
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

  return (
    <>
      <PageHeader
        title="Services & Categories"
        description="Manage the live service categories used by the website and quote workflow."
        actions={
          <Button size="sm" onClick={() => edit()}>
            <Plus className="size-4" /> New service
          </Button>
        }
      />
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading &&
        !error &&
        (services.length ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {["Service", "Category", "Description", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((service) => (
                  <tr key={service.id}>
                    <td className="px-4 py-3 font-medium">{service.name}</td>
                    <td className="px-4 py-3">{service.category}</td>
                    <td className="max-w-sm truncate px-4 py-3 text-muted-foreground">
                      {service.description}
                    </td>
                    <td className="px-4 py-3">{service.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => edit(service)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void remove(service)}>
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No services yet. Create one to get started.
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
                <Label htmlFor="service-category">Category *</Label>
                <Input
                  id="service-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                />
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
