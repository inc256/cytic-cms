import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: {
  title: string; description?: string; actions?: ReactNode; eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-gold-foreground">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold text-foreground md:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, flush }: {
  title?: string | undefined; description?: string | undefined; actions?: ReactNode; children: ReactNode; className?: string | undefined; flush?: boolean | undefined;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-soft", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h2 className="font-sans text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, delta, hint }: { label: string; value: string; delta?: number; hint?: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums text-foreground md:text-2xl">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {delta !== undefined ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(delta)}%
          </span>
        ) : null}
        <span className="text-muted-foreground">{hint ?? (delta !== undefined ? "vs previous period" : "")}</span>
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border shadow-soft sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

const STATUS: Record<string, "success" | "warning" | "info" | "danger" | "brand" | "neutral"> = {
  Published: "success", Active: "success", Cleared: "success", cleared: "success", Accepted: "success", Won: "success",
  Paid: "success",
  Draft: "neutral", Invited: "warning", partial: "warning", "In review": "warning", Scheduled: "info", Sent: "info",
  New: "brand", Contacted: "info", Qualified: "warning", "Proposal sent": "info",
  Lost: "danger", Declined: "danger", refunded: "danger",
  Overdue: "danger",
  Inactive: "neutral",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS[status] ?? "neutral"} className="capitalize">{status}</Badge>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-primary-subtle text-primary"><Inbox className="size-5" /></div>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = ["This week", "This month", "This quarter", "This year"];
  return (
    <div role="tablist" aria-label="Reporting period" className="inline-flex rounded-md border bg-card p-0.5">
      {opts.map((o) => (
        <button key={o} role="tab" aria-selected={value === o} onClick={() => onChange(o)}
          className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {o.replace("This ", "")}
        </button>
      ))}
    </div>
  );
}
