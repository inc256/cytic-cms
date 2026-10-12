import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Stat, StatGrid } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import { downloadCsv, sumTransactions, type FinancialTransaction } from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/finance")({
  head: () =>
    meta("Income & Expenditure", "Record, search and export live income and expense transactions."),
  component: Page,
});

const categories = [
  "Digital Products",
  "Brand Identity",
  "UI/UX Design",
  "Merchandise",
  "Software",
  "Production",
  "Contractors",
  "Operations",
  "Marketing",
  "Other",
];
const methods = ["Bank transfer", "Mobile money", "Card", "Cash", "Other"];
const transactionTypes = ["income", "expense", "refund"] as const;
const defaultCategory = "Digital Products";
const defaultMethod = "Bank transfer";

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const { state } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof transactionTypes)[number]>("income");
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);

  if (loading || error || !data) {
    return (
      <>
        <PageHeader
          title="Income & Expenditure"
          description="Live income, refunds, and recorded expenses."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const canRecord =
    state.status === "signed-in" && (state.role === "CEO" || state.role === "FINANCE");
  const income = sumTransactions(data.transactions, "income");
  const refunds = sumTransactions(data.transactions, "refund");
  const expenses = sumTransactions(data.transactions, "expense");
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const rows = data.transactions.filter((transaction) => {
    const project = transaction.project_id
      ? (projectById.get(transaction.project_id)?.name ?? "")
      : "";
    return `${transaction.transaction_ref} ${transaction.party} ${project} ${transaction.description} ${transaction.service_category ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const selectedProjectId = String(form.get("project_id") ?? "none");
    const projectId = selectedProjectId === "none" ? "" : selectedProjectId;
    const selectedProject = projectById.get(projectId);
    const amount = Number(form.get("amount"));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      toast.error("Enter a positive whole-number amount.");
      return;
    }
    const transaction = {
      transaction_date: String(form.get("date")),
      party: String(form.get("party")).trim(),
      project_id: projectId || null,
      service_category:
        selectedProject?.service_category ??
        (String(form.get("category") ?? "") === "none"
          ? null
          : String(form.get("category") || "") || null),
      description: String(form.get("description") ?? "").trim(),
      amount,
      method: String(form.get("method")),
      payment_reference: String(form.get("payment_reference") ?? "").trim() || null,
    };
    const result = editingTransaction
      ? await supabase
          .from("cms_financial_transactions")
          .update(transaction)
          .eq("id", editingTransaction.id)
      : await supabase
          .from("cms_financial_transactions")
          .insert({ ...transaction, transaction_type: type });
    if (result.error) {
      toast.error(
        `Could not ${editingTransaction ? "update" : "save"} transaction: ${result.error.message}`,
      );
      return;
    }
    toast.success(
      editingTransaction
        ? "Transaction updated"
        : type === "income"
          ? "Payment saved and receipt number assigned"
          : "Transaction saved",
    );
    setOpen(false);
    setEditingTransaction(null);
    await refresh();
  };

  const editTransaction = (transaction: FinancialTransaction) => {
    setEditingTransaction(transaction);
    setType(transaction.transaction_type);
    setOpen(true);
  };

  const deleteTransaction = async (transaction: FinancialTransaction) => {
    if (!window.confirm(`Delete transaction ${transaction.transaction_ref}?`)) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase
      .from("cms_financial_transactions")
      .delete()
      .eq("id", transaction.id);
    if (result.error) {
      toast.error(`Could not delete transaction: ${result.error.message}`);
      return;
    }
    toast.success("Transaction deleted");
    await refresh();
  };

  return (
    <>
      <PageHeader
        title="Income & Expenditure"
        description="Live ledger. Refunds are recorded as separate entries and deducted from received income."
        actions={
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ledger"
              aria-label="Search financial transactions"
              className="h-9 w-48"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "financial-transactions.csv",
                  rows.map((item) => ({
                    Reference: item.transaction_ref,
                    Date: item.transaction_date,
                    Type: item.transaction_type,
                    Party: item.party,
                    Project: item.project_id ? (projectById.get(item.project_id)?.name ?? "") : "",
                    Category: item.service_category ?? "",
                    Amount: item.amount,
                    Method: item.method,
                    PaymentReference: item.payment_reference ?? "",
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
            {canRecord && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingTransaction(null);
                      setType("income");
                    }}
                  >
                    <Plus className="size-4" /> Record transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTransaction ? "Edit transaction" : "Record transaction"}
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    id="transaction-form"
                    key={editingTransaction?.id ?? "new"}
                    onSubmit={saveTransaction}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <div className="grid gap-1.5">
                      <Label>Type</Label>
                      <Select
                        value={type}
                        disabled={Boolean(editingTransaction)}
                        onValueChange={(value) =>
                          setType(value as (typeof transactionTypes)[number])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {transactionTypes.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="amount">Amount (UGX)</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={editingTransaction?.amount}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        name="date"
                        type="date"
                        defaultValue={
                          editingTransaction?.transaction_date ??
                          new Date().toISOString().slice(0, 10)
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="party">
                        {type === "expense" ? "Payee" : "Client / source"}
                      </Label>
                      <Input
                        id="party"
                        name="party"
                        defaultValue={editingTransaction?.party}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Project (optional)</Label>
                      <Select
                        name="project_id"
                        defaultValue={editingTransaction?.project_id ?? "none"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {data.projects
                            .filter(
                              (project) =>
                                project.status !== "Cancelled" ||
                                project.id === editingTransaction?.project_id,
                            )
                            .map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Category</Label>
                      <Select
                        name="category"
                        defaultValue={
                          editingTransaction
                            ? (editingTransaction.service_category ?? "none")
                            : defaultCategory
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {categories.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                          {editingTransaction?.service_category &&
                            !categories.includes(editingTransaction.service_category) && (
                              <SelectItem
                                value={editingTransaction.service_category}
                                key={editingTransaction.service_category}
                              >
                                {editingTransaction.service_category}
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment method</Label>
                      <Select
                        name="method"
                        defaultValue={editingTransaction?.method ?? defaultMethod}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {methods.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="payment-reference">Payment reference (optional)</Label>
                      <Input
                        id="payment-reference"
                        name="payment_reference"
                        defaultValue={editingTransaction?.payment_reference ?? ""}
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        name="description"
                        defaultValue={editingTransaction?.description}
                      />
                    </div>
                  </form>
                  <DialogFooter>
                    <Button type="submit" form="transaction-form">
                      {editingTransaction ? "Save changes" : "Save transaction"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />
      <StatGrid>
        <Stat label="Income received" value={formatMoney(income)} hint="Recorded payments" />
        <Stat
          label="Refunds & reversals"
          value={formatMoney(refunds)}
          hint="Deducted from net income"
        />
        <Stat label="Expenditure" value={formatMoney(expenses)} hint="Recorded expenses" />
        <Stat
          label="Net"
          value={formatMoney(income - refunds - expenses)}
          hint="Income − refunds − expenses"
        />
      </StatGrid>
      <p className="mt-3 text-xs text-muted-foreground">
        Income creates a numbered receipt. Record refunds as separate transactions; financial
        history is retained.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border bg-card shadow-soft">
        {rows.length ? (
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {[
                  "Reference",
                  "Date",
                  "Type",
                  "Client / payee",
                  "Project",
                  "Category",
                  "Method",
                  "Amount",
                  ...(canRecord ? ["Actions"] : []),
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-xs">{item.transaction_ref}</td>
                  <td className="px-4 py-3">{item.transaction_date}</td>
                  <td className="px-4 py-3 capitalize">{item.transaction_type}</td>
                  <td className="px-4 py-3 font-medium">{item.party}</td>
                  <td className="px-4 py-3">
                    {item.project_id ? (projectById.get(item.project_id)?.name ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3">{item.service_category ?? "—"}</td>
                  <td className="px-4 py-3">{item.method}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.amount)}</td>
                  <td className="px-4 py-3">
                    {canRecord &&
                      (item.invoice_id ? (
                        <span className="text-xs text-muted-foreground">Manage on invoice</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => editTransaction(item)}>
                            <Pencil className="size-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void deleteTransaction(item)}
                          >
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </div>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {query
              ? "No matching transactions."
              : "No financial transactions yet. Record the first payment or expense."}
          </p>
        )}
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          {rows.length} transaction{rows.length === 1 ? "" : "s"} · live Supabase data
        </p>
      </div>
    </>
  );
}
