import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import type { jsPDF } from "jspdf";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import { downloadCsv, type FinancialTransaction } from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-context";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/receipts")({
  head: () =>
    meta("Receipts & Transactions", "Review and print receipts for payments recorded in Supabase."),
  component: Page,
});

function ReceiptDocument({
  transaction,
  projectName,
}: {
  transaction: FinancialTransaction;
  projectName: string;
}) {
  return (
    <div className="bg-card text-foreground">
      <div className="flex items-start justify-between bg-primary px-8 py-6 text-primary-foreground">
        <div>
          <p className="font-display text-xl font-semibold tracking-tight">CYTIC Creatives</p>
          <p className="mt-0.5 text-xs opacity-75">Identity that hits differently.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Payment receipt</p>
          <p className="mt-1 font-mono text-sm">{transaction.receipt_number}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 px-8 py-6 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Received from</p>
          <p className="mt-1 font-medium">{transaction.party}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Date received</p>
          <p className="mt-1 font-medium">{transaction.transaction_date}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Project</p>
          <p className="mt-1">{projectName || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Payment method</p>
          <p className="mt-1">{transaction.method}</p>
        </div>
      </div>
      <div className="mx-8 border-y py-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Payment reference</span>
          <span>{transaction.payment_reference || transaction.transaction_ref}</span>
        </div>
      </div>
      <div className="flex items-end justify-between px-8 py-6">
        <div className="text-xs text-muted-foreground">
          <p>Issued by CYTIC Creatives</p>
          <p>{transaction.description}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Amount paid</p>
          <p className="font-display text-2xl font-semibold tabular-nums text-primary">
            {formatMoney(transaction.amount)}
          </p>
        </div>
      </div>
      <div className="h-1 bg-gold" />
      <p className="px-8 py-3 text-[10px] text-muted-foreground">
        CYTIC Creatives · A Namielus Group Limited company · Kampala, Uganda. This receipt confirms
        payment received and is not an invoice.
      </p>
    </div>
  );
}

async function createReceiptPdf(
  transaction: FinancialTransaction,
  projectName: string,
): Promise<jsPDF> {
  const { jsPDF: PdfDocument } = await import("jspdf");
  const pdf = new PdfDocument();
  const navy: [number, number, number] = [0, 7, 93];
  const gold: [number, number, number] = [190, 157, 91];
  const left = 20;
  const right = 190;

  pdf.setFillColor(...navy);
  pdf.rect(0, 0, 210, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("CYTIC Creatives", left, 23);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Identity that hits differently.", left, 31);
  pdf.setTextColor(...gold);
  pdf.setFontSize(10);
  pdf.text("PAYMENT RECEIPT", right, 20, { align: "right" });
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.text(transaction.receipt_number ?? transaction.transaction_ref, right, 29, {
    align: "right",
  });

  pdf.setTextColor(90, 90, 90);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("RECEIVED FROM", left, 67);
  pdf.text("DATE RECEIVED", right, 67, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(pdf.splitTextToSize(transaction.party, 80).slice(0, 2), left, 75);
  pdf.text(transaction.transaction_date, right, 75, { align: "right" });

  pdf.setTextColor(90, 90, 90);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("PROJECT", left, 96);
  pdf.text("PAYMENT METHOD", right, 96, { align: "right" });
  pdf.setTextColor(25, 25, 25);
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(projectName || "-", 80).slice(0, 2), left, 104);
  pdf.text(transaction.method, right, 104, { align: "right" });

  pdf.setDrawColor(220, 220, 220);
  pdf.line(left, 118, right, 118);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("PAYMENT REFERENCE", left, 130);
  pdf.setTextColor(25, 25, 25);
  pdf.setFontSize(11);
  pdf.text(transaction.payment_reference || transaction.transaction_ref, right, 130, {
    align: "right",
  });
  pdf.line(left, 140, right, 140);

  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(9);
  pdf.text("AMOUNT PAID", left, 160);
  pdf.setTextColor(...navy);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(formatMoney(transaction.amount), right, 170, { align: "right" });

  const description = transaction.description.trim();
  if (description) {
    pdf.setTextColor(90, 90, 90);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(description, right - left).slice(0, 3), left, 188);
  }

  pdf.setDrawColor(...gold);
  pdf.setLineWidth(1.5);
  pdf.line(left, 250, right, 250);
  pdf.setTextColor(90, 90, 90);
  pdf.setFontSize(8);
  pdf.text("Issued by CYTIC Creatives", left, 260);
  pdf.text("A Namielus Group Limited company | Kampala, Uganda", left, 266);
  pdf.text("This receipt confirms payment received and is not an invoice.", left, 272);
  return pdf;
}

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const { state } = useAuth();
  const [selected, setSelected] = useState<FinancialTransaction | null>(null);
  if (loading || error || !data) {
    return (
      <>
        <PageHeader
          title="Receipts & Transactions"
          description="Receipts are created when payments are recorded."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const projects = new Map(data.projects.map((project) => [project.id, project]));
  const receipts = data.transactions.filter(
    (transaction) => transaction.transaction_type === "income" && transaction.receipt_number,
  );
  const selectedProject = selected?.project_id ? projects.get(selected.project_id) : undefined;
  const canRecordPayment =
    state.status === "signed-in" && (state.role === "CEO" || state.role === "FINANCE");

  const downloadReceipt = async (transaction: FinancialTransaction) => {
    const projectName = transaction.project_id
      ? (projects.get(transaction.project_id)?.name ?? "")
      : "";
    const filename = (transaction.receipt_number ?? transaction.transaction_ref).replace(
      /[^\w.-]/g,
      "_",
    );
    try {
      const pdf = await createReceiptPdf(transaction, projectName);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      toast.error(
        `Could not create receipt PDF: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const openReceiptForPrinting = (transaction: FinancialTransaction) => {
    const projectName = transaction.project_id
      ? (projects.get(transaction.project_id)?.name ?? "")
      : "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Allow pop-ups to open the receipt for printing, or download its PDF instead.");
      return;
    }
    printWindow.opener = null;
    void createReceiptPdf(transaction, projectName)
      .then((pdf) => {
        const pdfUrl = URL.createObjectURL(pdf.output("blob"));
        printWindow.location.href = pdfUrl;
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
      })
      .catch((error: unknown) => {
        printWindow.close();
        toast.error(
          `Could not open receipt for printing: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  };

  return (
    <>
      <PageHeader
        title="Receipts & Transactions"
        description="Record a payment to create its receipt, then download a PDF to print or share."
        actions={
          <>
            {canRecordPayment && (
              <Button asChild size="sm">
                <Link to="/analytics/finance">Record payment</Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "receipts.csv",
                  receipts.map((item) => ({
                    Receipt: item.receipt_number ?? "",
                    Date: item.transaction_date,
                    Client: item.party,
                    Project: item.project_id ? (projects.get(item.project_id)?.name ?? "") : "",
                    Amount: item.amount,
                    Method: item.method,
                    Reference: item.payment_reference ?? item.transaction_ref,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
          </>
        }
      />
      <div className="overflow-x-auto rounded-lg border bg-card shadow-soft">
        {receipts.length ? (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {["Receipt no.", "Date", "Client", "Project", "Payment reference", "Paid"].map(
                  (heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ),
                )}
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receipts.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-xs">{item.receipt_number}</td>
                  <td className="px-4 py-3">{item.transaction_date}</td>
                  <td className="px-4 py-3 font-medium">{item.party}</td>
                  <td className="px-4 py-3">
                    {item.project_id ? (projects.get(item.project_id)?.name ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.payment_reference ?? item.transaction_ref}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Download receipt ${item.receipt_number} as PDF`}
                        onClick={() => void downloadReceipt(item)}
                      >
                        <Download className="size-4" />
                        <span className="sr-only">Download PDF</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No payment receipts yet. Record income to create the first receipt.
          </p>
        )}
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          {receipts.length} receipt{receipts.length === 1 ? "" : "s"} · live Supabase data
        </p>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Receipt preview</DialogTitle>
          </DialogHeader>
          {selected && (
            <ReceiptDocument transaction={selected} projectName={selectedProject?.name ?? ""} />
          )}
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selected && openReceiptForPrinting(selected)}
            >
              <Printer className="size-4" /> Print
            </Button>
            <Button size="sm" onClick={() => selected && void downloadReceipt(selected)}>
              <Download className="size-4" /> Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
