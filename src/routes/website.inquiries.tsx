import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
          return String(entry.name ?? entry.label ?? entry.title ?? entry.id ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function Page() {
  const { rows, loading, error, refresh } = useWebsiteRows<QuoteRequest>("quote_requests");
  const [query, setQuery] = useState("");
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
    </>
  );
}
