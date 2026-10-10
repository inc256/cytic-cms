import { getSupabaseClient } from "@/lib/supabase";

export const WORKSPACE_BUCKET = "designer-workspace";
export const WORKSPACE_TYPES = [
  "guideline",
  "procedure",
  "policy",
  "checklist",
  "learning",
  "resource",
  "notice",
] as const;

export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];
export const WORKSPACE_STATUSES = ["Draft", "In review", "Published", "Archived"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];
export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === "string" && WORKSPACE_STATUSES.some((status) => status === value);
}
export type WorkspaceCategory = {
  id: string;
  name: string;
  workspace_type: WorkspaceType;
  description: string;
  sort_order: number;
};
export type WorkspaceDocument = {
  id: string;
  workspace_type: Exclude<WorkspaceType, "resource" | "notice">;
  category_id: string | null;
  title: string;
  summary: string;
  content: string;
  objectives: string[];
  attachment_paths: string[];
  external_url: string | null;
  status: WorkspaceStatus;
  version: number;
  mandatory_reading: boolean;
  require_renewed_acknowledgement: boolean;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type WorkspaceResource = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  resource_type: string;
  preview_path: string | null;
  file_path: string | null;
  external_url: string | null;
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
};
export type WorkspaceNotice = {
  id: string;
  title: string;
  message: string;
  attachment_path: string | null;
  priority: "Low" | "Normal" | "High" | "Urgent";
  published_at: string | null;
  expires_at: string | null;
  show_after_expiry: boolean;
  pinned: boolean;
  audience_roles: string[];
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
};
export type WorkspaceAcknowledgement = {
  document_id: string;
  document_version: number;
  user_id: string;
  acknowledged_at: string;
};

export async function saveWorkspaceRow(
  table: string,
  values: Record<string, unknown>,
  id?: string,
) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = id
    ? await supabase.from(table).update(values).eq("id", id).select().single()
    : await supabase.from(table).insert(values).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function deleteWorkspaceRow(table: string, id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.from(table).delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export async function uploadWorkspaceFile(file: File) {
  if (!allowedMimeTypes.has(file.type)) throw new Error("This file type is not allowed.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Files must be 20 MB or smaller.");
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Sign in before uploading files.");
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const result = await supabase.storage.from(WORKSPACE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (result.error) throw new Error(result.error.message);
  return path;
}

export async function removeWorkspaceFiles(paths: string[]) {
  if (!paths.length) return;
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.storage.from(WORKSPACE_BUCKET).remove(paths);
  if (result.error) throw new Error(result.error.message);
}

export async function getWorkspaceFileUrl(path: string, download = false) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.storage.from(WORKSPACE_BUCKET).createSignedUrl(path, 300, {
    download,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data.signedUrl;
}

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
