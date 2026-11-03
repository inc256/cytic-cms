import { getSupabaseClient } from "@/lib/supabase";

export const PORTFOLIO_IMAGE_BUCKET = "portofio-images";
export const BLOG_IMAGE_BUCKET = "blog-images";
export const DIGITAL_SIGNATURE_BUCKET = "cytic_digital_signatures";

export type WebsiteService = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string;
  status: "Draft" | "Published";
  sort_order: number;
  created_at: string;
};

export type PortfolioProject = {
  id: string;
  title: string;
  slug: string;
  project_url: string | null;
  service: string;
  year: number;
  summary: string;
  description: string;
  image_paths: string[];
  featured: boolean;
  status: "Draft" | "In review" | "Published";
  created_at: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  excerpt: string;
  body: string;
  image_path: string | null;
  status: "Draft" | "Scheduled" | "Published";
  publish_date: string | null;
  created_at: string;
};

export type WebsiteSettings = {
  address: string;
  phone: string;
  public_email: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
  facebook: string;
  x: string;
  whatsapp: string;
  website: string;
  show_quote: boolean;
  maintenance_mode: boolean;
};

export type InvoiceBankSettings = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_swift: string;
  bank_address: string;
};

export type DocumentSettings = WebsiteSettings &
  InvoiceBankSettings & { digital_signature_path: string | null };

export type DocumentSignatory = {
  user_id: string;
  full_name: string;
  job_title: string;
  digital_signature_path: string;
};

export type SavedDocumentSignature = {
  path: string | null;
  userId: string | null;
  name: string | null;
};

export function resolveDocumentSignature(
  enabled: boolean,
  selection: string,
  companySignaturePath: string | null,
  signatories: DocumentSignatory[],
): SavedDocumentSignature {
  if (!enabled) return { path: null, userId: null, name: null };
  if (selection === "company" && companySignaturePath) {
    return { path: companySignaturePath, userId: null, name: "CYTIC Creatives." };
  }
  const signatory = signatories.find((candidate) => candidate.user_id === selection);
  if (!signatory) throw new Error("Choose a signatory with a saved digital signature.");
  return {
    path: signatory.digital_signature_path,
    userId: signatory.user_id,
    name: signatory.full_name,
  };
}

export type QuotationAnalyticsRow = {
  id: string;
  proposal_code: string;
  status: "Draft" | "Sent" | "Accepted" | "Declined";
  value: number;
};

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  address: "",
  phone: "",
  public_email: "",
  instagram: "",
  linkedin: "",
  tiktok: "",
  youtube: "",
  facebook: "",
  x: "",
  whatsapp: "",
  website: "",
  show_quote: true,
  maintenance_mode: false,
};

export const DEFAULT_INVOICE_BANK_SETTINGS: InvoiceBankSettings = {
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_swift: "",
  bank_address: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeWebsiteSettings(value: unknown): WebsiteSettings {
  const record = isRecord(value) ? value : {};
  const stringValue = (key: Exclude<keyof WebsiteSettings, "show_quote" | "maintenance_mode">) =>
    typeof record[key] === "string" ? record[key] : "";
  const booleanValue = (key: "show_quote" | "maintenance_mode") =>
    typeof record[key] === "boolean" ? record[key] : DEFAULT_WEBSITE_SETTINGS[key];
  return {
    address: stringValue("address"),
    phone: stringValue("phone"),
    public_email: stringValue("public_email"),
    instagram: stringValue("instagram"),
    linkedin: stringValue("linkedin"),
    tiktok: stringValue("tiktok"),
    youtube: stringValue("youtube"),
    facebook: stringValue("facebook"),
    x: stringValue("x"),
    whatsapp: stringValue("whatsapp"),
    website: stringValue("website"),
    show_quote: booleanValue("show_quote"),
    maintenance_mode: booleanValue("maintenance_mode"),
  };
}

export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase
    .from("cms_website_settings")
    .select("settings")
    .eq("id", true)
    .single();
  if (result.error) throw new Error(result.error.message);
  return normalizeWebsiteSettings(result.data.settings);
}

