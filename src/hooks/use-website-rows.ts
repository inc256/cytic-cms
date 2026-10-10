import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";

export type WebsiteRow = Record<string, unknown> & { id: string };

export function useWebsiteRows<T extends WebsiteRow>(table: string, orderBy = "created_at") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await supabase
      .from(table)
      .select("*")
      .order(orderBy, {
        ascending: orderBy === "sort_order",
      });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setRows((result.data ?? []) as T[]);
    setError(null);
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}
