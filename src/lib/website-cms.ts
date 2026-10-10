import { getSupabaseClient } from "@/lib/supabase";

export const PORTFOLIO_IMAGE_BUCKET = "portofio-images";
export const BLOG_IMAGE_BUCKET = "blog-images";

export type WebsiteService = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: "Draft" | "Published";
  sort_order: number;
  created_at: string;
};

export type PortfolioProject = {
  id: string;
  title: string;
  slug: string;
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

export async function saveWebsiteRow(table: string, values: Record<string, unknown>, id?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = id
    ? await supabase.from(table).update(values).eq("id", id).select().single()
    : await supabase.from(table).insert(values).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
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
