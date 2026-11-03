import type { DocumentSignatory } from "@/lib/website-cms";

type DocumentSignatureSelectorProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  selection: string;
  onSelectionChange: (selection: string) => void;
  signatories: DocumentSignatory[];
  companySignatureAvailable: boolean;
  loading: boolean;
  error: string | null;
};

export function DocumentSignatureSelector({
  checked,
  onCheckedChange,
  selection,
  onSelectionChange,
  signatories,
  companySignatureAvailable,
  loading,
  error,
}: DocumentSignatureSelectorProps) {
  const hasOptions = companySignatureAvailable || signatories.length > 0;

  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[auto_1fr] sm:items-center">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={!hasOptions && !checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-1"
        />
        <span>Use digital signature</span>
      </label>
      <div className="grid gap-1.5">
        <label htmlFor="document-signatory" className="text-sm font-medium">
          Signature credentials
        </label>
        <select
          id="document-signatory"
          value={selection}
          disabled={!checked || loading}
          onChange={(event) => onSelectionChange(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Choose a signatory</option>
          {companySignatureAvailable && <option value="company">Company signature</option>}
          {signatories.map((signatory) => (
            <option key={signatory.user_id} value={signatory.user_id}>
              {signatory.full_name}
              {signatory.job_title ? ` · ${signatory.job_title}` : ""}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-xs text-destructive sm:col-span-2" role="alert">
          Could not load employee signatures: {error}
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground sm:col-span-2" role="status">
          Loading available signatories…
        </p>
      ) : !hasOptions ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Add an employee PNG signature in Team or upload the company signature in General Settings.
        </p>
      ) : null}
    </div>
  );
}
