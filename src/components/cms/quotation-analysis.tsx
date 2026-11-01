import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { Panel, Stat, StatGrid } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { canAccessPath } from "@/lib/cms-access";
import { formatMoney } from "@/lib/format";
import { getQuotationAnalytics, type QuotationAnalyticsRow } from "@/lib/website-cms";

export function QuotationAnalysis() {
  const { state } = useAuth();
  const [rows, setRows] = useState<QuotationAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canReadQuotations =
    state.status === "signed-in" &&
    ["CEO", "FINANCE", "PARTNER", "SECRETARY", "CONTENT EDITOR"].includes(state.role);
  const canViewProposals =
    state.status === "signed-in" && canAccessPath(state.role, "/website/proposals");

  useEffect(() => {
    if (!canReadQuotations) {
      setLoading(false);
      return;
    }
    let active = true;
    void getQuotationAnalytics()
      .then((result) => {
        if (active) {
          setRows(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load quotation analytics.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canReadQuotations]);

  const pipeline = rows.filter((row) => row.status === "Draft" || row.status === "Sent");
  const accepted = rows.filter((row) => row.status === "Accepted");
  const decided = rows.filter((row) => row.status === "Accepted" || row.status === "Declined");
  const acceptanceRate = decided.length ? Math.round((accepted.length / decided.length) * 100) : 0;

  if (!canReadQuotations) return null;

  return (
    <Panel
      title="Quotation analysis"
      description="Quotation activity and value are tracked separately from recognized income."
      actions={
        canViewProposals ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/website/proposals">View quotations</Link>
          </Button>
        ) : undefined
      }
    >
      {loading || error ? (
        <AnalyticsState
          loading={loading}
          error={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            void getQuotationAnalytics()
              .then(setRows)
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : "Could not load quotation analytics.",
                ),
              )
              .finally(() => setLoading(false));
          }}
        />
      ) : (
        <>
          <StatGrid>
            <Stat label="Total quotations" value={String(rows.length)} />
            <Stat
              label="Open pipeline"
              value={formatMoney(pipeline.reduce((sum, row) => sum + Number(row.value), 0))}
              hint={`${pipeline.length} draft or sent`}
            />
            <Stat
              label="Accepted value"
              value={formatMoney(accepted.reduce((sum, row) => sum + Number(row.value), 0))}
              hint={`${accepted.length} accepted`}
            />
            <Stat label="Decision acceptance" value={`${acceptanceRate}%`} />
          </StatGrid>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(["Draft", "Sent", "Accepted", "Declined"] as const).map((status) => {
              const count = rows.filter((row) => row.status === status).length;
              return (
                <div key={status} className="rounded-md border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">{status}</p>
                  <p className="mt-1 font-semibold tabular-nums">{count}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
