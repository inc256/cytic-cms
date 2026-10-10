import { useCallback, useEffect, useState } from "react";

import { fetchBusinessAnalytics, type AnalyticsData } from "@/lib/business-analytics";

export function useBusinessAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBusinessAnalytics());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load business analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
