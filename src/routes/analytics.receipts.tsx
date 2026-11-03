import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Eye, Plus, Printer, Trash2 } from "lucide-react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { DocumentSignatureSelector } from "@/components/cms/document-signature-selector";
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
import { useDocumentSettings } from "@/hooks/use-document-settings";
import { useDocumentSignatories } from "@/hooks/use-document-signatories";
import {
  createReceiptRecord,
  deleteReceiptRecord,
  getReceiptRecords,
  type ReceiptProject,
  type ReceiptRecord,
} from "@/lib/document-records";
import { amountInWords } from "@/lib/amount-in-words";
import { formatMoney } from "@/lib/format";
import { addDocumentWatermark } from "@/lib/document-logo";
import {
  getDigitalSignatureDataUrl,
  getDigitalSignatureUrl,
  getDocumentCompanyDetails,
  resolveDocumentSignature,
  type DocumentSettings,
} from "@/lib/website-cms";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/receipts")({
  head: () => meta("Receipts", "Issue and manage independent payment receipts."),
  component: Page,
});

type ReceiptDraft = Omit<ReceiptRecord, "id" | "receipt_number" | "created_at">;

function safeAmountInWords(amount: number): string {
  return Number.isSafeInteger(amount) && amount >= 0
    ? amountInWords(amount)
    : "Enter a valid whole-number amount to preview in words.";
}

