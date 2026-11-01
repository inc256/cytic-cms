import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_INVOICE_BANK_SETTINGS,
  DEFAULT_WEBSITE_SETTINGS,
  getDigitalSignaturePath,
  getInvoiceBankSettings,
  getWebsiteSettings,
  type DocumentSettings,
} from "@/lib/website-cms";

export function useDocumentSettings(includeBankDetails = false) {
  const [settings, setSettings] = useState<DocumentSettings>({
    ...DEFAULT_WEBSITE_SETTINGS,
    ...DEFAULT_INVOICE_BANK_SETTINGS,
    digital_signature_path: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [websiteSettings, signaturePath, bankSettings] = await Promise.all([
        getWebsiteSettings(),
        getDigitalSignaturePath(),
        includeBankDetails
          ? getInvoiceBankSettings()
          : Promise.resolve(DEFAULT_INVOICE_BANK_SETTINGS),
      ]);
      setSettings({ ...websiteSettings, ...bankSettings, digital_signature_path: signaturePath });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load document settings.");
    } finally {
      setLoading(false);
    }
  }, [includeBankDetails]);

  useEffect(() => void refresh(), [refresh]);

  return { settings, error, loading, refresh };
}
