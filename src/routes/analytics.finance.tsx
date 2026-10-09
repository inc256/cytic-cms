import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, Stat, StatGrid, StatusBadge } from "@/components/cms/primitives";
import { ResourceTable, type Column, type Field } from "@/components/cms/resource-table";
import { formatMoney, transactions, type Txn } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/finance")({
  head: () => meta("Income & Expenditure", "Record, search and export CYTIC's income and expense transactions."),
  component: Page,
});

const cols: Column<Txn>[] = [
  { key: "id", label: "Reference", className: "font-mono text-xs" },
  { key: "date", label: "Date" },
  { key: "party", label: "Client / payee", className: "font-medium" },
  { key: "category", label: "Category" },
  { key: "method", label: "Method" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount", align: "right", render: (r) => <span className={r.status === "refunded" ? "text-destructive" : ""}>{r.status === "refunded" ? "−" : ""}{formatMoney(r.amount)}</span> },
];
const methods = ["Bank transfer", "Mobile money", "Card", "Cash"];
const incomeFields: Field[] = [
  { key: "id", label: "Transaction reference", required: true },
  { key: "date", label: "Date received", type: "date", required: true },
  { key: "amount", label: "Amount (UGX)", type: "number", required: true },
  { key: "party", label: "Client or source", required: true },
  { key: "project", label: "Related project" },
  { key: "description", label: "Description" },
  { key: "category", label: "Category", type: "select", options: ["Digital Products", "Brand Identity", "UI/UX Design", "Merchandise"] },
  { key: "method", label: "Payment method", type: "select", options: methods },
  { key: "reference", label: "Payment reference" },
  { key: "status", label: "Status", type: "select", options: ["cleared", "partial", "refunded"] },
];
const expenseFields: Field[] = incomeFields.map((f) =>
  f.key === "party" ? { ...f, label: "Payee or supplier" } :
  f.key === "category" ? { ...f, label: "Expense category", options: ["Software", "Production", "Contractors", "Operations", "Marketing"] } :
  f.key === "date" ? { ...f, label: "Date" } : f);

function Page() {
  const [sel, setSel] = useState<Txn | null>(null);
  const inc = transactions.filter((t) => t.type === "income");
  const exp = transactions.filter((t) => t.type === "expense");
  const gross = inc.filter((t) => t.status !== "refunded").reduce((a, t) => a + t.amount, 0);
  const refunds = inc.filter((t) => t.status === "refunded").reduce((a, t) => a + t.amount, 0);
  const spent = exp.reduce((a, t) => a + t.amount, 0);
  return (
    <>
      <PageHeader title="Income & Expenditure" description="Every shilling in and out. Supports partial payments and multiple transactions per project." />
      <StatGrid>
        <Stat label="Gross income received" value={formatMoney(gross)} hint={`${inc.length} transactions`} />
        <Stat label="Refunds & reversals" value={formatMoney(refunds)} hint="Deducted from net income" />
        <Stat label="Expenditure" value={formatMoney(spent)} hint={`${exp.length} transactions`} />
        <Stat label="Net" value={formatMoney(gross - refunds - spent)} hint="Gross − refunds − expenses" />
      </StatGrid>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />Refunds and reversals are recorded as separate entries and subtract from totals; corrections edit the original entry and keep an audit trail.</p>
      <Tabs defaultValue="income" className="mt-6">
        <TabsList><TabsTrigger value="income">Income</TabsTrigger><TabsTrigger value="expense">Expenses</TabsTrigger></TabsList>
        <TabsContent value="income" className="mt-4"><ResourceTable entity="Income record" rows={inc} columns={cols} searchKeys={["id", "party", "project", "description"]} statusKey="status" fields={incomeFields} onRowClick={setSel} /></TabsContent>
        <TabsContent value="expense" className="mt-4"><ResourceTable entity="Expense" rows={exp} columns={cols} searchKeys={["id", "party", "description"]} statusKey="status" fields={expenseFields} onRowClick={setSel} /></TabsContent>
      </Tabs>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="sm:max-w-md">
          {sel && (<>
            <SheetHeader><SheetTitle className="font-mono text-base">{sel.id}</SheetTitle><SheetDescription>{sel.type === "income" ? "Income" : "Expense"} transaction</SheetDescription></SheetHeader>
            <div className="mt-6 px-4">
              <p className="font-display text-3xl font-semibold tabular-nums">{formatMoney(sel.amount)}</p>
              <div className="mt-2"><StatusBadge status={sel.status} /></div>
              <dl className="mt-6 divide-y border-y text-sm">
                {([["Date", sel.date], [sel.type === "income" ? "Client" : "Payee", sel.party], ["Project", sel.project], ["Description", sel.description], ["Category", sel.category], ["Method", sel.method], ["Payment reference", sel.reference]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
            </div>
          </>)}
        </SheetContent>
      </Sheet>
    </>
  );
}