function ReceiptDocument({
  receipt,
  paidFor,
  settings,
}: {
  receipt: ReceiptRecord | ReceiptDraft;
  paidFor: string;
  settings: DocumentSettings;
}) {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const companyDetails = getDocumentCompanyDetails(settings);
  useEffect(() => {
    let active = true;
    setSignatureUrl(null);
    if (receipt.digital_signature_path) {
      void getDigitalSignatureUrl(receipt.digital_signature_path)
        .then((url) => {
          if (active) setSignatureUrl(url);
        })
        .catch((cause: unknown) => {
          if (active)
            toast.error(
              `Could not load receipt signature: ${cause instanceof Error ? cause.message : String(cause)}`,
            );
        });
    }
    return () => {
      active = false;
    };
  }, [receipt.digital_signature_path]);
  return (
    <article className="document-a4 relative isolate mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col overflow-hidden bg-white text-[#1e2b3c]">
      <img
        src="/Logo_512p.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[58%] z-0 size-[112mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.045]"
      />
      <header className="relative z-10 flex min-h-[48mm] items-center justify-between gap-6 bg-[#0a2342] px-[9.5%] py-[12mm] text-white">
        <div>
          <p className="font-display text-3xl font-semibold uppercase tracking-wide">
            Payment receipt
          </p>
          <p className="mt-2 text-sm text-[#b0c4de]">{receipt.receipt_date || "—"}</p>
          <p className="mt-1 font-mono text-xs text-[#b0c4de]">
            {"receipt_number" in receipt ? receipt.receipt_number : "DRAFT PREVIEW"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold leading-tight tracking-wide">
            CYTIC <span className="font-medium">Creatives.</span>
          </p>
          <p className="mt-1 text-[10px] tracking-wide text-[#b0c4de]">
            Identity that hits differently
          </p>
        </div>
      </header>
      <div className="relative z-10 grid gap-5 px-[9.5%] py-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Received from</p>
          <p className="mt-1 font-medium">{receipt.client_name || "Client name"}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Date received</p>
          <p className="mt-1 font-medium">{receipt.receipt_date || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Paid for</p>
          <p className="mt-1 font-medium">{paidFor || "—"}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Payment method</p>
          <p className="mt-1">{receipt.payment_method || "—"}</p>
        </div>
      </div>
      <section className="relative z-10 mx-[9.5%] border-y border-[#0a2342] py-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <span className="text-muted-foreground">Payment reference</span>
          <span className="break-all text-right">{receipt.payment_reference || "—"}</span>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <span className="font-semibold text-[#4f6076]">Amount paid</span>
          <span className="text-right font-bold tabular-nums text-[#0a2342]">
            {formatMoney(Number(receipt.amount_paid))}
          </span>
        </div>
        <p className="py-1 text-xs text-[#4f6076]">
          {safeAmountInWords(Number(receipt.amount_paid))}
        </p>
        <div className="flex justify-between gap-4 border-t pt-3">
          <span className="text-[#4f6076]">Balance remaining</span>
          <span className="font-semibold tabular-nums text-[#0a2342]">
            {formatMoney(Number(receipt.balance))}
          </span>
        </div>
      </section>
      {receipt.notes && (
        <section className="relative z-10 mx-[9.5%] mt-5 rounded-r border-l-[3px] border-[#0a2342] bg-[#f7f9fc] px-4 py-3">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#0a2342]">Notes</h2>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#4f6076]">
            {receipt.notes}
          </p>
        </section>
      )}
      {companyDetails.length > 0 && (
        <section className="relative z-10 mx-[9.5%] mt-5 border-t border-[#d0d8e3] pt-4 text-xs">
          <h2 className="mb-2 font-bold uppercase tracking-wide text-[#0a2342]">CYTIC Details</h2>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {companyDetails.map((detail) => (
              <div key={detail.label} className="flex gap-2">
                <dt className="shrink-0 text-[#4f6076]">{detail.label}:</dt>
                <dd className="min-w-0 break-words">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="relative z-10 mx-[9.5%] mt-5 border-t border-[#d0d8e3] pt-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a2342]">
          Authorized signature
        </h2>
        {receipt.digital_signature_path ? (
          signatureUrl ? (
            <img
              src={signatureUrl}
              alt="Digital signature"
              className="h-16 max-w-48 object-contain object-left"
            />
          ) : (
            <p className="text-xs text-[#4f6076]">Loading digital signature…</p>
          )
        ) : (
          <div className="mt-8 w-56 border-t border-[#4f6076] pt-1 text-[10px] text-[#4f6076]">
            Authorized signatory · Sign here
          </div>
        )}
        {receipt.digital_signature_name && (
          <p className="text-xs text-[#4f6076]">{receipt.digital_signature_name}</p>
        )}
      </section>
      <footer className="relative z-10 mt-auto px-[9.5%]">
        <div className="mt-5 h-1 bg-[#c4a15a]" />
        <p className="py-3 text-[10px] text-[#4f6076]">
          CYTIC Creatives. · Kampala, Uganda. This receipt confirms payment received and is not an
          invoice.
        </p>
      </footer>
    </article>
  );
}

async function createReceiptPdf(
  receipt: ReceiptRecord | ReceiptDraft,
  paidFor: string,
  settings: DocumentSettings,
): Promise<jsPDF> {
  const { jsPDF: PdfDocument } = await import("jspdf");
  const pdf = new PdfDocument({ orientation: "portrait", unit: "mm", format: "a4" });
  const navy: [number, number, number] = [10, 35, 66];
  const gold: [number, number, number] = [190, 157, 91];
  const left = 20;
  const right = 190;
  pdf.setFillColor(...navy);
  pdf.rect(0, 0, 210, 48, "F");
  await addDocumentWatermark(pdf);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("PAYMENT RECEIPT", left, 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(176, 196, 222);
  pdf.text(receipt.receipt_date || "—", left, 34);
  pdf.text("receipt_number" in receipt ? receipt.receipt_number : "DRAFT PREVIEW", left, 41);
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
  pdf.text("RECEIVED FROM", left, 65);
  pdf.text("DATE RECEIVED", right, 65, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(pdf.splitTextToSize(receipt.client_name || "Client name", 80).slice(0, 2), left, 73);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(receipt.receipt_date || "—", right, 73, { align: "right" });

  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("PAID FOR", left, 94);
  pdf.text("PAYMENT METHOD", right, 94, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(paidFor || "—", 80).slice(0, 2), left, 102);
  pdf.text(receipt.payment_method || "—", right, 102, { align: "right" });

  pdf.setDrawColor(220, 220, 220);
  pdf.line(left, 116, right, 116);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("AMOUNT PAID", left, 130);
  pdf.text("PAYMENT REFERENCE", right, 130, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(formatMoney(Number(receipt.amount_paid)), left, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(receipt.payment_reference || "—", 80).slice(0, 2), right, 140, {
    align: "right",
  });
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text(
    pdf.splitTextToSize(safeAmountInWords(Number(receipt.amount_paid)), right - left),
    left,
    153,
  );

  pdf.setDrawColor(220, 220, 220);
  pdf.line(left, 166, right, 166);
  pdf.setTextColor(90, 90, 90);
  pdf.text("BALANCE REMAINING", left, 179);
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(formatMoney(Number(receipt.balance)), right, 179, { align: "right" });
  let detailY = 198;
  if (receipt.notes) {
    let remaining = pdf.splitTextToSize(receipt.notes, right - left - 10);
    let sectionHeading = "NOTES";
    detailY = 195;
    while (remaining.length) {
      if (detailY + 14 > 258) {
        pdf.addPage();
        await addDocumentWatermark(pdf);
        detailY = 24;
        sectionHeading = "NOTES (CONTINUED)";
      }
      const availableLines = Math.max(1, Math.floor((258 - detailY - 10) / 4));
      const currentLines = remaining.slice(0, availableLines);
      const noteHeight = currentLines.length * 4 + 10;
      pdf.setFillColor(247, 249, 252);
      pdf.rect(left, detailY, right - left, noteHeight, "F");
      pdf.setDrawColor(...navy);
      pdf.setLineWidth(0.8);
      pdf.line(left, detailY, left, detailY + noteHeight);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...navy);
      pdf.text(sectionHeading, left + 4, detailY + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(79, 96, 118);
      pdf.text(currentLines, left + 4, detailY + 10);
      detailY += noteHeight + 5;
      remaining = remaining.slice(currentLines.length);
      if (remaining.length) {
        pdf.addPage();
        await addDocumentWatermark(pdf);
        detailY = 24;
        sectionHeading = "NOTES (CONTINUED)";
      }
    }
  }

  const details = getDocumentCompanyDetails(settings);
  if (details.length) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...navy);
    pdf.text("    CYTIC DETAILS", left, detailY);
    detailY += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(70, 70, 70);
    for (const detail of details) {
      const lines = pdf.splitTextToSize(`${detail.label}: ${detail.value}`, right - left);
      const rowHeight = Math.max(4, lines.length * 3.5);
      if (detailY + rowHeight > 258) {
        pdf.addPage();
        await addDocumentWatermark(pdf);
        detailY = 24;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...navy);
        pdf.text("CYTIC DETAILS (CONTINUED)", left, detailY);
        detailY += 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(70, 70, 70);
      }
      pdf.text(lines, left, detailY);
      detailY += rowHeight + 1;
    }
  }
  if (detailY + 28 > 274) {
    pdf.addPage();
    await addDocumentWatermark(pdf);
    detailY = 24;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90, 90, 90);
  pdf.text("Authorized signature", left, detailY);
  if (receipt.digital_signature_path) {
    const signature = await getDigitalSignatureDataUrl(receipt.digital_signature_path);
    pdf.addImage(signature, "PNG", left, detailY + 3, 42, 18);
    if (receipt.digital_signature_name) {
      pdf.setFontSize(7);
      pdf.text(receipt.digital_signature_name, left, detailY + 25);
    }
  } else {
    pdf.setDrawColor(120, 120, 120);
    pdf.line(left, detailY + 22, left + 58, detailY + 22);
    pdf.setFontSize(7);
    pdf.text("Sign here", left, detailY + 27);
  }
  pdf.setDrawColor(...gold);
  pdf.setLineWidth(1.5);
  pdf.line(left, 280, right, 280);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(8);
  pdf.text("CYTIC Creatives. · Kampala, Uganda", left, 286);
  pdf.text("This receipt confirms payment received and is not an invoice.", left, 291);
  return pdf;
}

function Page() {
  const { state } = useAuth();
  const { settings, error: settingsError } = useDocumentSettings();
  const {
    signatories,
    error: signatoryError,
    loading: signatoriesLoading,
  } = useDocumentSignatories();
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [projects, setProjects] = useState<ReceiptProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ReceiptRecord | ReceiptDraft | null>(null);
  const [projectChoice, setProjectChoice] = useState("other");
  const [customPaidFor, setCustomPaidFor] = useState("");
  const [includeSignature, setIncludeSignature] = useState(false);
  const [signatureSource, setSignatureSource] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getReceiptRecords();
      setReceipts(result.receipts);
      setProjects(result.projects);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load receipt records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  const canIssue = state.status === "signed-in" && ["CEO", "FINANCE"].includes(state.role);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const getPaidFor = (receipt: ReceiptRecord | ReceiptDraft) =>
    (receipt.project_id ? projectById.get(receipt.project_id)?.name : null) || receipt.paid_for;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amountPaid = Number(form.get("amount_paid"));
    const balance = Number(form.get("balance"));
    const selectedProjectId = projectChoice === "other" ? null : projectChoice;
    const project = selectedProjectId ? projectById.get(selectedProjectId) : null;
    const paidFor = project?.name ?? customPaidFor.trim();
    if (!String(form.get("client_name") ?? "").trim()) {
      toast.error("Enter the client name.");
      return;
    }
    if (!Number.isSafeInteger(amountPaid) || amountPaid <= 0) {
      toast.error("Enter a positive whole-number amount paid.");
      return;
    }
    if (!Number.isSafeInteger(balance) || balance < 0) {
      toast.error("Balance must be a non-negative whole-number amount.");
      return;
    }
    if (!paidFor) {
      toast.error("Choose a project or enter what the payment is for.");
      return;
    }
    let signature: ReturnType<typeof resolveDocumentSignature>;
    try {
      signature = resolveDocumentSignature(
        includeSignature,
        signatureSource,
        settings.digital_signature_path,
        signatories,
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Choose a valid document signatory.");
      return;
    }
    setSaving(true);
    try {
      await createReceiptRecord({
        client_name: String(form.get("client_name")).trim(),
        project_id: selectedProjectId,
        paid_for: paidFor,
        receipt_date: String(form.get("receipt_date")),
        amount_paid: amountPaid,
        balance,
        payment_method: String(form.get("payment_method")),
        payment_reference: String(form.get("payment_reference") ?? "").trim() || null,
        notes: String(form.get("notes") ?? "").trim(),
        digital_signature_path: signature.path,
        digital_signature_user_id: signature.userId,
        digital_signature_name: signature.name,
      });
      toast.success("Receipt issued. Add the income separately in Income & Expenditure.");
      setCreateOpen(false);
      setProjectChoice("other");
      setCustomPaidFor("");
      setIncludeSignature(false);
      setSignatureSource("");
      formElement.reset();
      await refresh();
    } catch (cause) {
      toast.error(
        `Could not issue receipt: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const draftFromForm = (form: HTMLFormElement): ReceiptDraft => {
    const values = new FormData(form);
    const selectedProjectId = projectChoice === "other" ? null : projectChoice;
    const project = selectedProjectId ? projectById.get(selectedProjectId) : null;
    const signature = resolveDocumentSignature(
      includeSignature,
      signatureSource,
      settings.digital_signature_path,
      signatories,
    );
    return {
      client_name: String(values.get("client_name") ?? "").trim(),
      project_id: selectedProjectId,
      paid_for: project?.name ?? customPaidFor.trim(),
      receipt_date: String(values.get("receipt_date") ?? ""),
      amount_paid: Number(values.get("amount_paid")) || 0,
      balance: Number(values.get("balance")) || 0,
      payment_method: String(values.get("payment_method") ?? ""),
      payment_reference: String(values.get("payment_reference") ?? "").trim() || null,
      notes: String(values.get("notes") ?? "").trim(),
      digital_signature_path: signature.path,
      digital_signature_user_id: signature.userId,
      digital_signature_name: signature.name,
    };
  };

  const downloadReceipt = async (receipt: ReceiptRecord | ReceiptDraft) => {
    if (typeof window.print === "function") {
      window.print();
      return;
    }
    try {
      const pdf = await createReceiptPdf(receipt, getPaidFor(receipt), settings);
      const safeName = (
        "receipt_number" in receipt ? receipt.receipt_number : "receipt-preview"
      ).replace(/[^\w.-]/g, "_");
      pdf.save(`${safeName}.pdf`);
    } catch (cause) {
      toast.error(
        `Could not create receipt PDF: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  const remove = async (receipt: ReceiptRecord) => {
    if (!window.confirm(`Delete receipt ${receipt.receipt_number}? This does not affect income.`)) {
      return;
    }
    try {
      await deleteReceiptRecord(receipt.id);
      toast.success("Receipt deleted");
      await refresh();
    } catch (cause) {
      toast.error(
        `Could not delete receipt: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Issue receipts independently from income. After issuing a receipt, record the payment separately in Income & Expenditure."
        actions={
          canIssue ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Issue receipt
            </Button>
          ) : undefined
        }
      />
      {settingsError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Could not load CYTIC contact details: {settingsError}
        </p>
      )}
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-soft">
          {receipts.length ? (
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {["Receipt no.", "Date", "Client", "Paid for", "Amount paid", "Balance"].map(
                    (heading) => (
                      <th key={heading} className="px-4 py-3 font-medium">
                        {heading}
                      </th>
                    ),
                  )}
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="px-4 py-3 font-mono text-xs">{receipt.receipt_number}</td>
                    <td className="px-4 py-3">{receipt.receipt_date}</td>
                    <td className="px-4 py-3 font-medium">{receipt.client_name}</td>
                    <td className="px-4 py-3">
                      {receipt.project_id
                        ? (projectById.get(receipt.project_id)?.name ?? receipt.paid_for)
                        : receipt.paid_for}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(Number(receipt.amount_paid))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(Number(receipt.balance))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelected(receipt)}>
                          <Eye className="size-4" /> Preview
                        </Button>
                        {canIssue && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Delete receipt ${receipt.receipt_number}`}
                            onClick={() => void remove(receipt)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No receipts yet. Issue a receipt here; income is entered separately.
            </p>
          )}
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {receipts.length} receipt{receipts.length === 1 ? "" : "s"} · live Supabase data
          </p>
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setProjectChoice("other");
            setCustomPaidFor("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Issue receipt</DialogTitle>
            <DialogDescription>
              Issuing this receipt does not create an income transaction. Record income separately
              when ready.
            </DialogDescription>
          </DialogHeader>
          <form id="receipt-form" onSubmit={(event) => void save(event)} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="receipt-client">Client name *</Label>
                <Input id="receipt-client" name="client_name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="receipt-date">Date received *</Label>
                <Input
                  id="receipt-date"
                  name="receipt_date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="receipt-project">Paid for *</Label>
                <select
                  id="receipt-project"
                  value={projectChoice}
                  onChange={(event) => setProjectChoice(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} · {project.client_name}
                    </option>
                  ))}
                  <option value="other">Other / non-project</option>
                </select>
                {projectChoice === "other" && (
                  <Input
                    aria-label="Other paid for details"
                    value={customPaidFor}
                    onChange={(event) => setCustomPaidFor(event.target.value)}
                    placeholder="Describe what the payment is for"
                    required
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="receipt-method">Payment method *</Label>
                <select
                  id="receipt-method"
                  name="payment_method"
                  defaultValue="Bank transfer"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  {["Bank transfer", "Mobile money", "Card", "Cash", "Other"].map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="receipt-amount">Amount paid (UGX) *</Label>
                <Input
                  id="receipt-amount"
                  name="amount_paid"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="receipt-balance">Balance remaining (UGX) *</Label>
                <Input
                  id="receipt-balance"
                  name="balance"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                  required
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="receipt-reference">Payment reference</Label>
                <Input id="receipt-reference" name="payment_reference" />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="receipt-notes">Notes</Label>
                <textarea
                  id="receipt-notes"
                  name="notes"
                  rows={2}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <DocumentSignatureSelector
                  checked={includeSignature}
                  onCheckedChange={setIncludeSignature}
                  selection={signatureSource}
                  onSelectionChange={setSignatureSource}
                  signatories={signatories}
                  companySignatureAvailable={Boolean(settings.digital_signature_path)}
                  loading={signatoriesLoading}
                  error={signatoryError}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (!form) return;
                  try {
                    setSelected(draftFromForm(form));
                  } catch (cause) {
                    toast.error(
                      cause instanceof Error ? cause.message : "Choose a valid document signatory.",
                    );
                  }
                }}
              >
                <Eye className="size-4" /> Preview receipt
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Issuing…" : "Issue receipt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="document-dialog max-h-[90vh] max-w-[210mm] gap-0 overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Receipt preview</DialogTitle>
          </DialogHeader>
          {selected && (
            <ReceiptDocument
              receipt={selected}
              paidFor={getPaidFor(selected)}
              settings={settings}
            />
          )}
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selected && void downloadReceipt(selected)}
            >
              <Printer className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
