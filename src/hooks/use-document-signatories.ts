import { useEffect, useState } from "react";

import { getDocumentSignatories, type DocumentSignatory } from "@/lib/website-cms";

export function useDocumentSignatories() {
  const [signatories, setSignatories] = useState<DocumentSignatory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getDocumentSignatories()
      .then((result) => {
        if (active) setSignatories(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to load document signatories.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { signatories, error, loading };
}
