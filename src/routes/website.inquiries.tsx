import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import { getSupabaseClient } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/inquiries")({
  head: () => meta("Inquiries & Leads", "Review and update live quote requests."),
  component: Page,
});

type QuoteRequest = {
  id: string;
  quote_id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  preferred_contact: string;
  business_stage: string;
  industry: string;
  current_website: string | null;
  online_presence: string | null;
  project_description: string;
  selected_services: unknown;
  timeline: string;
  estimated_price: number;
  status: string;
  created_at: string;
};

const statuses = [
  "New",
  "Reviewing",
  "Contacted",
  "Proposal Sent",
  "Approved",
  "In Progress",
  "Completed",
  "Declined",
];

function servicesText(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  return (
    value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const entry = item as Record<string, unknown>;
          return String(entry["name"] ?? entry["label"] ?? entry["title"] ?? entry["id"] ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function Page() {
  const { state } = useAuth();
  const { rows, loading, error, refresh } = useWebsiteRows<QuoteRequest>("quote_requests");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<QuoteRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage =
    state.status === "signed-in" &&
    ["CEO", "CONTENT EDITOR", "PARTNER", "SECRETARY"].includes(state.role);
  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return rows.filter((row) =>
      `${row.quote_id} ${row.full_name} ${row.business_name} ${row.email} ${row.phone}`
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, query]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase.from("quote_requests").update({ status }).eq("id", id);
    if (result.error) {
      toast.error(`Could not update inquiry: ${result.error.message}`);
      return;
    }
    toast.success("Inquiry status updated");
    await refresh();
  };

  const editInquiry = (inquiry: QuoteRequest) => setEditing(inquiry);

  const saveInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    let selectedServices: unknown;
    try {
      selectedServices = JSON.parse(String(form.get("selected_services")));
      if (!Array.isArray(selectedServices)) throw new Error("Must be a JSON array.");
    } catch {
      toast.error("Services must be valid JSON in an array.");
      return;
    }
    const estimatedPrice = Number(form.get("estimated_price"));
    if (!Number.isFinite(estimatedPrice) || estimatedPrice < 0) {
      toast.error("Enter a valid non-negative estimate.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const result = await supabase
      .from("quote_requests")
      .update({
        full_name: String(form.get("full_name")).trim(),
        business_name: String(form.get("business_name")).trim(),
        email: String(form.get("email")).trim(),
        phone: String(form.get("phone")).trim(),
        preferred_contact: String(form.get("preferred_contact")).trim(),
        business_stage: String(form.get("business_stage")).trim(),
        industry: String(form.get("industry")).trim(),
        current_website: String(form.get("current_website")).trim() || null,
        online_presence: String(form.get("online_presence")).trim() || null,
        project_description: String(form.get("project_description")).trim(),
        selected_services: selectedServices,
        timeline: String(form.get("timeline")).trim(),
        estimated_price: estimatedPrice,
        status: String(form.get("status")),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (result.error) {
      toast.error(`Could not update inquiry: ${result.error.message}`);
      return;
    }
    toast.success("Inquiry updated");
    setEditing(null);
    await refresh();
  };

  const deleteInquiry = async (inquiry: QuoteRequest) => {
    if (!window.confirm(`Delete quote request ${inquiry.quote_id}? This cannot be undone.`)) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase.from("quote_requests").delete().eq("id", inquiry.id);
    if (result.error) {
      toast.error(`Could not delete inquiry: ${result.error.message}`);
      return;
    }
    toast.success("Inquiry deleted");
    await refresh();
  };

  return (
    <>
      <PageHeader
        title="Inquiries & Leads"
        description="Live requests submitted through the existing quote-request form."
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search inquiries"
          className="pl-8"
          aria-label="Search inquiries"
        />
      </div>
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          {filtered.length ? (
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {[
                    "Quote",
                    "Contact",
                    "Business",
                    "Services",
                    "Estimate",
                    "Received",
                    "Status",
                    "Details",
                    ...(canManage ? ["Actions"] : []),
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3 font-mono text-xs">{row.quote_id}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.full_name}</div>
                      <a className="text-xs text-primary underline" href={`mailto:${row.email}`}>
                        {row.email}
                      </a>
                      <div className="text-xs text-muted-foreground">{row.phone}</div>
                    </td>
                    <td className="px-3 py-3">{row.business_name}</td>
                    <td className="max-w-48 px-3 py-3">{servicesText(row.selected_services)}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                      {formatMoney(Number(row.estimated_price))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        value={row.status}
                        disabled={!canManage}
                        onValueChange={(value) => void updateStatus(row.id, value)}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="max-w-64 px-3 py-3 text-xs text-muted-foreground">
                      <details>
                        <summary className="cursor-pointer text-primary">View brief</summary>
                        <div className="mt-2 space-y-1">
                          <p>{row.project_description}</p>
                          <p>Industry: {row.industry}</p>
                          <p>Stage: {row.business_stage}</p>
                          <p>Timeline: {row.timeline}</p>
                          <p>Preferred contact: {row.preferred_contact}</p>
                          {row.current_website && <p>Website: {row.current_website}</p>}
                          {row.online_presence && <p>Online presence: {row.online_presence}</p>}
                        </div>
                      </details>
                    </td>
                    {canManage && (
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit inquiry ${row.quote_id}`}
                            onClick={() => editInquiry(row)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete inquiry ${row.quote_id}`}
                            onClick={() => void deleteInquiry(row)}
                          >
                            <Trash2 className="size-4" />
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
              {rows.length
                ? "No inquiries match this search."
                : "No quote requests have been received yet."}
            </p>
          )}
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {filtered.length} of {rows.length} live quote requests
          </div>
        </div>
      )}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit quote request {editing?.quote_id}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              id="edit-inquiry"
              onSubmit={(event) => void saveInquiry(event)}
              className="grid gap-4 sm:grid-cols-2"
            >
              {(
                [
                  ["full_name", "Contact name", editing.full_name],
                  ["business_name", "Business name", editing.business_name],
                  ["email", "Email", editing.email],
                  ["phone", "Phone", editing.phone],
                  ["preferred_contact", "Preferred contact", editing.preferred_contact],
                  ["business_stage", "Business stage", editing.business_stage],
                  ["industry", "Industry", editing.industry],
                  ["current_website", "Current website", editing.current_website ?? ""],
                  ["online_presence", "Online presence", editing.online_presence ?? ""],
                  ["timeline", "Timeline", editing.timeline],
                ] as const
              ).map(([name, label, value]) => (
                <div className="grid gap-1.5" key={name}>
                  <Label htmlFor={`inquiry-${name}`}>{label}</Label>
                  <Input
                    id={`inquiry-${name}`}
                    name={name}
                    type={name === "email" ? "email" : "text"}
                    defaultValue={value}
                    required={!["current_website", "online_presence"].includes(name)}
                  />
                </div>
              ))}
              <div className="grid gap-1.5">
                <Label htmlFor="inquiry-estimate">Estimated price</Label>
                <Input
                  id="inquiry-estimate"
                  name="estimated_price"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={editing.estimated_price}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inquiry-status">Status</Label>
                <select
                  id="inquiry-status"
                  name="status"
                  defaultValue={editing.status}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="inquiry-services">Selected services (JSON array)</Label>
                <Textarea
                  id="inquiry-services"
                  name="selected_services"
                  defaultValue={JSON.stringify(editing.selected_services, null, 2)}
                  rows={4}
                  required
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="inquiry-description">Project description</Label>
                <Textarea
                  id="inquiry-description"
                  name="project_description"
                  defaultValue={editing.project_description}
                  rows={4}
                />
              </div>
            </form>
          )}
          <DialogFooter>
            <Button type="submit" form="edit-inquiry" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
