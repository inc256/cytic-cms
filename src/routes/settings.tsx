import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_INVOICE_BANK_SETTINGS,
  DEFAULT_WEBSITE_SETTINGS,
  getInvoiceBankSettings,
  getDigitalSignaturePath,
  getDigitalSignatureUrl,
  getWebsiteSettings,
  saveInvoiceBankSettings,
  saveDigitalSignaturePath,
  saveWebsiteSettings,
  uploadDigitalSignature,
  deleteDigitalSignature,
  type InvoiceBankSettings,
  type WebsiteSettings,
} from "@/lib/website-cms";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () =>
    meta("General Settings", "Manage shared company contact and invoice payment details."),
  component: Page,
});

type SaveState = "idle" | "saving" | "saved" | "error";

function Page() {
  const [company, setCompany] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [bank, setBank] = useState<InvoiceBankSettings>(DEFAULT_INVOICE_BANK_SETTINGS);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactSaveState, setContactSaveState] = useState<SaveState>("idle");
  const [bankSaveState, setBankSaveState] = useState<SaveState>("idle");
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [companySettings, bankSettings, savedSignaturePath] = await Promise.all([
        getWebsiteSettings(),
        getInvoiceBankSettings(),
        getDigitalSignaturePath(),
      ]);
      setCompany(companySettings);
      setBank(bankSettings);
      setSignaturePath(savedSignaturePath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load general settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => void load(), []);

  useEffect(() => {
    let active = true;
    setSignatureUrl(null);
    setSignatureError(null);
    if (signaturePath) {
      void getDigitalSignatureUrl(signaturePath)
        .then((url) => {
          if (active) setSignatureUrl(url);
        })
        .catch((cause: unknown) => {
          if (active) {
            setSignatureError(
              cause instanceof Error ? cause.message : "Could not load the saved signature.",
            );
          }
        });
    }
    return () => {
      active = false;
    };
  }, [signaturePath]);

  const saveContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactSaveState("saving");
    try {
      await saveWebsiteSettings(company);
      setContactSaveState("saved");
      toast.success("Shared company details saved");
    } catch (cause) {
      setContactSaveState("error");
      toast.error(
        `Could not save company details: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  const saveBank = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBankSaveState("saving");
    try {
      await saveInvoiceBankSettings(bank);
      setBankSaveState("saved");
      toast.success("Invoice bank details saved");
    } catch (cause) {
      setBankSaveState("error");
      toast.error(
        `Could not save bank details: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  };

  const saveSignature = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSignatureSaving(true);
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadDigitalSignature(file);
      const previousPath = signaturePath;
      await saveDigitalSignaturePath(uploadedPath);
      setSignaturePath(uploadedPath);
      toast.success("Digital signature saved");
      if (previousPath) {
        try {
          const removed = await deleteDigitalSignature(previousPath);
          if (!removed) {
            toast.info("The previous signature was retained because an existing document uses it.");
          }
        } catch (cause) {
          toast.error(
            `New signature was saved, but the previous file could not be removed: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
      }
    } catch (cause) {
      if (uploadedPath) {
        try {
          await deleteDigitalSignature(uploadedPath);
        } catch (cleanupError) {
          toast.error(
            `Could not save signature: ${cause instanceof Error ? cause.message : String(cause)}. Uploaded file cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
          setSignatureSaving(false);
          return;
        }
      }
      toast.error(
        `Could not save signature: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setSignatureSaving(false);
    }
  };

  const removeSignature = async () => {
    const path = signaturePath;
    if (!path) return;
    setSignatureSaving(true);
    try {
      await saveDigitalSignaturePath(null);
      setSignaturePath(null);
      try {
        const removed = await deleteDigitalSignature(path);
        toast.success(
          removed
            ? "Digital signature removed"
            : "Signature removed from settings; retained for existing documents.",
        );
      } catch (cause) {
        toast.error(
          `Signature setting was cleared, but its stored file could not be removed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    } catch (cause) {
      toast.error(
        `Could not remove signature setting: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setSignatureSaving(false);
    }
  };

  if (loading || error) {
    return (
      <>
        <PageHeader
          title="General Settings"
          description="Manage company details shared with the public landing page and CMS documents."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void load()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="General Settings"
        description="Company contact details are shared with the landing page and documents. Bank details are private and appear only on invoices."
      />
      <div className="grid gap-6">
        <Panel title="Shared company details">
          <form onSubmit={(event) => void saveContact(event)} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              These contact details are stored with public website settings for use by the landing
              page, quotations, and invoices.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="company-address">Address</Label>
                <Input
                  id="company-address"
                  value={company.address}
                  onChange={(event) => setCompany({ ...company, address: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company-phone">Telephone</Label>
                <Input
                  id="company-phone"
                  value={company.phone}
                  onChange={(event) => setCompany({ ...company, phone: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={company.public_email}
                  onChange={(event) => setCompany({ ...company, public_email: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company-website">Website</Label>
                <Input
                  id="company-website"
                  value={company.website}
                  onChange={(event) => setCompany({ ...company, website: event.target.value })}
                />
              </div>
              {(
                [
                  ["instagram", "Instagram"],
                  ["linkedin", "LinkedIn"],
                  ["tiktok", "TikTok"],
                  ["youtube", "YouTube"],
                  ["facebook", "Facebook"],
                  ["x", "X"],
                  ["whatsapp", "WhatsApp"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`company-${key}`}>{label} URL or handle</Label>
                  <Input
                    id={`company-${key}`}
                    value={company[key]}
                    onChange={(event) => setCompany({ ...company, [key]: event.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={contactSaveState === "saving"}>
                {contactSaveState === "saving" ? "Saving…" : "Save company details"}
              </Button>
              {contactSaveState === "saved" && (
                <p role="status" className="text-sm text-success">
                  Company details saved successfully.
                </p>
              )}
              {contactSaveState === "error" && (
                <p role="alert" className="text-sm text-destructive">
                  Company details could not be saved. Check the error notification and retry.
                </p>
              )}
            </div>
          </form>
        </Panel>
        <Panel title="Private invoice bank details">
          <form onSubmit={(event) => void saveBank(event)} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              These details are protected from public landing-page access and are included only on
              invoice documents.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input
                  id="bank-name"
                  value={bank.bank_name}
                  onChange={(event) => setBank({ ...bank, bank_name: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bank-account-name">Account name</Label>
                <Input
                  id="bank-account-name"
                  value={bank.bank_account_name}
                  onChange={(event) => setBank({ ...bank, bank_account_name: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bank-account-number">Account number</Label>
                <Input
                  id="bank-account-number"
                  value={bank.bank_account_number}
                  onChange={(event) =>
                    setBank({ ...bank, bank_account_number: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bank-swift">SWIFT code</Label>
                <Input
                  id="bank-swift"
                  value={bank.bank_swift}
                  onChange={(event) => setBank({ ...bank, bank_swift: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="bank-address">Bank address</Label>
                <Input
                  id="bank-address"
                  value={bank.bank_address}
                  onChange={(event) => setBank({ ...bank, bank_address: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2 border-t pt-4">
              <Label htmlFor="digital-signature">Optional digital signature (PNG, max 2 MB)</Label>
              <Input
                id="digital-signature"
                type="file"
                accept="image/png,.png"
                disabled={signatureSaving}
                onChange={(event) => void saveSignature(event)}
              />
              <p className="text-xs text-muted-foreground">
                Stored privately in the Supabase cytic_digital_signatures bucket. When configured,
                it can be selected for quotations and invoices.
              </p>
              {signatureUrl && (
                <img
                  src={signatureUrl}
                  alt="Saved digital signature"
                  className="h-16 max-w-48 object-contain object-left"
                />
              )}
              {signatureError && (
                <p role="alert" className="text-sm text-destructive">
                  Could not display signature: {signatureError}
                </p>
              )}
              {signaturePath && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  disabled={signatureSaving}
                  onClick={() => void removeSignature()}
                >
                  {signatureSaving ? "Saving…" : "Remove digital signature"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={bankSaveState === "saving"}>
                {bankSaveState === "saving" ? "Saving…" : "Save bank details"}
              </Button>
              {bankSaveState === "saved" && (
                <p role="status" className="text-sm text-success">
                  Bank details saved successfully.
                </p>
              )}
              {bankSaveState === "error" && (
                <p role="alert" className="text-sm text-destructive">
                  Bank details could not be saved. Check the error notification and retry.
                </p>
              )}
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
