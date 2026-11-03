import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState, type FormEvent } from "react";
import { ChevronDown, Eye, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { DocumentPreview } from "@/components/cms/document-preview";
import { DocumentSignatureSelector } from "@/components/cms/document-signature-selector";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentSettings } from "@/hooks/use-document-settings";
import { useDocumentSignatories } from "@/hooks/use-document-signatories";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import {
  deleteWebsiteRow,
  getDigitalSignatureDataUrl,
  getDocumentCompanyDetails,
  resolveDocumentSignature,
  saveWebsiteRow,
  type DocumentSettings,
} from "@/lib/website-cms";
import { addDocumentWatermark } from "@/lib/document-logo";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/proposals")({
  head: () => meta("Quotations", "Create, preview, save and track client quotations."),
  component: Page,
});

type LineItem = { description: string; amount: number };
type Proposal = {
  id: string;
  proposal_code: string;
  quote_id: string | null;
  client: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  digital_signature_path: string | null;
  digital_signature_user_id: string | null;
  digital_signature_name: string | null;
  notes: string;
  terms_conditions: string;
  title: string;
  line_items: LineItem[];
  value: number;
  status: "Draft" | "Sent" | "Accepted" | "Declined";
  valid_until: string | null;
  created_at: string;
  updated_at: string;
};

