import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, Plus, Printer, Send, CircleDollarSign, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { DocumentPreview } from "@/components/cms/document-preview";
import { DocumentSignatureSelector } from "@/components/cms/document-signature-selector";
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
import { addDocumentWatermark } from "@/lib/document-logo";
import { useDocumentSettings } from "@/hooks/use-document-settings";
import { useDocumentSignatories } from "@/hooks/use-document-signatories";
import {
  getDigitalSignatureDataUrl,
  getDocumentBankDetails,
  getDocumentCompanyDetails,
  resolveDocumentSignature,
  type DocumentSettings,
} from "@/lib/website-cms";
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
  client_address: string;
  client_phone: string;
  digital_signature_path: string | null;
  digital_signature_user_id: string | null;
  digital_signature_name: string | null;
  project_id: string | null;
  issue_date: string;
  due_date: string;
  line_items: InvoiceLine[];
  total: number;
  notes: string;
  terms_conditions: string;
  status: "Draft" | "Sent" | "Paid";
  paid_at: string | null;
  created_at: string;
};
type Project = { id: string; name: string; client_name: string; service_category: string };

async function createInvoicePdf(
  invoice: Invoice,
  companySettings: DocumentSettings,
  signatureDataUrl?: string | null,
  signatureName?: string | null,
): Promise<jsPDF> {
  const { jsPDF: PdfDocument } = await import("jspdf");
  const pdf = new PdfDocument({ orientation: "portrait", unit: "mm", format: "a4" });
  const navy: [number, number, number] = [10, 35, 66];
  const gold: [number, number, number] = [190, 157, 91];
  const left = 18;
  const right = 192;
  const companyDetails = getDocumentCompanyDetails(companySettings);
  const bankDetails = getDocumentBankDetails(companySettings);

  pdf.setFillColor(...navy);
  pdf.rect(0, 0, 210, 48, "F");
  await addDocumentWatermark(pdf);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.text("INVOICE", left, 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(176, 196, 222);
  pdf.text(invoice.issue_date, left, 34);
  pdf.text(invoice.invoice_number, left, 41);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("CYTIC Creatives.", right, 22, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(176, 196, 222);
  pdf.text("Identity that hits differently", right, 29, { align: "right" });

  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("BILL TO", left, 62);
  pdf.text("CYTIC DETAILS", right, 62, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  const clientNameLines = pdf.splitTextToSize(invoice.client, 90);
  pdf.text(clientNameLines, left, 70);
  const clientDetails = [
    invoice.client_email && `Email: ${invoice.client_email}`,
    invoice.client_address && `Address: ${invoice.client_address}`,
    invoice.client_phone && `Tel: ${invoice.client_phone}`,
  ].filter((detail): detail is string => Boolean(detail));
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  let clientY = 70 + clientNameLines.length * 5 + 4;
  for (const detail of clientDetails) {
    const lines = pdf.splitTextToSize(detail, 90);
    pdf.text(lines, left, clientY);
    clientY += lines.length * 4 + 1;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(79, 96, 118);
  let officeY = 70;
  for (const detail of companyDetails) {
    const lines = pdf.splitTextToSize(`${detail.label}: ${detail.value}`, 82);
    pdf.text(lines, right - 82, officeY);
    officeY += lines.length * 4 + 1;
  }
  const dueDateY = Math.max(89, officeY + 4);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("DUE DATE", right, dueDateY, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFontSize(10);
  pdf.text(invoice.due_date, right, dueDateY + 8, { align: "right" });

  let y = Math.max(112, clientY + 8, dueDateY + 15);
  if (y > 230) {
    pdf.addPage();
    await addDocumentWatermark(pdf);
    y = 32;
  }
  const drawTableHeader = () => {
    pdf.setFillColor(...navy);
    pdf.rect(left, y - 7, right - left, 11, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.text("ITEM DESCRIPTION", left + 3, y);
    pdf.text("TOTAL (UGX)", right - 3, y, { align: "right" });
  };
  drawTableHeader();
  y += 11;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(25, 25, 25);
  for (const item of invoice.line_items) {
    const lines = pdf.splitTextToSize(item.description, 115);
    const rowHeight = Math.max(9, lines.length * 5 + 3);
    if (y + rowHeight > 250) {
      pdf.addPage();
      await addDocumentWatermark(pdf);
      y = 32;
      drawTableHeader();
      y += 11;
    }
    pdf.setDrawColor(208, 216, 227);
    pdf.rect(left, y - 5, right - left, rowHeight);
    pdf.text(lines, left + 3, y);
    pdf.text(formatMoney(item.amount), right - 3, y, { align: "right" });
    y += rowHeight + 1;
  }
  if (y > 248) {
    pdf.addPage();
    await addDocumentWatermark(pdf);
    y = 25;
  }
  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...navy);
  pdf.text(`TOTAL  ${formatMoney(Number(invoice.total))}`, right, y, { align: "right" });

  const addTextSection = async (heading: string, value: string) => {
    if (!value.trim()) return;
    const lines = pdf.splitTextToSize(value.trim(), right - left - 10);
    let remaining = lines;
    let sectionHeading = heading;
    while (remaining.length) {
      if (y + 14 > 270) {
        pdf.addPage();
        await addDocumentWatermark(pdf);
        y = 24;
      }
      const availableLines = Math.max(1, Math.floor((270 - y - 10) / 4));
      const currentLines = remaining.slice(0, availableLines);
      const sectionHeight = currentLines.length * 4 + 10;
      pdf.setFillColor(247, 249, 252);
      pdf.rect(left, y, right - left, sectionHeight, "F");
      pdf.setDrawColor(...navy);
      pdf.setLineWidth(0.8);
      pdf.line(left, y, left, y + sectionHeight);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...navy);
      pdf.text(sectionHeading.toUpperCase(), left + 4, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(79, 96, 118);
      pdf.text(currentLines, left + 4, y + 10);
      y += sectionHeight + 4;
      remaining = remaining.slice(currentLines.length);
      sectionHeading = `${heading} (continued)`;
      if (remaining.length) {
        pdf.addPage();
        await addDocumentWatermark(pdf);
        y = 24;
      }
    }
  };
  await addTextSection("Notes", invoice.notes);
  await addTextSection("Terms & Conditions", invoice.terms_conditions);
  if (y + 36 > 262) {
    pdf.addPage();
    await addDocumentWatermark(pdf);
    y = 24;
  } else {
    y += 12;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90, 90, 90);
  pdf.text("Authorized signature", left, y);
  if (signatureDataUrl) {
    pdf.addImage(signatureDataUrl, "PNG", left, y + 3, 42, 18);
    if (signatureName) {
      pdf.setFontSize(7);
      pdf.text(signatureName, left, y + 25);
    }
  } else {
    pdf.setDrawColor(120, 120, 120);
    pdf.line(left, y + 22, left + 58, y + 22);
    pdf.setFontSize(7);
    pdf.text("Sign here", left, y + 27);
  }
  y += 33;

  if (bankDetails.length) {
    const bankColumn = bankDetails.map((detail) => `${detail.label}: ${detail.value}`);
    const detailsHeight = bankColumn.reduce(
      (height, detail) =>
        height + Math.max(4, pdf.splitTextToSize(detail, right - left).length * 4) + 1,
      7,
    );
    if (y + detailsHeight > 270) {
      pdf.addPage();
      await addDocumentWatermark(pdf);
      y = 24;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...navy);
    pdf.text("BANK DETAILS", left, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(55, 55, 65);
    for (const detail of bankColumn) {
      const lines = pdf.splitTextToSize(detail, right - left);
      pdf.text(lines, left, y);
      y += Math.max(4, lines.length * 4) + 1;
    }
  }
  pdf.setDrawColor(...gold);
  pdf.setLineWidth(1.5);
  pdf.line(left, 280, right, 280);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(8);
  pdf.text("CYTIC Creatives. · Kampala, Uganda", left, 287);
  return pdf;
}

function Page() {
  const { state } = useAuth();
  const { settings: companySettings, error: settingsError } = useDocumentSettings(true);
  const {
    signatories,
    error: signatoryError,
    loading: signatoriesLoading,
  } = useDocumentSignatories();
  const canManage = state.status === "signed-in" && ["CEO", "FINANCE"].includes(state.role);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<InvoiceLine[]>([{ description: "", amount: 0 }]);
  const [projectId, setProjectId] = useState("");
  const [includeSignature, setIncludeSignature] = useState(false);
  const [signatureSource, setSignatureSource] = useState("");
  const companySignaturePath =
    companySettings.digital_signature_path ??
    (editingInvoice && !editingInvoice.digital_signature_user_id
      ? editingInvoice.digital_signature_path
      : null);

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
    setIncludeSignature(false);
    setSignatureSource("");
    setEditingInvoice(null);
  };

  const saveInvoice = async (event: FormEvent<HTMLFormElement>) => {
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
    let signature: ReturnType<typeof resolveDocumentSignature>;
    try {
      signature = resolveDocumentSignature(
        includeSignature,
        signatureSource,
        companySignaturePath,
        signatories,
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Choose a valid document signatory.");
      return;
    }
    setSaving(true);
    const invoiceData = {
      client: String(form.get("client")).trim(),
      client_email: String(form.get("client_email") ?? "").trim() || null,
      client_address: String(form.get("client_address") ?? "").trim(),
      client_phone: String(form.get("client_phone") ?? "").trim(),
      digital_signature_path: signature.path,
      digital_signature_user_id: signature.userId,
      digital_signature_name: signature.name,
      project_id: projectId || null,
      issue_date: String(form.get("issue_date")),
      due_date: String(form.get("due_date")),
      line_items: items,
      total,
      notes: String(form.get("notes") ?? "").trim(),
      terms_conditions: String(form.get("terms_conditions") ?? "").trim(),
    };
    const result = editingInvoice
      ? await supabase.from("cms_invoices").update(invoiceData).eq("id", editingInvoice.id)
      : await supabase.from("cms_invoices").insert(invoiceData);
    setSaving(false);
    if (result.error) {
      toast.error(
        `Could not ${editingInvoice ? "update" : "create"} invoice: ${result.error.message}`,
      );
      return;
    }
    toast.success(editingInvoice ? "Invoice updated" : "Draft invoice created");
    setCreateOpen(false);
    resetCreate();
    await refresh();
  };

  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setLines(invoice.line_items);
    setProjectId(invoice.project_id ?? "");
    setIncludeSignature(Boolean(invoice.digital_signature_path));
    setSignatureSource(
      invoice.digital_signature_user_id ?? (invoice.digital_signature_path ? "company" : ""),
    );
    setCreateOpen(true);
  };

  const deleteInvoice = async (invoice: Invoice) => {
    const detail =
      invoice.status === "Paid"
        ? " Its linked payment transaction and receipt will also be deleted."
        : "";
    if (!window.confirm(`Delete invoice ${invoice.invoice_number}?${detail}`)) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const result = await supabase.rpc("delete_cms_invoice", { invoice_uuid: invoice.id });
    setSaving(false);
    if (result.error) {
      toast.error(`Could not delete invoice: ${result.error.message}`);
      return;
    }
    toast.success("Invoice deleted");
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
      payment_method: "",
      payment_ref: null,
    });
    setSaving(false);
    if (result.error) {
      toast.error(`Could not clear invoice as paid: ${result.error.message}`);
      return;
    }
    toast.success(`${paying.invoice_number} marked paid. Record any income separately.`);
    setPaying(null);
    await refresh();
  };

  const download = async (invoice: Invoice) => {
    if (typeof window.print === "function") {
      window.print();
      return;
    }
    try {
      const signatureDataUrl = invoice.digital_signature_path
        ? await getDigitalSignatureDataUrl(invoice.digital_signature_path)
        : null;
      const pdf = await createInvoicePdf(
        invoice,
        companySettings,
        signatureDataUrl,
        invoice.digital_signature_name,
      );
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
        description="Create and issue invoices. Mark payment status separately; issue receipts and record income independently."
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
      {settingsError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Could not load invoice contact and bank details: {settingsError}
        </p>
      )}
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
                            onClick={() => setPreviewInvoice(invoice)}
                          >
                            <Eye className="size-4" /> Preview
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
                          {canManage && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={() => editInvoice(invoice)}
                              >
                                <Pencil className="size-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={() => void deleteInvoice(invoice)}
                              >
                                <Trash2 className="size-4" /> Delete
                              </Button>
                            </>
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreate();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? "Edit invoice" : "Create invoice"}</DialogTitle>
            <DialogDescription>
              {editingInvoice
                ? "Update this invoice. Changes to a paid invoice also update its linked payment ledger entry."
                : "Save as a draft, review the PDF, then issue it before recording payment."}
            </DialogDescription>
          </DialogHeader>
          <form
            key={editingInvoice?.id ?? "new"}
            onSubmit={(event) => void saveInvoice(event)}
            className="grid gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-client">Client *</Label>
                <Input
                  id="invoice-client"
                  name="client"
                  defaultValue={editingInvoice?.client}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-email">Client email</Label>
                <Input
                  id="invoice-email"
                  name="client_email"
                  type="email"
                  defaultValue={editingInvoice?.client_email ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-phone">Client telephone</Label>
                <Input
                  id="invoice-phone"
                  name="client_phone"
                  defaultValue={editingInvoice?.client_phone ?? ""}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="invoice-address">Client address</Label>
                <textarea
                  id="invoice-address"
                  name="client_address"
                  rows={2}
                  defaultValue={editingInvoice?.client_address ?? ""}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
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
                  defaultValue={editingInvoice?.issue_date ?? new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice-due-date">Due date *</Label>
                <Input
                  id="invoice-due-date"
                  name="due_date"
                  type="date"
                  defaultValue={
                    editingInvoice?.due_date ??
                    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
                  }
                  required
                />
              </div>
            </div>
            <DocumentSignatureSelector
              checked={includeSignature}
              onCheckedChange={setIncludeSignature}
              selection={signatureSource}
              onSelectionChange={setSignatureSource}
              signatories={signatories}
              companySignatureAvailable={Boolean(companySignaturePath)}
              loading={signatoriesLoading}
              error={signatoryError}
            />
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
              <Label htmlFor="invoice-notes">Notes (optional)</Label>
              <textarea
                id="invoice-notes"
                name="notes"
                rows={3}
                defaultValue={editingInvoice?.notes}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-terms">Terms &amp; Conditions (optional)</Label>
              <textarea
                id="invoice-terms"
                name="terms_conditions"
                rows={3}
                defaultValue={editingInvoice?.terms_conditions ?? ""}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Payment due date, delivery terms, and other conditions"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (!form) return;
                  const values = new FormData(form);
                  const items = lines.filter((line) => line.description.trim());
                  let signature: ReturnType<typeof resolveDocumentSignature>;
                  try {
                    signature = resolveDocumentSignature(
                      includeSignature,
                      signatureSource,
                      companySignaturePath,
                      signatories,
                    );
                  } catch (cause) {
                    toast.error(
                      cause instanceof Error ? cause.message : "Choose a valid document signatory.",
                    );
                    return;
                  }
                  setPreviewInvoice({
                    id: "preview",
                    invoice_number: editingInvoice?.invoice_number ?? "DRAFT PREVIEW",
                    client: String(values.get("client") ?? ""),
                    client_email: String(values.get("client_email") ?? "") || null,
                    client_address: String(values.get("client_address") ?? "").trim(),
                    client_phone: String(values.get("client_phone") ?? "").trim(),
                    digital_signature_path: signature.path,
                    digital_signature_user_id: signature.userId,
                    digital_signature_name: signature.name,
                    project_id: projectId || null,
                    issue_date: String(values.get("issue_date") ?? ""),
                    due_date: String(values.get("due_date") ?? ""),
                    line_items: items,
                    total: items.reduce((sum, line) => sum + line.amount, 0),
                    notes: String(values.get("notes") ?? ""),
                    terms_conditions: String(values.get("terms_conditions") ?? ""),
                    status: "Draft",
                    paid_at: null,
                    created_at: new Date().toISOString(),
                  });
                }}
              >
                <Eye className="size-4" /> Preview invoice
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingInvoice ? "Save changes" : "Save draft invoice"}
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
                ? `Mark ${paying.invoice_number} as paid on the selected date. This does not issue a receipt or add income; handle both separately.`
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
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Mark invoice paid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!previewInvoice} onOpenChange={(open) => !open && setPreviewInvoice(null)}>
        <DialogContent className="document-dialog max-h-[90vh] max-w-[210mm] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Invoice preview</DialogTitle>
          </DialogHeader>
          {previewInvoice && (
            <DocumentPreview
              documentType="Invoice"
              reference={previewInvoice.invoice_number}
              client={previewInvoice.client}
              clientDetails={[
                previewInvoice.client_address && {
                  label: "Address",
                  value: previewInvoice.client_address,
                },
                previewInvoice.client_phone && {
                  label: "Telephone",
                  value: previewInvoice.client_phone,
                },
                previewInvoice.client_email && {
                  label: "Email",
                  value: previewInvoice.client_email,
                },
              ].filter((detail): detail is { label: string; value: string } => Boolean(detail))}
              digitalSignaturePath={previewInvoice.digital_signature_path}
              digitalSignatureName={previewInvoice.digital_signature_name}
              issueDate={previewInvoice.issue_date}
              secondaryLabel="Due date"
              secondaryValue={previewInvoice.due_date}
              items={previewInvoice.line_items}
              total={Number(previewInvoice.total)}
              notes={previewInvoice.notes}
              termsConditions={previewInvoice.terms_conditions}
              companySettings={companySettings}
            />
          )}
          <div className="document-print-controls flex justify-end gap-2 border-t bg-muted/50 px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => previewInvoice && void download(previewInvoice)}
            >
              <Printer className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
