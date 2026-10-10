import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import {
  BLOG_IMAGE_BUCKET,
  deleteWebsiteImages,
  deleteWebsiteRow,
  getWebsiteImageUrl,
  saveWebsiteRow,
  slugify,
  uploadWebsiteImage,
  type BlogPost,
} from "@/lib/website-cms";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/blog")({
  head: () =>
    meta("Blog & Articles", "Write, schedule and publish articles with Supabase-hosted images."),
  component: Page,
});

const EMPTY_FORM = {
  title: "",
  slug: "",
  category: "",
  author: "",
  excerpt: "",
  body: "",
  status: "Draft",
  publish_date: "",
};

function Page() {
  const { rows: posts, loading, error, refresh } = useWebsiteRows<BlogPost>("cms_blog_posts");
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditing(null);
    setImagePath(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const startEdit = (post: BlogPost) => {
    setEditing(post);
    setImagePath(post.image_path);
    setForm({
      title: post.title,
      slug: post.slug,
      category: post.category,
      author: post.author,
      excerpt: post.excerpt,
      body: post.body,
      status: post.status,
      publish_date: post.publish_date ?? "",
    });
    setOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Article title is required.");
      return;
    }
    const file = new FormData(event.currentTarget).get("image");
    const imageFile = file instanceof File && file.size ? file : null;
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (imageFile) uploaded = await uploadWebsiteImage(BLOG_IMAGE_BUCKET, imageFile);
      const slug = slugify(form.slug || form.title);
      if (!slug) throw new Error("Add a title that can be used as a URL slug.");
      await saveWebsiteRow(
        "cms_blog_posts",
        {
          title: form.title.trim(),
          slug,
          category: form.category.trim(),
          author: form.author.trim(),
          excerpt: form.excerpt.trim(),
          body: form.body.trim(),
          image_path: uploaded ?? imagePath,
          status: form.status,
          publish_date: form.publish_date || null,
        },
        editing?.id,
      );
      if (editing?.image_path && editing.image_path !== imagePath && !uploaded) {
        try {
          await deleteWebsiteImages(BLOG_IMAGE_BUCKET, [editing.image_path]);
        } catch (cleanupError) {
          toast.error(
            `Article saved, but the removed image could not be deleted: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      } else if (editing?.image_path && uploaded) {
        try {
          await deleteWebsiteImages(BLOG_IMAGE_BUCKET, [editing.image_path]);
        } catch (cleanupError) {
          toast.error(
            `Article saved, but its previous image could not be deleted: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      toast.success(editing ? "Article updated" : "Article created");
      setOpen(false);
      await refresh();
    } catch (saveError) {
      if (uploaded) {
        try {
          await deleteWebsiteImages(BLOG_IMAGE_BUCKET, [uploaded]);
        } catch (cleanupError) {
          toast.error(
            `Uploaded image could not be cleaned up: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      toast.error(
        `Could not save article: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: BlogPost) => {
    try {
      await deleteWebsiteRow("cms_blog_posts", post.id);
      if (post.image_path) {
        try {
          await deleteWebsiteImages(BLOG_IMAGE_BUCKET, [post.image_path]);
        } catch (cleanupError) {
          toast.error(
            `Article deleted, but its image could not be removed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      toast.success("Article deleted");
      await refresh();
    } catch (removeError) {
      toast.error(
        `Could not delete article: ${removeError instanceof Error ? removeError.message : String(removeError)}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Blog & Articles"
        description="Create and publish articles. Optional cover images are saved in the blog-images bucket."
        actions={
          <Button size="sm" onClick={startNew}>
            <Plus className="size-4" /> New article
          </Button>
        }
      />
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading &&
        !error &&
        (posts.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-lg border bg-card shadow-soft"
              >
                {post.image_path ? (
                  <img
                    src={getWebsiteImageUrl(BLOG_IMAGE_BUCKET, post.image_path)}
                    alt={post.title}
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[16/10] place-items-center bg-muted text-sm text-muted-foreground">
                    No cover image
                  </div>
                )}
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold">{post.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {post.category} · {post.author || "No author"}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">{post.status}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  <p className="text-xs text-muted-foreground">
                    /{post.slug}
                    {post.publish_date ? ` · ${post.publish_date}` : ""}
                  </p>
                  <div className="flex justify-end gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => startEdit(post)}>
                      <Pencil className="size-4" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void remove(post)}>
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No articles yet. Create a draft, add an optional cover image, and publish when ready.
          </p>
        ))}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="presentation"
        >
          <form
            onSubmit={(event) => void save(event)}
            className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-background p-6 shadow-xl"
            aria-label={editing ? "Edit article" : "New article"}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {editing ? "Edit article" : "New article"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="blog-title">Title *</Label>
                <Input
                  id="blog-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blog-slug">URL slug</Label>
                <Input
                  id="blog-slug"
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: event.target.value })}
                  placeholder={slugify(form.title)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blog-category">Category</Label>
                <Input
                  id="blog-category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blog-author">Author</Label>
                <Input
                  id="blog-author"
                  value={form.author}
                  onChange={(event) => setForm({ ...form, author: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blog-status">Status</Label>
                <select
                  id="blog-status"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  {["Draft", "Scheduled", "Published"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blog-date">Publish date</Label>
                <Input
                  id="blog-date"
                  type="date"
                  value={form.publish_date}
                  onChange={(event) => setForm({ ...form, publish_date: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="blog-excerpt">Excerpt</Label>
                <Textarea
                  id="blog-excerpt"
                  rows={2}
                  value={form.excerpt}
                  onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="blog-body">Article content</Label>
                <Textarea
                  id="blog-body"
                  rows={9}
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="blog-image">
                  Cover image (JPEG, PNG, WebP or GIF; up to 10 MB)
                </Label>
                <Input
                  id="blog-image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                />
              </div>
            </div>
            {imagePath && (
              <div className="relative w-40">
                <img
                  src={getWebsiteImageUrl(BLOG_IMAGE_BUCKET, imagePath)}
                  alt="Article cover"
                  className="aspect-video w-full rounded-md object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-background p-1"
                  onClick={() => setImagePath(null)}
                  aria-label="Remove cover image"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <ImagePlus className="size-4" /> {saving ? "Saving…" : "Save article"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
