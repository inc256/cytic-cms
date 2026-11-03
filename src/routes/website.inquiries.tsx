import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Mail,
  Pencil,
  Phone,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function serviceNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const entry = item as Record<string, unknown>;
        return String(entry["name"] ?? entry["label"] ?? entry["title"] ?? entry["id"] ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function formatRequestDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

function Page() {
  const { state } = useAuth();
  const { rows, loading, error, refresh } = useWebsiteRows<QuoteRequest>("quote_requests");
  const [query, setQuery] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [editing, setEditing] = useState<QuoteRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage =
    state.status === "signed-in" &&
    ["CEO", "CONTENT EDITOR", "PARTNER", "SECRETARY"].includes(state.role);
  const canUpdateStatus = canManage || (state.status === "signed-in" && state.role === "FINANCE");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
      setStatusMessage(`Could not update quote request: ${result.error.message}`);
      return;
    }
    toast.success("Inquiry status updated");
    setStatusMessage("Quote request status updated successfully.");
    setSelectedQuote((current) => (current?.id === id ? { ...current, status } : current));
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
    setSelectedQuote((current) => (current?.id === inquiry.id ? null : current));
    await refresh();
  };

  return (
    <>
      <PageHeader
        title="Landing Page Quotes"
        description="Review and respond to self-quote requests submitted through the landing page."
      />
      {statusMessage && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {statusMessage}
        </p>
      )}
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
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {filtered.length ? (
            <ul className="divide-y">
              {filtered.map((row) => {
                const requestedServices = serviceNames(row.selected_services);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedQuote(row)}
                      className="grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                      aria-label={`View quote ${row.quote_id} from ${row.full_name}`}
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {row.quote_id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRequestDate(row.created_at)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-semibold">
                          {row.full_name}
                          {row.business_name ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {row.business_name}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block truncate text-sm text-muted-foreground">
                          {row.email}
                          {row.phone ? ` · ${row.phone}` : ""}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {requestedServices.slice(0, 3).map((service, index) => (
                            <span
                              key={`${row.id}-service-${index}`}
                              className="max-w-56 truncate rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
                            >
                              {service}
                            </span>
                          ))}
                          {requestedServices.length > 3 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              +{requestedServices.length - 3} more
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-4 sm:justify-end">
                        <span className="text-left sm:text-right">
                          <span className="block font-semibold tabular-nums">
                            {formatMoney(Number(row.estimated_price))}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {row.status}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
      <Dialog
        open={Boolean(selectedQuote)}
        onOpenChange={(open) => {
          if (!open) setSelectedQuote(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selectedQuote && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="break-words">{selectedQuote.full_name}</DialogTitle>
                <DialogDescription>
                  {selectedQuote.quote_id} · {formatRequestDate(selectedQuote.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-2">
                <section className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contact
                    </h3>
                    <a
                      className="mt-2 flex items-start gap-2 break-all text-sm text-primary hover:underline"
                      href={`mailto:${selectedQuote.email}`}
                    >
                      <Mail className="mt-0.5 size-4 shrink-0" />
                      {selectedQuote.email}
                    </a>
                    <a
                      className="mt-2 flex items-center gap-2 text-sm hover:underline"
                      href={`tel:${selectedQuote.phone.replace(/[^\d+]/g, "")}`}
                    >
                      <Phone className="size-4 shrink-0" />
                      {selectedQuote.phone || "Phone not provided"}
                    </a>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Preferred contact: {selectedQuote.preferred_contact || "Not specified"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Business
                    </h3>
                    <p className="mt-2 flex items-start gap-2 break-words text-sm font-medium">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {selectedQuote.business_name || "Not provided"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Industry: {selectedQuote.industry || "Not specified"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Stage: {selectedQuote.business_stage || "Not specified"}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Requested services
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {serviceNames(selectedQuote.selected_services).length ? (
                      serviceNames(selectedQuote.selected_services).map((service, index) => (
                        <span
                          key={`${selectedQuote.id}-detail-service-${index}`}
                          className="max-w-full whitespace-normal break-words rounded-full border bg-muted/40 px-3 py-1 text-sm"
                        >
                          {service}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No services specified.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Project brief
                    </h3>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Estimated price</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatMoney(Number(selectedQuote.estimated_price))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {selectedQuote.project_description || "No project description provided."}
                  </p>
                  <div className="mt-4 grid gap-3 border-t pt-3 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Timeline: </span>
                      {selectedQuote.timeline || "Not specified"}
                    </p>
                    {selectedQuote.current_website && (
                      <p className="min-w-0 break-words">
                        <span className="text-muted-foreground">Website: </span>
                        {selectedQuote.current_website}
                      </p>
                    )}
                    {selectedQuote.online_presence && (
                      <p className="min-w-0 break-words sm:col-span-2">
                        <span className="text-muted-foreground">Online presence: </span>
                        {selectedQuote.online_presence}
                      </p>
                    )}
                  </div>
                </section>

                <div className="grid max-w-xs gap-1.5">
                  <Label htmlFor="quote-detail-status">Request status</Label>
                  <Select
                    value={selectedQuote.status}
                    disabled={!canUpdateStatus}
                    onValueChange={(value) => void updateStatus(selectedQuote.id, value)}
                  >
                    <SelectTrigger id="quote-detail-status">
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
                </div>
              </div>
              <DialogFooter>
                {canManage && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        editInquiry(selectedQuote);
                        setSelectedQuote(null);
                      }}
                    >
                      <Pencil className="size-4" /> Edit request
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void deleteInquiry(selectedQuote)}
                    >
                      <Trash2 className="size-4" /> Delete request
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
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
