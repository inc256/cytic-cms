import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import { deleteWebsiteRow, saveWebsiteRow } from "@/lib/website-cms";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/proposals")({
  head: () => meta("Proposals", "Create, save and track live client proposals."),
  component: Page,
});

type LineItem = { description: string; amount: number };
type Proposal = {
  id: string;
  proposal_code: string;
  quote_id: string | null;
  client: string;
  title: string;
  line_items: LineItem[];
  value: number;
  status: "Draft" | "Sent" | "Accepted" | "Declined";
  valid_until: string | null;
  updated_at: string;
};

function Page() {
  const { rows, loading, error, refresh } = useWebsiteRows<Proposal>("cms_proposals");
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  const [title, setTitle] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState("Draft");
  const [items, setItems] = useState<LineItem[]>([{ description: "", amount: 0 }]);
  const [saving, setSaving] = useState(false);
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const resetForm = () => {
    setClient("");
    setTitle("");
    setQuoteId("");
    setValidUntil("");
    setStatus("Draft");
    setItems([{ description: "", amount: 0 }]);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const proposalForm = event.currentTarget;
    if (!client.trim() || !title.trim() || !items.some((item) => item.description.trim())) {
      toast.error("Client, title, and at least one described line item are required.");
      return;
    }
    if (items.some((item) => !Number.isSafeInteger(item.amount) || item.amount < 0)) {
      toast.error("Line item amounts must be non-negative whole UGX amounts.");
      return;
    }
    setSaving(true);
    try {
      await saveWebsiteRow("cms_proposals", {
        client: client.trim(),
        title: title.trim(),
        quote_id: quoteId.trim() || null,
        line_items: items.filter((item) => item.description.trim()),
        value: total,
        status,
        valid_until: validUntil || null,
      });
      toast.success("Proposal saved");
      setOpen(false);
      resetForm();
      proposalForm.reset();
      void refresh();
    } catch (saveError) {
      toast.error(
        `Could not save proposal: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (proposal: Proposal, nextStatus: string) => {
    try {
      await saveWebsiteRow("cms_proposals", { status: nextStatus }, proposal.id);
      toast.success("Proposal status updated");
      await refresh();
    } catch (updateError) {
      toast.error(
        `Could not update proposal: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
      );
    }
  };

  const remove = async (proposal: Proposal) => {
    try {
      await deleteWebsiteRow("cms_proposals", proposal.id);
      toast.success("Proposal deleted");
      await refresh();
    } catch (deleteError) {
      toast.error(
        `Could not delete proposal: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Proposals"
        description="Save and track live commercial offers; proposals are not counted as income."
        actions={
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New proposal
          </Button>
        }
      />
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          {rows.length ? (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {[
                    "Reference",
                    "Client",
                    "Title",
                    "Status",
                    "Valid until",
                    "Value",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-mono text-xs">{row.proposal_code}</td>
                    <td className="px-4 py-3 font-medium">{row.client}</td>
                    <td className="px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Status for ${row.proposal_code}`}
                        className="h-8 rounded-md border bg-background px-2"
                        value={row.status}
                        onChange={(event) => void updateStatus(row, event.target.value)}
                      >
                        {["Draft", "Sent", "Accepted", "Declined"].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">{row.valid_until ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(Number(row.value))}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => void remove(row)}>
                        <Trash2 className="size-4" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">No saved proposals yet.</p>
          )}
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {rows.length} live proposal{rows.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={(event) => void save(event)}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-background p-6 shadow-xl"
          >
            <h2 className="font-display text-lg font-semibold">New proposal</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-client">Client *</Label>
                <Input
                  id="proposal-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-title">Title *</Label>
                <Input
                  id="proposal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-quote">Quote request ID (optional)</Label>
                <Input
                  id="proposal-quote"
                  value={quoteId}
                  onChange={(e) => setQuoteId(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-valid">Valid until</Label>
                <Input
                  id="proposal-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line items</Label>
              {items.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    aria-label="Line item description"
                    value={item.description}
                    onChange={(e) =>
                      setItems(
                        items.map((value, i) =>
                          i === index ? { ...value, description: e.target.value } : value,
                        ),
                      )
                    }
                    required
                  />
                  <Input
                    aria-label="Line item amount"
                    type="number"
                    min="0"
                    step="1"
                    className="w-40"
                    value={item.amount}
                    onChange={(e) =>
                      setItems(
                        items.map((value, i) =>
                          i === index ? { ...value, amount: Number(e.target.value) } : value,
                        ),
                      )
                    }
                    required
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                      aria-label="Remove line item"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { description: "", amount: 0 }])}
              >
                <Plus className="size-4" /> Add line item
              </Button>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="proposal-status">Status</Label>
              <select
                id="proposal-status"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["Draft", "Sent", "Accepted", "Declined"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-between border-t pt-4">
              <span className="font-semibold">Total: {formatMoney(total)}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save proposal"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