export async function saveWebsiteSettings(settings: WebsiteSettings): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const current = await supabase
    .from("cms_website_settings")
    .select("settings")
    .eq("id", true)
    .single();
  if (current.error) throw new Error(current.error.message);
  const existingSettings = isRecord(current.data.settings) ? current.data.settings : {};
  const result = await supabase.from("cms_website_settings").upsert({
    id: true,
    settings: { ...existingSettings, ...settings },
    updated_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(result.error.message);
}

export async function getInvoiceBankSettings(): Promise<InvoiceBankSettings> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase
    .from("cms_document_settings")
    .select("bank_name,bank_account_name,bank_account_number,bank_swift,bank_address")
    .eq("id", true)
    .single();
  if (result.error) throw new Error(result.error.message);
  return {
    bank_name: result.data.bank_name ?? "",
    bank_account_name: result.data.bank_account_name ?? "",
    bank_account_number: result.data.bank_account_number ?? "",
    bank_swift: result.data.bank_swift ?? "",
    bank_address: result.data.bank_address ?? "",
  };
}

export async function saveInvoiceBankSettings(settings: InvoiceBankSettings): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.from("cms_document_settings").upsert({
    id: true,
    ...settings,
    updated_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(result.error.message);
}

export async function getDigitalSignaturePath(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.rpc("get_cms_digital_signature_path");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? null;
}

export async function saveDigitalSignaturePath(path: string | null): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase
    .from("cms_document_settings")
    .update({ digital_signature_path: path, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (result.error) throw new Error(result.error.message);
}

export async function uploadDigitalSignature(file: File): Promise<string> {
  if (file.type !== "image/png" || !file.name.toLowerCase().endsWith(".png")) {
    throw new Error("Choose a PNG image for the digital signature.");
  }
  if (file.size === 0 || file.size > 2 * 1024 * 1024) {
    throw new Error("The signature image must be smaller than 2 MB.");
  }
  const pngHeader = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if ([137, 80, 78, 71, 13, 10, 26, 10].some((byte, index) => pngHeader[index] !== byte)) {
    throw new Error("The selected file is not a valid PNG image.");
  }
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `signatures/${crypto.randomUUID()}.png`;
  const result = await supabase.storage
    .from(DIGITAL_SIGNATURE_BUCKET)
    .upload(path, file, { contentType: "image/png", upsert: false });
  if (result.error) throw new Error(result.error.message);
  return path;
}

export async function getDocumentSignatories(): Promise<DocumentSignatory[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.rpc("get_cms_document_signatories");
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as DocumentSignatory[];
}

export async function deleteDigitalSignature(path: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const [settingsResult, invoiceResult, proposalResult, receiptResult, teamResult] =
    await Promise.all([
      supabase
        .from("cms_document_settings")
        .select("id", { count: "exact", head: true })
        .eq("digital_signature_path", path),
      supabase
        .from("cms_invoices")
        .select("id", { count: "exact", head: true })
        .eq("digital_signature_path", path),
      supabase
        .from("cms_proposals")
        .select("id", { count: "exact", head: true })
        .eq("digital_signature_path", path),
      supabase
        .from("cms_receipts")
        .select("id", { count: "exact", head: true })
        .eq("digital_signature_path", path),
      supabase
        .from("cms_team_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("digital_signature_path", path),
    ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (proposalResult.error) throw new Error(proposalResult.error.message);
  if (receiptResult.error) throw new Error(receiptResult.error.message);
  if (teamResult.error) throw new Error(teamResult.error.message);
  if (
    settingsResult.count ||
    invoiceResult.count ||
    proposalResult.count ||
    receiptResult.count ||
    teamResult.count
  )
    return false;
  const result = await supabase.storage.from(DIGITAL_SIGNATURE_BUCKET).remove([path]);
  if (result.error) throw new Error(result.error.message);
  return true;
}

export async function getDigitalSignatureUrl(path: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.storage
    .from(DIGITAL_SIGNATURE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (result.error) throw new Error(result.error.message);
  return result.data.signedUrl;
}

export async function getDigitalSignatureDataUrl(path: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.storage.from(DIGITAL_SIGNATURE_BUCKET).download(path);
  if (result.error) throw new Error(result.error.message);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the PNG signature."));
    };
    reader.onerror = () => reject(new Error("Could not read the PNG signature."));
    reader.readAsDataURL(result.data);
  });
}

export type DocumentSocial = { platforms: string[]; username: string };

export function groupDocumentSocials(settings: WebsiteSettings): DocumentSocial[] {
  const socialFields = [
    ["Instagram", settings.instagram],
    ["LinkedIn", settings.linkedin],
    ["TikTok", settings.tiktok],
    ["YouTube", settings.youtube],
    ["Facebook", settings.facebook],
    ["X", settings.x],
    ["WhatsApp", settings.whatsapp],
  ] as const;
  const groups = new Map<string, DocumentSocial>();

  for (const [platform, rawValue] of socialFields) {
    const value = rawValue.trim();
    if (!value) continue;
    let username = value;
    try {
      const urlValue = value.startsWith("@")
        ? `https://social.invalid/${value}`
        : /^https?:\/\//i.test(value)
          ? value
          : /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\//i.test(value)
            ? `https://${value}`
            : null;
      if (urlValue) {
        const url = new URL(urlValue);
        const pathSegments = url.pathname.split("/").filter(Boolean);
        username =
          pathSegments.find((segment) => segment.startsWith("@")) ??
          pathSegments.at(-1) ??
          url.searchParams.get("id") ??
          value;
      }
    } catch {
      username = value;
    }
    username = username.replace(/^@/, "").trim();
    if (!username) continue;

    const key = username.toLocaleLowerCase();
    const existing = groups.get(key);
    if (existing) existing.platforms.push(platform);
    else groups.set(key, { platforms: [platform], username });
  }

  return Array.from(groups.values());
}

export function getDocumentCompanyDetails(settings: WebsiteSettings) {
  const details = [
    { label: "Address", value: settings.address.trim() },
    { label: "Tel", value: settings.phone.trim() },
    { label: "Email", value: settings.public_email.trim() },
    { label: "Website", value: settings.website.trim() },
    ...groupDocumentSocials(settings).map((social) => ({
      label: social.platforms.join(" · "),
      value:
        social.platforms.includes("WhatsApp") && /^[+\d ()-]+$/.test(social.username)
          ? social.username
          : `@${social.username}`,
    })),
  ];
  return details.filter((detail) => detail.value);
}

export function getDocumentBankDetails(settings: InvoiceBankSettings) {
  return [
    { label: "Bank name", value: settings.bank_name.trim() },
    { label: "Account name", value: settings.bank_account_name.trim() },
    { label: "Account number", value: settings.bank_account_number.trim() },
    { label: "SWIFT", value: settings.bank_swift.trim() },
    { label: "Bank address", value: settings.bank_address.trim() },
  ].filter((detail) => detail.value);
}

export async function saveWebsiteRow(table: string, values: Record<string, unknown>, id?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = id
    ? await supabase.from(table).update(values).eq("id", id).select().single()
    : await supabase.from(table).insert(values).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function getQuotationAnalytics(): Promise<QuotationAnalyticsRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase
    .from("cms_proposals")
    .select("id,proposal_code,status,value")
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as QuotationAnalyticsRow[];
}

export async function deleteWebsiteRow(table: string, id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.from(table).delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function uploadWebsiteImage(bucket: string, file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Sign in before uploading images.");

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "img";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const result = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (result.error) throw new Error(result.error.message);
  return path;
}

export async function deleteWebsiteImages(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.storage.from(bucket).remove(paths);
  if (result.error) throw new Error(result.error.message);
}

export function getWebsiteImageUrl(bucket: string, path: string): string {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
