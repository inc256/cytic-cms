import { useEffect, useState } from "react";

import { formatMoney } from "@/lib/format";
import { getDigitalSignatureUrl } from "@/lib/website-cms";
import {
  getDocumentBankDetails,
  getDocumentCompanyDetails,
  type DocumentSettings,
} from "@/lib/website-cms";

type DocumentLineItem = { description: string; amount: number };

type DocumentPreviewProps = {
  documentType: "Invoice" | "Quotation" | "Receipt";
  reference: string;
  client: string;
  title?: string;
  issueDate: string;
  issueDateLabel?: string;
  secondaryLabel: string;
  secondaryValue: string;
  items: DocumentLineItem[];
  total: number;
  notes?: string;
  termsConditions?: string;
  companySettings?: DocumentSettings;
  clientDetails?: { label: string; value: string }[];
  digitalSignaturePath?: string | null;
};

export function DocumentPreview({
  documentType,
  reference,
  client,
  title,
  issueDate,
  issueDateLabel = "Issue date",
  secondaryLabel,
  secondaryValue,
  items,
  total,
  notes,
  termsConditions,
  companySettings,
  clientDetails = [],
  digitalSignaturePath,
}: DocumentPreviewProps) {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const companyDetails = companySettings ? getDocumentCompanyDetails(companySettings) : [];
  const bankDetails =
    documentType === "Invoice" && companySettings ? getDocumentBankDetails(companySettings) : [];

  useEffect(() => {
    let active = true;
    setSignatureUrl(null);
    setSignatureError(null);
    if (digitalSignaturePath) {
      void getDigitalSignatureUrl(digitalSignaturePath)
        .then((url) => {
          if (active) setSignatureUrl(url);
        })
        .catch((cause: unknown) => {
          if (active) {
            setSignatureError(
              cause instanceof Error ? cause.message : "Could not load the digital signature.",
            );
          }
        });
    }
    return () => {
      active = false;
    };
  }, [digitalSignaturePath]);

  return (
    <article className="document-a4 relative isolate mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col overflow-hidden border bg-white text-[#1e2b3c] shadow-sm">
      <img
        src="/Logo_512p.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[58%] z-0 size-[112mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.045]"
      />
      <header className="relative z-10 flex min-h-[48mm] items-center justify-between gap-6 bg-[#0a2342] px-[9.5%] py-[12mm] text-white">
        <div>
          <p className="font-display text-3xl font-semibold uppercase tracking-wide">
            {documentType}
          </p>
          <p className="mt-2 text-sm text-[#b0c4de]">
            {issueDateLabel}: {issueDate || "—"}
          </p>
          <p className="mt-1 font-mono text-xs text-[#b0c4de]">{reference}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold leading-tight tracking-wide">
            CYTIC <span className="font-medium">Creatives.</span>
          </p>
          <p className="mt-1 text-[10px] tracking-wide text-[#b0c4de]">
            Identity that hits differently
          </p>
        </div>
      </header>
      <div className="relative z-10 flex flex-1 flex-col px-[9.5%] pb-10 pt-8">
        <div className="mb-8 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold text-[#0a2342]">To:</p>
            <p className="text-sm font-bold">{client || "Client name"}</p>
            {clientDetails.map((detail) => (
              <p
                key={detail.label}
                className="mt-1 break-words text-xs leading-relaxed text-[#4f6076]"
              >
                <span className="font-semibold">{detail.label}:</span> {detail.value}
              </p>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-[#0a2342]">CYTIC Details</p>
            <div className="grid gap-1 text-xs leading-relaxed text-[#4f6076]">
              {companyDetails.map((detail) => (
                <p key={detail.label} className="break-words">
                  <span className="font-semibold">{detail.label}:</span> {detail.value}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          {title && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#0a2342]">Title</p>
              <p className="mt-1 font-semibold">{title}</p>
            </div>
          )}
          {secondaryValue && (
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-[#0a2342]">
                {secondaryLabel}
              </p>
              <p className="mt-1 font-medium">{secondaryValue}</p>
            </div>
          )}
        </div>
        <div className="mb-5 overflow-hidden border border-[#0a2342]">
          <div className="grid grid-cols-[1fr_auto] bg-[#0a2342] text-xs font-bold uppercase tracking-wide text-white">
            <span className="px-4 py-3">Item description</span>
            <span className="px-4 py-3 text-right">Total (UGX)</span>
          </div>
          {items.length ? (
            items.map((item, index) => (
              <div
                key={`${item.description}-${index}`}
                className="document-item-row grid grid-cols-[1fr_auto] border-t border-[#d0d8e3] text-sm"
              >
                <span className="whitespace-pre-wrap px-4 py-4 font-medium text-[#0a2342]">
                  {item.description || "—"}
                </span>
                <span className="px-4 py-4 text-right font-semibold tabular-nums text-[#0a2342]">
                  {formatMoney(item.amount)}
                </span>
              </div>
            ))
          ) : (
            <p className="px-4 py-5 text-sm text-[#4f6076]">No line items added yet.</p>
          )}
        </div>
        <div className="mb-7 flex justify-end border-t border-[#0a2342] pt-4">
          <div className="flex w-full max-w-xs justify-between text-base font-bold text-[#0a2342]">
            <span>Total due</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>
        {notes && (
          <section className="document-document-section mb-7 rounded-r border-l-[3px] border-[#0a2342] bg-[#f7f9fc] px-4 py-3">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#0a2342]">Notes</h2>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#4f6076]">{notes}</p>
          </section>
        )}
        {(termsConditions || bankDetails.length > 0) && (
          <div className="document-document-section mb-6 grid gap-5 border-t border-[#0a2342] pt-4 sm:grid-cols-2">
            {termsConditions && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a2342]">
                  Terms &amp; Conditions
                </h2>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#4f6076]">
                  {termsConditions}
                </p>
              </section>
            )}
            {bankDetails.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a2342]">
                  Payment method
                </h2>
                <dl className="grid gap-y-1 text-xs">
                  {bankDetails.map((detail) => (
                    <div key={detail.label} className="flex gap-2">
                      <dt className="shrink-0 text-[#4f6076]">{detail.label}:</dt>
                      <dd className="min-w-0 break-words">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
        <section className="document-document-section mb-6 border-t border-[#d0d8e3] pt-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a2342]">
            Authorized signature
          </h2>
          {digitalSignaturePath ? (
            <>
              {signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt="Digital signature"
                  className="h-16 max-w-48 object-contain object-left"
                />
              ) : signatureError ? (
                <p role="alert" className="text-xs text-destructive">
                  Could not load digital signature: {signatureError}
                </p>
              ) : (
                <p role="status" className="text-xs text-[#4f6076]">
                  Loading digital signature…
                </p>
              )}
            </>
          ) : (
            <div className="mt-8 w-56 border-t border-[#4f6076] pt-1 text-[10px] text-[#4f6076]">
              Authorized signatory · Sign here
            </div>
          )}
        </section>
        <footer className="mt-auto border-t-2 border-[#c4a15a] pt-4 text-[10px] leading-relaxed text-[#4f6076]">
          <p className="font-bold uppercase tracking-wide text-[#0a2342]">CYTIC Creatives.</p>
        </footer>
      </div>
    </article>
  );
}
