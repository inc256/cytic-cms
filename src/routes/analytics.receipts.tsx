import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/cms/primitives";
import { ResourceTable, type Column } from "@/components/cms/resource-table";
import { formatMoney, receipts } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/receipts")({
  head: () => meta("Receipts & Transactions", "Issue and review branded receipts for payments CYTIC has received."),
  component: Page,
});
type R = (typeof receipts)[number];
const cols: Column<R>[] = [
  { key: "no", label: "Receipt no.", className: "font-mono text-xs" },
  { key: "date", label: "Issued" },
  { key: "client", label: "Client", className: "font-medium" },
  { key: "project", label: "Project" },
  { key: "txn", label: "Transaction", className: "font-mono text-xs text-muted-foreground" },
  { key: "paid", label: "Paid", align: "right", render: (r) => formatMoney(r.paid) },
  { key: "total", label: "Balance", align: "right", render: (r) => r.total - r.paid ? formatMoney(r.total - r.paid) : <span className="text-success">Settled</span> },
];

function ReceiptDoc({ r }: { r: R }) {
  return (
    <div id="receipt" className="bg-card text-foreground">
      <div className="flex items-start justify-between bg-primary px-8 py-6 text-primary-foreground">
        <div>
          <p className="font-display text-xl font-semibold tracking-tight">CYTIC Creatives</p>
          <p className="mt-0.5 text-xs opacity-75">Identity that hits differently.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Payment receipt</p>
          <p className="mt-1 font-mono text-sm">{r.no}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 px-8 py-6 text-sm">
        <div><p className="text-xs text-muted-foreground">Received from</p><p className="mt-1 font-medium">{r.client}</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Date of issue</p><p className="mt-1 font-medium">{r.date}</p></div>
        <div><p className="text-xs text-muted-foreground">Project</p><p className="mt-1">{r.project}</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Payment method</p><p className="mt-1">{r.method}</p></div>
      </div>
      <div className="mx-8 border-y py-4 text-sm">
        <div className="flex justify-between py-1"><span className="text-muted-foreground">Project value</span><span className="tabular-nums">{formatMoney(r.total)}</span></div>
        <div className="flex justify-between py-1"><span className="text-muted-foreground">Outstanding balance</span><span className="tabular-nums">{formatMoney(r.total - r.paid)}</span></div>
      </div>
      <div className="flex items-end justify-between px-8 py-6">
        <div className="text-xs text-muted-foreground"><p>Issued by {r.issuedBy}</p><p>Ref. {r.txn}</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Amount paid</p><p className="font-display text-2xl font-semibold tabular-nums text-primary">{formatMoney(r.paid)}</p></div>
      </div>
      <div className="h-1 bg-gold" />
      <p className="px-8 py-3 text-[10px] text-muted-foreground">CYTIC Creatives · A Namielus Group Limited company · Kampala, Uganda. This receipt confirms payment received and is not an invoice.</p>
    </div>
  );
}

function Page() {
  const [sel, setSel] = useState<R | null>(null);
  return (
    <>
      <PageHeader title="Receipts & Transactions" description="Receipts can only be issued against payments recorded as received. Numbers are unique and history is preserved." />
      <ResourceTable entity="Receipt" rows={receipts} columns={cols} searchKeys={["no", "client", "project"]} onRowClick={setSel}
        rowActions={(r) => <DropdownMenuItem onClick={() => setSel(r)}>Preview & print</DropdownMenuItem>} />
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only"><DialogTitle>Receipt preview</DialogTitle></DialogHeader>
          {sel && <ReceiptDoc r={sel} />}
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-6 py-3">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Button size="sm" onClick={() => window.print()}><Download className="size-4" /> Download PDF</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
