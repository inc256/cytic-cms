import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Panel } from "@/components/cms/primitives";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusinessAnalytics } from "@/hooks/use-business-analytics";
import {
  downloadCsv,
  getGoalActual,
  getProjectFinancials,
  type BusinessGoal,
} from "@/lib/business-analytics";
import { formatMoney } from "@/lib/format";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/analytics/goals")({
  head: () =>
    meta("Goals & Reports", "Set business targets and export financial reports from live data."),
  component: Page,
});

const metrics: { value: BusinessGoal["metric"]; label: string; unit: string }[] = [
  { value: "revenue", label: "Revenue (UGX)", unit: "UGX" },
  { value: "expenses", label: "Expenses (UGX)", unit: "UGX" },
  { value: "inquiries", label: "Quote requests", unit: "count" },
  { value: "projects_completed", label: "Completed projects", unit: "count" },
];

function Page() {
  const { data, error, loading, refresh } = useBusinessAnalytics();
  const { state } = useAuth();
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<BusinessGoal["metric"]>("revenue");
  const [editingGoal, setEditingGoal] = useState<BusinessGoal | null>(null);
  const canManage = state.status === "signed-in" && state.role === "CEO";

  if (loading || error || !data) {
    return (
      <>
        <PageHeader
          title="Goals & Reports"
          description="Targets are measured against saved records only."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      </>
    );
  }

  const saveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = Number(form.get("target"));
    if (!Number.isSafeInteger(target) || target <= 0) {
      toast.error("Enter a positive whole-number target.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const goal = {
      name: String(form.get("name")).trim(),
      metric,
      target,
      period_start: String(form.get("period_start")),
      period_end: String(form.get("period_end")),
    };
    const result = editingGoal
      ? await supabase.from("cms_business_goals").update(goal).eq("id", editingGoal.id)
      : await supabase.from("cms_business_goals").insert(goal);
    if (result.error) {
      toast.error(`Could not ${editingGoal ? "update" : "create"} goal: ${result.error.message}`);
      return;
    }
    toast.success(editingGoal ? "Goal updated" : "Goal saved");
    setOpen(false);
    setEditingGoal(null);
    await refresh();
  };

  const openGoal = (goal?: BusinessGoal) => {
    setEditingGoal(goal ?? null);
    setMetric(goal?.metric ?? "revenue");
    setOpen(true);
  };

  const deleteGoal = async (goal: BusinessGoal) => {
    if (!window.confirm(`Delete goal "${goal.name}"?`)) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const result = await supabase.from("cms_business_goals").delete().eq("id", goal.id);
    if (result.error) {
      toast.error(`Could not delete goal: ${result.error.message}`);
      return;
    }
    toast.success("Goal deleted");
    await refresh();
  };

  const reports = [
    {
      label: "Income statement",
      rows: data.transactions.map((item) => ({
        Date: item.transaction_date,
        Type: item.transaction_type,
        Party: item.party,
        Category: item.service_category ?? "",
        Amount: item.amount,
        Reference: item.transaction_ref,
      })),
    },
    {
      label: "Expense breakdown",
      rows: data.transactions
        .filter((item) => item.transaction_type === "expense")
        .map((item) => ({
          Date: item.transaction_date,
          Party: item.party,
          Category: item.service_category ?? "",
          Amount: item.amount,
          Reference: item.transaction_ref,
        })),
    },
    {
      label: "Receivables ageing",
      rows: getProjectFinancials(data)
        .filter((item) => item.outstanding > 0)
        .map((item) => ({
          Project: item.name,
          Client: item.client_name,
          Contract: item.contract_value,
          Received: item.received,
          Outstanding: item.outstanding,
        })),
    },
    {
      label: "Service revenue report",
      rows: data.transactions
        .filter((item) => item.transaction_type === "income" || item.transaction_type === "refund")
        .map((item) => ({
          Date: item.transaction_date,
          Service: item.service_category ?? "",
          Type: item.transaction_type,
          Amount: item.transaction_type === "refund" ? -Number(item.amount) : Number(item.amount),
        })),
    },
  ];

  const formatActual = (goal: BusinessGoal, value: number) =>
    goal.metric === "revenue" || goal.metric === "expenses" ? formatMoney(value) : String(value);

  return (
    <>
      <PageHeader
        title="Goals & Reports"
        description="Targets are compared with live transactions, quote requests, and completed projects."
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => openGoal()}>
                  <Plus className="size-4" /> New goal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingGoal ? "Edit goal" : "New goal"}</DialogTitle>
                </DialogHeader>
                <form
                  key={editingGoal?.id ?? "new"}
                  id="new-goal"
                  onSubmit={saveGoal}
                  className="grid gap-4"
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="goal-name">Goal name</Label>
                    <Input id="goal-name" name="name" defaultValue={editingGoal?.name} required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Measure</Label>
                    <Select
                      value={metric}
                      onValueChange={(value) => setMetric(value as BusinessGoal["metric"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {metrics.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="goal-target">Target</Label>
                    <Input
                      id="goal-target"
                      name="target"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={editingGoal?.target}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="goal-start">Period start</Label>
                      <Input
                        id="goal-start"
                        name="period_start"
                        type="date"
                        defaultValue={editingGoal?.period_start}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="goal-end">Period end</Label>
                      <Input
                        id="goal-end"
                        name="period_end"
                        type="date"
                        defaultValue={editingGoal?.period_end}
                        required
                      />
                    </div>
                  </div>
                </form>
                <DialogFooter>
                  <Button type="submit" form="new-goal">
                    {editingGoal ? "Save changes" : "Save goal"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      {data.goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.goals.map((goal) => {
            const actual = getGoalActual(goal, data);
            const pct = Math.min(100, Math.round((actual / Number(goal.target)) * 100));
            const unit = metrics.find((item) => item.value === goal.metric)?.unit;
            return (
              <Panel key={goal.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{goal.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {goal.period_start} – {goal.period_end}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
                    {canManage && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit goal ${goal.name}`}
                          onClick={() => openGoal(goal)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete goal ${goal.name}`}
                          onClick={() => void deleteGoal(goal)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <Progress value={pct} className="mt-4 h-2" />
                <dl className="mt-4 grid grid-cols-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Target</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {unit === "UGX" ? formatMoney(goal.target) : goal.target}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Actual</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatActual(goal, actual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {unit === "UGX"
                        ? formatMoney(Math.max(0, goal.target - actual))
                        : Math.max(0, goal.target - actual)}
                    </dd>
                  </div>
                </dl>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">No goals have been set yet.</p>
        </Panel>
      )}
      <Panel title="Reports" className="mt-6" flush>
        <ul className="divide-y">
          {reports.map((report) => (
            <li
              key={report.label}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <span>{report.label}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!report.rows.length}
                  onClick={() =>
                    downloadCsv(
                      `${report.label.toLowerCase().replaceAll(" ", "-")}.csv`,
                      report.rows,
                    )
                  }
                >
                  <FileDown className="size-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  PDF
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
