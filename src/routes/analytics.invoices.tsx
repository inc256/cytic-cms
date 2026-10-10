import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Send, CircleDollarSign, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, StatusBadge } from "@/components/cms/primitives";
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
import { formatMoney } from "@/lib/format";
import { getSupabaseClient } from "@/lib/supabase";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/invoices")({
  head: () => meta("Invoices", "Create invoices, track payments, and issue receipts."),
  component: Page,
});

type InvoiceLine = { description: string; amount: number };
type Invoice = {
  id: string;
  invoice_number: string;
  client: string;
  client_email: string | null;
  project_id: string | null;
  issue_date: string;
  due_date: string;
  line_items: InvoiceLine[];
  total: number;
  notes: string;
  status: "Draft" | "Sent" | "Paid";
  paid_at: string | null;
  created_at: string;
};
type Project = { id: string; name: string; client_name: string; service_category: string };

const METHODS = ["Bank transfer", "Mobile money", "Card", "Cash", "Other"];

async function createInvoicePdf(invoice: Invoice): Promise<jsPDF> {
  const { jsPDF: PdfDocument } = await import("jspdf");
  const pdf = new PdfDocument();
  const navy: [number, number, number] = [0, 7, 93];
  const gold: [number, number, number] = [190, 157, 91];
  const left = 18;
  const right = 192;

  pdf.setFillColor(...navy);
  pdf.rect(0, 0, 210, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("CYTIC Creatives", left, 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Identity that hits differently.", left, 30);
  pdf.setTextColor(...gold);
  pdf.setFontSize(10);
  pdf.text("INVOICE", right, 19, { align: "right" });
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.text(invoice.invoice_number, right, 28, { align: "right" });

  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("BILL TO", left, 62);
  pdf.text("ISSUED", right, 62, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(pdf.splitTextToSize(invoice.client, 90).slice(0, 2), left, 70);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(invoice.issue_date, right, 70, { align: "right" });
  if (invoice.client_email) {
    pdf.setTextColor(90, 90, 90);
    pdf.text(invoice.client_email, left, 78);
  }
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("DUE DATE", right, 87, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFontSize(10);
  pdf.text(invoice.due_date, right, 95, { align: "right" });

  let y = 112;
  pdf.setFillColor(245, 246, 250);
  pdf.rect(left, y - 7, right - left, 11, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(55, 55, 65);
  pdf.setFontSize(9);
  pdf.text("DESCRIPTION", left + 3, y);
  pdf.text("AMOUNT (UGX)", right - 3, y, { align: "right" });
  y += 11;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(25, 25, 25);
  for (const item of invoice.line_items) {
    const lines = pdf.splitTextToSize(item.description, 115);
    const rowHeight = Math.max(9, lines.length * 5 + 3);
    if (y + rowHeight > 250) {
      pdf.addPage();
      y = 25;
    }
    pdf.text(lines, left + 3, y);
    pdf.text(formatMoney(item.amount), right - 3, y, { align: "right" });
    y += rowHeight;
    pdf.setDrawColor(225, 225, 230);
    pdf.line(left, y - 2, right, y - 2);
  }
  if (y > 248) {
    pdf.addPage();
    y = 25;
  }
  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...navy);
  pdf.text(`TOTAL  ${formatMoney(Number(invoice.total))}`, right, y, { align: "right" });

  if (invoice.notes) {
    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(90, 90, 90);
    pdf.text(pdf.splitTextToSize(invoice.notes, right - left).slice(0, 4), left, y);
  }
  pdf.setDrawColor(...gold);
  pdf.setLineWidth(1.5);
  pdf.line(left, 270, right, 270);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(8);
  pdf.text("CYTIC Creatives · A Namielus Group Limited company · Kampala, Uganda", left, 278);
  return pdf;
}

function Page() {
  const { state } = useAuth();
  const canManage = state.status === "signed-in" && ["CEO", "FINANCE"].includes(state.role);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([{ description: "", amount: 0 }]);
  const [projectId, setProjectId] = useState("");

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [invoiceResult, projectResult] = await Promise.all([
      supabase.from("cms_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("cms_projects").select("id,name,client_name,service_category").order("name"),
    ]);
    if (invoiceResult.error) {
      setError(invoiceResult.error.message);
    } else if (projectResult.error) {
      setError(projectResult.error.message);
    } else {
      setRows((invoiceResult.data ?? []) as Invoice[]);
      setProjects((projectResult.data ?? []) as Project[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetCreate = () => {
    setLines([{ description: "", amount: 0 }]);
    setProjectId("");
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = lines.filter((line) => line.description.trim());
    if (
      !items.length ||
      items.some((line) => !Number.isSafeInteger(line.amount) || line.amount <= 0)
    ) {
      toast.error("Add at least one described line item with a positive whole-UGX amount.");
      return;
    }
    const total = items.reduce((sum, line) => sum + line.amount, 0);
    if (!Number.isSafeInteger(total)) {
      toast.error("The invoice total is too large.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const result = await supabase.from("cms_invoices").insert({
      client: String(form.get("client")).trim(),
      client_email: String(form.get("client_email") ?? "").trim() || null,
      project_id: projectId || null,
      issue_date: String(form.get("issue_date")),
      due_date: String(form.get("due_date")),
      line_items: items,
      total,
      notes: String(form.get("notes") ?? "").trim(),
    });
    setSaving(false);
    if (result.error) {
      toast.error(`Could not create invoice: ${result.error.message}`);
      return;
    }
    toast.success("Draft invoice created");
    setCreateOpen(false);
    resetCreate();
    await refresh();
  };

  const issue = async (invoice: Invoice) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const result = await supabase.rpc("issue_cms_invoice", { invoice_uuid: invoice.id });
    setSaving(false);
    if (result.error) {
      toast.error(`Could not issue invoice: ${result.error.message}`);
      return;
    }
    toast.success(`${invoice.invoice_number} issued`);
    await refresh();
  };

  const markPaid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paying) return;
    const form = new FormData(event.currentTarget);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const result = await supabase.rpc("mark_cms_invoice_paid", {
      invoice_uuid: paying.id,
      paid_date: String(form.get("paid_date")),
      payment_method: String(form.get("payment_method")),
      payment_ref: String(form.get("payment_ref") ?? "").trim() || null,
    });
    setSaving(false);
    if (result.error) {
      toast.error(`Could not clear invoice as paid: ${result.error.message}`);
      return;
    }
    const receiptNumber = result.data?.[0]?.receipt_number;
    toast.success(
      receiptNumber
        ? `${paying.invoice_number} paid; receipt ${receiptNumber} created`
        : `${paying.invoice_number} paid and recorded`,
    );
    setPaying(null);
    await refresh();
  };

  const download = async (invoice: Invoice) => {
    try {
      const pdf = await createInvoicePdf(invoice);
      pdf.save(`${invoice.invoice_number}.pdf`);
    } catch (cause) {
      toast.error(
        `Could not create invoice PDF: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  const totalOutstanding = rows
    .filter((invoice) => invoice.status === "Sent")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Create invoices, issue them to clients, and record full payment. Paid invoices automatically create a ledger entry and receipt."
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => {
                resetCreate();
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" /> New invoice
            </Button>
          ) : undefined
        }
      />
      <div className="mb-5 flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="grid size-9 place-items-center rounded-md bg-primary-subtle text-primary">
          <CircleDollarSign className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding invoices</p>
          <p className="font-display text-lg font-semibold tabular-nums">
            {formatMoney(totalOutstanding)}
          </p>
        </div>
      </div>
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-soft">
          {rows.length ? (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {[
                    "Invoice",
                    "Client",
                    "Project",
                    "Issued",
                    "Due",
                    "Total",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((invoice) => {
                  const overdue =
                    invoice.status === "Sent" &&
                    invoice.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 font-mono text-xs">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 font-medium">{invoice.client}</td>
                      <td className="px-4 py-3">
                        {invoice.project_id
                          ? (projectById.get(invoice.project_id)?.name ?? "—")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{invoice.issue_date}</td>
                      <td className="px-4 py-3">{invoice.due_date}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(invoice.total))}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={overdue ? "Overdue" : invoice.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Download ${invoice.invoice_number} as PDF`}
                            onClick={() => void download(invoice)}
                          >
                            <Download className="size-4" /> PDF
                          </Button>
                          {canManage && invoice.status === "Draft" && (
                            <Button size="sm" disabled={saving} onClick={() => void issue(invoice)}>
                              <Send className="size-4" /> Issue
                            </Button>
                          )}
                          {canManage && invoice.status === "Sent" && (
                            <Button size="sm" disabled={saving} onClick={() => setPaying(invoice)}>
                              <CircleDollarSign className="size-4" /> Mark paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No invoices yet. Create a draft invoice to get started.
            </p>
          )}
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {rows.length} invoice{rows.length === 1 ? "" : "s"} · live Supabase data
          </p>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription>
              Save as a draft, review the PDF, then issue it before recording payment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void create(event)} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-client">Client *</Label>
                <Input id="invoice-client" name="client" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-email">Client email</Label>
                <Input id="invoice-email" name="client_email" type="email" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-project">Project (optional)</Label>
                <select
                  id="invoice-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No linked project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} · {project.client_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-issue-date">Issue date *</Label>
                <Input
                  id="invoice-issue-date"
                  name="issue_date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-due-date">Due date *</Label>
                <Input
                  id="invoice-due-date"
                  name="due_date"
                  type="date"
                  defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLines([...lines, { description: "", amount: 0 }])}
                >
                  <Plus className="size-4" /> Add item
                </Button>
              </div>
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_160px_40px]">
                  <Input
                    aria-label={`Description for line item ${index + 1}`}
                    placeholder="Description"
                    value={line.description}
                    onChange={(event) =>
                      setLines(
                        lines.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Amount for line item ${index + 1}`}
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Amount (UGX)"
                    value={line.amount || ""}
                    onChange={(event) =>
                      setLines(
                        lines.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, amount: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove line item ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <p className="text-right text-sm font-semibold">
                Total: {formatMoney(lines.reduce((sum, line) => sum + (line.amount || 0), 0))}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-notes">Notes / payment instructions</Label>
              <textarea
                id="invoice-notes"
                name="notes"
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Save draft invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear invoice as paid</DialogTitle>
            <DialogDescription>
              {paying
                ? `Record full payment of ${formatMoney(Number(paying.total))} for ${paying.invoice_number}. This creates one income transaction and a receipt.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void markPaid(event)} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="paid-date">Payment date *</Label>
              <Input
                id="paid-date"
                name="paid_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="payment-method">Payment method *</Label>
              <select
                id="payment-method"
                name="payment_method"
                defaultValue={METHODS[0]}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                {METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="payment-ref">Payment reference</Label>
              <Input id="payment-ref" name="payment_ref" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving payment…" : "Confirm payment received"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
