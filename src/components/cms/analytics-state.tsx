import { Button } from "@/components/ui/button";
import { Panel } from "@/components/cms/primitives";

export function AnalyticsState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground" role="status">
          Loading live Supabase data...
        </p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Business data could not be loaded">
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Run the latest Supabase analytics migration and verify your account's role permissions.
        </p>
        <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </Panel>
    );
  }

  return null;
}