async function createProposalPdf(proposal: Proposal, settings: DocumentSettings): Promise<jsPDF> {
  const { jsPDF: PdfDocument } = await import("jspdf");
  const pdf = new PdfDocument({ orientation: "portrait", unit: "mm", format: "a4" });
  const navy: [number, number, number] = [10, 35, 66];
  const gold: [number, number, number] = [190, 157, 91];
  const left = 18;
  const right = 192;
  const companyDetails = getDocumentCompanyDetails(settings);
  pdf.setFillColor(...navy);
  pdf.rect(0, 0, 210, 48, "F");
  await addDocumentWatermark(pdf);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.text("QUOTATION", left, 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(176, 196, 222);
  pdf.text(proposal.created_at.slice(0, 10), left, 34);
  pdf.text(proposal.proposal_code, left, 41);
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
  pdf.text("PREPARED FOR", left, 62);
  pdf.text("CYTIC DETAILS", right, 62, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  const clientNameLines = pdf.splitTextToSize(proposal.client, 90);
  pdf.text(clientNameLines, left, 70);
  const clientDetails = [
    proposal.client_address && `Address: ${proposal.client_address}`,
    proposal.client_phone && `Tel: ${proposal.client_phone}`,
    proposal.client_email && `Email: ${proposal.client_email}`,
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
  const titleY = Math.max(99, clientY + 5, officeY + 5);
  pdf.setTextColor(90, 90, 90);
  pdf.text("TITLE", left, titleY);
  if (proposal.valid_until) {
    pdf.text("VALID UNTIL", right, titleY, { align: "right" });
  }
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  const titleLines = pdf.splitTextToSize(proposal.title, 110);
  pdf.text(titleLines, left, titleY + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  if (proposal.valid_until) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(proposal.valid_until, right, titleY + 8, { align: "right" });
  }

  let y = Math.max(124, titleY + 13 + titleLines.length * 5);
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
  for (const item of proposal.line_items) {
    const lines = pdf.splitTextToSize(item.description, 115);
    const rowHeight = Math.max(9, lines.length * 5 + 3);
    if (y + rowHeight > 245) {
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
  if (y + 22 > 262) {
    pdf.addPage();
    await addDocumentWatermark(pdf);
    y = 24;
  }
  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...navy);
  pdf.text(`TOTAL  ${formatMoney(Number(proposal.value))}`, right, y, { align: "right" });
  y += 12;
  await addTextSection("Notes", proposal.notes);
  await addTextSection("Terms & Conditions", proposal.terms_conditions);

  let signature: string | null = null;
  if (proposal.digital_signature_path) {
    signature = await getDigitalSignatureDataUrl(proposal.digital_signature_path);
  }
  if (y + 34 > 262) {
    pdf.addPage();
    await addDocumentWatermark(pdf);
    y = 24;
  } else {
    y += 15;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90, 90, 90);
  pdf.text("Authorized signature", left, y);
  if (signature) {
    pdf.addImage(signature, "PNG", left, y + 3, 42, 18);
    if (proposal.digital_signature_name) {
      pdf.setFontSize(7);
      pdf.text(proposal.digital_signature_name, left, y + 25);
    }
  } else {
    pdf.setDrawColor(120, 120, 120);
    pdf.line(left, y + 22, left + 58, y + 22);
    pdf.setFontSize(7);
    pdf.text("Sign here", left, y + 27);
  }
  y += 34;

  pdf.setDrawColor(...gold);
  pdf.setLineWidth(1.5);
  pdf.line(left, 280, right, 280);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(8);
  pdf.text("CYTIC Creatives. · Kampala, Uganda", left, 287);
  return pdf;
}

function Page() {
  const { rows, loading, error, refresh } = useWebsiteRows<Proposal>("cms_proposals");
  const { settings: companySettings, error: settingsError } = useDocumentSettings();
  const {
    signatories,
    error: signatoryError,
    loading: signatoriesLoading,
  } = useDocumentSignatories();
  const [open, setOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [client, setClient] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [title, setTitle] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [status, setStatus] = useState<Proposal["status"]>("Draft");
  const [items, setItems] = useState<LineItem[]>([{ description: "", amount: 0 }]);
  const [saving, setSaving] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [signatureSource, setSignatureSource] = useState("");
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);
  const [expandedItems, setExpandedItems] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const companySignaturePath =
    companySettings.digital_signature_path ??
    (editingProposal && !editingProposal.digital_signature_user_id
      ? editingProposal.digital_signature_path
      : null);

  const resetForm = () => {
    setEditingProposal(null);
    setClient("");
    setClientEmail("");
    setClientPhone("");
    setClientAddress("");
    setTitle("");
    setQuoteId("");
    setValidUntil("");
    setNotes("");
    setTermsConditions("");
    setStatus("Draft");
    setItems([{ description: "", amount: 0 }]);
    setIncludeSignature(false);
    setSignatureSource("");
  };

  const editProposal = (proposal: Proposal) => {
    setEditingProposal(proposal);
    setClient(proposal.client);
    setClientEmail(proposal.client_email ?? "");
    setClientPhone(proposal.client_phone ?? "");
    setClientAddress(proposal.client_address ?? "");
    setTitle(proposal.title);
    setQuoteId(proposal.quote_id ?? "");
    setValidUntil(proposal.valid_until ?? "");
    setNotes(proposal.notes ?? "");
    setTermsConditions(proposal.terms_conditions ?? "");
    setStatus(proposal.status);
    setItems(proposal.line_items.length ? proposal.line_items : [{ description: "", amount: 0 }]);
    setIncludeSignature(Boolean(proposal.digital_signature_path));
    setSignatureSource(
      proposal.digital_signature_user_id ?? (proposal.digital_signature_path ? "company" : ""),
    );
    setOpen(true);
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
    try {
      await saveWebsiteRow(
        "cms_proposals",
        {
          client: client.trim(),
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          client_address: clientAddress.trim() || null,
          digital_signature_path: signature.path,
          digital_signature_user_id: signature.userId,
          digital_signature_name: signature.name,
          notes: notes.trim(),
          terms_conditions: termsConditions.trim(),
          title: title.trim(),
          quote_id: quoteId.trim() || null,
          line_items: items.filter((item) => item.description.trim()),
          value: total,
          status,
          valid_until: validUntil || null,
        },
        editingProposal?.id,
      );
      toast.success(editingProposal ? "Quotation updated" : "Quotation saved");
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

  const download = async (proposal: Proposal) => {
    if (typeof window.print === "function") {
      window.print();
      return;
    }
    try {
      const pdf = await createProposalPdf(proposal, companySettings);
      pdf.save(`${proposal.proposal_code.replace(/[^\w.-]/g, "_")}.pdf`);
    } catch (cause) {
      toast.error(
        `Could not create quotation PDF: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Create and preview client quotations independently; no project is required."
        actions={
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New quotation
          </Button>
        }
      />
      {settingsError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Could not load quotation contact details: {settingsError}
        </p>
      )}
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
                    "Items",
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
                  <Fragment key={row.id}>
                    <tr>
                      <td className="px-4 py-3 font-mono text-xs">{row.proposal_code}</td>
                      <td className="max-w-48 whitespace-normal break-words px-4 py-3 font-medium">
                        {row.client}
                      </td>
                      <td className="max-w-64 whitespace-normal break-words px-4 py-3">
                        {row.title}
                      </td>
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
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={expandedItems === row.id}
                          aria-controls={`quotation-items-${row.id}`}
                          onClick={() =>
                            setExpandedItems((current) => (current === row.id ? null : row.id))
                          }
                        >
                          <ChevronDown
                            className={`size-4 transition-transform ${expandedItems === row.id ? "rotate-180" : ""}`}
                          />
                          {row.line_items.length} item{row.line_items.length === 1 ? "" : "s"}
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(row.value))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editProposal(row)}>
                            <Pencil className="size-4" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewProposal(row)}
                          >
                            <Eye className="size-4" /> Preview / Print
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void remove(row)}>
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedItems === row.id && (
                      <tr className="bg-muted/30">
                        <td colSpan={8} className="px-4 py-4">
                          <div
                            id={`quotation-items-${row.id}`}
                            className="mx-auto max-w-5xl space-y-3"
                          >
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <span>Item description</span>
                              <span className="text-right">Amount</span>
                            </div>
                            {row.line_items.map((item, index) => (
                              <div
                                key={`${row.id}-item-${index}`}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-dashed pb-3 last:border-0"
                              >
                                <div className="min-w-0">
                                  <p className="mb-1 text-xs text-muted-foreground">
                                    Item {index + 1}
                                  </p>
                                  <p className="whitespace-pre-wrap break-words text-sm">
                                    {item.description}
                                  </p>
                                </div>
                                <p className="max-w-40 break-words text-right text-sm font-medium tabular-nums">
                                  {formatMoney(Number(item.amount))}
                                </p>
                              </div>
                            ))}
                            {!row.line_items.length && (
                              <p className="text-sm text-muted-foreground">No items recorded.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No saved quotations yet.
            </p>
          )}
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {rows.length} quotation{rows.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={(event) => void save(event)}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-background p-6 shadow-xl"
          >
            <h2 className="font-display text-lg font-semibold">
              {editingProposal ? "Edit quotation" : "New quotation"}
            </h2>
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
                <Label htmlFor="proposal-email">Client email</Label>
                <Input
                  id="proposal-email"
                  type="email"
                  value={clientEmail}
                  onChange={(event) => setClientEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-phone">Client telephone</Label>
                <Input
                  id="proposal-phone"
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="proposal-address">Client address</Label>
                <textarea
                  id="proposal-address"
                  rows={2}
                  value={clientAddress}
                  onChange={(event) => setClientAddress(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-notes">Notes (optional)</Label>
                <textarea
                  id="proposal-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Additional information for the client"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proposal-terms">Terms &amp; Conditions (optional)</Label>
                <textarea
                  id="proposal-terms"
                  rows={3}
                  value={termsConditions}
                  onChange={(event) => setTermsConditions(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Validity, payment, and delivery terms"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Line items ({items.length})</Label>
                <span className="text-sm font-medium tabular-nums">
                  Subtotal: {formatMoney(total)}
                </span>
              </div>
              <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <section
                    key={index}
                    className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,200px)_auto]"
                  >
                    <div className="grid min-w-0 gap-1.5">
                      <Label htmlFor={`proposal-item-description-${index}`}>
                        Item {index + 1} description
                      </Label>
                      <textarea
                        id={`proposal-item-description-${index}`}
                        aria-label={`Line item ${index + 1} description`}
                        rows={3}
                        value={item.description}
                        onChange={(event) =>
                          setItems(
                            items.map((value, i) =>
                              i === index ? { ...value, description: event.target.value } : value,
                            ),
                          )
                        }
                        className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Describe the service, deliverables, scope, or other details"
                        required
                      />
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor={`proposal-item-amount-${index}`}>Amount (UGX)</Label>
                      <Input
                        id={`proposal-item-amount-${index}`}
                        aria-label={`Line item ${index + 1} amount`}
                        type="number"
                        min="0"
                        step="1"
                        value={item.amount}
                        onChange={(event) =>
                          setItems(
                            items.map((value, i) =>
                              i === index
                                ? { ...value, amount: Number(event.target.value) }
                                : value,
                            ),
                          )
                        }
                        required
                      />
                    </div>
                    <div className="flex justify-end sm:pt-6">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setItems(items.filter((_, i) => i !== index))}
                          aria-label={`Remove line item ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </section>
                ))}
              </div>
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
                onChange={(e) => setStatus(e.target.value as Proposal["status"])}
              >
                {["Draft", "Sent", "Accepted", "Declined"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-between border-t pt-4">
              <span className="font-semibold">Total: {formatMoney(total)}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
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
                        cause instanceof Error
                          ? cause.message
                          : "Choose a valid document signatory.",
                      );
                      return;
                    }
                    setPreviewProposal({
                      id: "preview",
                      proposal_code: "DRAFT PREVIEW",
                      quote_id: null,
                      client,
                      client_email: clientEmail.trim() || null,
                      client_phone: clientPhone.trim() || null,
                      client_address: clientAddress.trim() || null,
                      digital_signature_path: signature.path,
                      digital_signature_user_id: signature.userId,
                      digital_signature_name: signature.name,
                      notes: notes.trim(),
                      terms_conditions: termsConditions.trim(),
                      title,
                      line_items: items.filter((item) => item.description.trim()),
                      value: total,
                      status,
                      valid_until: validUntil || null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    });
                  }}
                >
                  <Eye className="size-4" /> Preview
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editingProposal ? "Save changes" : "Save quotation"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
      <Dialog open={!!previewProposal} onOpenChange={(open) => !open && setPreviewProposal(null)}>
        <DialogContent className="document-dialog max-h-[90vh] max-w-[210mm] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Quotation preview</DialogTitle>
          </DialogHeader>
          {previewProposal && (
            <DocumentPreview
              documentType="Quotation"
              reference={previewProposal.proposal_code}
              client={previewProposal.client}
              clientDetails={[
                previewProposal.client_address && {
                  label: "Address",
                  value: previewProposal.client_address,
                },
                previewProposal.client_phone && {
                  label: "Telephone",
                  value: previewProposal.client_phone,
                },
                previewProposal.client_email && {
                  label: "Email",
                  value: previewProposal.client_email,
                },
              ].filter((detail): detail is { label: string; value: string } => Boolean(detail))}
              digitalSignaturePath={previewProposal.digital_signature_path}
              digitalSignatureName={previewProposal.digital_signature_name}
              title={previewProposal.title}
              issueDate={previewProposal.created_at.slice(0, 10)}
              secondaryLabel="Valid until"
              secondaryValue={previewProposal.valid_until ?? ""}
              items={previewProposal.line_items}
              total={Number(previewProposal.value)}
              notes={previewProposal.notes}
              termsConditions={previewProposal.terms_conditions}
              companySettings={companySettings}
            />
          )}
          <div className="document-print-controls flex justify-end gap-2 border-t bg-muted/50 px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => previewProposal && void download(previewProposal)}
            >
              <Printer className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
